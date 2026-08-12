const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const router = express.Router();
const { passport, oauthProvidersEnabled, findOrCreateOAuthPlayer } = require('../oauth/passportConfig');
const { generateAccessToken, generateRefreshToken } = require('../jwt/index');
const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

const { get } = require('../../constants/env');
const { notifyLogin } = require('../services/notifications');
const FRONTEND_URL = get('FRONTEND_URL') || 'http://localhost:3000';
const SERVER_URL   = get('SERVER_URL')   || 'http://localhost:8080';
const MOBILE_DEEP_LINK = get('MOBILE_OAUTH_CALLBACK') || 'stage://auth/callback';

// Survives the Google/Microsoft/Twitch round-trip better than cookies.
// state → 'mobile' | 'web'
const oauthClientByState = new Map();
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

function pruneOAuthClientStates() {
  const cutoff = Date.now() - OAUTH_STATE_TTL_MS;
  for (const [state, entry] of oauthClientByState) {
    if ((entry?.createdAt || 0) < cutoff) oauthClientByState.delete(state);
  }
}

function createOAuthState(isMobile, redirectUri = null) {
  pruneOAuthClientStates();
  const nonce = crypto.randomBytes(16).toString('hex');
  const state = `${isMobile ? 'stage_mobile' : 'stage_web'}_${nonce}`;
  oauthClientByState.set(state, {
    client: isMobile ? 'mobile' : 'web',
    redirectUri: isMobile ? sanitizeMobileRedirectUri(redirectUri) : null,
    createdAt: Date.now(),
  });
  return state;
}

function sanitizeMobileRedirectUri(value) {
  const fallback = MOBILE_DEEP_LINK;
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  try {
    const url = new URL(raw);
    // App scheme (standalone / custom builds)
    if (url.protocol === 'stage:' && url.hostname === 'auth' && url.pathname.replace(/^\//, '') === 'callback') {
      return 'stage://auth/callback';
    }
    if (url.protocol === 'stage:' && (url.pathname === '/auth/callback' || raw.startsWith('stage://auth/callback'))) {
      return 'stage://auth/callback';
    }
    // Expo Go: exp://127.0.0.1:8081/--/auth/callback
    if (url.protocol === 'exp:' && /auth\/callback/i.test(url.pathname + url.hash)) {
      return `${url.protocol}//${url.host}${url.pathname}`;
    }
    // Explicit deep-link form without URL parsing quirks
    if (raw === 'stage://auth/callback' || raw.startsWith('stage://auth/callback?')) {
      return 'stage://auth/callback';
    }
  } catch {
    if (raw === 'stage://auth/callback' || raw.startsWith('stage://auth/callback')) {
      return 'stage://auth/callback';
    }
  }
  return fallback;
}

function peekMobileRedirectUri(req, player) {
  const state = String(req?.query?.state || '');
  const mapped = state ? oauthClientByState.get(state) : null;
  if (mapped?.redirectUri) return mapped.redirectUri;
  if (player?.__mobileRedirectUri) return player.__mobileRedirectUri;
  const fromQuery = sanitizeMobileRedirectUri(req?.query?.redirect_uri);
  return fromQuery || MOBILE_DEEP_LINK;
}

function readCookie(req, name) {
  const raw = String(req.headers.cookie || '');
  const match = raw.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function isMobileOAuthRequest(req) {
  if (!req) return false;
  if (String(req.query?.client || '').toLowerCase() === 'mobile') return true;
  const state = String(req.query?.state || '');
  if (state.startsWith('stage_mobile')) return true;
  const mapped = oauthClientByState.get(state);
  if (mapped?.client === 'mobile') return true;
  if (readCookie(req, 'stage_oauth_client') === 'mobile') return true;
  return false;
}

function resolveOAuthClient(req, player) {
  const state = String(req?.query?.state || '');
  const mapped = state ? oauthClientByState.get(state) : null;
  // Keep redirectUri on the player before consuming state (used by deep-link redirect).
  if (mapped?.redirectUri && player) {
    player.__mobileRedirectUri = player.__mobileRedirectUri || mapped.redirectUri;
  }
  if (mapped) oauthClientByState.delete(state);
  if (mapped?.client === 'mobile') return 'mobile';
  if (String(player?.__oauthClient || '').toLowerCase() === 'mobile') return 'mobile';
  if (state.startsWith('stage_mobile')) return 'mobile';
  if (isMobileOAuthRequest(req)) return 'mobile';
  return 'web';
}

function markMobileStart(req, res) {
  const isMobile = String(req.query?.client || '').toLowerCase() === 'mobile';
  if (isMobile) {
    res.setHeader(
      'Set-Cookie',
      'stage_oauth_client=mobile; Path=/; Max-Age=600; SameSite=Lax; Secure'
    );
  }
  return isMobile;
}

function attachMobileClientFlag(req, player) {
  if (!player) return player;
  const state = String(req?.query?.state || '');
  const mapped = state ? oauthClientByState.get(state) : null;
  if (
    mapped?.client === 'mobile' ||
    state.startsWith('stage_mobile') ||
    String(req?.query?.client || '').toLowerCase() === 'mobile' ||
    readCookie(req, 'stage_oauth_client') === 'mobile'
  ) {
    player.__oauthClient = 'mobile';
    player.__mobileRedirectUri = mapped?.redirectUri || sanitizeMobileRedirectUri(req?.query?.redirect_uri);
  }
  return player;
}

function mobileHandoffUrl(queryParams) {
  // Prefer /auth/mobile-handoff (live on production Express).
  // /api/stage/auth/mobile-handoff is the SPA-safe mirror.
  return `${SERVER_URL}/auth/mobile-handoff?${queryParams}`;
}

function redirectMobileApp(res, queryParams, req, player) {
  const deepBase = peekMobileRedirectUri(req, player);
  const qs = String(queryParams);
  const deep = qs ? `${deepBase}?${qs}` : deepBase;
  // Prefer direct custom-scheme redirect so Expo AuthSession stays in-app
  // (no Safari, no SPA). Fall back to API handoff page if needed.
  if (String(deepBase).startsWith('stage:') || String(deepBase).startsWith('exp:')) {
    res.setHeader('Cache-Control', 'no-store');
    return res.redirect(302, deep);
  }
  const handoff = new URLSearchParams(qs);
  handoff.set('redirect_uri', deepBase);
  return res.redirect(302, mobileHandoffUrl(handoff));
}

/** HTTPS handoff under /api/stage — never hits the SPA catch-all. */
function sendMobileHandoffPage(req, res) {
  const params = new URLSearchParams(req.query || {});
  const redirectUri = sanitizeMobileRedirectUri(params.get('redirect_uri'));
  params.delete('redirect_uri');
  const q = params.toString();
  const deepLink = q ? `${redirectUri}?${q}` : redirectUri;
  const j = JSON.stringify(deepLink);
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).type('html').send(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Opening Stage…</title>
  </head>
  <body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:24px;text-align:center">
    <p>Opening the Stage app…</p>
    <p style="font-size:14px;opacity:.75;margin-top:12px">
      If nothing happens, <a id="open" href=${j}>tap here</a>.
    </p>
    <script>
      (function () {
        var deep = ${j};
        try { window.location.replace(deep); } catch (e) {}
        setTimeout(function () {
          try { window.location.href = deep; } catch (e) {}
        }, 200);
      })();
    </script>
  </body>
</html>`);
}

async function issueAndRedirect(res, player, req = null) {
  const userRows = await EXECUTESQL('SELECT id FROM users WHERE email = ? LIMIT 1', [player.email]);
  if (!userRows.length) return oauthFail(res, req);
  const userId = userRows[0].id;

  const payload      = { id: userId, email: player.email };
  const accessToken  = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  await EXECUTESQL(
    `INSERT INTO auth_tokens (id, email, refresh_token, created_date)
     VALUES (?, ?, ?, NOW())`,
    [uuidv4(), player.email || '', refreshToken]
  );

  const clubs = await EXECUTESQL(
    `SELECT id, president_user_id, president_id, user_id
       FROM clubs
      WHERE president_user_id = ?
         OR user_id = ?
         OR LOWER(TRIM(owner_email)) = LOWER(TRIM(?))
      ORDER BY (president_user_id = ?) DESC, (user_id = ?) DESC
      LIMIT 1`,
    [userId, userId, player.email || '', userId, userId]
  );
  const matchedClubId = clubs[0]?.id || '';
  const presidentClubId = String(clubs[0]?.president_user_id || '') === String(userId) ? matchedClubId : '';
  let presidentId = clubs[0]?.president_id || '';
  if (presidentClubId && !presidentId && clubs[0]) {
    try {
      const { ensurePresidentForClub } = require('../services/presidentResolutionService');
      const president = await ensurePresidentForClub(clubs[0]);
      presidentId = president?.id || '';
    } catch {
      /* non-fatal */
    }
  }

  notifyLogin({
    to: player.email,
    name: player.gamertag || (player.email ? player.email.split('@')[0] : 'there'),
    when: new Date(),
  });

  const params = new URLSearchParams({
    accessToken,
    refreshToken,
    userId,
    playerId: player.id,
    ownerId: matchedClubId,
    ownedClubId: matchedClubId,
    presidentClubId,
    presidentId,
  });
  if (player.__isNewUser) params.set('isNewUser', '1');

  // Mobile app → deep link. Web → SPA /auth/callback.
  const redirectUri = peekMobileRedirectUri(req, player);
  if (player && redirectUri) player.__mobileRedirectUri = redirectUri;
  const client = resolveOAuthClient(req, player);
  if (client === 'mobile' || String(FRONTEND_URL).startsWith('stage://')) {
    params.set('mobile', '1');
    params.set('client', 'mobile');
    return redirectMobileApp(res, params, req, player);
  }
  res.redirect(`${FRONTEND_URL}/auth/callback?${params}`);
}

function oauthFail(res, req) {
  // Capture redirect target before resolveOAuthClient consumes state.
  const redirectUri = peekMobileRedirectUri(req, null);
  const mobile = resolveOAuthClient(req, null) === 'mobile' || String(FRONTEND_URL).startsWith('stage://');
  if (mobile) {
    return redirectMobileApp(
      res,
      new URLSearchParams({ error: 'auth_failed', mobile: '1' }),
      req,
      { __mobileRedirectUri: redirectUri }
    );
  }
  return res.redirect(`${FRONTEND_URL}/auth/error`);
}

function requireGoogleOAuth(req, res, next) {
  if (!oauthProvidersEnabled.google) return oauthFail(res, req);
  next();
}

function requireMicrosoftOAuth(req, res, next) {
  if (!oauthProvidersEnabled.microsoft) return oauthFail(res, req);
  next();
}

function requireTwitchOAuth(req, res, next) {
  if (!oauthProvidersEnabled.twitch) return oauthFail(res, req);
  next();
}

// ── Google ──────────────────────────────────────────────────────────────────
router.get('/google',
  requireGoogleOAuth,
  (req, res, next) => {
    const isMobile = markMobileStart(req, res);
    passport.authenticate('google', {
      session: false,
      scope: ['profile', 'email'],
      prompt: 'select_account',
      state: createOAuthState(isMobile, req.query?.redirect_uri),
    })(req, res, next);
  }
);
router.get('/google/callback',
  requireGoogleOAuth,
  (req, res, next) => passport.authenticate('google', { session: false }, (err, player) => {
    if (err || !player) return oauthFail(res, req);
    req.user = attachMobileClientFlag(req, player);
    next();
  })(req, res, next),
  (req, res) => issueAndRedirect(res, req.user, req)
);

// ── Microsoft / Outlook ─────────────────────────────────────────────────────
router.get('/microsoft',
  requireMicrosoftOAuth,
  (req, res, next) => {
    const isMobile = markMobileStart(req, res);
    passport.authenticate('microsoft', {
      session: false,
      prompt: 'select_account',
      state: createOAuthState(isMobile, req.query?.redirect_uri),
    })(req, res, next);
  }
);
router.get('/microsoft/callback',
  requireMicrosoftOAuth,
  (req, res, next) => passport.authenticate('microsoft', { session: false }, (err, player) => {
    if (err || !player) return oauthFail(res, req);
    req.user = attachMobileClientFlag(req, player);
    next();
  })(req, res, next),
  (req, res) => issueAndRedirect(res, req.user, req)
);

// ── Twitch ──────────────────────────────────────────────────────────────────
router.get('/twitch',
  requireTwitchOAuth,
  (req, res, next) => {
    const isMobile = markMobileStart(req, res);
    passport.authenticate('twitch', {
      session: false,
      state: createOAuthState(isMobile, req.query?.redirect_uri),
    })(req, res, next);
  }
);
router.get('/twitch/callback',
  requireTwitchOAuth,
  (req, res, next) => passport.authenticate('twitch', { session: false }, (err, player) => {
    if (err || !player) return oauthFail(res, req);
    req.user = attachMobileClientFlag(req, player);
    next();
  })(req, res, next),
  (req, res) => issueAndRedirect(res, req.user, req)
);

// ── Kick ────────────────────────────────────────────────────────────────────
// Kick uses OAuth 2.1: PKCE (S256) + state are MANDATORY, so this flow is
// implemented directly (passport-oauth2 needs a session store for PKCE).
// Docs: https://docs.kick.com/getting-started/generating-tokens-oauth2-flow
const KICK_AUTHORIZE_URL = 'https://id.kick.com/oauth/authorize';
const KICK_TOKEN_URL     = 'https://id.kick.com/oauth/token';
const KICK_USERS_URL     = 'https://api.kick.com/public/v1/users';
const KICK_CHANNELS_URL  = 'https://api.kick.com/public/v1/channels';
const KICK_CALLBACK_URL  = `${SERVER_URL}/api/stage/auth/kick/callback`;

const kickEnabled = () => Boolean(get('KICK_CLIENT_ID') && get('KICK_CLIENT_SECRET'));
if (!kickEnabled()) {
  console.warn('[oauth] Kick OAuth disabled: set KICK_CLIENT_ID and KICK_CLIENT_SECRET');
}

function kickStreamUrlFromProfile(user, channel) {
  const slug = channel?.slug || channel?.stream?.url || null;
  if (slug && /^https?:\/\//i.test(String(slug))) return String(slug);
  if (slug) return `https://kick.com/${String(slug).replace(/^\/+/, '')}`;
  const name = String(user?.name || '').trim().toLowerCase().replace(/\s+/g, '-');
  if (name) return `https://kick.com/${encodeURIComponent(name)}`;
  return null;
}

// In-memory state → PKCE verifier store (single-process server; 10 min TTL).
const kickStates = new Map();
const KICK_STATE_TTL_MS = 10 * 60 * 1000;
function pruneKickStates() {
  const cutoff = Date.now() - KICK_STATE_TTL_MS;
  for (const [state, entry] of kickStates) {
    if (entry.createdAt < cutoff) kickStates.delete(state);
  }
}

router.get('/kick', (req, res) => {
  if (!kickEnabled()) return oauthFail(res, req);
  pruneKickStates();

  const isMobile = markMobileStart(req, res);
  const state     = createOAuthState(isMobile, req.query?.redirect_uri);
  const verifier  = crypto.randomBytes(48).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  const mapped = oauthClientByState.get(state);
  kickStates.set(state, {
    verifier,
    createdAt: Date.now(),
    client: isMobile ? 'mobile' : 'web',
    redirectUri: mapped?.redirectUri || null,
  });

  const params = new URLSearchParams({
    client_id:             get('KICK_CLIENT_ID'),
    response_type:         'code',
    redirect_uri:          KICK_CALLBACK_URL,
    scope:                 'user:read channel:read',
    code_challenge:        challenge,
    code_challenge_method: 'S256',
    state,
  });
  res.redirect(`${KICK_AUTHORIZE_URL}?${params}`);
});

router.get('/kick/callback', async (req, res) => {
  if (!kickEnabled()) return oauthFail(res, req);
  try {
    const { code, state } = req.query;
    const entry = state ? kickStates.get(state) : null;
    if (!code || !entry) return oauthFail(res, req);
    kickStates.delete(state);

    const tokenRes = await axios.post(
      KICK_TOKEN_URL,
      new URLSearchParams({
        grant_type:    'authorization_code',
        client_id:     get('KICK_CLIENT_ID'),
        client_secret: get('KICK_CLIENT_SECRET'),
        redirect_uri:  KICK_CALLBACK_URL,
        code_verifier: entry.verifier,
        code,
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    const accessToken = tokenRes.data?.access_token;
    if (!accessToken) return oauthFail(res, req);

    // Without an id param, /public/v1/users returns the token's own user.
    const userRes = await axios.get(KICK_USERS_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const u = userRes.data?.data?.[0];
    if (!u || !u.user_id) return oauthFail(res, req);

    let channel = null;
    try {
      const channelRes = await axios.get(KICK_CHANNELS_URL, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { broadcaster_user_id: u.user_id },
      });
      channel = channelRes.data?.data?.[0] || null;
    } catch (channelErr) {
      console.warn('[oauth] Kick channel lookup failed:', channelErr.response?.data || channelErr.message);
    }

    const player = await findOrCreateOAuthPlayer({
      oauthId:  String(u.user_id),
      provider: 'kick',
      email:    u.email || null,
      fullName: u.name || null,
      avatar:   u.profile_picture || null,
      streamUrl: kickStreamUrlFromProfile(u, channel),
    });
    if (entry.client === 'mobile') {
      player.__oauthClient = 'mobile';
      player.__mobileRedirectUri = entry.redirectUri || MOBILE_DEEP_LINK;
    }
    return issueAndRedirect(res, attachMobileClientFlag(req, player), req);
  } catch (err) {
    console.error('[oauth] Kick callback failed:', err.response?.data || err.message);
    return oauthFail(res, req);
  }
});

// Mobile deep-link handoff (mounted at /api/stage/auth/mobile-handoff).
// Must live under /api so nginx/SPA never serves a website 404.
router.get('/mobile-handoff', sendMobileHandoffPage);

module.exports = router;

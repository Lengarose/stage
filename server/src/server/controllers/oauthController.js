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

async function issueAndRedirect(res, player) {
  const userRows = await EXECUTESQL('SELECT id FROM users WHERE email = ? LIMIT 1', [player.email]);
  if (!userRows.length) return oauthFail(res);
  const userId = userRows[0].id;

  const payload      = { id: userId, email: player.email };
  const accessToken  = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  await EXECUTESQL(
    `INSERT INTO auth_tokens (id, email, refresh_token, created_date)
     VALUES (?, ?, ?, NOW())`,
    [uuidv4(), player.email || '', refreshToken]
  );

  const clubs = await EXECUTESQL('SELECT id FROM clubs WHERE user_id = ? LIMIT 1', [userId]);

  // Sign-in notification (mailer skips @stage.local placeholder addresses).
  notifyLogin({
    to: player.email,
    name: player.gamertag || (player.email ? player.email.split('@')[0] : 'there'),
    when: new Date(),
  });

  // Redirect to frontend with tokens in query — frontend stores them and closes the OAuth window
  const params = new URLSearchParams({
    accessToken,
    refreshToken,
    userId,
    playerId: player.id,
    ownerId:  clubs[0]?.id || '',
  });
  res.redirect(`${FRONTEND_URL}/auth/callback?${params}`);
}

function oauthFail(res) {
  return res.redirect(`${FRONTEND_URL}/auth/error`);
}

function requireGoogleOAuth(req, res, next) {
  if (!oauthProvidersEnabled.google) return oauthFail(res);
  next();
}

function requireMicrosoftOAuth(req, res, next) {
  if (!oauthProvidersEnabled.microsoft) return oauthFail(res);
  next();
}

function requireTwitchOAuth(req, res, next) {
  if (!oauthProvidersEnabled.twitch) return oauthFail(res);
  next();
}

// ── Google ──────────────────────────────────────────────────────────────────
router.get('/google',
  requireGoogleOAuth,
  // prompt=select_account → always show the account chooser instead of silently
  // re-using the browser's remembered Google session.
  passport.authenticate('google', { session: false, scope: ['profile', 'email'], prompt: 'select_account' })
);
router.get('/google/callback',
  requireGoogleOAuth,
  (req, res, next) => passport.authenticate('google', { session: false }, (err, player) => {
    if (err || !player) return oauthFail(res);
    req.user = player;
    next();
  })(req, res, next),
  (req, res) => issueAndRedirect(res, req.user)
);

// ── Microsoft / Outlook ─────────────────────────────────────────────────────
router.get('/microsoft',
  requireMicrosoftOAuth,
  // prompt=select_account → always show the Microsoft account chooser.
  passport.authenticate('microsoft', { session: false, prompt: 'select_account' })
);
router.get('/microsoft/callback',
  requireMicrosoftOAuth,
  (req, res, next) => passport.authenticate('microsoft', { session: false }, (err, player) => {
    if (err || !player) return oauthFail(res);
    req.user = player;
    next();
  })(req, res, next),
  (req, res) => issueAndRedirect(res, req.user)
);

// ── Twitch ──────────────────────────────────────────────────────────────────
router.get('/twitch',
  requireTwitchOAuth,
  passport.authenticate('twitch', { session: false })
);
router.get('/twitch/callback',
  requireTwitchOAuth,
  (req, res, next) => passport.authenticate('twitch', { session: false }, (err, player) => {
    if (err || !player) return oauthFail(res);
    req.user = player;
    next();
  })(req, res, next),
  (req, res) => issueAndRedirect(res, req.user)
);

// ── Kick ────────────────────────────────────────────────────────────────────
// Kick uses OAuth 2.1: PKCE (S256) + state are MANDATORY, so this flow is
// implemented directly (passport-oauth2 needs a session store for PKCE).
// Docs: https://docs.kick.com/getting-started/generating-tokens-oauth2-flow
const KICK_AUTHORIZE_URL = 'https://id.kick.com/oauth/authorize';
const KICK_TOKEN_URL     = 'https://id.kick.com/oauth/token';
const KICK_USERS_URL     = 'https://api.kick.com/public/v1/users';
const KICK_CALLBACK_URL  = `${SERVER_URL}/api/stage/auth/kick/callback`;

const kickEnabled = () => Boolean(get('KICK_CLIENT_ID') && get('KICK_CLIENT_SECRET'));
if (!kickEnabled()) {
  console.warn('[oauth] Kick OAuth disabled: set KICK_CLIENT_ID and KICK_CLIENT_SECRET');
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
  if (!kickEnabled()) return oauthFail(res);
  pruneKickStates();

  const state     = crypto.randomBytes(24).toString('base64url');
  const verifier  = crypto.randomBytes(48).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  kickStates.set(state, { verifier, createdAt: Date.now() });

  const params = new URLSearchParams({
    client_id:             get('KICK_CLIENT_ID'),
    response_type:         'code',
    redirect_uri:          KICK_CALLBACK_URL,
    scope:                 'user:read',
    code_challenge:        challenge,
    code_challenge_method: 'S256',
    state,
  });
  res.redirect(`${KICK_AUTHORIZE_URL}?${params}`);
});

router.get('/kick/callback', async (req, res) => {
  if (!kickEnabled()) return oauthFail(res);
  try {
    const { code, state } = req.query;
    const entry = state ? kickStates.get(state) : null;
    if (!code || !entry) return oauthFail(res);
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
    if (!accessToken) return oauthFail(res);

    // Without an id param, /public/v1/users returns the token's own user.
    const userRes = await axios.get(KICK_USERS_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const u = userRes.data?.data?.[0];
    if (!u || !u.user_id) return oauthFail(res);

    const player = await findOrCreateOAuthPlayer({
      oauthId:  String(u.user_id),
      provider: 'kick',
      email:    u.email || null,
      fullName: u.name || null,
      avatar:   u.profile_picture || null,
    });
    return issueAndRedirect(res, player);
  } catch (err) {
    console.error('[oauth] Kick callback failed:', err.response?.data || err.message);
    return oauthFail(res);
  }
});

module.exports = router;

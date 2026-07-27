const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const MicrosoftStrategy = require('passport-microsoft').Strategy;
const OAuth2Strategy = require('passport-oauth2');
const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');
const { get } = require('../../constants/env');

const SERVER_URL = get('SERVER_URL') || 'http://localhost:8080';

async function findOrCreateOAuthPlayer({ oauthId, provider, email, fullName, avatar, streamUrl }) {
  async function ensureUserLink(player) {
    if (!email) return player;
    const users = await EXECUTESQL('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if (!users.length) {
      await EXECUTESQL(
        `INSERT INTO users (id, email, created_date, updated_date)
         VALUES (?, ?, NOW(), NOW())`,
        [uuidv4(), email]
      );
    }
    await EXECUTESQL(
      'UPDATE players SET user_id = (SELECT id FROM users WHERE email = ? LIMIT 1) WHERE id = ?',
      [email, player.id]
    );
    const refreshed = await EXECUTESQL('SELECT * FROM players WHERE id = ?', [player.id]);
    return refreshed[0] || player;
  }

  async function persistStreamUrl(playerId) {
    if (!streamUrl) return;
    await EXECUTESQL(
      'UPDATE players SET stream_url = ?, updated_date = NOW() WHERE id = ?',
      [streamUrl, playerId]
    ).catch((err) => console.warn('[oauth] stream_url update failed:', err.message));
  }

  // 1. Match by oauth_id + provider (returning user)
  let rows = await EXECUTESQL(
    'SELECT * FROM players WHERE oauth_provider = ? AND oauth_id = ?',
    [provider, oauthId]
  );
  if (rows.length) {
    await persistStreamUrl(rows[0].id);
    const linked = await ensureUserLink(rows[0]);
    if (streamUrl) linked.stream_url = streamUrl;
    return linked;
  }

  // 2. Match by email → link OAuth to existing account
  if (email) {
    rows = await EXECUTESQL('SELECT * FROM players WHERE email = ?', [email]);
    if (rows.length) {
      await EXECUTESQL(
        'UPDATE players SET oauth_provider = ?, oauth_id = ? WHERE id = ?',
        [provider, oauthId, rows[0].id]
      );
      await persistStreamUrl(rows[0].id);
      const linked = await ensureUserLink(rows[0]);
      if (streamUrl) linked.stream_url = streamUrl;
      return linked;
    }
  }

  // 3. Create new player
  const id = uuidv4();
  const gamertag = fullName?.split(' ')[0] || email?.split('@')[0] || 'Player';
  const safeEmail = email || `${provider}_${oauthId}@stage.local`;

  await EXECUTESQL(
    `INSERT INTO players
       (id, email, gamertag, avatar_url, oauth_provider, oauth_id, stream_url, credits, subscription, created_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, 50, 'free', NOW())`,
    [id, safeEmail, gamertag, avatar || null, provider, oauthId, streamUrl || null]
  );

  const created = await EXECUTESQL('SELECT * FROM players WHERE id = ?', [id]);
  return ensureUserLink(created[0]);
}

/** Which OAuth providers have env vars set and were registered with Passport */
const oauthProvidersEnabled = {
  google: false,
  microsoft: false,
  twitch: false,
};

// ── Google ──────────────────────────────────────────────────────────────────
if (get('GOOGLE_CLIENT_ID') && get('GOOGLE_CLIENT_SECRET')) {
  passport.use('google', new GoogleStrategy(
    {
      clientID:     get('GOOGLE_CLIENT_ID'),
      clientSecret: get('GOOGLE_CLIENT_SECRET'),
      callbackURL:  `${SERVER_URL}/api/stage/auth/google/callback`,
      scope: ['profile', 'email'],
    },
    async (_at, _rt, profile, done) => {
      try {
        const player = await findOrCreateOAuthPlayer({
          oauthId:  profile.id,
          provider: 'google',
          email:    profile.emails?.[0]?.value,
          fullName: profile.displayName,
          avatar:   profile.photos?.[0]?.value,
        });
        done(null, player);
      } catch (err) { done(err); }
    }
  ));
  oauthProvidersEnabled.google = true;
} else {
  console.warn('[oauth] Google OAuth disabled: set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET');
}

// ── Microsoft / Outlook ─────────────────────────────────────────────────────
if (get('MICROSOFT_CLIENT_ID') && get('MICROSOFT_CLIENT_SECRET')) {
  passport.use('microsoft', new MicrosoftStrategy(
    {
      clientID:     get('MICROSOFT_CLIENT_ID'),
      clientSecret: get('MICROSOFT_CLIENT_SECRET'),
      callbackURL:  `${SERVER_URL}/api/stage/auth/microsoft/callback`,
      scope: ['user.read'],
    },
    async (_at, _rt, profile, done) => {
      try {
        const player = await findOrCreateOAuthPlayer({
          oauthId:  profile.id,
          provider: 'microsoft',
          email:    profile.emails?.[0]?.value,
          fullName: profile.displayName,
          avatar:   null,
        });
        done(null, player);
      } catch (err) { done(err); }
    }
  ));
  oauthProvidersEnabled.microsoft = true;
} else {
  console.warn('[oauth] Microsoft OAuth disabled: set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET');
}

// ── Twitch ──────────────────────────────────────────────────────────────────
// Twitch has no maintained passport strategy — we use the generic OAuth2
// strategy with a custom userProfile against the Helix API.
// https://dev.twitch.tv/docs/authentication (Authorization Code Grant Flow)
class TwitchStrategy extends OAuth2Strategy {
  constructor(options, verify) {
    super(
      {
        authorizationURL: 'https://id.twitch.tv/oauth2/authorize',
        tokenURL:         'https://id.twitch.tv/oauth2/token',
        ...options,
      },
      verify
    );
    this.name = 'twitch';
    // Helix requires the Client-ID header alongside the Bearer token
    this._oauth2.useAuthorizationHeaderforGET(true);
    this._oauth2._customHeaders = { 'Client-ID': options.clientID };
  }

  // force_verify=true → Twitch always re-shows the authorize screen instead of
  // silently re-using the logged-in account (Twitch equivalent of select_account).
  authorizationParams() {
    return { force_verify: 'true' };
  }

  userProfile(accessToken, done) {
    this._oauth2.get('https://api.twitch.tv/helix/users', accessToken, (err, body) => {
      if (err) return done(err);
      try {
        const u = JSON.parse(body)?.data?.[0];
        if (!u) return done(new Error('Twitch: empty user profile'));
        done(null, {
          id:          u.id,
          login:       u.login,
          displayName: u.display_name,
          email:       u.email || null, // requires user:read:email scope + verified email
          avatar:      u.profile_image_url || null,
        });
      } catch (e) { done(e); }
    });
  }
}

if (get('TWITCH_CLIENT_ID') && get('TWITCH_CLIENT_SECRET')) {
  passport.use('twitch', new TwitchStrategy(
    {
      clientID:     get('TWITCH_CLIENT_ID'),
      clientSecret: get('TWITCH_CLIENT_SECRET'),
      callbackURL:  `${SERVER_URL}/api/stage/auth/twitch/callback`,
      scope: ['user:read:email'],
    },
    async (_at, _rt, profile, done) => {
      try {
        const player = await findOrCreateOAuthPlayer({
          oauthId:  profile.id,
          provider: 'twitch',
          email:    profile.email,
          fullName: profile.displayName || profile.login,
          avatar:   profile.avatar,
          streamUrl: profile.login ? `https://www.twitch.tv/${profile.login}` : null,
        });
        done(null, player);
      } catch (err) { done(err); }
    }
  ));
  oauthProvidersEnabled.twitch = true;
} else {
  console.warn('[oauth] Twitch OAuth disabled: set TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET');
}

module.exports = { passport, findOrCreateOAuthPlayer, oauthProvidersEnabled };

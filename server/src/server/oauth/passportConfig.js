const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const MicrosoftStrategy = require('passport-microsoft').Strategy;
const AppleStrategy = require('passport-apple');
const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');
const { get } = require('../../constants/env');

const SERVER_URL = get('SERVER_URL') || 'http://localhost:8080';

async function findOrCreateOAuthPlayer({ oauthId, provider, email, fullName, avatar }) {
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

  // 1. Match by oauth_id + provider (returning user)
  let rows = await EXECUTESQL(
    'SELECT * FROM players WHERE oauth_provider = ? AND oauth_id = ?',
    [provider, oauthId]
  );
  if (rows.length) return ensureUserLink(rows[0]);

  // 2. Match by email → link OAuth to existing account
  if (email) {
    rows = await EXECUTESQL('SELECT * FROM players WHERE email = ?', [email]);
    if (rows.length) {
      await EXECUTESQL(
        'UPDATE players SET oauth_provider = ?, oauth_id = ? WHERE id = ?',
        [provider, oauthId, rows[0].id]
      );
      return ensureUserLink(rows[0]);
    }
  }

  // 3. Create new player
  const id = uuidv4();
  const gamertag = fullName?.split(' ')[0] || email?.split('@')[0] || 'Player';
  const safeEmail = email || `${provider}_${oauthId}@stage.local`;

  await EXECUTESQL(
    `INSERT INTO players
       (id, email, gamertag, avatar_url, oauth_provider, oauth_id, credits, subscription, created_date)
     VALUES (?, ?, ?, ?, ?, ?, 0, 'rookie', NOW())`,
    [id, safeEmail, gamertag, avatar || null, provider, oauthId]
  );

  const created = await EXECUTESQL('SELECT * FROM players WHERE id = ?', [id]);
  return ensureUserLink(created[0]);
}

/** Which OAuth providers have env vars set and were registered with Passport */
const oauthProvidersEnabled = {
  google: false,
  microsoft: false,
  apple: false,
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

// ── Apple ───────────────────────────────────────────────────────────────────
// Apple sends name+email only on the VERY FIRST login — store them immediately.
const appleReady =
  get('APPLE_CLIENT_ID') &&
  get('APPLE_TEAM_ID') &&
  get('APPLE_KEY_ID') &&
  get('APPLE_PRIVATE_KEY');

if (appleReady) {
  passport.use('apple', new AppleStrategy(
    {
      clientID:         get('APPLE_CLIENT_ID'),
      teamID:           get('APPLE_TEAM_ID'),
      keyID:            get('APPLE_KEY_ID'),
      privateKeyString: get('APPLE_PRIVATE_KEY'),
      callbackURL:      `${SERVER_URL}/api/stage/auth/apple/callback`,
      passReqToCallback: false,
    },
    async (_at, _rt, idToken, profile, done) => {
      try {
        const email    = idToken?.email || profile?.email || null;
        const oauthId  = idToken?.sub   || profile?.id;
        const firstName = profile?.name?.firstName || '';
        const lastName  = profile?.name?.lastName  || '';
        const player = await findOrCreateOAuthPlayer({
          oauthId,
          provider: 'apple',
          email,
          fullName: [firstName, lastName].filter(Boolean).join(' ') || null,
          avatar:   null,
        });
        done(null, player);
      } catch (err) { done(err); }
    }
  ));
  oauthProvidersEnabled.apple = true;
} else {
  console.warn('[oauth] Apple OAuth disabled: set APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY');
}

module.exports = { passport, findOrCreateOAuthPlayer, oauthProvidersEnabled };

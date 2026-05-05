const express = require('express');
const router = express.Router();
const { passport, oauthProvidersEnabled } = require('../oauth/passportConfig');
const { generateAccessToken, generateRefreshToken } = require('../jwt/index');
const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

const { get } = require('../../constants/env');
const FRONTEND_URL = get('FRONTEND_URL') || 'http://localhost:3000';

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

  // Redirect to frontend with tokens in query — frontend stores them and closes the OAuth window
  const params = new URLSearchParams({
    accessToken,
    refreshToken,
    userId,
    playerId: player.id,
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

function requireAppleOAuth(req, res, next) {
  if (!oauthProvidersEnabled.apple) return oauthFail(res);
  next();
}

// ── Google ──────────────────────────────────────────────────────────────────
router.get('/google',
  requireGoogleOAuth,
  passport.authenticate('google', { session: false, scope: ['profile', 'email'] })
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
  passport.authenticate('microsoft', { session: false })
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

// ── Apple ────────────────────────────────────────────────────────────────────
// Apple uses POST for callback (unlike Google/Microsoft which use GET)
router.get('/apple',
  requireAppleOAuth,
  passport.authenticate('apple', { session: false })
);
router.post('/apple/callback',
  requireAppleOAuth,
  (req, res, next) => passport.authenticate('apple', { session: false }, (err, player) => {
    if (err || !player) return oauthFail(res);
    req.user = player;
    next();
  })(req, res, next),
  (req, res) => issueAndRedirect(res, req.user)
);

module.exports = router;

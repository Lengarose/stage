const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { EXECUTESQL } = require('../db/database');
const { generateAccessToken, generateRefreshToken } = require('../jwt/index');
const { ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET } = require('../../constants/constants');
const { get } = require('../../constants/env');
const { ok, fail, buildMePayload } = require('./helpers');
const { notifySignup } = require('../services/notifications');

const router = express.Router();
const SERVER_URL = () => get('SERVER_URL') || 'http://localhost:8080';

router.post('/register', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim();
    const password = String(req.body?.password || '');
    if (!email || !password) return fail(res, 400, 'email and password required');
    if (password.length < 6) return fail(res, 400, 'password must be at least 6 characters');

    const existing = await EXECUTESQL('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [email]);
    if (existing.length) return fail(res, 409, 'This user with this email exist');

    const hash = await bcrypt.hash(password, 10);
    const userId = uuidv4();
    await EXECUTESQL(
      `INSERT INTO users (id, email, password_hash, role_id, created_date, updated_date)
       VALUES (?, ?, ?, 1, NOW(), NOW())`,
      [userId, email, hash]
    );

    const gamerTag = String(req.body?.gamer_tag || req.body?.gamertag || '').trim();
    let playerId = null;
    if (gamerTag || req.body?.first_name) {
      playerId = uuidv4();
      const tag = gamerTag || `${req.body.first_name || 'Player'}${req.body.last_name ? `_${req.body.last_name}` : ''}`;
      await EXECUTESQL(
        `INSERT INTO players (id, user_id, email, gamertag, position, platform, created_date, updated_date)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          playerId,
          userId,
          email,
          tag,
          req.body?.position || null,
          req.body?.platform || null,
        ]
      ).catch(async () => {
        playerId = null;
      });
      if (playerId) {
        await EXECUTESQL('UPDATE users SET player_id = ?, updated_date = NOW() WHERE id = ?', [playerId, userId]).catch(() => {});
      }
    }

    const payload = { id: userId, email };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);
    await EXECUTESQL(
      'INSERT INTO auth_tokens (id, email, refresh_token, created_date) VALUES (?, ?, ?, NOW())',
      [uuidv4(), email, refreshToken]
    );

    notifySignup({
      to: email,
      name: gamerTag || email.split('@')[0],
    });

    const user = await buildMePayload(userId);
    return ok(res, { accessToken, refreshToken, user, userId, playerId }, 201);
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.post('/login', async (req, res) => {
  try {
    const loginIdentifier = String(req.body?.identifier || req.body?.email || '').trim();
    const password = String(req.body?.password || '');
    if (!loginIdentifier || !password) return fail(res, 400, 'identifier and password required');

    const rows = await EXECUTESQL(
      `SELECT u.* FROM users u
       LEFT JOIN players p ON p.user_id = u.id OR LOWER(TRIM(p.email)) = LOWER(TRIM(u.email))
       LEFT JOIN clubs c ON c.president_user_id = u.id OR c.user_id = u.id OR LOWER(TRIM(c.owner_email)) = LOWER(TRIM(u.email))
       WHERE LOWER(u.email) = LOWER(?)
          OR LOWER(p.gamertag) = LOWER(?)
          OR LOWER(c.name) = LOWER(?)
       LIMIT 1`,
      [loginIdentifier, loginIdentifier, loginIdentifier]
    );
    if (!rows.length) return fail(res, 401, 'Invalid credentials');

    const userRow = rows[0];
    const valid = await bcrypt.compare(password, userRow.password_hash);
    if (!valid) return fail(res, 401, 'Invalid credentials');

    const payload = { id: userRow.id, email: userRow.email };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);
    await EXECUTESQL(
      'INSERT INTO auth_tokens (id, email, refresh_token, created_date) VALUES (?, ?, ?, NOW())',
      [uuidv4(), userRow.email, refreshToken]
    );

    const user = await buildMePayload(userRow.id);
    return ok(res, { accessToken, refreshToken, user, userId: userRow.id });
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body || {};
    if (!refreshToken) return fail(res, 400, 'refreshToken required');

    const stored = await EXECUTESQL('SELECT * FROM auth_tokens WHERE refresh_token = ?', [refreshToken]);
    if (!stored.length) return fail(res, 401, 'Invalid or expired refresh token');

    const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);
    const accessToken = generateAccessToken({ id: decoded.id, email: decoded.email });
    const newRefresh = generateRefreshToken({ id: decoded.id, email: decoded.email });

    await EXECUTESQL('DELETE FROM auth_tokens WHERE refresh_token = ?', [refreshToken]);
    await EXECUTESQL(
      'INSERT INTO auth_tokens (id, email, refresh_token, created_date) VALUES (?, ?, ?, NOW())',
      [uuidv4(), decoded.email, newRefresh]
    );

    return ok(res, { accessToken, refreshToken: newRefresh });
  } catch (err) {
    return fail(res, 401, err.message || 'Invalid refresh token');
  }
});

router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body || {};
    if (refreshToken) {
      await EXECUTESQL('DELETE FROM auth_tokens WHERE refresh_token = ?', [refreshToken]);
    }
    return ok(res, { success: true });
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

// Mobile OAuth entrypoints → Stage Passport routes, with mobile deep-link callback.
['google', 'microsoft', 'twitch', 'kick'].forEach((provider) => {
  router.get(`/${provider}`, (req, res) => {
    const params = new URLSearchParams(req.query);
    params.set('client', 'mobile');
    res.redirect(`${SERVER_URL()}/api/stage/auth/${provider}?${params.toString()}`);
  });
});

router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return fail(res, 401, 'No token provided');
    const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET);
    const user = await buildMePayload(decoded.id);
    if (!user) return fail(res, 401, 'User not found');
    return ok(res, user);
  } catch {
    return fail(res, 401, 'Invalid token');
  }
});

module.exports = router;

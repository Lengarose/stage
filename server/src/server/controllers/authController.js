const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { EXECUTESQL } = require('../db/database');
const { generateAccessToken, generateRefreshToken } = require('../jwt/index');
const jwt = require('jsonwebtoken');
const { ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET } = require('../../constants/constants');

router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    if (String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const existing = await EXECUTESQL('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [email]);
    if (existing.length) return res.status(409).json({ error: 'This user with this email exist' });

    const hash = await bcrypt.hash(password, 10);
    const userId = uuidv4();
    await EXECUTESQL(
      `INSERT INTO users (id, email, password_hash, role_id, created_date, updated_date)
       VALUES (?, ?, ?, 1, NOW(), NOW())`,
      [userId, email, hash]
    );

    const payload = { id: userId, email };
    const accessToken  = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    await EXECUTESQL(
      'INSERT INTO auth_tokens (id, email, refresh_token, created_date) VALUES (?, ?, ?, NOW())',
      [uuidv4(), email, refreshToken]
    );

    res.status(201).json({ accessToken, refreshToken, userId, playerId: null, ownerId: null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, identifier, password } = req.body;
    const loginIdentifier = String(identifier || email || '').trim();
    if (!loginIdentifier || !password) return res.status(400).json({ error: 'identifier and password required' });

    // Allow login by: email OR player gamertag OR club name.
    const rows = await EXECUTESQL(
      `SELECT u.* FROM users u
       LEFT JOIN players p ON p.user_id = u.id
       LEFT JOIN clubs c ON c.user_id = u.id
       WHERE LOWER(u.email) = LOWER(?)
          OR LOWER(p.gamertag) = LOWER(?)
          OR LOWER(c.name) = LOWER(?)
       LIMIT 1`,
      [loginIdentifier, loginIdentifier, loginIdentifier]
    );
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const payload = { id: user.id, email: user.email };
    const accessToken  = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    await EXECUTESQL(
      'INSERT INTO auth_tokens (id, email, refresh_token, created_date) VALUES (?, ?, ?, NOW())',
      [uuidv4(), user.email, refreshToken]
    );

    const players = await EXECUTESQL('SELECT id FROM players WHERE user_id = ? LIMIT 1', [user.id]);
    const clubs = await EXECUTESQL('SELECT id FROM clubs WHERE user_id = ? LIMIT 1', [user.id]);
    res.json({
      accessToken,
      refreshToken,
      userId: user.id,
      playerId: players[0]?.id || null,
      ownerId: clubs[0]?.id || null,
      roleId: user.role_id || 1,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'refreshToken required' });

    const stored = await EXECUTESQL(
      'SELECT * FROM auth_tokens WHERE refresh_token = ?',
      [refreshToken]
    );
    if (!stored.length) return res.status(401).json({ error: 'Invalid or expired refresh token' });

    const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);
    const accessToken  = generateAccessToken({ id: decoded.id, email: decoded.email });
    const newRefresh   = generateRefreshToken({ id: decoded.id, email: decoded.email });

    await EXECUTESQL('DELETE FROM auth_tokens WHERE refresh_token = ?', [refreshToken]);
    await EXECUTESQL(
      'INSERT INTO auth_tokens (id, email, refresh_token, created_date) VALUES (?, ?, ?, NOW())',
      [uuidv4(), decoded.email, newRefresh]
    );

    res.json({ accessToken, refreshToken: newRefresh });
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await EXECUTESQL('DELETE FROM auth_tokens WHERE refresh_token = ?', [refreshToken]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', async (req, res) => {
  try {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });
    const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET);

    const rows = await EXECUTESQL(
      `SELECT
         u.id,
         u.email,
         u.role_id,
         u.created_date,
         u.updated_date,
         r.name AS db_role_name,
         p.id AS player_id,
         p.gamertag,
         p.role AS player_role,
         p.club_id,
         c.id AS owner_id,
         c.name AS club_name
       FROM users u
       LEFT JOIN roles r   ON r.id = u.role_id
       LEFT JOIN players p ON p.user_id = u.id
       LEFT JOIN clubs c   ON c.user_id = u.id
       WHERE u.id = ?
       LIMIT 1`,
      [decoded.id]
    );
    if (!rows.length) return res.status(401).json({ error: 'User not found' });
    const me = rows[0];
    const roleId = me.role_id ?? 1;
    const roleName = me.db_role_name || (Number(roleId) === 0 ? 'admin' : 'player_club');
    const appRole = Number(roleId) === 0 ? 'admin' : (me.player_role || 'player');

    res.json({
      id: me.id,
      email: me.email,
      created_date: me.created_date,
      updated_date: me.updated_date,
      player_id: me.player_id || null,
      owner_id: me.owner_id || null,
      role_id: roleId,
      role_name: roleName,
      role: appRole,
      gamertag: me.gamertag || null,
      club_id: me.club_id || null,
      club_name: me.club_name || null,
    });
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;

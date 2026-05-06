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

    const existing = await EXECUTESQL('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) return res.status(409).json({ error: 'Email already registered' });

    const hash = await bcrypt.hash(password, 10);
    const userId = uuidv4();
    await EXECUTESQL(
      `INSERT INTO users (id, email, password_hash, created_date, updated_date)
       VALUES (?, ?, ?, NOW(), NOW())`,
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
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });

    const rows = await EXECUTESQL('SELECT * FROM users WHERE email = ?', [email]);
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

    const users = await EXECUTESQL('SELECT id, email, created_date, updated_date FROM users WHERE id = ? LIMIT 1', [decoded.id]);
    if (!users.length) return res.status(401).json({ error: 'User not found' });
    const user = users[0];

    const players = await EXECUTESQL('SELECT id, gamertag, role, club_id FROM players WHERE user_id = ? LIMIT 1', [user.id]);
    const clubs = await EXECUTESQL('SELECT id, name FROM clubs WHERE user_id = ? LIMIT 1', [user.id]);

    res.json({
      ...user,
      player_id: players[0]?.id || null,
      owner_id: clubs[0]?.id || null,
      gamertag: players[0]?.gamertag || null,
      role: players[0]?.role || null,
      club_id: players[0]?.club_id || null,
    });
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;

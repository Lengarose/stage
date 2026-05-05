const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { EXECUTESQL } = require('../db/database');
const { generateAccessToken, generateRefreshToken } = require('../jwt/index');
const jwt = require('jsonwebtoken');
const { REFRESH_TOKEN_SECRET } = require('../../constants/constants');

router.post('/register', async (req, res) => {
  try {
    const { email, password, gamertag } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    if (String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const existing = await EXECUTESQL('SELECT id FROM players WHERE email = ?', [email]);
    if (existing.length) return res.status(409).json({ error: 'Email already registered' });

    const hash = await bcrypt.hash(password, 10);
    const id = uuidv4();
    const fallbackTag = String(email).split('@')[0];
    const safeGamertag = (gamertag && String(gamertag).trim()) || fallbackTag;
    await EXECUTESQL(
      `INSERT INTO players (id, email, gamertag, password_hash, created_date)
       VALUES (?, ?, ?, ?, NOW())`,
      [id, email, safeGamertag, hash]
    );

    const payload = { id, email };
    const accessToken  = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    await EXECUTESQL(
      'INSERT INTO auth_tokens (id, email, refresh_token, created_date) VALUES (?, ?, ?, NOW())',
      [uuidv4(), email, refreshToken]
    );

    res.status(201).json({ accessToken, refreshToken, playerId: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });

    const rows = await EXECUTESQL('SELECT * FROM players WHERE email = ?', [email]);
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });

    const player = rows[0];
    const valid = await bcrypt.compare(password, player.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const payload = { id: player.id, email: player.email };
    const accessToken  = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    await EXECUTESQL(
      'INSERT INTO auth_tokens (id, email, refresh_token, created_date) VALUES (?, ?, ?, NOW())',
      [uuidv4(), player.email, refreshToken]
    );

    res.json({ accessToken, refreshToken, playerId: player.id });
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
    const accessToken = generateAccessToken({ id: decoded.id, email: decoded.email });
    res.json({ accessToken });
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

module.exports = router;

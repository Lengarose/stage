const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { EXECUTESQL } = require('../db/database');
const { generateAccessToken, generateRefreshToken } = require('../jwt/index');
const jwt = require('jsonwebtoken');
const { ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET } = require('../../constants/constants');
const { validate, rules } = require('../middleware/validate');
const { notifySignup } = require('../services/notifications');

function isValidTimeZone(value) {
  if (!value || typeof value !== 'string' || value.length > 80) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

async function repairUserProfileLinks(userId, email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!userId || !normalizedEmail) return;

  await EXECUTESQL(
    `UPDATE players
     SET user_id = ?, updated_date = NOW()
     WHERE (user_id IS NULL OR user_id = '')
       AND LOWER(TRIM(email)) = ?`,
    [userId, normalizedEmail]
  ).catch(() => {});

  await EXECUTESQL(
    `UPDATE clubs
     SET user_id = ?,
         president_user_id = COALESCE(president_user_id, ?),
         updated_date = NOW()
     WHERE (user_id IS NULL OR user_id = '')
       AND LOWER(TRIM(owner_email)) = ?`,
    [userId, userId, normalizedEmail]
  ).catch(() => {});

  const [players, clubs] = await Promise.all([
    EXECUTESQL(
      `SELECT id, club_id
       FROM players
       WHERE user_id = ? OR LOWER(TRIM(email)) = ?
       ORDER BY user_id = ? DESC, updated_date DESC
       LIMIT 1`,
      [userId, normalizedEmail, userId]
    ).catch(() => []),
    EXECUTESQL(
      `SELECT id, president_user_id
       FROM clubs
       WHERE president_user_id = ? OR user_id = ? OR LOWER(TRIM(owner_email)) = ?
       ORDER BY president_user_id = ? DESC, user_id = ? DESC, updated_date DESC
       LIMIT 1`,
      [userId, userId, normalizedEmail, userId, userId]
    ).catch(() => []),
  ]);

  await EXECUTESQL(
    `UPDATE users
     SET player_id = COALESCE(player_id, ?),
         owner_id = COALESCE(owner_id, ?),
         updated_date = NOW()
     WHERE id = ?`,
    [players[0]?.id || null, clubs[0]?.id || null, userId]
  ).catch(() => {});

  const club = clubs[0];
  if (club?.id && !club.president_user_id) {
    await EXECUTESQL(
      'UPDATE clubs SET president_user_id = COALESCE(president_user_id, ?), updated_date = NOW() WHERE id = ?',
      [userId, club.id]
    ).catch(() => {});
  }
  // A user may own/preside over a club and also have a separate free-agent
  // player profile. Do not infer player.club_id or player president roles from
  // owned club links; player squad membership only comes from accepted player contracts.
}

router.post('/register', validate({
  email:    [rules.required, rules.email, rules.maxLength(255)],
  password: [rules.required, rules.string, rules.minLength(6), rules.maxLength(128)],
}), async (req, res) => {
  try {
    const { email, password } = req.body;

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

    notifySignup({
      to: email,
      name: email.split('@')[0],
    });

    res.status(201).json({ accessToken, refreshToken, userId, playerId: null, ownerId: null, ownedClubId: null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', validate({
  password: [rules.required, rules.string, rules.maxLength(128)],
}), async (req, res) => {
  try {
    const { email, identifier, password } = req.body;
    const loginIdentifier = String(identifier || email || '').trim();
    if (!loginIdentifier) return res.status(400).json({ error: 'identifier and password required' });

    // Allow login by: email OR player gamertag OR club name.
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
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    await repairUserProfileLinks(user.id, user.email);

    const payload = { id: user.id, email: user.email };
    const accessToken  = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    await EXECUTESQL(
      'INSERT INTO auth_tokens (id, email, refresh_token, created_date) VALUES (?, ?, ?, NOW())',
      [uuidv4(), user.email, refreshToken]
    );

    const players = await EXECUTESQL(
      'SELECT id FROM players WHERE user_id = ? OR LOWER(TRIM(email)) = LOWER(TRIM(?)) LIMIT 1',
      [user.id, user.email]
    );
    const clubs = await EXECUTESQL(
      'SELECT id, president_user_id FROM clubs WHERE president_user_id = ? OR user_id = ? OR LOWER(TRIM(owner_email)) = LOWER(TRIM(?)) ORDER BY president_user_id = ? DESC, user_id = ? DESC LIMIT 1',
      [user.id, user.id, user.email, user.id, user.id]
    );
    const presidentClubId = clubs[0]?.president_user_id === user.id ? clubs[0]?.id : clubs[0]?.id || null;

    res.json({
      accessToken,
      refreshToken,
      userId: user.id,
      playerId: players[0]?.id || null,
      ownerId: clubs[0]?.id || null,
      ownedClubId: clubs[0]?.id || null,
      presidentClubId,
      roleId: Number(user.role_id ?? 1),
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
    await repairUserProfileLinks(decoded.id, decoded.email);

    const rows = await EXECUTESQL(
      `SELECT
         u.id,
         u.email,
         u.role_id,
         u.access_mode,
         u.limited_tournament_id,
         u.limited_mode_expires_at,
         u.credits,
         u.credits_refreshed_at,
         u.timezone,
         u.created_date,
         u.updated_date,
         r.name AS db_role_name,
         p.id AS player_id,
         p.gamertag,
         p.subscription,
         p.role AS player_role,
         p.club_id,
         c.id AS owner_id,
         c.id AS owned_club_id,
         c.id AS president_club_id,
         c.president_id AS club_president_id,
         c.president_player_id AS club_president_player_id,
         c.name AS club_name,
         pr.id AS president_id,
         pr.display_name AS president_display_name
       FROM users u
       LEFT JOIN roles r   ON r.id = u.role_id
       LEFT JOIN players p ON p.user_id = u.id OR LOWER(TRIM(p.email)) = LOWER(TRIM(u.email))
       LEFT JOIN clubs c   ON c.president_user_id = u.id OR c.user_id = u.id OR c.president_player_id = p.id OR LOWER(TRIM(c.owner_email)) = LOWER(TRIM(u.email))
       LEFT JOIN presidents pr ON pr.user_id = u.id OR pr.id = c.president_id
       WHERE u.id = ?
       ORDER BY p.user_id = u.id DESC, c.president_user_id = u.id DESC, c.user_id = u.id DESC, (pr.user_id = u.id) DESC, p.updated_date DESC, c.updated_date DESC
       LIMIT 1`,
      [decoded.id]
    );
    if (!rows.length) return res.status(401).json({ error: 'User not found' });
    const me = rows[0];
    const roleId = me.role_id ?? 1;
    const roleName = me.db_role_name || (Number(roleId) === 0 ? 'admin' : 'player_club');
    const appRole = Number(roleId) === 0 ? 'admin' : (me.player_role || 'player');
    const presidentId = me.president_id || me.club_president_id || null;

    res.json({
      id: me.id,
      email: me.email,
      created_date: me.created_date,
      updated_date: me.updated_date,
      player_id: me.player_id || null,
      owner_id: me.owner_id || null,
      owned_club_id: me.owned_club_id || me.owner_id || null,
      president_id: presidentId,
      president_player_id: me.club_president_player_id || null,
      president_display_name: me.president_display_name || null,
      president_club_id: me.president_club_id || null,
      president_club_name: me.president_club_id ? me.club_name || null : null,
      role_id: roleId,
      role_name: roleName,
      role: appRole,
      access_mode: me.access_mode || 'standard',
      limited_tournament_id: me.limited_tournament_id || null,
      limited_mode_expires_at: me.limited_mode_expires_at || null,
      credits: Math.max(0, Number(me.credits || 0)),
      credits_refreshed_at: me.credits_refreshed_at || null,
      timezone: me.timezone || 'Europe/Brussels',
      subscription: me.subscription || null,
      gamertag: me.gamertag || null,
      club_id: me.club_id || null,
      club_name: me.club_name || null,
    });
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

router.patch('/timezone', async (req, res) => {
  try {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });
    const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET);
    const timezone = String(req.body?.timezone || '').trim();
    if (!isValidTimeZone(timezone)) {
      return res.status(400).json({ error: 'Invalid timezone. Use an IANA timezone like Europe/Brussels.' });
    }
    await EXECUTESQL('UPDATE users SET timezone = ?, updated_date = NOW() WHERE id = ?', [timezone, decoded.id]);
    res.json({ success: true, timezone });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;

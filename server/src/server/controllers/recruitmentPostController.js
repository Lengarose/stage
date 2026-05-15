const express = require('express');
const router = express.Router();
const RecruitmentPost = require('../models/recruitmentPostModel');
const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

const POST_TYPES = new Set(['player_lfg', 'club_recruiting', 'trial_request']);
const STATUSES = new Set(['open', 'closed', 'expired']);

async function getUser(req) {
  const rows = await EXECUTESQL('SELECT id, email, role_id FROM users WHERE id = ? LIMIT 1', [req.user?.id]);
  return rows[0] || null;
}

function isAdmin(user) {
  return Number(user?.role_id) === 0;
}

function parseJsonField(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try { return JSON.parse(value); } catch { return []; }
}

async function canManagePost(user, post) {
  if (isAdmin(user)) return true;
  if (post.author_user_id === user?.id) return true;
  if (post.author_club_id) {
    const clubs = await EXECUTESQL('SELECT id FROM clubs WHERE id = ? AND user_id = ? LIMIT 1', [post.author_club_id, user?.id]);
    if (clubs.length) return true;
  }
  return false;
}

async function audit(user, action, post, oldValue, newValue, reason) {
  await EXECUTESQL(
    `INSERT INTO admin_audit_log
       (id, admin_user_id, admin_email, action, entity_type, entity_id, entity_name,
        old_value, new_value, reason, created_date)
     VALUES (?, ?, ?, ?, 'recruitment_post', ?, ?, ?, ?, ?, NOW())`,
    [
      uuidv4(), user?.id || null, user?.email || null, action, post.id,
      post.title || null,
      oldValue ? JSON.stringify(oldValue) : null,
      newValue ? JSON.stringify(newValue) : null,
      reason || null,
    ]
  ).catch(() => {});
}

router.get('/', async (req, res) => {
  try {
    await EXECUTESQL("UPDATE recruitment_posts SET status = 'expired', updated_date = NOW() WHERE status = 'open' AND expires_at IS NOT NULL AND expires_at < NOW()").catch(() => {});
    const rows = await new RecruitmentPost().selectAll(req.query);
    res.json(rows.map(row => ({
      ...row,
      positions_needed: parseJsonField(row.positions_needed),
      preferred_positions: parseJsonField(row.preferred_positions),
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const rows = await new RecruitmentPost().selectOne(req.params.id);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const row = rows[0];
    res.json({
      ...row,
      positions_needed: parseJsonField(row.positions_needed),
      preferred_positions: parseJsonField(row.preferred_positions),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'User not found' });
    const body = { ...req.body };
    if (!POST_TYPES.has(body.post_type)) return res.status(400).json({ error: 'Invalid post_type' });
    if (!body.title || !body.platform || !body.region) return res.status(400).json({ error: 'title, platform and region are required' });
    body.author_user_id = user.id;
    body.status = STATUSES.has(body.status) ? body.status : 'open';

    if (body.post_type === 'club_recruiting') {
      if (!body.author_club_id) return res.status(400).json({ error: 'author_club_id required for club posts' });
      const clubRows = await EXECUTESQL('SELECT id FROM clubs WHERE id = ? AND (user_id = ? OR owner_email = ?) LIMIT 1', [body.author_club_id, user.id, user.email]);
      if (!clubRows.length && !isAdmin(user)) return res.status(403).json({ error: 'You can only post for your own club' });
      body.author_player_id = null;
    } else {
      if (!body.author_player_id) {
        const players = await EXECUTESQL('SELECT id FROM players WHERE user_id = ? OR LOWER(email)=LOWER(?) LIMIT 1', [user.id, user.email]);
        body.author_player_id = players[0]?.id || null;
      }
      if (!body.author_player_id) return res.status(400).json({ error: 'author_player_id required for player posts' });
      const playerRows = await EXECUTESQL('SELECT id FROM players WHERE id = ? AND (user_id = ? OR LOWER(email)=LOWER(?)) LIMIT 1', [body.author_player_id, user.id, user.email]);
      if (!playerRows.length && !isAdmin(user)) return res.status(403).json({ error: 'You can only post for your own player' });
      body.author_club_id = null;
    }

    const model = new RecruitmentPost(body);
    await model.create();
    const created = await model.selectOne(model.id);
    res.status(201).json(created[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'User not found' });
    const existingRows = await new RecruitmentPost().selectOne(req.params.id);
    if (!existingRows.length) return res.status(404).json({ error: 'Not found' });
    const existing = existingRows[0];
    if (!await canManagePost(user, existing)) return res.status(403).json({ error: 'Forbidden' });

    const body = { ...existing, ...req.body };
    if (!POST_TYPES.has(body.post_type)) return res.status(400).json({ error: 'Invalid post_type' });
    if (!STATUSES.has(body.status)) return res.status(400).json({ error: 'Invalid status' });
    const model = new RecruitmentPost(body);
    await model.update(req.params.id);
    const updated = await model.selectOne(req.params.id);
    if (isAdmin(user) && req.body.status && req.body.status !== existing.status) {
      await audit(user, 'set_recruitment_post_status', existing, existing, updated[0], req.body.reason);
    }
    res.json(updated[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'User not found' });
    const existingRows = await new RecruitmentPost().selectOne(req.params.id);
    if (!existingRows.length) return res.status(404).json({ error: 'Not found' });
    if (!await canManagePost(user, existingRows[0])) return res.status(403).json({ error: 'Forbidden' });
    await new RecruitmentPost().delete(req.params.id);
    if (isAdmin(user)) await audit(user, 'delete_recruitment_post', existingRows[0], existingRows[0], null, req.body?.reason);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

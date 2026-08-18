const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { EXECUTESQL } = require('../db/database');
const PlayerCardBackground = require('../models/playerCardBackgroundModel');

async function requireAdmin(req) {
  const rows = await EXECUTESQL('SELECT id, email, role_id FROM users WHERE id = ? LIMIT 1', [req.user?.id]);
  const user = rows[0];
  if (!user) {
    const err = new Error('Not authenticated');
    err.status = 401;
    throw err;
  }
  if (![0, 2].includes(Number(user.role_id))) {
    const err = new Error('Admin only');
    err.status = 403;
    throw err;
  }
  return user;
}

function auditValue(value) {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value); } catch { return String(value); }
}

function isImageUrl(value) {
  const url = String(value || '').trim();
  if (!url) return false;
  const imagePath = (pathname) => /\.(jpe?g|png|webp|gif)$/i.test(String(pathname || '').split('?')[0]);
  if (url.startsWith('/uploads/') || url.startsWith('uploads/')) return imagePath(url);
  try {
    const parsed = new URL(url);
    return imagePath(parsed.pathname);
  } catch {
    return false;
  }
}

async function audit(admin, action, entityId, before, after, reason) {
  await EXECUTESQL(
    `INSERT INTO admin_audit_log
       (id, admin_user_id, admin_email, action, entity_type, entity_id, entity_name, old_value, new_value, reason, created_date)
     VALUES (?, ?, ?, ?, 'player_card_background', ?, ?, ?, ?, ?, NOW())`,
    [
      uuidv4(),
      admin.id,
      admin.email,
      action,
      entityId || null,
      after?.name || before?.name || 'Player card background',
      auditValue(before),
      auditValue(after),
      reason || null,
    ],
  ).catch((err) => console.error('[playerCardBackground audit]', err.message));
}

function normalizeBody(body = {}, adminId = null) {
  return {
    name: String(body.name || '').trim(),
    description: body.description || null,
    image_url: String(body.image_url || '').trim(),
    is_active: body.is_active == null ? 1 : Number(Boolean(body.is_active)),
    is_stage_plus: 1,
    sort_order: Number(body.sort_order) || 0,
    created_by: adminId,
  };
}

router.get('/', async (req, res) => {
  try {
    const model = new PlayerCardBackground();
    const rows = await model.selectAll(req.query);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const rows = await new PlayerCardBackground().selectOne(req.params.id);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const admin = await requireAdmin(req);
    const body = normalizeBody(req.body, admin.id);
    if (!body.name || !body.image_url) return res.status(400).json({ error: 'Name and image_url are required' });
    if (!isImageUrl(body.image_url)) return res.status(400).json({ error: 'image_url must point to an image file' });
    const model = new PlayerCardBackground(body);
    await model.create();
    const created = (await model.selectOne(model.id))[0];
    await audit(admin, 'create_player_card_background', model.id, null, created, req.body?.reason);
    res.status(201).json(created);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const admin = await requireAdmin(req);
    const before = (await new PlayerCardBackground().selectOne(req.params.id))[0];
    if (!before) return res.status(404).json({ error: 'Not found' });
    const body = normalizeBody({ ...before, ...req.body }, before.created_by || admin.id);
    if (!body.name || !body.image_url) return res.status(400).json({ error: 'Name and image_url are required' });
    if (!isImageUrl(body.image_url)) return res.status(400).json({ error: 'image_url must point to an image file' });
    const model = new PlayerCardBackground(body);
    await model.update(req.params.id);
    const after = (await model.selectOne(req.params.id))[0];
    await audit(admin, 'update_player_card_background', req.params.id, before, after, req.body?.reason);
    res.json(after);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const admin = await requireAdmin(req);
    const before = (await new PlayerCardBackground().selectOne(req.params.id))[0];
    if (!before) return res.status(404).json({ error: 'Not found' });
    await new PlayerCardBackground().delete(req.params.id);
    await audit(admin, 'delete_player_card_background', req.params.id, before, null, req.body?.reason);
    res.json({ success: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;

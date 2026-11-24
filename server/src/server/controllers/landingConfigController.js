const express = require('express');
const router = express.Router();
const LandingConfig = require('../models/landingConfigModel');
const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

async function requireAdmin(req) {
  const userId = req.user?.id;
  if (!userId) {
    const err = new Error('not authenticated');
    err.status = 401;
    throw err;
  }
  const rows = await EXECUTESQL('SELECT id, email, role_id FROM users WHERE id = ? LIMIT 1', [userId]);
  const user = rows[0];
  if (!user || ![0, 2].includes(Number(user.role_id))) {
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

async function audit(admin, action, entityId, before, after, reason) {
  await EXECUTESQL(
    `INSERT INTO admin_audit_log
       (id, admin_user_id, admin_email, action, entity_type, entity_id, entity_name, old_value, new_value, reason, created_date)
     VALUES (?, ?, ?, ?, 'landing_config', ?, 'STAGE Landing Page', ?, ?, ?, NOW())`,
    [uuidv4(), admin.id, admin.email, action, entityId || null, auditValue(before), auditValue(after), reason || null]
  ).catch((err) => console.error('[landingConfig audit]', err.message));
}



router.get('/', async (req, res) => {
  try {
    const rows = await new LandingConfig().selectAll(1);
    res.json(rows);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const rows = await new LandingConfig().selectOne(req.params.id);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const admin = await requireAdmin(req);
    const cfg = new LandingConfig(req.body);
    await cfg.create();
    const created = await cfg.selectOne(cfg.id);
    await audit(admin, 'create_landing_config', cfg.id, null, created[0], req.body.reason);
    res.status(201).json(created[0]);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const admin = await requireAdmin(req);
    const { id } = req.params;
    const existing = await new LandingConfig().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    const cfg = new LandingConfig({ ...existing[0], ...req.body });
    await cfg.update(id);
    const updated = await cfg.selectOne(id);
    await audit(admin, 'update_landing_config', id, existing[0], updated[0], req.body.reason);
    res.json(updated[0]);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const admin = await requireAdmin(req);
    const { id } = req.params;
    const existing = await new LandingConfig().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    await new LandingConfig().delete(id);
    await audit(admin, 'delete_landing_config', req.params.id, existing[0], null, req.body?.reason);
    res.json({ success: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;

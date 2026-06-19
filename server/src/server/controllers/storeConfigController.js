const express = require('express');
const router = express.Router();
const StoreConfig = require('../models/storeConfigModel');
const { EXECUTESQL } = require('../db/database');
const { DEFAULT_STORE_SETTINGS } = require('../utils/storeSettings');
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
     VALUES (?, ?, ?, ?, 'store_config', ?, 'STAGE Plus Store', ?, ?, ?, NOW())`,
    [uuidv4(), admin.id, admin.email, action, entityId || null, auditValue(before), auditValue(after), reason || null]
  ).catch((err) => console.error('[storeConfig audit]', err.message));
}

router.get('/', async (req, res) => {
  try {
    const rows = await new StoreConfig().selectAll(req.query, req.query.limit || 50);
    if (!rows.length && Number(req.query.with_defaults || 0)) {
      return res.json([{ id: null, name: 'STAGE Plus', is_active: 1, ...DEFAULT_STORE_SETTINGS }]);
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const rows = await new StoreConfig().selectOne(req.params.id);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const admin = await requireAdmin(req);
    const cfg = new StoreConfig(req.body);
    await cfg.create();
    const created = (await cfg.selectOne(cfg.id))[0];
    await audit(admin, 'create_store_config', cfg.id, null, created, req.body.reason);
    res.status(201).json(created);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const admin = await requireAdmin(req);
    const { id } = req.params;
    const before = (await new StoreConfig().selectOne(id))[0];
    if (!before) return res.status(404).json({ error: 'Not found' });
    const cfg = new StoreConfig({ ...before, ...req.body });
    await cfg.update(id);
    const after = (await cfg.selectOne(id))[0];
    await audit(admin, 'update_store_config', id, before, after, req.body.reason);
    res.json(after);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const admin = await requireAdmin(req);
    const before = (await new StoreConfig().selectOne(req.params.id))[0];
    if (!before) return res.status(404).json({ error: 'Not found' });
    await new StoreConfig().delete(req.params.id);
    await audit(admin, 'delete_store_config', req.params.id, before, null, req.body?.reason);
    res.json({ success: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;

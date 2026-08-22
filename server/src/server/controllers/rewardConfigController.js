/**
 * REST controller for `reward_configs`.
 *
 * Consumed by the admin Rewards tab via `stageClient.entities.RewardConfig`.
 * Defines, per competition / regional league, how STC prize money and badges
 * are distributed across final positions. Achievement rows are written by
 * `rewardsEngine.js` when a season is archived.
 *
 *   GET    /                    list (filter: source_id, source_type)
 *   GET    /:id                 one
 *   POST   /                    create
 *   PATCH  /:id                 update (partial via merge with existing row)
 *   DELETE /:id                 delete
 */
const express = require('express');
const router = express.Router();
const { EXECUTESQL } = require('../db/database');
const RewardConfigModel = require('../models/rewardConfigModel');
const { v4: uuidv4 } = require('uuid');

const FILTER_FIELDS = ['source_id', 'source_type', 'source_name'];

async function requireAdmin(req) {
  const rows = await EXECUTESQL('SELECT id, email, role_id FROM users WHERE id = ? LIMIT 1', [req.user?.id || null]);
  const user = rows[0];
  if (!user || ![0, 2].includes(Number(user.role_id))) {
    const err = new Error('Admin access required');
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
     VALUES (?, ?, ?, ?, 'reward_config', ?, ?, ?, ?, ?, NOW())`,
    [
      uuidv4(),
      admin.id,
      admin.email,
      action,
      entityId || null,
      after?.source_name || before?.source_name || 'Reward Config',
      auditValue(before),
      auditValue(after),
      reason || null,
    ],
  ).catch((err) => console.error('[rewardConfig audit]', err.message));
}

function buildWhere(query) {
  const where = [];
  const params = [];
  for (const field of FILTER_FIELDS) {
    const value = query?.[field];
    if (value !== undefined && value !== null && value !== '') {
      where.push(`${field} = ?`);
      params.push(String(value));
    }
  }
  return { clause: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

router.get('/', async (req, res) => {
  try {
    const { clause, params } = buildWhere(req.query);
    const cap = Math.max(1, Math.min(Number(req.query?.limit) || 200, 500));
    const sql = `SELECT * FROM reward_configs ${clause} ORDER BY source_id ASC, position ASC LIMIT ?`;
    params.push(cap);
    const rows = await EXECUTESQL(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const rows = await new RewardConfigModel().selectOne(req.params.id);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const admin = await requireAdmin(req);
    const rc = new RewardConfigModel(req.body);
    await rc.create();
    const created = await rc.selectOne(rc.id);
    await audit(admin, 'create_reward_config', rc.id, null, created[0], req.body?.reason);
    res.status(201).json(created[0]);
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const admin = await requireAdmin(req);
    const { id } = req.params;
    const existing = await new RewardConfigModel().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    const rc = new RewardConfigModel({ ...existing[0], ...req.body });
    await rc.update(id);
    const updated = await rc.selectOne(id);
    await audit(admin, 'update_reward_config', id, existing[0], updated[0], req.body?.reason);
    res.json(updated[0]);
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const admin = await requireAdmin(req);
    const { id } = req.params;
    const existing = await new RewardConfigModel().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    await new RewardConfigModel().delete(id);
    await audit(admin, 'delete_reward_config', id, existing[0], null, req.body?.reason);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;

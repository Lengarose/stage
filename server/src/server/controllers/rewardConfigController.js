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

const FILTER_FIELDS = ['source_id', 'source_type', 'source_name'];

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
    const rc = new RewardConfigModel(req.body);
    await rc.create();
    const created = await rc.selectOne(rc.id);
    res.status(201).json(created[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await new RewardConfigModel().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    const rc = new RewardConfigModel({ ...existing[0], ...req.body });
    await rc.update(id);
    const updated = await rc.selectOne(id);
    res.json(updated[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await new RewardConfigModel().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    await new RewardConfigModel().delete(id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

/**
 * REST controller for `objective_definitions`.
 *
 * Catalogue of Daily / Weekly / Season objectives a player can complete.
 * Player-side progress is tracked via /api/stage/objective-progresses and
 * rewards are claimed via /api/stage/functions/claimObjectiveReward.
 *
 *   GET    /                    list (filters: scope, is_active)
 *   GET    /:id                 one
 *   POST   /                    create  (admin-only in practice)
 *   PATCH  /:id                 update
 *   DELETE /:id                 delete
 */
const express = require('express');
const router  = express.Router();
const { EXECUTESQL } = require('../db/database');
const ObjectiveDefinitionModel = require('../models/objectiveDefinitionModel');

const FILTER_FIELDS = ['scope', 'metric', 'code'];

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
  if (query?.is_active !== undefined && query.is_active !== '') {
    where.push('is_active = ?');
    params.push(Number(query.is_active) ? 1 : 0);
  }
  if (query?.only_active === '1' || query?.only_active === 'true') {
    where.push('is_active = 1');
    where.push('(active_from IS NULL OR active_from <= NOW())');
    where.push('(active_until IS NULL OR active_until > NOW())');
  }
  return { clause: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

router.get('/', async (req, res) => {
  try {
    const { clause, params } = buildWhere(req.query);
    const cap = Math.max(1, Math.min(Number(req.query?.limit) || 200, 500));
    const sql = `SELECT * FROM objective_definitions ${clause} ORDER BY scope ASC, created_date DESC LIMIT ?`;
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
    const rows = await new ObjectiveDefinitionModel().selectOne(req.params.id);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const m = new ObjectiveDefinitionModel(req.body);
    await m.create();
    const created = await m.selectOne(m.id);
    res.status(201).json(created[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await new ObjectiveDefinitionModel().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    const m = new ObjectiveDefinitionModel({ ...existing[0], ...req.body });
    await m.update(id);
    const updated = await m.selectOne(id);
    res.json(updated[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await new ObjectiveDefinitionModel().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    await new ObjectiveDefinitionModel().delete(id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

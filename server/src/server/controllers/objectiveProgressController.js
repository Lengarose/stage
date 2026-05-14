/**
 * REST controller for `objective_progress`.
 *
 * Per-player progress on Daily / Weekly objectives. Progress is INCREMENTED
 * by the match pipeline (matchModel / scheduleEngine post-match hook) — admin
 * mutations through PATCH should be rare and audit-logged externally.
 *
 *   GET    /                    list (filters: player_id, objective_id, scope, claimed)
 *   GET    /:id                 one
 *   POST   /                    create (used by the post-match hook to seed)
 *   PATCH  /:id                 update
 *   DELETE /:id                 delete
 *
 * The reward-claim endpoint is intentionally NOT here — it is a transactional
 * action handled by functionsController#claimObjectiveReward.
 */
const express = require('express');
const router  = express.Router();
const { EXECUTESQL } = require('../db/database');
const ObjectiveProgressModel = require('../models/objectiveProgressModel');

const FILTER_FIELDS = ['player_id', 'player_email', 'objective_id', 'scope'];

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
  if (query?.claimed === '1' || query?.claimed === 'true') {
    where.push('claimed_at IS NOT NULL');
  } else if (query?.claimed === '0' || query?.claimed === 'false') {
    where.push('claimed_at IS NULL');
  }
  if (query?.completed === '1' || query?.completed === 'true') {
    where.push('completed_at IS NOT NULL');
  } else if (query?.completed === '0' || query?.completed === 'false') {
    where.push('completed_at IS NULL');
  }
  return { clause: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

router.get('/', async (req, res) => {
  try {
    const { clause, params } = buildWhere(req.query);
    const cap = Math.max(1, Math.min(Number(req.query?.limit) || 100, 500));
    const sql = `SELECT * FROM objective_progress ${clause} ORDER BY created_date DESC LIMIT ?`;
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
    const rows = await new ObjectiveProgressModel().selectOne(req.params.id);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const m = new ObjectiveProgressModel(req.body);
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
    const existing = await new ObjectiveProgressModel().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    const m = new ObjectiveProgressModel({ ...existing[0], ...req.body });
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
    const existing = await new ObjectiveProgressModel().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    await new ObjectiveProgressModel().delete(id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

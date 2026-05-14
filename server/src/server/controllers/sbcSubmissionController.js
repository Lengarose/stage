/**
 * REST controller for `sbc_submissions`.
 *
 * Read-only audit/history view. The actual *mutation* (creating a submission,
 * sacrificing players, granting the reward) is performed atomically by
 * functionsController#submitSbc — see that function for the business logic.
 *
 *   GET    /                    list (filters: sbc_id, player_id, status)
 *   GET    /:id                 one
 *   POST   /                    create — accepted but flagged 'pending';
 *                               use functions/submitSbc for the real flow
 *   PATCH  /:id                 admin override only
 *   DELETE /:id                 admin override only
 */
const express = require('express');
const router  = express.Router();
const { EXECUTESQL } = require('../db/database');
const SbcSubmissionModel = require('../models/sbcSubmissionModel');

const FILTER_FIELDS = ['sbc_id', 'player_id', 'player_email', 'club_id', 'status'];

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
    const cap = Math.max(1, Math.min(Number(req.query?.limit) || 100, 500));
    const sql = `SELECT * FROM sbc_submissions ${clause} ORDER BY created_date DESC LIMIT ?`;
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
    const rows = await new SbcSubmissionModel().selectOne(req.params.id);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const m = new SbcSubmissionModel({ ...req.body, status: 'pending' });
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
    const existing = await new SbcSubmissionModel().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    const m = new SbcSubmissionModel({ ...existing[0], ...req.body });
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
    const existing = await new SbcSubmissionModel().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    await new SbcSubmissionModel().delete(id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

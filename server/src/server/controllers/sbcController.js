/**
 * REST controller for `sbcs` (Squad Building Challenge definitions).
 *
 * Read-mostly for end users. Admins create/edit/expire SBCs.
 * Submissions go through /api/stage/functions/submitSbc, NOT through this
 * controller — sacrificing players and crediting rewards must be atomic.
 *
 *   GET    /                    list (filters: category, is_active, only_active)
 *   GET    /:id                 one
 *   POST   /                    create
 *   PATCH  /:id                 update
 *   DELETE /:id                 delete
 */
const express = require('express');
const router  = express.Router();
const { EXECUTESQL } = require('../db/database');
const SbcModel = require('../models/sbcModel');

const FILTER_FIELDS = ['category', 'name'];

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
    where.push('(expires_at IS NULL OR expires_at > NOW())');
  }
  return { clause: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

router.get('/', async (req, res) => {
  try {
    const { clause, params } = buildWhere(req.query);
    const cap = Math.max(1, Math.min(Number(req.query?.limit) || 100, 500));
    const sql = `SELECT * FROM sbcs ${clause} ORDER BY created_date DESC LIMIT ?`;
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
    const rows = await new SbcModel().selectOne(req.params.id);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const m = new SbcModel(req.body);
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
    const existing = await new SbcModel().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    const m = new SbcModel({ ...existing[0], ...req.body });
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
    const existing = await new SbcModel().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    await new SbcModel().delete(id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

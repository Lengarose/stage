/**
 * REST controller for `archetypes`.
 *
 * Read-mostly. Seeded by the startup migration with 13 default archetypes
 * (inspired by EAFC 26 Clubs Pro). Admins can override via PATCH; new
 * archetypes can be added via POST.
 *
 *   GET    /                    list (filters: code, position, is_active)
 *   GET    /:id                 one
 *   POST   /                    create
 *   PATCH  /:id                 update
 *   DELETE /:id                 delete
 */
const express = require('express');
const router  = express.Router();
const { EXECUTESQL } = require('../db/database');
const ArchetypeModel = require('../models/archetypeModel');

const FILTER_FIELDS = ['code', 'position', 'name'];

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
  return { clause: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

router.get('/', async (req, res) => {
  try {
    const { clause, params } = buildWhere(req.query);
    const cap = Math.max(1, Math.min(Number(req.query?.limit) || 100, 500));
    const sql = `SELECT * FROM archetypes ${clause} ORDER BY sort_order ASC, name ASC LIMIT ?`;
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
    const rows = await new ArchetypeModel().selectOne(req.params.id);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const m = new ArchetypeModel(req.body);
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
    const existing = await new ArchetypeModel().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    const m = new ArchetypeModel({ ...existing[0], ...req.body });
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
    const existing = await new ArchetypeModel().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    await new ArchetypeModel().delete(id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

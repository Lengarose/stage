/**
 * REST controller for `chemistry_links`.
 *
 * Stores pairwise chemistry relationships between players. Read by
 * chemistryService#computeChemistry which the scheduleEngine consults at
 * match-simulation time.
 *
 *   GET    /                    list
 *     filters: player_id (returns all links touching this player),
 *              squad_ids (CSV — returns only intra-squad links),
 *              link_type, source, is_active
 *   GET    /:id                 one
 *   POST   /                    create (auto-canonicalised pair ordering)
 *   PATCH  /:id                 update
 *   DELETE /:id                 delete
 */
const express = require('express');
const router  = express.Router();
const { EXECUTESQL } = require('../db/database');
const ChemistryLinkModel = require('../models/chemistryLinkModel');

const FILTER_FIELDS = ['link_type', 'source'];

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
  if (query?.player_id) {
    where.push('(player_a_id = ? OR player_b_id = ?)');
    params.push(String(query.player_id), String(query.player_id));
  }
  if (query?.squad_ids) {
    const ids = String(query.squad_ids).split(',').map(s => s.trim()).filter(Boolean);
    if (ids.length >= 2) {
      const ph = ids.map(() => '?').join(',');
      where.push(`player_a_id IN (${ph}) AND player_b_id IN (${ph})`);
      params.push(...ids, ...ids);
    }
  }
  return { clause: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

router.get('/', async (req, res) => {
  try {
    const { clause, params } = buildWhere(req.query);
    const cap = Math.max(1, Math.min(Number(req.query?.limit) || 200, 1000));
    const sql = `SELECT * FROM chemistry_links ${clause} ORDER BY created_date DESC LIMIT ?`;
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
    const rows = await new ChemistryLinkModel().selectOne(req.params.id);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const m = new ChemistryLinkModel(req.body);
    if (!m.player_a_id || !m.player_b_id || m.player_a_id === m.player_b_id) {
      return res.status(400).json({ error: 'player_a_id and player_b_id required and must differ' });
    }
    // Dedupe on canonical pair if same link_type already exists
    const existing = await new ChemistryLinkModel().selectByPair(m.player_a_id, m.player_b_id);
    const sameType = existing.find(e => e.link_type === m.link_type);
    if (sameType) {
      // Refresh bonus factor / description if changed, keep id stable
      const merged = new ChemistryLinkModel({ ...sameType, ...req.body, id: sameType.id });
      await merged.update(sameType.id);
      const updated = await merged.selectOne(sameType.id);
      return res.status(200).json(updated[0]);
    }
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
    const existing = await new ChemistryLinkModel().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    const m = new ChemistryLinkModel({ ...existing[0], ...req.body });
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
    const existing = await new ChemistryLinkModel().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    await new ChemistryLinkModel().delete(id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

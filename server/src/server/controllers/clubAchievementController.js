/**
 * REST controller for `club_achievements`.
 *
 * Records the trophies / final standings each club has earned at the end of
 * a competition or regional-league season. Written by `rewardsEngine.js`
 * when a season is archived; read by the trophy cabinet, club profile and
 * admin reward views via `stageClient.entities.ClubAchievement`.
 *
 *   GET    /                    list (filter: club_id, source_id, source_type,
 *                                      season_id, season_number, badge_type)
 *   GET    /:id                 one
 *   POST   /                    create
 *   PATCH  /:id                 update (partial)
 *   DELETE /:id                 delete
 */
const express = require('express');
const router = express.Router();
const { EXECUTESQL } = require('../db/database');
const ClubAchievementModel = require('../models/clubAchievementModel');

const FILTER_FIELDS = [
  'club_id',
  'source_id',
  'source_type',
  'season_id',
  'season_number',
  'badge_type',
];

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
    const sql = `SELECT * FROM club_achievements ${clause} ORDER BY awarded_at DESC LIMIT ?`;
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
    const rows = await new ClubAchievementModel().selectOne(req.params.id);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const body = { ...req.body };
    if (!body.awarded_at) body.awarded_at = new Date().toISOString();
    const ach = new ClubAchievementModel(body);
    await ach.create();
    const created = await ach.selectOne(ach.id);
    res.status(201).json(created[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await new ClubAchievementModel().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    const ach = new ClubAchievementModel({ ...existing[0], ...req.body });
    await ach.update(id);
    const updated = await ach.selectOne(id);
    res.json(updated[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await new ClubAchievementModel().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    await new ClubAchievementModel().delete(id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

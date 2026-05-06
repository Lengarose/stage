const express         = require('express');
const router          = express.Router();
const MatchPlayerStat = require('../models/matchPlayerStatModel');

// GET /
router.get('/', async (req, res) => {
  try {
    const { match_id, player_email, page } = req.query;
    const stat = new MatchPlayerStat();
    let result;
    if (match_id)      result = await stat.selectByMatch(match_id);
    else if (player_email) result = await stat.selectByPlayer(player_email);
    else result = await stat.selectAll(Number(page) || 1);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const stat   = new MatchPlayerStat();
    const result = await stat.selectOne(req.params.id);
    if (!result.length) return res.status(404).json({ error: 'Not found' });
    res.json(result[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /
router.post('/', async (req, res) => {
  try {
    const stat = new MatchPlayerStat(req.body);
    await stat.create();
    const created = await stat.selectOne(stat.id);
    res.status(201).json(created[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /:id
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await new MatchPlayerStat().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    const stat = new MatchPlayerStat({ ...existing[0], ...req.body });
    await stat.update(id);
    const updated = await stat.selectOne(id);
    res.json(updated[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await new MatchPlayerStat().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    await new MatchPlayerStat().delete(id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

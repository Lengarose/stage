const express        = require('express');
const router         = express.Router();
const RatingHistory  = require('../models/ratingHistoryModel');

router.get('/', async (req, res) => {
  try {
    const { club_id, match_id, page, limit } = req.query;
    const rh = new RatingHistory();
    let result;
    if (club_id)       result = await rh.selectByClub(club_id);
    else if (match_id) result = await rh.selectByMatch(match_id);
    else               result = await rh.selectAll(Number(page) || 1);
    if (limit) result = result.slice(0, Number(limit));
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await new RatingHistory().selectOne(req.params.id);
    if (!result.length) return res.status(404).json({ error: 'Not found' });
    res.json(result[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const rh = new RatingHistory(req.body);
    await rh.create();
    const record = (await rh.selectOne(rh.id))[0];
    res.status(201).json(record);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await new RatingHistory().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    const rh = new RatingHistory({ ...existing[0], ...req.body });
    await rh.update(id);
    const record = (await rh.selectOne(id))[0];
    res.json(record);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await new RatingHistory().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    await new RatingHistory().delete(id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

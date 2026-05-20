const express    = require('express');
const router     = express.Router();
const Challenge  = require('../models/challengeModel');

router.get('/', async (req, res) => {
  try {
    const { challenger_id, opponent_club_id, status, page, limit } = req.query;
    const ch = new Challenge();
    let result;
    if (challenger_id)     result = await ch.selectByChallenger(challenger_id);
    else if (opponent_club_id) result = await ch.selectByOpponent(opponent_club_id);
    else if (status)       result = await ch.selectByStatus(status);
    else                   result = await ch.selectAll(Number(page) || 1);
    if (limit) result = result.slice(0, Number(limit));
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await new Challenge().selectOne(req.params.id);
    if (!result.length) return res.status(404).json({ error: 'Not found' });
    res.json(result[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const ch = new Challenge(req.body);
    await ch.create();
    const record = (await ch.selectOne(ch.id))[0];
    res.status(201).json(record);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await new Challenge().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    const ch = new Challenge({ ...existing[0], ...req.body });
    await ch.update(id);
    const record = (await ch.selectOne(id))[0];
    res.json(record);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await new Challenge().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    await new Challenge().delete(id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

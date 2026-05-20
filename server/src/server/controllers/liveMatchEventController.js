const express         = require('express');
const router          = express.Router();
const LiveMatchEvent  = require('../models/liveMatchEventModel');

router.get('/', async (req, res) => {
  try {
    const { live_match_id, page, limit } = req.query;
    const lme = new LiveMatchEvent();
    let result;
    if (live_match_id) result = await lme.selectByMatch(live_match_id);
    else               result = await lme.selectAll(Number(page) || 1);
    if (limit) result = result.slice(0, Number(limit));
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await new LiveMatchEvent().selectOne(req.params.id);
    if (!result.length) return res.status(404).json({ error: 'Not found' });
    res.json(result[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const lme = new LiveMatchEvent(req.body);
    await lme.create();
    const record = (await lme.selectOne(lme.id))[0];
    res.status(201).json(record);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await new LiveMatchEvent().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    const lme = new LiveMatchEvent({ ...existing[0], ...req.body });
    await lme.update(id);
    const record = (await lme.selectOne(id))[0];
    res.json(record);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await new LiveMatchEvent().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    await new LiveMatchEvent().delete(id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

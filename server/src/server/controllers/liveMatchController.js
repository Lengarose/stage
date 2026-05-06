const express   = require('express');
const router    = express.Router();
const LiveMatch = require('../models/liveMatchModel');
const { socketEmit } = require('../express/index');
const { SOCKET_CHANNELS, MAKE_SOCKET_CHANNEL } = require('../../constants/constants');

router.get('/', async (req, res) => {
  try {
    const { match_id, status, page } = req.query;
    const lm = new LiveMatch();
    let result;
    if (match_id && status) result = await lm.selectByMatchAndStatus(match_id, status);
    else if (match_id)      result = await lm.selectByMatch(match_id);
    else if (status)        result = await lm.selectByStatus(status);
    else result = await lm.selectAll(Number(page) || 1);
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await new LiveMatch().selectOne(req.params.id);
    if (!result.length) return res.status(404).json({ error: 'Not found' });
    res.json(result[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const lm = new LiveMatch(req.body);
    await lm.create();
    const record = (await lm.selectOne(lm.id))[0];
    socketEmit(MAKE_SOCKET_CHANNEL(record.match_id, SOCKET_CHANNELS.MATCH), record);
    res.status(201).json(record);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await new LiveMatch().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    const lm = new LiveMatch({ ...existing[0], ...req.body });
    await lm.update(id);
    const record = (await lm.selectOne(id))[0];
    socketEmit(MAKE_SOCKET_CHANNEL(record.match_id, SOCKET_CHANNELS.MATCH), record);
    res.json(record);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await new LiveMatch().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    const { match_id } = existing[0];
    await new LiveMatch().delete(id);
    socketEmit(MAKE_SOCKET_CHANNEL(match_id, SOCKET_CHANNELS.MATCH), { deleted: true, id });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

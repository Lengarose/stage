const express    = require('express');
const router     = express.Router();
const Tournament = require('../models/tournamentModel');
const { socketEmit } = require('../express/index');
const { SOCKET_CHANNELS, MAKE_SOCKET_CHANNEL } = require('../../constants/constants');

// GET /
router.get('/', async (req, res) => {
  try {
    const { status, page } = req.query;
    const tournament = new Tournament();
    let result;
    if (status) {
      result = await tournament.selectByStatus(status);
    } else {
      result = await tournament.selectAll(Number(page) || 1);
    }
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const tournament = new Tournament();
    const result     = await tournament.selectOne(req.params.id);
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
    const tournament = new Tournament(req.body);
    await tournament.create();
    const created = await tournament.selectOne(tournament.id);
    const record  = created[0];
    socketEmit(MAKE_SOCKET_CHANNEL(record.id, SOCKET_CHANNELS.TOURNAMENT), record);
    res.status(201).json(record);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /:id
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await new Tournament().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    const tournament = new Tournament({ ...existing[0], ...req.body });
    await tournament.update(id);
    const updated = await tournament.selectOne(id);
    const record  = updated[0];
    socketEmit(MAKE_SOCKET_CHANNEL(record.id, SOCKET_CHANNELS.TOURNAMENT), record);
    res.json(record);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await new Tournament().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    await new Tournament().delete(id);
    socketEmit(MAKE_SOCKET_CHANNEL(id, SOCKET_CHANNELS.TOURNAMENT), { deleted: true, id });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

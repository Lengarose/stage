const express = require('express');
const router  = express.Router();
const Match   = require('../models/matchModel');
const { socketEmit } = require('../express/index');
const { SOCKET_CHANNELS, MAKE_SOCKET_CHANNEL } = require('../../constants/constants');

// GET /
router.get('/', async (req, res) => {
  try {
    const { club_id, tournament_id, status, page } = req.query;
    const match = new Match();
    let result;
    if (club_id)       result = await match.selectByClub(club_id);
    else if (tournament_id) result = await match.selectByTournament(tournament_id);
    else if (status)   result = await match.selectByStatus(status);
    else result = await match.selectAll(Number(page) || 1);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const match  = new Match();
    const result = await match.selectOne(req.params.id);
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
    const match = new Match(req.body);
    await match.create();
    const created = await match.selectOne(match.id);
    const record  = created[0];
    socketEmit(MAKE_SOCKET_CHANNEL(record.id, SOCKET_CHANNELS.MATCH), record);
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
    const existing = await new Match().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    const match = new Match({ ...existing[0], ...req.body });
    await match.update(id);
    const updated = await match.selectOne(id);
    const record  = updated[0];
    socketEmit(MAKE_SOCKET_CHANNEL(record.id, SOCKET_CHANNELS.MATCH), record);
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
    const existing = await new Match().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    await new Match().delete(id);
    socketEmit(MAKE_SOCKET_CHANNEL(id, SOCKET_CHANNELS.MATCH), { deleted: true, id });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

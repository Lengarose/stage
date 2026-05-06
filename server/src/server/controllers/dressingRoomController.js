const express      = require('express');
const router       = express.Router();
const DressingRoom = require('../models/dressingRoomModel');
const { socketEmit } = require('../express/index');
const { SOCKET_CHANNELS, MAKE_SOCKET_CHANNEL } = require('../../constants/constants');

// GET /
router.get('/', async (req, res) => {
  try {
    const { match_id, club_id, page } = req.query;
    const dr = new DressingRoom();
    let result;
    if (match_id && club_id) result = await dr.selectByMatchAndClub(match_id, club_id);
    else if (match_id) result = await dr.selectByMatch(match_id);
    else if (club_id)  result = await dr.selectByClub(club_id);
    else result = await dr.selectAll(Number(page) || 1);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const dr     = new DressingRoom();
    const result = await dr.selectOne(req.params.id);
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
    const dr = new DressingRoom(req.body);
    await dr.create();
    const created = await dr.selectOne(dr.id);
    const record  = created[0];
    socketEmit(MAKE_SOCKET_CHANNEL(record.match_id, SOCKET_CHANNELS.DRESSING_ROOM), record);
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
    const existing = await new DressingRoom().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    const dr = new DressingRoom({ ...existing[0], ...req.body });
    await dr.update(id);
    const updated = await dr.selectOne(id);
    const record  = updated[0];
    socketEmit(MAKE_SOCKET_CHANNEL(record.match_id, SOCKET_CHANNELS.DRESSING_ROOM), record);
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
    const existing = await new DressingRoom().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    const { match_id } = existing[0];
    await new DressingRoom().delete(id);
    socketEmit(MAKE_SOCKET_CHANNEL(match_id, SOCKET_CHANNELS.DRESSING_ROOM), { deleted: true, id });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

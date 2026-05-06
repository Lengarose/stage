const express = require('express');
const router  = express.Router();
const Player  = require('../models/playerModel');
const { EXECUTESQL } = require('../db/database');
const { socketEmit } = require('../express/index');
const { SOCKET_CHANNELS, MAKE_SOCKET_CHANNEL } = require('../../constants/constants');

// GET /
router.get('/', async (req, res) => {
  try {
    const { email, user_id, club_id, page } = req.query;
    const player = new Player();
    let result;
    if (email)   result = await player.selectByEmail(email);
    else if (user_id) result = await player.selectByUserId(user_id);
    else if (club_id) result = await player.selectByClub(club_id);
    else result = await player.selectAll(Number(page) || 1);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const player = new Player();
    const result = await player.selectOne(req.params.id);
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
    const player = new Player(req.body);
    await player.create();
    const created = await player.selectOne(player.id);
    const record  = created[0];
    if (record?.user_id) {
      await EXECUTESQL('UPDATE users SET player_id = ?, updated_date = NOW() WHERE id = ?', [record.id, record.user_id]);
    }
    socketEmit(MAKE_SOCKET_CHANNEL(record.id, SOCKET_CHANNELS.PLAYER), record);
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
    const existing = await new Player().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    const player = new Player({ ...existing[0], ...req.body });
    await player.update(id);
    const updated = await player.selectOne(id);
    const record  = updated[0];
    socketEmit(MAKE_SOCKET_CHANNEL(record.id, SOCKET_CHANNELS.PLAYER), record);
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
    const existing = await new Player().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    await new Player().delete(id);
    socketEmit(MAKE_SOCKET_CHANNEL(id, SOCKET_CHANNELS.PLAYER), { deleted: true, id });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

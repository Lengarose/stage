const express = require('express');
const router  = express.Router();
const Club    = require('../models/clubModel');
const { EXECUTESQL } = require('../db/database');
const { io }  = require('../express/index');
const { SOCKET_CHANNELS, MAKE_SOCKET_CHANNEL } = require('../../constants/constants');

// GET /
router.get('/', async (req, res) => {
  try {
    const { owner_email, user_id, page } = req.query;
    const club = new Club();
    let result;
    if (owner_email) result = await club.selectByOwner(owner_email);
    else if (user_id) result = await EXECUTESQL('SELECT * FROM clubs WHERE user_id = ?', [user_id]);
    else result = await club.selectAll(Number(page) || 1);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const club   = new Club();
    const result = await club.selectOne(req.params.id);
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
    const club = new Club(req.body);
    await club.create();
    const created = await club.selectOne(club.id);
    const record  = created[0];
    if (record?.user_id) {
      await EXECUTESQL('UPDATE users SET owner_id = ?, updated_date = NOW() WHERE id = ?', [record.id, record.user_id]);
    }
    socketEmit(MAKE_SOCKET_CHANNEL(record.id, SOCKET_CHANNELS.CLUB), record);
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
    const existing = await new Club().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    const club = new Club({ ...existing[0], ...req.body });
    await club.update(id);
    const updated = await club.selectOne(id);
    const record  = updated[0];
    socketEmit(MAKE_SOCKET_CHANNEL(record.id, SOCKET_CHANNELS.CLUB), record);
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
    const existing = await new Club().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    await new Club().delete(id);
    socketEmit(MAKE_SOCKET_CHANNEL(id, SOCKET_CHANNELS.CLUB), { deleted: true, id });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

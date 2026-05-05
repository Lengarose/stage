const express = require('express');
const router  = express.Router();
const Post    = require('../models/postModel');
const { io }  = require('../express/index');
const { SOCKET_CHANNELS, MAKE_SOCKET_CHANNEL } = require('../../constants/constants');

// GET /
router.get('/', async (req, res) => {
  try {
    const { club_id, author_email, page } = req.query;
    const post = new Post();
    let result;
    if (club_id)      result = await post.selectByClub(club_id);
    else if (author_email) result = await post.selectByAuthor(author_email);
    else result = await post.selectAll(Number(page) || 1);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const post   = new Post();
    const result = await post.selectOne(req.params.id);
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
    const post = new Post(req.body);
    await post.create();
    const created = await post.selectOne(post.id);
    const record  = created[0];
    socketEmit(MAKE_SOCKET_CHANNEL(record.id, SOCKET_CHANNELS.POST), record);
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
    const existing = await new Post().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    const post = new Post({ ...existing[0], ...req.body });
    await post.update(id);
    const updated = await post.selectOne(id);
    const record  = updated[0];
    socketEmit(MAKE_SOCKET_CHANNEL(record.id, SOCKET_CHANNELS.POST), record);
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
    const existing = await new Post().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    await new Post().delete(id);
    socketEmit(MAKE_SOCKET_CHANNEL(id, SOCKET_CHANNELS.POST), { deleted: true, id });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

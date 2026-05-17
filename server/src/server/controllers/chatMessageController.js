const express     = require('express');
const router      = express.Router();
const ChatMessage = require('../models/chatMessageModel');
const { broadcastChatMessage, broadcastChatMessageDeleted } = require('../utils/socketBroadcast');

// GET /
router.get('/', async (req, res) => {
  try {
    const { match_id, channel, club_id, page, limit } = req.query;
    const cm = new ChatMessage();
    let result;
    if (match_id) result = await cm.selectByMatch(match_id, limit);
    else if (channel) result = await cm.selectByChannel(channel, club_id || null);
    else result = await cm.selectAll(Number(page) || 1);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const cm     = new ChatMessage();
    const result = await cm.selectOne(req.params.id);
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
    const cm = new ChatMessage(req.body);
    await cm.create();
    const created = await cm.selectOne(cm.id);
    const record  = created[0];
    broadcastChatMessage(record);
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
    const existing = await new ChatMessage().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    const cm = new ChatMessage({ ...existing[0], ...req.body });
    await cm.update(id);
    const updated = await cm.selectOne(id);
    const record  = updated[0];
    broadcastChatMessage(record);
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
    const existing = await new ChatMessage().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    const { match_id } = existing[0];
    await new ChatMessage().delete(id);
    broadcastChatMessageDeleted(id, match_id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

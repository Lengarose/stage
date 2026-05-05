const express       = require('express');
const router        = express.Router();
const DirectMessage = require('../models/directMessageModel');
const { socketEmit } = require('../express/index');
const { SOCKET_CHANNELS, MAKE_SOCKET_CHANNEL } = require('../../constants/constants');

router.get('/', async (req, res) => {
  try {
    const { conversation_id, page } = req.query;
    const dm = new DirectMessage();
    const result = conversation_id
      ? await dm.selectByConversation(conversation_id)
      : await dm.selectAll(Number(page) || 1);
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await new DirectMessage().selectOne(req.params.id);
    if (!result.length) return res.status(404).json({ error: 'Not found' });
    res.json(result[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const dm = new DirectMessage(req.body);
    await dm.create();
    const record = (await dm.selectOne(dm.id))[0];
    // Emit to both participants' inbox channels
    if (record.sender_id)   socketEmit(MAKE_SOCKET_CHANNEL(record.sender_id,   SOCKET_CHANNELS.INBOX), record);
    if (record.receiver_id) socketEmit(MAKE_SOCKET_CHANNEL(record.receiver_id, SOCKET_CHANNELS.INBOX), record);
    res.status(201).json(record);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await new DirectMessage().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    const dm = new DirectMessage({ ...existing[0], ...req.body });
    await dm.update(id);
    const record = (await dm.selectOne(id))[0];
    if (record.receiver_id) socketEmit(MAKE_SOCKET_CHANNEL(record.receiver_id, SOCKET_CHANNELS.INBOX), record);
    res.json(record);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await new DirectMessage().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    const { sender_id, receiver_id } = existing[0];
    await new DirectMessage().delete(id);
    if (sender_id)   socketEmit(MAKE_SOCKET_CHANNEL(sender_id,   SOCKET_CHANNELS.INBOX), { deleted: true, id });
    if (receiver_id) socketEmit(MAKE_SOCKET_CHANNEL(receiver_id, SOCKET_CHANNELS.INBOX), { deleted: true, id });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

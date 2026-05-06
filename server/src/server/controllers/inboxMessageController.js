const express       = require('express');
const router        = express.Router();
const InboxMessage  = require('../models/inboxMessageModel');
const { socketEmit } = require('../express/index');
const { SOCKET_CHANNELS, MAKE_SOCKET_CHANNEL } = require('../../constants/constants');

// GET /
router.get('/', async (req, res) => {
  try {
    const { email, page } = req.query;
    const inbox = new InboxMessage();
    let result;
    if (email) result = await inbox.selectByRecipient(email);
    else result = await inbox.selectAll(Number(page) || 1);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}); 

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const inbox  = new InboxMessage();
    const result = await inbox.selectOne(req.params.id);
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
    const inbox = new InboxMessage(req.body);
    await inbox.create();
    const created = await inbox.selectOne(inbox.id);
    const record  = created[0];
    socketEmit(MAKE_SOCKET_CHANNEL(record.recipient_email, SOCKET_CHANNELS.INBOX), record);
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
    const existing = await new InboxMessage().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    const inbox = new InboxMessage({ ...existing[0], ...req.body });
    await inbox.update(id);
    const updated = await inbox.selectOne(id);
    const record  = updated[0];
    socketEmit(MAKE_SOCKET_CHANNEL(record.recipient_email, SOCKET_CHANNELS.INBOX), record);
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
    const existing = await new InboxMessage().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    const { recipient_email } = existing[0];
    await new InboxMessage().delete(id);
    socketEmit(MAKE_SOCKET_CHANNEL(recipient_email, SOCKET_CHANNELS.INBOX), { deleted: true, id });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

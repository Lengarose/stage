const express      = require('express');
const router       = express.Router();
const Notification = require('../models/notificationModel');
const { io }       = require('../express/index');
const { SOCKET_CHANNELS, MAKE_SOCKET_CHANNEL } = require('../../constants/constants');

// GET /
router.get('/', async (req, res) => {
  try {
    const { email, page } = req.query;
    const notification = new Notification();
    let result;
    if (email) result = await notification.selectByRecipient(email);
    else result = await notification.selectAll(Number(page) || 1);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const notification = new Notification();
    const result       = await notification.selectOne(req.params.id);
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
    const notification = new Notification(req.body);
    await notification.create();
    const created = await notification.selectOne(notification.id);
    const record  = created[0];
    socketEmit(MAKE_SOCKET_CHANNEL(record.recipient_email, SOCKET_CHANNELS.NOTIFICATION), record);
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
    const existing = await new Notification().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    const notification = new Notification({ ...existing[0], ...req.body });
    await notification.update(id);
    const updated = await notification.selectOne(id);
    const record  = updated[0];
    socketEmit(MAKE_SOCKET_CHANNEL(record.recipient_email, SOCKET_CHANNELS.NOTIFICATION), record);
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
    const existing = await new Notification().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    const { recipient_email } = existing[0];
    await new Notification().delete(id);
    socketEmit(MAKE_SOCKET_CHANNEL(recipient_email, SOCKET_CHANNELS.NOTIFICATION), { deleted: true, id });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

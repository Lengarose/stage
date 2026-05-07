const express       = require('express');
const router        = express.Router();
const InboxMessage  = require('../models/inboxMessageModel');
const { EXECUTESQL } = require('../db/database');
const { socketEmit } = require('../express/index');
const { SOCKET_CHANNELS, MAKE_SOCKET_CHANNEL } = require('../../constants/constants');

async function getCurrentUser(req) {
  const userId = req.user?.id;
  if (!userId) return null;
  const rows = await EXECUTESQL('SELECT id, email, role_id FROM users WHERE id = ? LIMIT 1', [userId]);
  return rows[0] || null;
}

// GET /
router.get('/', async (req, res) => {
  try {
    const { page } = req.query;
    const inbox = new InboxMessage();
    const currentUser = await getCurrentUser(req);
    if (!currentUser?.email) return res.status(403).json({ error: 'Forbidden' });

    let result;
    if (Number(currentUser.role_id) === 0 && req.query?.email) {
      result = await inbox.selectByRecipient(String(req.query.email));
    } else {
      // Always scope inbox reads to the authenticated user's email.
      result = await inbox.selectByRecipient(currentUser.email);
    }

    if (!req.query?.email && Number(currentUser.role_id) === 0 && page) {
      result = await inbox.selectAll(Number(page) || 1);
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
    const inbox  = new InboxMessage();
    const currentUser = await getCurrentUser(req);
    if (!currentUser?.email) return res.status(403).json({ error: 'Forbidden' });
    const result = await inbox.selectOne(req.params.id);
    if (!result.length) return res.status(404).json({ error: 'Not found' });
    const record = result[0];
    const isAdmin = Number(currentUser.role_id) === 0;
    if (!isAdmin && record.recipient_email !== currentUser.email) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.json(record);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /
router.post('/', async (req, res) => {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser?.email) return res.status(403).json({ error: 'Forbidden' });
    const isAdmin = Number(currentUser.role_id) === 0;
    const payload = { ...req.body };
    if (!isAdmin) {
      // Prevent sender spoofing from the client.
      payload.sender_email = currentUser.email;
    }
    const inbox = new InboxMessage(payload);
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
    const currentUser = await getCurrentUser(req);
    if (!currentUser?.email) return res.status(403).json({ error: 'Forbidden' });
    const isAdmin = Number(currentUser.role_id) === 0;
    const existing = await new InboxMessage().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    if (!isAdmin && existing[0].recipient_email !== currentUser.email) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const merged = { ...existing[0], ...req.body };
    if (!isAdmin) {
      merged.sender_email = existing[0].sender_email;
      merged.recipient_email = existing[0].recipient_email;
    }
    const inbox = new InboxMessage(merged);
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
    const currentUser = await getCurrentUser(req);
    if (!currentUser?.email) return res.status(403).json({ error: 'Forbidden' });
    const isAdmin = Number(currentUser.role_id) === 0;
    const existing = await new InboxMessage().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    if (!isAdmin && existing[0].recipient_email !== currentUser.email) {
      return res.status(403).json({ error: 'Forbidden' });
    }
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

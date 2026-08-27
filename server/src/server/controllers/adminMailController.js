const express = require('express');
const router = express.Router();
const {
  listMessages,
  getMessage,
  markRead,
  moveToTrash,
  deletePermanently,
  emptyTrash,
  saveDraft,
  deleteDraft,
  sendMessage,
  syncInbox,
} = require('../services/adminMailService');
const { listAudiences, resolveMailAudience, searchMailContacts } = require('../services/mailRecipientResolver');
const { EXECUTESQL } = require('../db/database');

async function requireAdmin(req) {
  const userId = req.user?.id;
  if (!userId) {
    const err = new Error('Not authenticated');
    err.status = 401;
    throw err;
  }
  const rows = await EXECUTESQL(
    'SELECT id, email, role_id FROM users WHERE id = ? LIMIT 1',
    [userId],
  );
  const user = rows[0];
  if (!user || ![0, 2].includes(Number(user.role_id))) {
    const err = new Error('Admin only');
    err.status = 403;
    throw err;
  }
  return user;
}

router.get('/audiences', async (req, res) => {
  try {
    await requireAdmin(req);
    res.json(await listAudiences());
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/recipients', async (req, res) => {
  try {
    await requireAdmin(req);
    const { type, id } = req.query || {};
    res.json(await resolveMailAudience({ type, id }));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/contacts', async (req, res) => {
  try {
    await requireAdmin(req);
    const { q, limit } = req.query || {};
    res.json(await searchMailContacts(q, limit));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/status', async (req, res) => {
  try {
    await requireAdmin(req);
    const data = await listMessages({ folder: 'inbox', limit: 1, offset: 0 });
    res.json({
      mailbox: data.configured.mailbox,
      smtp: data.configured.smtp,
      imap: data.configured.imap,
      unread: data.unread,
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const admin = await requireAdmin(req);
    res.json(await listMessages(req.query || {}, admin.id));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    await requireAdmin(req);
    const message = await getMessage(req.params.id);
    if (!message) return res.status(404).json({ error: 'Message not found' });
    res.json(message);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/sync', async (req, res) => {
  try {
    await requireAdmin(req);
    res.json(await syncInbox());
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/drafts', async (req, res) => {
  try {
    const admin = await requireAdmin(req);
    const body = req.body || {};
    const draft = await saveDraft(admin, {
      id: body.id,
      to: body.to,
      cc: body.cc,
      bcc: body.bcc,
      subject: body.subject,
      body: body.body,
      audience: body.audience || null,
      replyToId: body.reply_to_id,
    });
    res.status(body.id ? 200 : 201).json(draft);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.delete('/drafts/:id', async (req, res) => {
  try {
    const admin = await requireAdmin(req);
    res.json(await deleteDraft(admin, req.params.id));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/send', async (req, res) => {
  try {
    const admin = await requireAdmin(req);
    const body = req.body || {};
    const message = await sendMessage({
      admin,
      to: body.to,
      cc: body.cc,
      bcc: body.bcc,
      subject: body.subject,
      body: body.body,
      replyToId: body.reply_to_id,
      audience: body.audience || null,
      draftId: body.draft_id,
    });
    res.status(201).json(message);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/trash/empty', async (req, res) => {
  try {
    const admin = await requireAdmin(req);
    res.json(await emptyTrash(admin));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    await requireAdmin(req);
    const existing = await getMessage(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Message not found' });
    if (req.body?.folder === 'trash') {
      return res.json(await moveToTrash(req.params.id));
    }
    if (req.body?.is_read != null) {
      return res.json(await markRead(req.params.id, Boolean(req.body.is_read)));
    }
    return res.status(400).json({ error: 'Nothing to update' });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.delete('/:id/permanent', async (req, res) => {
  try {
    const admin = await requireAdmin(req);
    res.json(await deletePermanently(admin, req.params.id));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await requireAdmin(req);
    const existing = await getMessage(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Message not found' });
    await moveToTrash(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;

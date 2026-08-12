const express = require('express');
const router  = express.Router();
const Comment = require('../models/commentModel');
const { createTrustedComment } = require('../services/feedTrustService');
const { EXECUTESQL } = require('../db/database');
const { createNotificationIfEnabled } = require('../services/messageDeliveryService');
const { resolveMentionedPlayers } = require('../services/socialMentionService');

async function getCurrentUser(req) {
  const userId = req.user?.id;
  if (!userId) return null;
  const rows = await EXECUTESQL('SELECT id, email, full_name FROM users WHERE id = ? LIMIT 1', [userId]);
  return rows[0] || null;
}

async function enrichAuthenticatedUser(req) {
  if (req.user?.email) return req.user;
  const currentUser = await getCurrentUser(req);
  return { ...(req.user || {}), ...(currentUser || {}) };
}

// GET /
router.get('/', async (req, res) => {
  try {
    const { post_id, page } = req.query;
    const comment = new Comment();
    let result;
    if (post_id) result = await comment.selectByPost(post_id);
    else result = await comment.selectAll(Number(page) || 1);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const comment = new Comment();
    const result  = await comment.selectOne(req.params.id);
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
    const user = await enrichAuthenticatedUser(req);
    const result = await createTrustedComment({ body: req.body, user });
    const record = result.comment;
    const post = result.post;
    const actorEmail = String(record?.author_email || user?.email || '').toLowerCase();
    const content = String(req.body?.content || '').trim();
    const mentionedPlayers = await resolveMentionedPlayers(EXECUTESQL, content);
    for (const mentionedPlayer of mentionedPlayers) {
      if (!mentionedPlayer.email || String(mentionedPlayer.email).toLowerCase() === actorEmail) continue;
      await createNotificationIfEnabled({
        recipientEmail: mentionedPlayer.email,
        type: 'mention',
        title: 'You were mentioned in a comment',
        body: `${record.author_name} mentioned you in a comment.`,
        link: `/social?post=${post.id}&comment=${record.id}`,
        relatedId: record.id,
      });
    }
    res.status(201).json({ ...record, ...result });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

// PATCH /:id
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await new Comment().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    const comment = new Comment({ ...existing[0], ...req.body });
    await comment.update(id);
    const updated = await comment.selectOne(id);
    res.json(updated[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await new Comment().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    await new Comment().delete(id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

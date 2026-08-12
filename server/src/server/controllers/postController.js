const express = require('express');
const router  = express.Router();
const Post    = require('../models/postModel');
const { broadcastPost, broadcastPostDeleted } = require('../utils/socketBroadcast');
const {
  assertFeedPostAllowsMedia,
  removeServerOwnedPostFields,
  togglePostLike,
} = require('../services/feedTrustService');
const { EXECUTESQL } = require('../db/database');
const { createNotificationIfEnabled } = require('../services/messageDeliveryService');
const { resolveMentionedPlayers } = require('../services/socialMentionService');

async function getCurrentUser(req) {
  const userId = req.user?.id;
  if (!userId) return null;
  const rows = await EXECUTESQL('SELECT id, email, full_name FROM users WHERE id = ? LIMIT 1', [userId]);
  return rows[0] || null;
}

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
    if (!err.status || err.status >= 500) console.error(err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

// POST /:id/like-toggle
router.post('/:id/like-toggle', async (req, res) => {
  try {
    const result = await togglePostLike({ postId: req.params.id, user: req.user });
    broadcastPost(result.post);
    res.json(result);
  } catch (err) {
    if (!err.status || err.status >= 500) console.error(err);
    res.status(err.status || 500).json({ error: err.message });
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
    if (!err.status || err.status >= 500) console.error(err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

// POST /
router.post('/', async (req, res) => {
  try {
    assertFeedPostAllowsMedia(req.body);
    const mentionedPlayers = await resolveMentionedPlayers(EXECUTESQL, req.body?.content);
    const currentUser = mentionedPlayers.length ? await getCurrentUser(req) : null;
    const post = new Post({
      ...removeServerOwnedPostFields(req.body),
      likes: [],
      likes_count: 0,
      comments_count: 0,
      tags: mentionedPlayers.map((player) => ({ gamertag: player.gamertag, player_id: player.id })),
    });
    await post.create();
    const created = await post.selectOne(post.id);
    const record  = created[0];
    const actorEmail = String(currentUser?.email || post.author_email || '').toLowerCase();
    for (const mentionedPlayer of mentionedPlayers) {
      if (!mentionedPlayer.email || String(mentionedPlayer.email).toLowerCase() === actorEmail) continue;
      await createNotificationIfEnabled({
        recipientEmail: mentionedPlayer.email,
        type: 'mention',
        title: 'You were mentioned in a post',
        body: `${post.author_name || currentUser?.full_name || actorEmail} mentioned you in a post.`,
        link: `/social?post=${record.id}`,
        relatedId: record.id,
      });
    }
    broadcastPost(record);
    res.status(201).json(record);
  } catch (err) {
    if (!err.status || err.status >= 500) console.error(err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

// POST /:id/like
router.post('/:id/like', async (req, res) => {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser?.email) return res.status(403).json({ error: 'Forbidden' });

    const post = new Post();
    const existing = await post.selectOne(req.params.id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });

    const record = existing[0];
    const email = currentUser.email;
    const isLike = await post.toggleLike(record.id, email);

    const updated = (await post.selectOne(record.id))[0];
    if (isLike && String(record.author_email).toLowerCase() !== String(email).toLowerCase()) {
      await createNotificationIfEnabled({
        recipientEmail: record.author_email,
        type: 'post_like',
        title: 'New like on your post',
        body: `${currentUser.full_name || email} liked your post.`,
        link: `/social?post=${record.id}`,
      });
    }
    broadcastPost(updated);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /:id
router.patch('/:id', async (req, res) => {
  try {
    if (['likes', 'likes_count', 'comments_count'].some((field) => Object.hasOwn(req.body || {}, field))) {
      return res.status(400).json({ error: 'Use dedicated social actions for likes and comment counts' });
    }
    const { id } = req.params;
    assertFeedPostAllowsMedia(req.body);
    const existing = await new Post().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    const post = new Post({ ...existing[0], ...removeServerOwnedPostFields(req.body) });
    await post.update(id);
    const updated = await post.selectOne(id);
    const record  = updated[0];
    broadcastPost(record);
    res.json(record);
  } catch (err) {
    if (!err.status || err.status >= 500) console.error(err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

// DELETE /:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await new Post().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    await new Post().delete(id);
    broadcastPostDeleted(id, existing[0]);
    res.json({ success: true });
  } catch (err) {
    if (!err.status || err.status >= 500) console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

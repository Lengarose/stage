const express = require('express');
const router  = express.Router();
const Comment = require('../models/commentModel');
const Post = require('../models/postModel');
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
    const currentUser = await getCurrentUser(req);
    if (!currentUser?.email) return res.status(403).json({ error: 'Forbidden' });
    const postId = String(req.body?.post_id || '').trim();
    const content = String(req.body?.content || '').trim();
    if (!postId || !content) return res.status(400).json({ error: 'post_id and content are required' });

    const postRows = await new Post().selectOne(postId);
    if (!postRows.length) return res.status(404).json({ error: 'Post not found' });
    const playerRows = await EXECUTESQL(
      'SELECT gamertag, avatar_url FROM players WHERE LOWER(email) = LOWER(?) LIMIT 1',
      [currentUser.email]
    );
    const player = playerRows[0] || {};
    const comment = new Comment({
      post_id: postId,
      content,
      author_email: currentUser.email,
      author_name: player.gamertag || currentUser.full_name || currentUser.email,
      author_avatar: player.avatar_url || '',
    });
    await comment.create();
    const created = await comment.selectOne(comment.id);
    const record = created[0];
    await comment.incrementPostCommentsCount();

    const post = postRows[0];
    const actorEmail = String(currentUser.email).toLowerCase();
    if (String(post.author_email || '').toLowerCase() !== actorEmail) {
      await createNotificationIfEnabled({
        recipientEmail: post.author_email,
        type: 'post_comment',
        title: 'New comment on your post',
        body: `${record.author_name} commented on your post.`,
        link: `/social?post=${post.id}&comment=${record.id}`,
        relatedId: record.id,
      });
    }
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

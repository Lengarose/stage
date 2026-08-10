const express = require('express');
const Post = require('../models/postModel');
const Comment = require('../models/commentModel');
const DirectMessage = require('../models/directMessageModel');
const { EXECUTESQL } = require('../db/database');
const {
  ok,
  fail,
  mapPost,
  mapComment,
  resolveCallerContext,
} = require('./helpers');

const router = express.Router();

router.get('/feed', async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const rows = await new Post().selectAll(page);
    return ok(res, (rows || []).map(mapPost));
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.get('/reels', async (req, res) => {
  try {
    const rows = await EXECUTESQL(
      `SELECT * FROM posts
       WHERE media_type IN ('video', 'reel') OR media_url LIKE '%.mp4%' OR media_url LIKE '%.webm%'
       ORDER BY id DESC
       LIMIT 50`
    ).catch(() => new Post().selectAll(1));
    return ok(res, (rows || []).map((p) => ({
      ...mapPost(p),
      gamer_tag: p.author_name,
      user_avatar: p.author_avatar,
      video_url: p.media_url,
    })));
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.get('/posts/:id', async (req, res) => {
  try {
    const rows = await new Post().selectOne(req.params.id);
    if (!rows.length) return fail(res, 404, 'Not found');
    return ok(res, mapPost(rows[0]));
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.get('/comments', async (req, res) => {
  try {
    const targetId = req.query.target_id || req.query.post_id;
    if (!targetId) return ok(res, []);
    const rows = await new Comment().selectByPost(targetId).catch(() => []);
    return ok(res, (rows || []).map(mapComment));
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.post('/comments', async (req, res) => {
  try {
    const ctx = await resolveCallerContext(req.user);
    const postId = req.body?.target_id || req.body?.post_id;
    if (!postId) return fail(res, 400, 'target_id is required');
    const comment = new Comment({
      post_id: postId,
      author_email: ctx?.user?.email || null,
      author_name: ctx?.player?.gamertag || ctx?.user?.email?.split('@')[0] || 'Player',
      author_avatar: ctx?.player?.avatar_url || null,
      content: req.body?.content || '',
    });
    await comment.create();
    const created = (await comment.selectOne(comment.id))[0];
    return ok(res, mapComment(created), 201);
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.get('/messages', async (req, res) => {
  try {
    const ctx = await resolveCallerContext(req.user);
    const email = ctx?.user?.email;
    if (!email) return ok(res, []);
    const rows = await EXECUTESQL(
      `SELECT * FROM direct_messages
       WHERE LOWER(sender_email) = LOWER(?) OR LOWER(recipient_email) = LOWER(?)
       ORDER BY id DESC
       LIMIT 100`,
      [email, email]
    ).catch(() => []);

    const byConversation = new Map();
    for (const dm of rows || []) {
      const key = dm.conversation_id || [dm.sender_email, dm.recipient_email].sort().join('|');
      if (!byConversation.has(key)) {
        const otherEmail =
          String(dm.sender_email).toLowerCase() === String(email).toLowerCase()
            ? dm.recipient_email
            : dm.sender_email;
        const otherName =
          String(dm.sender_email).toLowerCase() === String(email).toLowerCase()
            ? dm.recipient_name
            : dm.sender_name;
        byConversation.set(key, {
          id: key,
          conversation_id: key,
          other_user_id: otherEmail,
          other_user_name: otherName,
          gamer_tag: otherName,
          last_message: dm.content,
          updated_at: dm.created_date || dm.id,
        });
      }
    }
    return ok(res, [...byConversation.values()]);
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.get('/messages/:otherUserId', async (req, res) => {
  try {
    const ctx = await resolveCallerContext(req.user);
    const me = ctx?.user?.email;
    const other = req.params.otherUserId;
    if (!me) return ok(res, []);

    // otherUserId may be email or user/player id
    let otherEmail = other;
    if (!other.includes('@')) {
      const users = await EXECUTESQL('SELECT email FROM users WHERE id = ? LIMIT 1', [other]).catch(() => []);
      const players = await EXECUTESQL('SELECT email FROM players WHERE id = ? OR user_id = ? LIMIT 1', [other, other]).catch(() => []);
      otherEmail = users[0]?.email || players[0]?.email || other;
    }

    const conversationId = [String(me).toLowerCase(), String(otherEmail).toLowerCase()].sort().join('|');
    let rows = await new DirectMessage().selectByConversation(conversationId).catch(() => []);
    if (!rows?.length) {
      rows = await EXECUTESQL(
        `SELECT * FROM direct_messages
         WHERE (LOWER(sender_email) = LOWER(?) AND LOWER(recipient_email) = LOWER(?))
            OR (LOWER(sender_email) = LOWER(?) AND LOWER(recipient_email) = LOWER(?))
         ORDER BY id ASC
         LIMIT 200`,
        [me, otherEmail, otherEmail, me]
      ).catch(() => []);
    }
    return ok(res, rows || []);
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.post('/messages', async (req, res) => {
  try {
    const ctx = await resolveCallerContext(req.user);
    if (!ctx?.user?.email) return fail(res, 401, 'Unauthorized');

    let recipientEmail = req.body?.recipient_email || req.body?.to;
    const recipientId = req.body?.recipient_id || req.body?.other_user_id || req.body?.user_id;
    if (!recipientEmail && recipientId) {
      const users = await EXECUTESQL('SELECT email FROM users WHERE id = ? LIMIT 1', [recipientId]).catch(() => []);
      const players = await EXECUTESQL('SELECT email, gamertag FROM players WHERE id = ? OR user_id = ? LIMIT 1', [recipientId, recipientId]).catch(() => []);
      recipientEmail = users[0]?.email || players[0]?.email;
    }
    if (!recipientEmail) return fail(res, 400, 'recipient required');

    const conversationId =
      req.body?.conversation_id ||
      [String(ctx.user.email).toLowerCase(), String(recipientEmail).toLowerCase()].sort().join('|');

    const dm = new DirectMessage({
      conversation_id: conversationId,
      sender_email: ctx.user.email,
      sender_name: ctx.player?.gamertag || ctx.user.email.split('@')[0],
      recipient_email: recipientEmail,
      recipient_name: req.body?.recipient_name || recipientEmail.split('@')[0],
      content: req.body?.content || req.body?.message || '',
      media_url: req.body?.media_url || null,
      read: 0,
    });
    await dm.create();
    const created = (await dm.selectOne(dm.id))[0];
    return ok(res, created, 201);
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

module.exports = router;

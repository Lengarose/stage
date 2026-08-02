const express = require('express');
const router = express.Router();
const RecruitmentInterest = require('../models/recruitmentInterestModel');
const { EXECUTESQL } = require('../db/database');
const { sendActionMessage } = require('../services/messageDeliveryService');
const { resolveClubPresidentContact } = require('../services/clubContactService');

const STATUSES = new Set(['pending', 'accepted', 'declined', 'withdrawn']);

async function getUser(req) {
  const rows = await EXECUTESQL('SELECT id, email, role_id FROM users WHERE id = ? LIMIT 1', [req.user?.id]);
  return rows[0] || null;
}

function isAdmin(user) {
  return Number(user?.role_id) === 0;
}

async function notifyRecipient(post, interest, senderName, senderEmail = null) {
  let email = null;
  if (post.author_user_id) {
    const users = await EXECUTESQL('SELECT email FROM users WHERE id = ? LIMIT 1', [post.author_user_id]);
    email = users[0]?.email || null;
  }
  if (!email && post.author_player_id) {
    const players = await EXECUTESQL('SELECT email FROM players WHERE id = ? LIMIT 1', [post.author_player_id]);
    email = players[0]?.email || null;
  }
  if (!email && post.author_club_id) {
    const contact = await resolveClubPresidentContact({ clubId: post.author_club_id });
    email = contact.email;
  }
  if (!email) return;
  const recipient = String(email).trim().toLowerCase();
  const subject = `Recruitment interest: ${post.title}`;
  const body = interest.message || `${senderName || 'Someone'} is interested in your recruitment post.`;
  await sendActionMessage({
    recipientEmail: recipient,
    senderEmail,
    senderGamertag: senderName || 'Recruitment',
    subject,
    body,
    messageType: 'recruitment_interest',
    actionType: 'recruitment_interest_response',
    relatedEntityId: interest.id,
    relatedEntityType: 'recruitment_interest',
    idempotencyKey: `recruitment_interest:recruitment_interest:${interest.id}:${recipient}`,
    notification: {
      type: 'club_update',
      title: subject,
      body,
    },
  });
}

function canSeeInterest(user, interest) {
  return isAdmin(user) ||
    interest.sender_user_id === user?.id ||
    interest.recipient_user_id === user?.id;
}

router.get('/', async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'User not found' });
    const filters = { ...req.query };
    if (!isAdmin(user)) {
      filters.viewer_user_id = user.id;
    }
    res.json(await new RecruitmentInterest().selectAll(filters));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'User not found' });
    const rows = await new RecruitmentInterest().selectOne(req.params.id);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    if (!canSeeInterest(user, rows[0])) return res.status(403).json({ error: 'Forbidden' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'User not found' });
    if (!req.body?.recruitment_post_id) return res.status(400).json({ error: 'recruitment_post_id required' });
    const posts = await EXECUTESQL('SELECT * FROM recruitment_posts WHERE id = ? LIMIT 1', [req.body.recruitment_post_id]);
    if (!posts.length) return res.status(404).json({ error: 'Recruitment post not found' });
    const post = posts[0];

    const body = { ...req.body, sender_user_id: user.id, status: 'pending' };
    if (!body.sender_player_id && !body.sender_club_id) {
      const players = await EXECUTESQL('SELECT id, gamertag FROM players WHERE user_id = ? OR LOWER(email)=LOWER(?) LIMIT 1', [user.id, user.email]);
      body.sender_player_id = players[0]?.id || null;
    }
    body.recipient_user_id = post.author_user_id || null;
    body.recipient_player_id = post.author_player_id || null;
    body.recipient_club_id = post.author_club_id || null;

    const model = new RecruitmentInterest(body);
    await model.create();
    const created = (await model.selectOne(model.id))[0];
    const senderNameRows = body.sender_club_id
      ? await EXECUTESQL('SELECT name FROM clubs WHERE id = ? LIMIT 1', [body.sender_club_id])
      : await EXECUTESQL('SELECT gamertag AS name FROM players WHERE id = ? LIMIT 1', [body.sender_player_id]);
    await notifyRecipient(post, created, senderNameRows[0]?.name, user.email);
    res.status(201).json(created);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'User not found' });
    const rows = await new RecruitmentInterest().selectOne(req.params.id);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const existing = rows[0];
    if (!canSeeInterest(user, existing)) return res.status(403).json({ error: 'Forbidden' });
    const status = req.body?.status || existing.status;
    if (!STATUSES.has(status)) return res.status(400).json({ error: 'Invalid status' });
    const model = new RecruitmentInterest({ ...existing, ...req.body, status });
    await model.update(req.params.id);
    res.json((await model.selectOne(req.params.id))[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'User not found' });
    const rows = await new RecruitmentInterest().selectOne(req.params.id);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    if (!canSeeInterest(user, rows[0])) return res.status(403).json({ error: 'Forbidden' });
    await new RecruitmentInterest().delete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

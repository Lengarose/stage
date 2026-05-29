const express  = require('express');
const router   = express.Router();
const ChatRead = require('../models/chatReadModel');

function getEmail(req) {
  return String(req.user?.email || '').trim();
}

// GET /api/stage/chat-reads
//   ?channel_id=<id>      → return only this user's read marker for that channel
//   (no params)           → return all read markers for this user
//
// We intentionally ignore client-supplied user_email and always scope to req.user.email
// so a token can never read another user's markers.
router.get('/', async (req, res) => {
  try {
    const email = getEmail(req);
    if (!email) return res.status(401).json({ error: 'No email on token' });

    const { channel_id } = req.query;
    const model = new ChatRead();
    const rows = channel_id
      ? await model.selectByUserAndChannel(email, channel_id)
      : await model.selectByUser(email);
    res.json(rows);
  } catch (err) {
    console.error('[chat-reads] GET /', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stage/chat-reads/unread-counts
//   Optional ?channel_id=<id> filters to one channel.
//   Returns { counts: { [channel_id]: number }, total: number }
router.get('/unread-counts', async (req, res) => {
  try {
    const email = getEmail(req);
    if (!email) return res.status(401).json({ error: 'No email on token' });

    const { channel_id } = req.query;
    if (channel_id) {
      const count = await ChatRead.unreadCountForChannel(email, channel_id);
      return res.json({ counts: { [channel_id]: count }, total: count });
    }
    const counts = await ChatRead.unreadCountsForUser(email);
    const total  = Object.values(counts).reduce((s, n) => s + (Number(n) || 0), 0);
    res.json({ counts, total });
  } catch (err) {
    console.error('[chat-reads] GET /unread-counts', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/stage/chat-reads/mark-read
//   body: { channel_id, last_read_at? }
//   Upserts the read marker. If last_read_at is omitted, uses NOW().
router.post('/mark-read', async (req, res) => {
  try {
    const email = getEmail(req);
    if (!email) return res.status(401).json({ error: 'No email on token' });

    const channel_id = String(req.body?.channel_id || '').trim();
    if (!channel_id) return res.status(400).json({ error: 'channel_id required' });

    // Accept ISO strings; let the DB layer coerce. Default to now.
    const last_read_at = req.body?.last_read_at
      ? new Date(req.body.last_read_at)
      : new Date();
    if (Number.isNaN(last_read_at.getTime())) {
      return res.status(400).json({ error: 'last_read_at is not a valid date' });
    }

    const model = new ChatRead();
    await model.upsert({ user_email: email, channel_id, last_read_at });
    const [row] = await model.selectByUserAndChannel(email, channel_id);
    res.json(row || { user_email: email, channel_id, last_read_at });
  } catch (err) {
    console.error('[chat-reads] POST /mark-read', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

const express     = require('express');
const router      = express.Router();
const matchChat = require('../services/matchChatService');
const ChatMessage = require('../models/chatMessageModel');
const { broadcastChatMessage, broadcastChatMessageDeleted } = require('../utils/socketBroadcast');
const { notifyLiveChatIfEnabled } = require('../services/messageDeliveryService');

// GET /
router.get('/', async (req, res) => {
  try {
    const { match_id, channel, club_id, page, limit } = req.query;
    const cm = new ChatMessage();
    let result;
    if (match_id) { await matchChat.access(req.user, match_id); result = await cm.selectByMatch(match_id, limit); }
    else if (channel) result = await cm.selectByChannel(channel, club_id || null);
    else result = await cm.selectAll(Number(page) || 1);
    if (!match_id) {
      const visible = await matchChat.visibleCounts(req.user, Object.fromEntries(result.filter(r=>r.match_id).map(r=>[r.match_id,1])));
      result = result.filter(r=>!r.match_id || visible[r.match_id]);
    }
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const cm     = new ChatMessage();
    const result = await cm.selectOne(req.params.id);
    if (!result.length) return res.status(404).json({ error: 'Not found' });
    await matchChat.access(req.user, result[0].match_id);
    res.json(result[0]);
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

// POST /
router.post('/', async (req, res) => {
  try {
    const canonical = await matchChat.sender(req.user, req.body.match_id);
    const content = String(req.body.content || '').trim();
    if (!content || content.length > 2000) return res.status(400).json({error:'Write a message of 1–2000 characters.'});
    const cm = new ChatMessage({...req.body, ...canonical, content});
    await cm.create();
    const created = await cm.selectOne(cm.id);
    const record  = created[0];
    broadcastChatMessage(record);
    await notifyLiveChatIfEnabled(record).catch(err => console.error('[match-chat] Notification delivery failed', err.message));
    res.status(201).json(record);
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

// PATCH /:id
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await new ChatMessage().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    await matchChat.access(req.user, existing[0].match_id);
    if (String(existing[0].sender_email).toLowerCase() !== String(req.user.email).toLowerCase()) return res.status(403).json({error:'Only the sender can edit this message.'});
    const content=String(req.body.content||'').trim();
    if(!content || content.length>2000)return res.status(400).json({error:'Write a message of 1–2000 characters.'});
    const cm = new ChatMessage({ ...existing[0], content });
    await cm.update(id);
    const updated = await cm.selectOne(id);
    const record  = updated[0];
    broadcastChatMessage(record);
    res.json(record);
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

// DELETE /:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await new ChatMessage().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    await matchChat.access(req.user, existing[0].match_id);
    if (String(existing[0].sender_email).toLowerCase() !== String(req.user.email).toLowerCase()) return res.status(403).json({error:'Only the sender can delete this message.'});
    const { match_id } = existing[0];
    await new ChatMessage().delete(id);
    broadcastChatMessageDeleted(id, match_id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;

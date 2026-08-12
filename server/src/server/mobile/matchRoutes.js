const express = require('express');
const Match = require('../models/matchModel');
const ChatMessage = require('../models/chatMessageModel');
const { EXECUTESQL } = require('../db/database');
const { ok, fail, mapMatch, resolveCallerContext } = require('./helpers');

const router = express.Router();

router.get('/fixtures', async (req, res) => {
  try {
    const status = req.query.status;
    const tournamentId = req.query.tournament_id || req.query.tournamentId;
    let rows = [];

    if (tournamentId) {
      rows = await EXECUTESQL(
        'SELECT * FROM matches WHERE tournament_id = ? ORDER BY scheduled_date ASC LIMIT 200',
        [tournamentId]
      ).catch(() => []);
    } else if (status === 'live') {
      rows = await new Match().selectByStatus('live').catch(() => []);
      if (!rows?.length) {
        rows = await EXECUTESQL(
          `SELECT * FROM matches WHERE status IN ('live', 'in_progress', 'playing') ORDER BY updated_date DESC LIMIT 50`
        ).catch(() => []);
      }
    } else if (status === 'scheduled') {
      rows = await new Match().selectByStatus('scheduled').catch(() => []);
      if (!rows?.length) {
        rows = await EXECUTESQL(
          `SELECT * FROM matches WHERE status IN ('scheduled', 'confirmed', 'pending') ORDER BY scheduled_date ASC LIMIT 100`
        ).catch(() => []);
      }
    } else if (status) {
      rows = await new Match().selectByStatus(status).catch(() => []);
    } else {
      rows = await new Match().selectAll(Number(req.query.page) || 1).catch(() => []);
    }

    return ok(res, (rows || []).map(mapMatch));
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const rows = await new Match().selectOne(req.params.id);
    if (!rows.length) return fail(res, 404, 'Not found');
    return ok(res, mapMatch(rows[0]));
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.post('/:id/video', async (req, res) => {
  try {
    const rows = await new Match().selectOne(req.params.id);
    if (!rows.length) return fail(res, 404, 'Not found');
    const videoUrl = req.body?.video_url;
    const videoSource = req.body?.video_source || null;
    if (!videoUrl) return fail(res, 400, 'video_url is required');

    await EXECUTESQL(
      `UPDATE matches
       SET stream_url = COALESCE(?, stream_url),
           video_url = COALESCE(?, video_url),
           updated_date = NOW()
       WHERE id = ?`,
      [videoUrl, videoUrl, req.params.id]
    ).catch(async () => {
      await EXECUTESQL(
        `UPDATE matches SET stream_url = ?, updated_date = NOW() WHERE id = ?`,
        [videoUrl, req.params.id]
      );
    });

    const updated = (await new Match().selectOne(req.params.id))[0];
    return ok(res, { ...mapMatch(updated), video_url: videoUrl, video_source: videoSource });
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.post('/:id/chat/read', async (req, res) => {
  try {
    return ok(res, { success: true, match_id: req.params.id });
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.get('/:id/chat', async (req, res) => {
  try {
    const rows = await new ChatMessage().selectByMatch(req.params.id);
    return ok(res, rows || []);
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.post('/:id/chat', async (req, res) => {
  try {
    const ctx = await resolveCallerContext(req.user);
    const cm = new ChatMessage({
      match_id: req.params.id,
      sender_id: ctx?.player?.id || req.user.id,
      sender_gamertag: ctx?.player?.gamertag || req.body?.gamer_tag || null,
      sender_avatar_url: ctx?.player?.avatar_url || null,
      content: req.body?.content || req.body?.message || '',
      media_url: req.body?.media_url || null,
      channel: 'match',
    });
    await cm.create();
    const created = (await cm.selectOne(cm.id))[0];
    return ok(res, created, 201);
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

module.exports = router;

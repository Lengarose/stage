const express      = require('express');
const router       = express.Router();
const DressingRoom = require('../models/dressingRoomModel');
const { EXECUTESQL } = require('../db/database');
const {
  broadcastDressingRoom,
  broadcastDressingRoomDeleted,
  broadcastMatchById,
} = require('../utils/socketBroadcast');
const { applySeatedPlayerStreamToMatch } = require('../utils/matchStream');
const { createNotificationIfEnabled } = require('../services/messageDeliveryService');

function parsePlayerIds(value) {
  if (value == null || value === '') return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

async function assertPlayersAvailable({ matchId, clubId, seatedPlayers }) {
  const ids = [...new Set(parsePlayerIds(seatedPlayers))];
  if (!ids.length) return;
  const placeholders = ids.map(() => '?').join(',');
  const rows = await EXECUTESQL(
    `SELECT player_id
     FROM club_fixture_availability
     WHERE club_id = ?
       AND fixture_id = ?
       AND status = 'available'
       AND player_id IN (${placeholders})`,
    [clubId, matchId, ...ids]
  );
  const available = new Set((rows || []).map((row) => String(row.player_id)));
  const missing = ids.filter((id) => !available.has(id));
  if (missing.length) {
    const err = new Error('Players must mark themselves available in Club Operations before taking a dressing room seat.');
    err.status = 400;
    throw err;
  }
}

async function maybeApplyStream(record) {
  if (!record?.match_id || !record?.club_id) return;
  const applied = await applySeatedPlayerStreamToMatch({
    matchId: record.match_id,
    clubId: record.club_id,
    seatedPlayers: record.seated_players,
  }).catch((err) => {
    console.warn('[dressingRoom] stream auto-fill failed:', err.message);
    return null;
  });
  if (applied) await broadcastMatchById(record.match_id).catch(() => {});
}

async function notifyDressingRoomAction(req, record, previousSeatedPlayers = []) {
  const recipientEmail = String(req.user?.email || '').trim().toLowerCase();
  if (!recipientEmail || !record?.match_id) return;
  const before = new Set(parsePlayerIds(previousSeatedPlayers));
  const after = new Set(parsePlayerIds(record.seated_players));
  const playerRows = req.user?.id
    ? await EXECUTESQL(
      `SELECT id, gamertag
       FROM players
       WHERE user_id = ? OR LOWER(TRIM(email)) = LOWER(TRIM(?))
       ORDER BY user_id = ? DESC, updated_date DESC
       LIMIT 1`,
      [req.user.id, recipientEmail, req.user.id]
    ).catch(() => [])
    : [];
  const player = playerRows[0] || null;
  const playerId = String(player?.id || '');
  const tookSeat = playerId && !before.has(playerId) && after.has(playerId);
  const leftSeat = playerId && before.has(playerId) && !after.has(playerId);
  const title = tookSeat
    ? 'Dressing room seat taken'
    : leftSeat
      ? 'Dressing room seat released'
      : 'Dressing room updated';
  const body = tookSeat
    ? 'You are seated for this match. If kickoff starts, you can be featured in the game.'
    : leftSeat
      ? 'You left your dressing-room seat for this match.'
      : 'Your dressing room was updated for this match.';

  await createNotificationIfEnabled({
    recipientEmail,
    type: 'match_reminder',
    title,
    body,
    link: `/game-day?match=${record.match_id}`,
  }).catch(() => {});
}

// GET /
router.get('/', async (req, res) => {
  try {
    const { match_id, club_id, page } = req.query;
    const dr = new DressingRoom();
    let result;
    if (match_id && club_id) result = await dr.selectByMatchAndClub(match_id, club_id);
    else if (match_id) result = await dr.selectByMatch(match_id);
    else if (club_id)  result = await dr.selectByClub(club_id);
    else result = await dr.selectAll(Number(page) || 1);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const dr     = new DressingRoom();
    const result = await dr.selectOne(req.params.id);
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
    await assertPlayersAvailable({
      matchId: req.body?.match_id,
      clubId: req.body?.club_id,
      seatedPlayers: req.body?.seated_players,
    });
    const dr = new DressingRoom(req.body);
    await dr.create();
    const created = await dr.selectOne(dr.id);
    const record  = created[0];
    broadcastDressingRoom(record);
    await maybeApplyStream(record);
    await notifyDressingRoomAction(req, record, []);
    if (record?.match_id) await broadcastMatchById(record.match_id).catch(() => {});
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
    const existing = await new DressingRoom().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    const body = { ...existing[0], ...req.body };
    await assertPlayersAvailable({
      matchId: body.match_id,
      clubId: body.club_id,
      seatedPlayers: body.seated_players,
    });
    const dr = new DressingRoom(body);
    await dr.update(id);
    const updated = await dr.selectOne(id);
    const record  = updated[0];
    broadcastDressingRoom(record);
    await maybeApplyStream(record);
    await notifyDressingRoomAction(req, record, existing[0].seated_players);
    if (record?.match_id) await broadcastMatchById(record.match_id).catch(() => {});
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
    const existing = await new DressingRoom().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    const { match_id } = existing[0];
    await new DressingRoom().delete(id);
    broadcastDressingRoomDeleted(id, match_id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

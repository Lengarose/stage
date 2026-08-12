const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const Club = require('../models/clubModel');
const Player = require('../models/playerModel');
const JoinRequest = require('../models/joinRequestModel');
const DressingRoom = require('../models/dressingRoomModel');
const ChatRead = require('../models/chatReadModel');
const { EXECUTESQL } = require('../db/database');
const { ensureUploadsDir } = require('../../constants/paths');
const { get } = require('../../constants/env');
const {
  ok,
  fail,
  mapClub,
  mapPlayer,
  mapJoinRequest,
  resolveCallerContext,
} = require('./helpers');

const router = express.Router();
const upload = multer({
  storage: multer.diskStorage({
    destination: ensureUploadsDir(),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '') || '.png';
      cb(null, `${uuidv4()}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

function parseLineup(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

router.get('/', async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    let rows;
    if (search) {
      rows = await EXECUTESQL(
        `SELECT * FROM clubs
         WHERE LOWER(name) LIKE LOWER(?) OR LOWER(tag) LIKE LOWER(?)
         ORDER BY updated_date DESC
         LIMIT 50`,
        [`%${search}%`, `%${search}%`]
      );
    } else {
      rows = await new Club().selectAll(Number(req.query.page) || 1);
    }
    return ok(res, (rows || []).map(mapClub));
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.get('/with-members', async (req, res) => {
  try {
    const clubs = await new Club().selectAll(1);
    const enriched = [];
    for (const club of clubs.slice(0, 40)) {
      const players = await new Player().selectByClub(club.id).catch(() => []);
      enriched.push({
        ...mapClub(club),
        members: (players || []).map(mapPlayer),
        member_count: (players || []).length,
      });
    }
    return ok(res, enriched);
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const rows = await new Club().selectOne(req.params.id);
    if (!rows.length) return fail(res, 404, 'Not found');
    const players = await new Player().selectByClub(req.params.id).catch(() => []);
    return ok(res, {
      ...mapClub(rows[0]),
      members: (players || []).map(mapPlayer),
      players: (players || []).map(mapPlayer),
    });
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.post('/', upload.single('logo'), async (req, res) => {
  try {
    const ctx = await resolveCallerContext(req.user);
    if (!ctx) return fail(res, 401, 'Unauthorized');

    const body = { ...(req.body || {}) };
    const name = body.name || body.club_name;
    if (!name) return fail(res, 400, 'Club name is required');

    const existingByName = await EXECUTESQL(
      'SELECT id FROM clubs WHERE LOWER(name) = LOWER(?) LIMIT 1',
      [name]
    );
    if (existingByName.length) return fail(res, 409, 'A club with this name already exists');

    if (req.file) {
      const SERVER_URL = get('SERVER_URL') || 'http://localhost:8080';
      body.logo_url = `${SERVER_URL}/uploads/${req.file.filename}`;
    }

    const club = new Club({
      user_id: ctx.user.id,
      president_user_id: ctx.user.id,
      owner_email: ctx.user.email,
      name,
      tag: body.tag || null,
      platform: body.platform || ctx.player?.platform || null,
      region: body.region || body.country || null,
      country_code: body.country_code || null,
      logo_url: body.logo_url || null,
      description: body.description || null,
      status: 'active',
    });
    await club.create();
    const created = (await club.selectOne(club.id))[0];
    return ok(res, mapClub(created), 201);
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.get('/:id/players', async (req, res) => {
  try {
    const players = await new Player().selectByClub(req.params.id);
    return ok(res, (players || []).map(mapPlayer));
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.delete('/:id/players/:userId', async (req, res) => {
  try {
    const players = await EXECUTESQL(
      `SELECT * FROM players
       WHERE club_id = ? AND (id = ? OR user_id = ?)
       LIMIT 1`,
      [req.params.id, req.params.userId, req.params.userId]
    );
    if (!players.length) return fail(res, 404, 'Player not found in club');
    await EXECUTESQL('UPDATE players SET club_id = NULL, updated_date = NOW() WHERE id = ?', [players[0].id]);
    return ok(res, { success: true });
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.get('/:id/formation', async (req, res) => {
  try {
    const rows = await new Club().selectOne(req.params.id);
    if (!rows.length) return fail(res, 404, 'Not found');
    const club = rows[0];
    return ok(res, {
      name: club.formation || '4-3-3',
      positions: parseLineup(club.lineup) || [],
      formation: club.formation || '4-3-3',
      lineup: parseLineup(club.lineup),
    });
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.post('/:id/formation', async (req, res) => {
  try {
    const rows = await new Club().selectOne(req.params.id);
    if (!rows.length) return fail(res, 404, 'Not found');
    const name = req.body?.name || req.body?.formation || '4-3-3';
    const positions = req.body?.positions || req.body?.lineup || [];
    const club = new Club({
      ...rows[0],
      formation: name,
      lineup: typeof positions === 'string' ? positions : JSON.stringify(positions),
    });
    await club.update(req.params.id);
    return ok(res, { name, positions, formation: name, lineup: positions });
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.get('/:id/join-request-status', async (req, res) => {
  try {
    const ctx = await resolveCallerContext(req.user);
    if (!ctx?.player) return ok(res, { status: null });
    const requests = await new JoinRequest().selectFiltered({
      club_id: req.params.id,
      player_id: ctx.player.id,
    });
    const active = (requests || []).find(
      (r) => !['rejected', 'cancelled', 'withdrawn'].includes(String(r.status || '').toLowerCase())
    );
    return ok(res, { status: active?.status || null, request: active ? mapJoinRequest(active) : null });
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.post('/:id/join-request', async (req, res) => {
  try {
    const ctx = await resolveCallerContext(req.user);
    if (!ctx?.player) return fail(res, 400, 'Create a player profile before joining a club');
    const clubs = await new Club().selectOne(req.params.id);
    if (!clubs.length) return fail(res, 404, 'Club not found');

    const existing = await new JoinRequest().selectFiltered({
      club_id: req.params.id,
      player_id: ctx.player.id,
    });
    const active = (existing || []).find(
      (r) => !['rejected', 'cancelled', 'withdrawn'].includes(String(r.status || '').toLowerCase())
    );
    if (active) return ok(res, mapJoinRequest(active));

    const jr = new JoinRequest({
      player_id: ctx.player.id,
      player_email: ctx.player.email || ctx.user.email,
      player_gamertag: ctx.player.gamertag,
      club_id: req.params.id,
      club_name: clubs[0].name,
      message: req.body?.message || null,
      status: 'pending',
    });
    await jr.create();
    const created = (await jr.selectOne(jr.id))[0];
    return ok(res, mapJoinRequest(created), 201);
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.get('/:id/join-requests', async (req, res) => {
  try {
    const rows = await new JoinRequest().selectFiltered({
      club_id: req.params.id,
      status: req.query.status || undefined,
    });
    return ok(res, (rows || []).map(mapJoinRequest));
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.post('/:id/join-requests/:requestId/accept', async (req, res) => {
  try {
    const existing = await new JoinRequest().selectOne(req.params.requestId);
    if (!existing.length) return fail(res, 404, 'Not found');
    const row = existing[0];
    const jr = new JoinRequest({ ...row, status: 'accepted' });
    await jr.update(row.id);
    if (row.player_id) {
      await EXECUTESQL(
        'UPDATE players SET club_id = ?, updated_date = NOW() WHERE id = ?',
        [req.params.id, row.player_id]
      );
    }
    return ok(res, mapJoinRequest({ ...row, status: 'accepted' }));
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.post('/:id/join-requests/:requestId/decline', async (req, res) => {
  try {
    const existing = await new JoinRequest().selectOne(req.params.requestId);
    if (!existing.length) return fail(res, 404, 'Not found');
    const row = existing[0];
    const jr = new JoinRequest({ ...row, status: 'rejected' });
    await jr.update(row.id);
    return ok(res, mapJoinRequest({ ...row, status: 'rejected' }));
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.post('/:id/leave', async (req, res) => {
  try {
    const ctx = await resolveCallerContext(req.user);
    if (!ctx?.player) return fail(res, 400, 'No player profile');
    if (String(ctx.player.club_id) !== String(req.params.id)) {
      return fail(res, 400, 'You are not a member of this club');
    }
    await EXECUTESQL('UPDATE players SET club_id = NULL, updated_date = NOW() WHERE id = ?', [ctx.player.id]);
    return ok(res, { success: true });
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.get('/:id/dressing-room', async (req, res) => {
  try {
    const rooms = await new DressingRoom().selectByClub(req.params.id).catch(() => []);
    const room = rooms?.[0] || null;
    if (!room) {
      return ok(res, { club_id: req.params.id, seated_players: [], seats: [] });
    }
    let seated = room.seated_players;
    if (typeof seated === 'string') {
      try { seated = JSON.parse(seated); } catch { seated = []; }
    }
    const ids = Array.isArray(seated) ? seated : [];
    let players = [];
    if (ids.length) {
      const placeholders = ids.map(() => '?').join(',');
      players = await EXECUTESQL(
        `SELECT * FROM players WHERE id IN (${placeholders})`,
        ids
      ).catch(() => []);
    }
    return ok(res, {
      ...room,
      seated_players: ids,
      seats: (players || []).map(mapPlayer),
    });
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.post('/:id/chat/read', async (req, res) => {
  try {
    const ctx = await resolveCallerContext(req.user);
    const channel = `club:${req.params.id}`;
    if (ctx?.user?.email) {
      await new ChatRead().upsert({
        user_email: ctx.user.email,
        channel_id: channel,
        last_read_at: new Date(),
      }).catch(() => {});
    }
    return ok(res, { success: true, channel });
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

module.exports = router;

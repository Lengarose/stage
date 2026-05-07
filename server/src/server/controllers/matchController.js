const express = require('express');
const router  = express.Router();
const Match   = require('../models/matchModel');
const { EXECUTESQL } = require('../db/database');
const { socketEmit } = require('../express/index');
const { SOCKET_CHANNELS, MAKE_SOCKET_CHANNEL } = require('../../constants/constants');

async function getAuthContext(req) {
  const userId = req.user?.id;
  if (!userId) return null;
  const users = await EXECUTESQL('SELECT id, role_id FROM users WHERE id = ? LIMIT 1', [userId]);
  if (!users.length) return null;
  const user = users[0];
  const [players, clubs] = await Promise.all([
    EXECUTESQL('SELECT id, club_id FROM players WHERE user_id = ? LIMIT 1', [userId]),
    EXECUTESQL('SELECT id FROM clubs WHERE user_id = ? LIMIT 1', [userId]),
  ]);
  return {
    userId,
    // Use ?? so role_id 0 (admin) is not replaced by || 1.
    roleId: Number(user.role_id ?? 1),
    playerId: players[0]?.id || null,
    playerClubId: players[0]?.club_id || null,
    ownerClubId: clubs[0]?.id || null,
  };
}

function ownScopeWhere(ctx) {
  return {
    clause: '(home_player_id = ? OR away_player_id = ? OR home_club_id = ? OR away_club_id = ?)',
    values: [ctx.playerId, ctx.playerId, ctx.playerClubId || ctx.ownerClubId, ctx.playerClubId || ctx.ownerClubId],
  };
}

function hasOwnScope(ctx) {
  return Boolean(ctx.playerId || ctx.playerClubId || ctx.ownerClubId);
}

async function enrichMatchRows(rows) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return list;

  const clubIds = [...new Set(
    list.flatMap((r) => [r.home_club_id, r.away_club_id]).filter(Boolean)
  )];
  const playerIds = [...new Set(
    list.flatMap((r) => [r.home_player_id, r.away_player_id]).filter(Boolean)
  )];

  const [clubs, players] = await Promise.all([
    clubIds.length
      ? EXECUTESQL(
          `SELECT id, name FROM clubs WHERE id IN (${clubIds.map(() => '?').join(',')})`,
          clubIds
        )
      : Promise.resolve([]),
    playerIds.length
      ? EXECUTESQL(
          `SELECT id, gamertag FROM players WHERE id IN (${playerIds.map(() => '?').join(',')})`,
          playerIds
        )
      : Promise.resolve([]),
  ]);

  const clubNameById = new Map(clubs.map((c) => [c.id, c.name]));
  const playerNameById = new Map(players.map((p) => [p.id, p.gamertag]));

  return list.map((r) => ({
    ...r,
    home_club_name: r.home_club_name || (r.home_club_id ? (clubNameById.get(r.home_club_id) || null) : null),
    away_club_name: r.away_club_name || (r.away_club_id ? (clubNameById.get(r.away_club_id) || null) : null),
    home_player_name: r.home_player_name || (r.home_player_id ? (playerNameById.get(r.home_player_id) || null) : null),
    away_player_name: r.away_player_name || (r.away_player_id ? (playerNameById.get(r.away_player_id) || null) : null),
  }));
}

async function attachMatchNames(payload) {
  const next = { ...(payload || {}) };
  const clubIds = [next.home_club_id, next.away_club_id].filter(Boolean);
  const playerIds = [next.home_player_id, next.away_player_id].filter(Boolean);

  if (clubIds.length) {
    const clubs = await EXECUTESQL(
      `SELECT id, name FROM clubs WHERE id IN (${clubIds.map(() => '?').join(',')})`,
      clubIds
    );
    const byId = new Map(clubs.map((c) => [c.id, c.name]));
    if (next.home_club_id) next.home_club_name = byId.get(next.home_club_id) || next.home_club_name || null;
    if (next.away_club_id) next.away_club_name = byId.get(next.away_club_id) || next.away_club_name || null;
  }

  if (playerIds.length) {
    const players = await EXECUTESQL(
      `SELECT id, gamertag FROM players WHERE id IN (${playerIds.map(() => '?').join(',')})`,
      playerIds
    );
    const byId = new Map(players.map((p) => [p.id, p.gamertag]));
    if (next.home_player_id) next.home_player_name = byId.get(next.home_player_id) || next.home_player_name || null;
    if (next.away_player_id) next.away_player_name = byId.get(next.away_player_id) || next.away_player_name || null;
  }

  return next;
}

// GET /
router.get('/', async (req, res) => {
  try {
    const {
      club_id,
      tournament_id,
      status,
      page,
      id,
      home_club_id,
      away_club_id,
      home_player_id,
      away_player_id,
      mode,
      round,
      type,
    } = req.query;
    const match = new Match();
    const auth = await getAuthContext(req);
    if (!auth) return res.status(403).json({ error: 'Forbidden' });
    const isAdmin = auth.roleId === 0;
    if (!isAdmin && !hasOwnScope(auth)) return res.status(403).json({ error: 'Forbidden' });
    let result;

    // Support generic stageClient filters, otherwise we accidentally fall back
    // to selectAll() and leak unrelated schedule rows.
    const filters = {
      id, home_club_id, away_club_id, home_player_id, away_player_id,
      tournament_id, status, mode, round, type,
    };
    const clean = Object.entries(filters).filter(([, v]) => v !== undefined && v !== null && v !== '');
    if (!isAdmin) {
      const own = ownScopeWhere(auth);
      const whereParts = [own.clause];
      const values = [...own.values];
      for (const [k, v] of clean) {
        whereParts.push(`${k} = ?`);
        values.push(v);
      }
      result = await EXECUTESQL(`SELECT * FROM matches WHERE ${whereParts.join(' AND ')} ORDER BY scheduled_date DESC`, values);
    } else if (clean.length) {
      const where = clean.map(([k]) => `${k} = ?`).join(' AND ');
      const values = clean.map(([, v]) => v);
      result = await EXECUTESQL(`SELECT * FROM matches WHERE ${where} ORDER BY scheduled_date DESC`, values);
    } else if (club_id) {
      result = await match.selectByClub(club_id);
    } else if (tournament_id) {
      result = await match.selectByTournament(tournament_id);
    } else if (status) {
      result = await match.selectByStatus(status);
    } else {
      result = await match.selectAll(Number(page) || 1);
    }

    res.json(await enrichMatchRows(result));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return res.status(403).json({ error: 'Forbidden' });
    const isAdmin = auth.roleId === 0;
    if (!isAdmin && !hasOwnScope(auth)) return res.status(403).json({ error: 'Forbidden' });
    const match  = new Match();
    const result = await match.selectOne(req.params.id);
    if (!result.length) return res.status(404).json({ error: 'Not found' });
    const record = result[0];
    const userClubId = auth.playerClubId || auth.ownerClubId;
    const canAccess = isAdmin ||
      record.home_player_id === auth.playerId ||
      record.away_player_id === auth.playerId ||
      record.home_club_id === userClubId ||
      record.away_club_id === userClubId;
    if (!canAccess) return res.status(403).json({ error: 'Forbidden' });
    res.json((await enrichMatchRows([record]))[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /
router.post('/', async (req, res) => {
  try {
    const auth = await getAuthContext(req);
    if (!auth) return res.status(403).json({ error: 'Forbidden' });
    const isAdmin = auth.roleId === 0;
    if (!isAdmin && !hasOwnScope(auth)) return res.status(403).json({ error: 'Forbidden' });
    if (!isAdmin) {
      const userClubId = auth.playerClubId || auth.ownerClubId;
      const payload = req.body || {};
      const touchesMine =
        payload.home_player_id === auth.playerId ||
        payload.away_player_id === auth.playerId ||
        payload.home_club_id === userClubId ||
        payload.away_club_id === userClubId;
      if (!touchesMine) return res.status(403).json({ error: 'Forbidden' });
    }
    const payloadWithNames = await attachMatchNames(req.body);
    const match = new Match(payloadWithNames);
    await match.create();
    const created = await match.selectOne(match.id);
    const record  = created[0];
    socketEmit(MAKE_SOCKET_CHANNEL(record.id, SOCKET_CHANNELS.MATCH), record);
    socketEmit(SOCKET_CHANNELS.MATCH, record);
    res.status(201).json((await enrichMatchRows([record]))[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /:id
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const auth = await getAuthContext(req);
    if (!auth) return res.status(403).json({ error: 'Forbidden' });
    const isAdmin = auth.roleId === 0;
    if (!isAdmin && !hasOwnScope(auth)) return res.status(403).json({ error: 'Forbidden' });
    const existing = await new Match().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    if (!isAdmin) {
      const record = existing[0];
      const userClubId = auth.playerClubId || auth.ownerClubId;
      const canAccess =
        record.home_player_id === auth.playerId ||
        record.away_player_id === auth.playerId ||
        record.home_club_id === userClubId ||
        record.away_club_id === userClubId;
      if (!canAccess) return res.status(403).json({ error: 'Forbidden' });
    }
    const payloadWithNames = await attachMatchNames({ ...existing[0], ...req.body });
    const match = new Match(payloadWithNames);
    await match.update(id);
    const updated = await match.selectOne(id);
    const record  = updated[0];
    socketEmit(MAKE_SOCKET_CHANNEL(record.id, SOCKET_CHANNELS.MATCH), record);
    socketEmit(SOCKET_CHANNELS.MATCH, record);
    res.json((await enrichMatchRows([record]))[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const auth = await getAuthContext(req);
    if (!auth) return res.status(403).json({ error: 'Forbidden' });
    const isAdmin = auth.roleId === 0;
    if (!isAdmin && !hasOwnScope(auth)) return res.status(403).json({ error: 'Forbidden' });
    const existing = await new Match().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    if (!isAdmin) {
      const record = existing[0];
      const userClubId = auth.playerClubId || auth.ownerClubId;
      const canAccess =
        record.home_player_id === auth.playerId ||
        record.away_player_id === auth.playerId ||
        record.home_club_id === userClubId ||
        record.away_club_id === userClubId;
      if (!canAccess) return res.status(403).json({ error: 'Forbidden' });
    }
    await new Match().delete(id);
    socketEmit(MAKE_SOCKET_CHANNEL(id, SOCKET_CHANNELS.MATCH), { deleted: true, id });
    socketEmit(SOCKET_CHANNELS.MATCH, { deleted: true, id });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

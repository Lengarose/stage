const express = require('express');
const router  = express.Router();
const Match   = require('../models/matchModel');
const { EXECUTESQL } = require('../db/database');
const { socketEmit } = require('../express/index');
const { SOCKET_CHANNELS, MAKE_SOCKET_CHANNEL } = require('../../constants/constants');
const { v4: uuidv4 } = require('uuid');
const { normalizeMatchForApi } = require('../utils/datetime');

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

function eloDelta(ratingA, ratingB, result) {
  const K = 32;
  const expected = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  const actual = result === 'win' ? 1 : result === 'draw' ? 0.5 : 0;
  return Math.round((K * (actual - expected)) * 10) / 10;
}

function parseForm(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function runPostConfirmProcessing(record) {
  if (!record || record.status !== 'confirmed' || Number(record.stats_processed || 0) === 1) return;
  const homeScore = Number(record.home_score || 0);
  const awayScore = Number(record.away_score || 0);
  const homeResult = homeScore > awayScore ? 'win' : (homeScore < awayScore ? 'loss' : 'draw');
  const awayResult = homeResult === 'win' ? 'loss' : (homeResult === 'loss' ? 'win' : 'draw');

  // Update player aggregates from match_player_stats if any.
  const statRows = await EXECUTESQL('SELECT * FROM match_player_stats WHERE match_id = ?', [record.id]);
  if (statRows.length) {
    const maxRating = Math.max(...statRows.map((s) => Number(s.rating || 0)));
    for (const s of statRows) {
      const pRows = await EXECUTESQL('SELECT * FROM players WHERE LOWER(email)=LOWER(?) LIMIT 1', [s.player_email]);
      const p = pRows[0];
      if (!p) continue;
      const isHome = s.club_id && record.home_club_id && s.club_id === record.home_club_id;
      const result = isHome ? homeResult : awayResult;
      await EXECUTESQL(
        `UPDATE players SET
          matches_played = IFNULL(matches_played,0)+1,
          goals = IFNULL(goals,0)+?,
          assists = IFNULL(assists,0)+?,
          wins_count = IFNULL(wins_count,0)+?,
          losses_count = IFNULL(losses_count,0)+?,
          draws_count = IFNULL(draws_count,0)+?,
          man_of_the_match = IFNULL(man_of_the_match,0)+?,
          updated_date = NOW()
         WHERE id = ?`,
        [
          Number(s.goals || 0),
          Number(s.assists || 0),
          result === 'win' ? 1 : 0,
          result === 'loss' ? 1 : 0,
          result === 'draw' ? 1 : 0,
          Number(s.rating || 0) === maxRating ? 1 : 0,
          p.id,
        ]
      );
    }
  }

  // Club aggregates + ranking updates (club mode only).
  if (record.mode === 'club' && record.home_club_id && record.away_club_id) {
    const [homeRows, awayRows] = await Promise.all([
      EXECUTESQL('SELECT * FROM clubs WHERE id = ? LIMIT 1', [record.home_club_id]),
      EXECUTESQL('SELECT * FROM clubs WHERE id = ? LIMIT 1', [record.away_club_id]),
    ]);
    const homeClub = homeRows[0];
    const awayClub = awayRows[0];
    if (homeClub && awayClub) {
      const isRanked = record.type === 'ranked';
      const hDelta = eloDelta(Number(homeClub.rating || 1500), Number(awayClub.rating || 1500), homeResult);
      const aDelta = eloDelta(Number(awayClub.rating || 1500), Number(homeClub.rating || 1500), awayResult);
      const newHRating = Math.max(100, Math.round(Number(homeClub.rating || 1500) + hDelta));
      const newARating = Math.max(100, Math.round(Number(awayClub.rating || 1500) + aDelta));
      await EXECUTESQL(
        `UPDATE clubs SET
          wins = IFNULL(wins,0)+?, losses = IFNULL(losses,0)+?, draws = IFNULL(draws,0)+?,
          goals_scored = IFNULL(goals_scored,0)+?, goals_conceded = IFNULL(goals_conceded,0)+?,
          matches_ranked = IFNULL(matches_ranked,0)+?,
          rating = ?, peak_rating = GREATEST(IFNULL(peak_rating,1500), ?),
          form = ?, updated_date = NOW()
         WHERE id = ?`,
        [
          homeResult === 'win' ? 1 : 0,
          homeResult === 'loss' ? 1 : 0,
          homeResult === 'draw' ? 1 : 0,
          homeScore, awayScore,
          isRanked ? 1 : 0,
          newHRating, newHRating,
          JSON.stringify([...parseForm(homeClub.form), homeResult[0].toUpperCase()].slice(-5)),
          homeClub.id,
        ]
      );
      await EXECUTESQL(
        `UPDATE clubs SET
          wins = IFNULL(wins,0)+?, losses = IFNULL(losses,0)+?, draws = IFNULL(draws,0)+?,
          goals_scored = IFNULL(goals_scored,0)+?, goals_conceded = IFNULL(goals_conceded,0)+?,
          matches_ranked = IFNULL(matches_ranked,0)+?,
          rating = ?, peak_rating = GREATEST(IFNULL(peak_rating,1500), ?),
          form = ?, updated_date = NOW()
         WHERE id = ?`,
        [
          awayResult === 'win' ? 1 : 0,
          awayResult === 'loss' ? 1 : 0,
          awayResult === 'draw' ? 1 : 0,
          awayScore, homeScore,
          isRanked ? 1 : 0,
          newARating, newARating,
          JSON.stringify([...parseForm(awayClub.form), awayResult[0].toUpperCase()].slice(-5)),
          awayClub.id,
        ]
      );
      if (isRanked) {
        await EXECUTESQL(
          `INSERT INTO rating_history
           (id, club_id, club_name, opponent_club_id, opponent_club_name, match_id, competition_type, result, home_score, away_score, points_before, points_after, points_change, played_at, created_date)
           VALUES (?, ?, ?, ?, ?, ?, 'ranked', ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [uuidv4(), homeClub.id, homeClub.name || null, awayClub.id, awayClub.name || null, record.id, homeResult === 'win' ? 'W' : (homeResult === 'draw' ? 'D' : 'L'), homeScore, awayScore, Number(homeClub.rating || 1500), newHRating, hDelta]
        ).catch(() => {});
        await EXECUTESQL(
          `INSERT INTO rating_history
           (id, club_id, club_name, opponent_club_id, opponent_club_name, match_id, competition_type, result, home_score, away_score, points_before, points_after, points_change, played_at, created_date)
           VALUES (?, ?, ?, ?, ?, ?, 'ranked', ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [uuidv4(), awayClub.id, awayClub.name || null, homeClub.id, homeClub.name || null, record.id, awayResult === 'win' ? 'W' : (awayResult === 'draw' ? 'D' : 'L'), awayScore, homeScore, Number(awayClub.rating || 1500), newARating, aDelta]
        ).catch(() => {});
      }
    }
  }

  await EXECUTESQL('UPDATE matches SET stats_processed = 1, updated_date = NOW() WHERE id = ?', [record.id]);
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

  return list.map((r) => normalizeMatchForApi({
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
    const previous = existing[0];
    const payloadWithNames = await attachMatchNames({ ...previous, ...req.body });
    const match = new Match(payloadWithNames);
    await match.update(id);
    const updated = await match.selectOne(id);
    const record  = updated[0];
    if (previous.status !== 'confirmed' && record.status === 'confirmed') {
      await runPostConfirmProcessing(record);
      const refreshed = await match.selectOne(id);
      if (refreshed.length) {
        Object.assign(record, refreshed[0]);
      }
    }
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

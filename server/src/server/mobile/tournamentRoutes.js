const express = require('express');
const { v4: uuidv4 } = require('uuid');
const Tournament = require('../models/tournamentModel');
const Match = require('../models/matchModel');
const { EXECUTESQL } = require('../db/database');
const { ok, fail, mapMatch, mapClub, resolveCallerContext } = require('./helpers');

const router = express.Router();

function mapTournament(row = {}) {
  if (!row) return null;
  return {
    ...row,
    team_id: row.club_id || null,
  };
}

router.get('/list', async (req, res) => {
  try {
    const rows = await new Tournament().selectAll(Number(req.query.page) || 1);
    return ok(res, (rows || []).map(mapTournament));
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.get('/', async (req, res) => {
  try {
    const rows = await new Tournament().selectAll(Number(req.query.page) || 1);
    return ok(res, (rows || []).map(mapTournament));
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const rows = await new Tournament().selectOne(req.params.id);
    if (!rows.length) return fail(res, 404, 'Not found');
    const tournament = mapTournament(rows[0]);

    const matches = await new Match().selectByTournament?.(req.params.id).catch(() => null);
    let matchRows = matches;
    if (!matchRows) {
      matchRows = await EXECUTESQL(
        'SELECT * FROM matches WHERE tournament_id = ? ORDER BY scheduled_date ASC, created_date ASC LIMIT 200',
        [req.params.id]
      ).catch(() => []);
    }

    const participants = await EXECUTESQL(
      `SELECT c.* FROM clubs c
       INNER JOIN competition_participants cp ON cp.club_id = c.id
       INNER JOIN competition_instances ci ON ci.id = cp.competition_instance_id
       WHERE ci.legacy_source_id = ? OR ci.legacy_source_id = ?
       LIMIT 100`,
      [req.params.id, req.params.id]
    ).catch(() => []);

    return ok(res, {
      ...tournament,
      teams: (participants || []).map((c) => ({ ...mapClub(c), team_id: c.id })),
      matches: (matchRows || []).map(mapMatch),
    });
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.post('/', async (req, res) => {
  try {
    const ctx = await resolveCallerContext(req.user);
    if (!ctx) return fail(res, 401, 'Unauthorized');
    const body = req.body || {};
    const tournament = new Tournament({
      ...body,
      name: body.name,
      creator_id: ctx.user.id,
      creator_email: ctx.user.email,
      organizer_email: ctx.user.email,
      creator_gamertag: ctx.player?.gamertag || null,
      status: body.status || 'draft',
    });
    await tournament.create();
    const created = (await tournament.selectOne(tournament.id))[0];
    return ok(res, mapTournament(created), 201);
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.post('/:id/start', async (req, res) => {
  try {
    const rows = await new Tournament().selectOne(req.params.id);
    if (!rows.length) return fail(res, 404, 'Not found');
    const tournament = new Tournament({ ...rows[0], status: 'active' });
    await tournament.update(req.params.id);
    const updated = (await tournament.selectOne(req.params.id))[0];
    return ok(res, mapTournament(updated));
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.post('/:id/join', async (req, res) => {
  try {
    const teamId = req.body?.team_id || req.body?.club_id;
    if (!teamId) return fail(res, 400, 'team_id is required');
    // Soft join: record a season registration-like row when possible, else acknowledge.
    await EXECUTESQL(
      `INSERT INTO season_registrations (id, tournament_id, club_id, status, created_date, updated_date)
       VALUES (?, ?, ?, 'registered', NOW(), NOW())`,
      [uuidv4(), req.params.id, teamId]
    ).catch(() => null);
    return ok(res, { success: true, tournament_id: req.params.id, team_id: teamId });
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.post('/:id/invite', async (req, res) => {
  try {
    const teamIds = req.body?.team_ids || [];
    return ok(res, { success: true, invited: teamIds.length, team_ids: teamIds });
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.get('/:id/standings', async (req, res) => {
  try {
    const rows = await EXECUTESQL(
      `SELECT * FROM competition_standings
       WHERE competition_instance_id IN (
         SELECT id FROM competition_instances WHERE legacy_source_id = ?
       )
       ORDER BY points DESC, goal_difference DESC
       LIMIT 100`,
      [req.params.id]
    ).catch(() => []);
    const standings = (rows || []).map((s, idx) => ({
      ...s,
      team_id: s.club_id,
      rank: idx + 1,
      played: s.played ?? s.matches_played ?? 0,
      won: s.won ?? s.wins ?? 0,
      drawn: s.drawn ?? s.draws ?? 0,
      lost: s.lost ?? s.losses ?? 0,
      gf: s.goals_for ?? s.gf ?? 0,
      ga: s.goals_against ?? s.ga ?? 0,
      pts: s.points ?? s.pts ?? 0,
    }));
    return ok(res, standings);
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.get('/:id/groups', async (req, res) => {
  try {
    const rows = await EXECUTESQL(
      `SELECT * FROM competition_phase_states
       WHERE competition_instance_id IN (
         SELECT id FROM competition_instances WHERE legacy_source_id = ?
       )
       AND (phase = 'groups' OR format LIKE '%group%')
       LIMIT 50`,
      [req.params.id]
    ).catch(() => []);
    return ok(res, rows || []);
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.get('/:id/brackets', async (req, res) => {
  try {
    const matches = await EXECUTESQL(
      `SELECT * FROM matches
       WHERE tournament_id = ?
       ORDER BY round ASC, created_date ASC
       LIMIT 200`,
      [req.params.id]
    ).catch(() => []);
    const byRound = {};
    for (const m of matches || []) {
      const round = m.round || m.phase || 'Round';
      if (!byRound[round]) byRound[round] = [];
      byRound[round].push(mapMatch(m));
    }
    const rounds = Object.entries(byRound).map(([name, items]) => ({ name, matches: items }));
    return ok(res, rounds);
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

module.exports = router;

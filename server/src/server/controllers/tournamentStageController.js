'use strict';

const { EXECUTESQL } = require('../db/database');
const {
  buildStageCatalogue,
  presentStageMatches,
  publicStage,
  stageStandings,
  parseStagePage,
  pageStageMatches,
} = require('../lib/tournamentStageView');

const STAGE_KEY = /^[a-z0-9-]{1,40}$/;

async function rowsByIds(sql, ids) {
  if (!ids.length) return [];
  return EXECUTESQL(sql.replace('IN (?)', `IN (${ids.map(() => '?').join(',')})`), ids);
}

async function loadStageBundle(tournamentId, userId, includeScheduleCapability) {
  const tournaments = await EXECUTESQL('SELECT * FROM tournaments WHERE id = ? LIMIT 1', [tournamentId]);
  if (!tournaments.length) return null;
  const tournament = tournaments[0];
  const matches = await EXECUTESQL(
    'SELECT * FROM matches WHERE tournament_id = ? ORDER BY round ASC, group_number ASC, id ASC',
    [tournamentId]
  );
  const playerTournament = tournament.participant_type === 'player';
  const participantIds = [...new Set(matches.flatMap((match) => (
    playerTournament
      ? [match.home_player_id, match.away_player_id]
      : [match.home_club_id, match.away_club_id]
  )).filter(Boolean).map(String))];
  const profiles = new Map();
  const homeClubs = new Map();
  if (playerTournament) {
    const players = await rowsByIds('SELECT id, gamertag, avatar_url FROM players WHERE id IN (?)', participantIds);
    players.forEach((row) => profiles.set(String(row.id), { name: row.gamertag, badge: row.avatar_url || null }));
  } else {
    const clubs = await rowsByIds(
      'SELECT id, name, logo_url, president_user_id, user_id, owner_email FROM clubs WHERE id IN (?)',
      participantIds
    );
    clubs.forEach((row) => {
      profiles.set(String(row.id), { name: row.name, badge: row.logo_url || null });
      homeClubs.set(String(row.id), row);
    });
  }

  let viewer = null;
  if (includeScheduleCapability && userId) {
    const users = await EXECUTESQL('SELECT id, email FROM users WHERE id = ? LIMIT 1', [userId]);
    if (users.length) {
      const email = String(users[0].email || '').trim().toLowerCase();
      const players = await EXECUTESQL(
        'SELECT id FROM players WHERE user_id = ? OR LOWER(TRIM(email)) = ? ORDER BY (user_id = ?) DESC LIMIT 1',
        [userId, email, userId]
      );
      viewer = { userId, email, playerId: players[0]?.id || null };
    }
  }

  return {
    tournament,
    stages: buildStageCatalogue(tournament, matches),
    profiles,
    viewer,
    homeClubs,
  };
}

function stageOrNull(bundle, stageKey) {
  if (!STAGE_KEY.test(String(stageKey || ''))) return { error: 'invalid' };
  const stage = bundle.stages.find((item) => item.key === stageKey);
  return { stage: stage || null };
}

async function getTournamentStages(req, res) {
  try {
    const bundle = await loadStageBundle(req.params.id, req.user?.id, Boolean(req.user));
    if (!bundle) return res.status(404).json({ error: 'Tournament not found' });
    res.json({
      tournament_id: bundle.tournament.id,
      format: bundle.tournament.type,
      participant_type: bundle.tournament.participant_type || 'club',
      stages: bundle.stages.map(publicStage),
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

async function getTournamentStage(req, res) {
  try {
    const bundle = await loadStageBundle(req.params.id, req.user?.id, Boolean(req.user));
    if (!bundle) return res.status(404).json({ error: 'Tournament not found' });
    const found = stageOrNull(bundle, req.params.stageKey);
    if (found.error) return res.status(400).json({ error: 'Invalid stage key' });
    if (!found.stage) return res.status(404).json({ error: 'Stage not found', stage_key: req.params.stageKey });
    res.json({
      tournament_id: bundle.tournament.id,
      stage: publicStage(found.stage),
      standings: stageStandings(bundle.tournament, found.stage, bundle.profiles),
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

async function getTournamentStageMatches(req, res) {
  try {
    const page = parseStagePage(req.query);
    const bundle = await loadStageBundle(req.params.id, req.user?.id, Boolean(req.user));
    if (!bundle) return res.status(404).json({ error: 'Tournament not found' });
    const found = stageOrNull(bundle, req.params.stageKey);
    if (found.error) return res.status(400).json({ error: 'Invalid stage key' });
    if (!found.stage) return res.status(404).json({ error: 'Stage not found', stage_key: req.params.stageKey });
    const rows = presentStageMatches(found.stage, bundle.tournament, bundle.profiles, bundle.viewer, bundle.homeClubs);
    res.json({
      tournament_id: bundle.tournament.id,
      stage: publicStage(found.stage),
      standings: stageStandings(bundle.tournament, found.stage, bundle.profiles),
      ...pageStageMatches(rows, page),
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

module.exports = {
  getTournamentStages,
  getTournamentStage,
  getTournamentStageMatches,
};

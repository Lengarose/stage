const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { EXECUTESQL } = require('../db/database');
const CompetitionEngineModel = require('../models/competitionEngineModel');
const Match = require('../models/matchModel');

const model = new CompetitionEngineModel();

function deterministicId(seed) {
  const hex = crypto.createHash('sha1').update(String(seed)).digest('hex').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function parseJson(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  if (Array.isArray(value) || (typeof value === 'object' && value !== null)) return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function assertSide(side) {
  if (!['home', 'away'].includes(side)) {
    const err = new Error('side must be home or away');
    err.status = 400;
    throw err;
  }
}

function mapFixtureToMatch(fixture) {
  return {
    id: uuidv4(),
    tournament_id: fixture.competition_instance_id,
    home_club_id: fixture.home_club_id,
    away_club_id: fixture.away_club_id,
    home_club_name: fixture.home_club_name,
    away_club_name: fixture.away_club_name,
    home_owner_email: fixture.home_owner_email,
    away_owner_email: fixture.away_owner_email,
    home_player_id: fixture.player_home_id,
    home_player_name: fixture.player_home_gamertag,
    home_player_email: fixture.player_home_email,
    away_player_id: fixture.player_away_id,
    away_player_name: fixture.player_away_gamertag,
    away_player_email: fixture.player_away_email,
    status: fixture.scheduled_at ? 'scheduled' : 'pending_schedule',
    mode: fixture.participant_type === 'player' ? 'player' : 'club',
    type: fixture.format || 'competition_engine',
    round: fixture.round,
    group_number: fixture.group_number,
    bracket_side: fixture.bracket_side,
    scheduled_date: fixture.scheduled_at,
    source_fixture_id: fixture.id,
    source_fixture_type: 'competition_engine',
    competition_context: fixture.competition_instance_id,
  };
}

function inferTournamentParticipantType(tournament, registeredClubs, registeredPlayers) {
  const raw = String(tournament.participant_type || '').toLowerCase();
  if (['player', 'solo'].includes(raw)) return 'player';
  if (['club', 'team'].includes(raw)) return 'club';
  if (registeredPlayers.length && !registeredClubs.length) return 'player';
  return 'club';
}

function normalizeParticipantIdentity(entry, participantType) {
  if (typeof entry === 'string' || typeof entry === 'number') {
    const sourceId = String(entry);
    if (participantType === 'player') {
      return {
        id: sourceId,
        player_id: sourceId,
        user_id: null,
        name: null,
        email: null,
      };
    }
    return {
      id: sourceId,
      club_id: sourceId,
      user_id: null,
      name: null,
      email: null,
    };
  }
  const row = entry || {};
  if (participantType === 'player') {
    const playerId = row.player_id || row.id;
    return {
      id: playerId,
      player_id: playerId,
      user_id: row.user_id || row.owner_id || null,
      name: row.gamertag || row.name || row.player_name || null,
      email: row.email || row.player_email || null,
    };
  }
  const clubId = row.club_id || row.id;
  return {
    id: clubId,
    club_id: clubId,
    user_id: row.user_id || row.owner_id || null,
    name: row.name || row.club_name || null,
    email: row.owner_email || row.email || null,
  };
}

function parseLeagueEntityRow(row) {
  const data = parseJson(row.data_json, {});
  return {
    ...data,
    id: row.id,
    entity_type: row.entity_type,
    status: row.status ?? data.status,
    scheduling_status: row.scheduling_status ?? data.scheduling_status,
    slug: row.slug ?? data.slug,
    league_id: row.league_id ?? data.league_id,
    season_id: row.season_id ?? data.season_id,
    competition_id: row.competition_id ?? data.competition_id,
    club_id: row.club_id ?? data.club_id,
    tier: row.tier ?? data.tier,
    division: row.division ?? data.division,
    region: row.region ?? data.region,
    platform: row.platform ?? data.platform,
    season_number: row.season_number ?? data.season_number,
    created_date: row.created_date,
    updated_date: row.updated_date,
  };
}

function statusToFixtureStatus(status) {
  if (status === 'completed') return 'completed';
  if (status === 'disputed') return 'disputed';
  if (status === 'in_progress') return 'in_progress';
  if (status === 'cancelled') return 'cancelled';
  if (status === 'forfeit') return 'forfeit';
  if (status === 'scheduled') return 'scheduled';
  return status || 'unscheduled';
}

async function hasFixtureMatchConflict(row) {
  if (!row.match_id) return false;
  const existingRows = await model.selectFixtureByMatch(row.match_id);
  if (!existingRows.length) return false;
  const existing = existingRows[0];
  return String(existing.legacy_fixture_type || '') !== String(row.legacy_fixture_type || '') ||
    String(existing.legacy_fixture_id || '') !== String(row.legacy_fixture_id || '');
}

function leagueParentConfig(productType) {
  if (productType === 'regional_league') {
    return {
      product_type: 'regional_league',
      parent_type: 'regional_league',
      standing_type: 'regional_league_standing',
      fixture_type: 'regional_league_fixture',
      parent_key: 'league_id',
    };
  }
  return {
    product_type: 'official_competition',
    parent_type: 'competition_season',
    standing_type: 'competition_standing',
    fixture_type: 'competition_fixture',
    parent_key: 'season_id',
  };
}

async function backfillCommunityTournaments({ status } = {}) {
  const params = [];
  const where = [];
  if (status) {
    where.push('status = ?');
    params.push(status);
  }
  const tournaments = await EXECUTESQL(
    `SELECT * FROM tournaments ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_date ASC LIMIT 500`,
    params,
  );

  const summary = {
    tournaments: tournaments.length,
    instances: 0,
    participants: 0,
    fixtures: 0,
    conflicts: 0,
  };

  for (const tournament of tournaments) {
    const registeredClubs = parseJson(tournament.registered_clubs, []);
    const registeredPlayers = parseJson(tournament.registered_players, []);
    const participantType = inferTournamentParticipantType(tournament, registeredClubs, registeredPlayers);
    const participants = participantType === 'player' ? registeredPlayers : registeredClubs;
    const instanceId = deterministicId(`competition_instance:tournament:${tournament.id}`);

    await model.upsertInstance({
      id: instanceId,
      product_type: 'community_tournament',
      legacy_source_type: 'tournament',
      legacy_source_id: tournament.id,
      name: tournament.name || 'Community Tournament',
      slug: tournament.slug || tournament.id,
      region: tournament.region || null,
      platform: tournament.platform || null,
      status: tournament.status || 'draft',
      starts_at: tournament.start_date || null,
      ends_at: tournament.end_date || null,
      created_by_user_id: tournament.creator_id || null,
    });
    summary.instances += 1;

    const participantIdBySource = new Map();
    for (const [index, rawParticipant] of participants.entries()) {
      const identity = normalizeParticipantIdentity(rawParticipant, participantType);
      if (!identity.id) continue;
      const participantId = deterministicId(`competition_participant:${instanceId}:${participantType}:${identity.id}`);
      participantIdBySource.set(identity.id, participantId);
      await model.upsertParticipant({
        id: participantId,
        competition_instance_id: instanceId,
        participant_type: participantType,
        club_id: participantType === 'club' ? identity.club_id : null,
        player_id: participantType === 'player' ? identity.player_id : null,
        user_id: identity.user_id,
        status: 'active',
        seed: index + 1,
        registered_at: tournament.created_date || null,
        approved_at: tournament.created_date || null,
      });
      summary.participants += 1;
    }

    const matches = await EXECUTESQL('SELECT * FROM matches WHERE tournament_id = ? ORDER BY round, group_number, scheduled_date, created_date', [tournament.id]);
    for (const match of matches) {
      const homeSourceId = participantType === 'player' ? match.home_player_id : match.home_club_id;
      const awaySourceId = participantType === 'player' ? match.away_player_id : match.away_club_id;
      const fixtureRow = {
        id: deterministicId(`competition_fixture:match:${match.id}`),
        competition_instance_id: instanceId,
        legacy_fixture_type: 'tournament_match',
        legacy_fixture_id: match.id,
        match_id: match.id,
        participant_type: participantType,
        format: tournament.type || match.type || null,
        phase: tournament.ucl_phase || match.type || tournament.type || 'main',
        round: match.round ?? tournament.current_round ?? 1,
        group_number: match.group_number ?? null,
        bracket_side: match.bracket_side || null,
        home_participant_id: homeSourceId ? (participantIdBySource.get(homeSourceId) || deterministicId(`competition_participant:${instanceId}:${participantType}:${homeSourceId}`)) : null,
        away_participant_id: awaySourceId ? (participantIdBySource.get(awaySourceId) || deterministicId(`competition_participant:${instanceId}:${participantType}:${awaySourceId}`)) : null,
        home_club_id: match.home_club_id || null,
        home_club_name: match.home_club_name || null,
        home_owner_email: match.home_owner_email || null,
        away_club_id: match.away_club_id || null,
        away_club_name: match.away_club_name || null,
        away_owner_email: match.away_owner_email || null,
        player_home_id: match.home_player_id || null,
        player_home_gamertag: match.home_player_name || null,
        player_home_email: match.home_player_email || null,
        player_away_id: match.away_player_id || null,
        player_away_gamertag: match.away_player_name || null,
        player_away_email: match.away_player_email || null,
        status: statusToFixtureStatus(match.status),
        scheduling_status: match.scheduled_date ? 'confirmed' : 'open',
        scheduled_at: match.scheduled_date || null,
        confirmed_at: match.scheduled_date || null,
        home_score: match.home_score ?? null,
        away_score: match.away_score ?? null,
        winner_participant_id: match.winner_player_id
          ? participantIdBySource.get(match.winner_player_id)
          : match.winner_club_id
            ? participantIdBySource.get(match.winner_club_id)
            : null,
        stats_processed: match.stats_processed ? 1 : 0,
        idempotency_key: `backfill:tournament_match:${match.id}`,
      };
      if (await hasFixtureMatchConflict(fixtureRow)) {
        summary.conflicts += 1;
        continue;
      }
      await model.upsertFixture(fixtureRow);
      summary.fixtures += 1;
    }
  }

  return summary;
}

async function backfillLeagueEntities({ productType = 'official_competition', status } = {}) {
  const cfg = leagueParentConfig(productType);
  const parentWhere = ['entity_type = ?'];
  const parentParams = [cfg.parent_type];
  if (status) {
    parentWhere.push('status = ?');
    parentParams.push(status);
  }
  const parentRows = await EXECUTESQL(
    `SELECT * FROM league_entities WHERE ${parentWhere.join(' AND ')} ORDER BY created_date ASC LIMIT 500`,
    parentParams,
  );

  const summary = {
    product_type: cfg.product_type,
    parents: parentRows.length,
    instances: 0,
    participants: 0,
    fixtures: 0,
    conflicts: 0,
  };

  for (const rawParent of parentRows) {
    const parent = parseLeagueEntityRow(rawParent);
    const instanceId = deterministicId(`competition_instance:${cfg.parent_type}:${parent.id}`);
    await model.upsertInstance({
      id: instanceId,
      product_type: cfg.product_type,
      legacy_source_type: cfg.parent_type,
      legacy_source_id: parent.id,
      name: parent.name || parent.season_name || parent.competition_name || parent.league_name || parent.id,
      slug: parent.slug || parent.id,
      region: parent.region || null,
      platform: parent.platform || null,
      status: parent.status || 'draft',
      starts_at: parent.starts_at || parent.start_date || null,
      ends_at: parent.ends_at || parent.end_date || null,
      created_by_user_id: parent.created_by_user_id || null,
    });
    summary.instances += 1;

    const standingRows = await EXECUTESQL(
      `SELECT * FROM league_entities WHERE entity_type = ? AND \`${cfg.parent_key}\` = ? ORDER BY created_date ASC LIMIT 500`,
      [cfg.standing_type, parent.id],
    );
    const participantIdByClubId = new Map();
    for (const [index, rawStanding] of standingRows.entries()) {
      const standing = parseLeagueEntityRow(rawStanding);
      const clubId = standing.club_id;
      if (!clubId) continue;
      const participantId = deterministicId(`competition_participant:${instanceId}:club:${clubId}`);
      participantIdByClubId.set(clubId, participantId);
      await model.upsertParticipant({
        id: participantId,
        competition_instance_id: instanceId,
        participant_type: 'club',
        club_id: clubId,
        player_id: null,
        user_id: standing.user_id || standing.owner_id || null,
        status: standing.is_eliminated ? 'eliminated' : 'active',
        seed: standing.seed ?? standing.rank ?? index + 1,
        registered_at: standing.created_date || parent.created_date || null,
        approved_at: standing.created_date || parent.created_date || null,
      });
      summary.participants += 1;
    }

    const fixtureRows = await EXECUTESQL(
      `SELECT * FROM league_entities WHERE entity_type = ? AND \`${cfg.parent_key}\` = ? ORDER BY created_date ASC LIMIT 1000`,
      [cfg.fixture_type, parent.id],
    );
    for (const rawFixture of fixtureRows) {
      const fixture = parseLeagueEntityRow(rawFixture);
      const homeClubId = fixture.home_club_id || null;
      const awayClubId = fixture.away_club_id || null;
      const fixtureRow = {
        id: deterministicId(`competition_fixture:${cfg.fixture_type}:${fixture.id}`),
        competition_instance_id: instanceId,
        legacy_fixture_type: cfg.fixture_type,
        legacy_fixture_id: fixture.id,
        match_id: fixture.match_id || null,
        participant_type: 'club',
        format: fixture.format || (cfg.product_type === 'regional_league' ? 'league' : 'official_competition'),
        phase: fixture.phase || fixture.stage || 'main',
        round: fixture.round ?? null,
        matchday: fixture.matchday ?? null,
        group_number: fixture.group_number ?? fixture.group ?? null,
        tie_id: fixture.tie_id || null,
        leg: fixture.leg ?? null,
        bracket_side: fixture.bracket_side || null,
        home_participant_id: homeClubId ? (participantIdByClubId.get(homeClubId) || deterministicId(`competition_participant:${instanceId}:club:${homeClubId}`)) : null,
        away_participant_id: awayClubId ? (participantIdByClubId.get(awayClubId) || deterministicId(`competition_participant:${instanceId}:club:${awayClubId}`)) : null,
        home_club_id: homeClubId,
        home_club_name: fixture.home_club_name || fixture.home_name || null,
        home_owner_email: fixture.home_owner_email || null,
        away_club_id: awayClubId,
        away_club_name: fixture.away_club_name || fixture.away_name || null,
        away_owner_email: fixture.away_owner_email || null,
        status: statusToFixtureStatus(fixture.status),
        scheduling_status: fixture.scheduling_status || (fixture.confirmed_date || fixture.scheduled_date ? 'confirmed' : 'open'),
        window_start: fixture.window_start || null,
        window_end: fixture.window_end || null,
        scheduled_at: fixture.scheduled_date || fixture.confirmed_date || null,
        confirmed_at: fixture.confirmed_date || null,
        home_score: fixture.home_score ?? null,
        away_score: fixture.away_score ?? null,
        winner_participant_id: fixture.winner_club_id ? participantIdByClubId.get(fixture.winner_club_id) : null,
        stats_processed: fixture.stats_processed ? 1 : 0,
        idempotency_key: `backfill:${cfg.fixture_type}:${fixture.id}`,
      };
      if (await hasFixtureMatchConflict(fixtureRow)) {
        summary.conflicts += 1;
        continue;
      }
      await model.upsertFixture(fixtureRow);
      summary.fixtures += 1;
    }
  }

  return summary;
}

async function createMatchFromFixture(fixtureId) {
  const rows = await model.selectFixture(fixtureId);
  if (!rows.length) {
    const err = new Error('Fixture not found');
    err.status = 404;
    throw err;
  }
  const fixture = rows[0];
  if (fixture.match_id) {
    const existing = await EXECUTESQL('SELECT * FROM matches WHERE id = ?', [fixture.match_id]);
    if (existing.length) return existing[0];
  }

  const payload = mapFixtureToMatch(fixture);
  const match = new Match(payload);
  await match.create();
  await EXECUTESQL(
    `UPDATE competition_fixtures
     SET match_id = ?, status = ?, scheduling_status = ?, updated_date = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [payload.id, payload.status === 'scheduled' ? 'scheduled' : fixture.status, fixture.scheduling_status || 'confirmed', fixture.id],
  );
  return payload;
}

function submissionsAgree(home, away) {
  return Number(home.score_home) === Number(away.score_home) &&
    Number(home.score_away) === Number(away.score_away);
}

async function finalizeAgreedResult(fixture, home, away) {
  const homeScore = Number(home.score_home);
  const awayScore = Number(home.score_away);
  const winnerParticipantId = homeScore > awayScore
    ? fixture.home_participant_id
    : awayScore > homeScore
      ? fixture.away_participant_id
      : null;
  await EXECUTESQL(
    `UPDATE matches
     SET status = 'completed', home_score = ?, away_score = ?, stats_processed = 1
     WHERE id = ?`,
    [homeScore, awayScore, fixture.match_id],
  );
  await EXECUTESQL(
    `UPDATE competition_fixtures
     SET status = 'completed', home_score = ?, away_score = ?, winner_participant_id = ?, stats_processed = 1, updated_date = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [homeScore, awayScore, winnerParticipantId, fixture.id],
  );
  return { status: 'completed', home_score: homeScore, away_score: awayScore, winner_participant_id: winnerParticipantId };
}

async function submitResult({ matchId, side, submittedByUserId, scoreHome, scoreAway, payloadJson, proofUrl }) {
  assertSide(side);
  const fixtureRows = await model.selectFixtureByMatch(matchId);
  if (!fixtureRows.length) {
    const err = new Error('Competition fixture not found for match');
    err.status = 404;
    throw err;
  }
  const fixture = fixtureRows[0];
  await model.insertResultSubmission({
    id: uuidv4(),
    fixture_id: fixture.id,
    match_id: matchId,
    side,
    submitted_by_user_id: submittedByUserId,
    score_home: Number(scoreHome),
    score_away: Number(scoreAway),
    payload_json: payloadJson || null,
    proof_url: proofUrl || null,
    idempotency_key: `match_submission:${matchId}:${side}`,
  });
  const submissions = await model.listResultSubmissionsByMatch(matchId);
  const home = submissions.find((entry) => entry.side === 'home');
  const away = submissions.find((entry) => entry.side === 'away');
  if (!home || !away) return { status: 'pending_confirmation' };
  if (!submissionsAgree(home, away)) {
    await EXECUTESQL("UPDATE matches SET status = 'disputed' WHERE id = ?", [matchId]);
    await EXECUTESQL("UPDATE competition_fixtures SET status = 'disputed', updated_date = CURRENT_TIMESTAMP WHERE id = ?", [fixture.id]);
    return { status: 'disputed' };
  }
  return finalizeAgreedResult(fixture, home, away);
}

module.exports = {
  backfillCommunityTournaments,
  backfillLeagueEntities,
  createMatchFromFixture,
  deterministicId,
  submitResult,
  mapFixtureToMatch,
};

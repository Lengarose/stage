const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { EXECUTESQL } = require('../db/database');
const CompetitionEngineModel = require('../models/competitionEngineModel');
const Match = require('../models/matchModel');
const {
  broadcastInbox,
  broadcastNotification,
} = require('../utils/socketBroadcast');

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

async function enrichFixtureSnapshots(fixture) {
  const next = { ...fixture };
  const clubIds = [next.home_club_id, next.away_club_id].filter(Boolean);
  if (clubIds.length) {
    const rows = await EXECUTESQL(
      `SELECT id, name, owner_email FROM clubs WHERE id IN (${clubIds.map(() => '?').join(',')})`,
      clubIds,
    ).catch(() => []);
    const byId = new Map(rows.map(row => [String(row.id), row]));
    const homeClub = next.home_club_id ? byId.get(String(next.home_club_id)) : null;
    const awayClub = next.away_club_id ? byId.get(String(next.away_club_id)) : null;
    if (homeClub) {
      next.home_club_name = next.home_club_name || homeClub.name || null;
      next.home_owner_email = next.home_owner_email || homeClub.owner_email || null;
    }
    if (awayClub) {
      next.away_club_name = next.away_club_name || awayClub.name || null;
      next.away_owner_email = next.away_owner_email || awayClub.owner_email || null;
    }
  }

  const playerIds = [next.player_home_id, next.player_away_id].filter(Boolean);
  if (playerIds.length) {
    const rows = await EXECUTESQL(
      `SELECT id, gamertag, email FROM players WHERE id IN (${playerIds.map(() => '?').join(',')})`,
      playerIds,
    ).catch(() => []);
    const byId = new Map(rows.map(row => [String(row.id), row]));
    const homePlayer = next.player_home_id ? byId.get(String(next.player_home_id)) : null;
    const awayPlayer = next.player_away_id ? byId.get(String(next.player_away_id)) : null;
    if (homePlayer) {
      next.player_home_gamertag = next.player_home_gamertag || homePlayer.gamertag || null;
      next.player_home_email = next.player_home_email || homePlayer.email || null;
    }
    if (awayPlayer) {
      next.player_away_gamertag = next.player_away_gamertag || awayPlayer.gamertag || null;
      next.player_away_email = next.player_away_email || awayPlayer.email || null;
    }
  }
  return next;
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

function parseFormList(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return value.split(',').map(v => v.trim()).filter(Boolean);
    }
  }
  return [];
}

function sortStandingRows(rows) {
  return [...rows].sort((a, b) => {
    if (Number(b.points || 0) !== Number(a.points || 0)) return Number(b.points || 0) - Number(a.points || 0);
    if (Number(b.goal_difference || 0) !== Number(a.goal_difference || 0)) return Number(b.goal_difference || 0) - Number(a.goal_difference || 0);
    if (Number(b.goals_for || 0) !== Number(a.goals_for || 0)) return Number(b.goals_for || 0) - Number(a.goals_for || 0);
    return String(a.club_name || '').localeCompare(String(b.club_name || ''));
  });
}

async function updateLeagueEntityData(entityType, id, next, indexed = {}) {
  const sets = ['data_json = ?', 'updated_date = NOW()'];
  const values = [JSON.stringify(next)];
  for (const [column, value] of Object.entries(indexed)) {
    sets.push(`${column} = ?`);
    values.push(value ?? null);
  }
  values.push(id, entityType);
  await EXECUTESQL(
    `UPDATE league_entities SET ${sets.join(', ')} WHERE id = ? AND entity_type = ?`,
    values,
  );
}

function buildStandingUpdate(row, goalsFor, goalsAgainst, resultCode) {
  const wins = Number(row.wins || 0) + (resultCode === 'W' ? 1 : 0);
  const draws = Number(row.draws || 0) + (resultCode === 'D' ? 1 : 0);
  const losses = Number(row.losses || 0) + (resultCode === 'L' ? 1 : 0);
  const nextGoalsFor = Number(row.goals_for || 0) + goalsFor;
  const nextGoalsAgainst = Number(row.goals_against || 0) + goalsAgainst;
  return {
    played: Number(row.played || 0) + 1,
    wins,
    draws,
    losses,
    goals_for: nextGoalsFor,
    goals_against: nextGoalsAgainst,
    goal_difference: nextGoalsFor - nextGoalsAgainst,
    points: Number(row.points || 0) + (resultCode === 'W' ? 3 : resultCode === 'D' ? 1 : 0),
    form: [resultCode, ...parseFormList(row.form)].slice(0, 5),
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
  const fixture = await enrichFixtureSnapshots(rows[0]);
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
  await syncMatchResultToSource(fixture.match_id);
  return { status: 'completed', home_score: homeScore, away_score: awayScore, winner_participant_id: winnerParticipantId };
}

async function syncCompetitionFixtureResult(match, sourceFixtureId) {
  const rows = await EXECUTESQL(
    `SELECT * FROM league_entities
      WHERE id = ? AND entity_type = 'competition_fixture'
      LIMIT 1`,
    [sourceFixtureId],
  );
  if (!rows.length) return { synced: false, reason: 'competition_fixture_not_found' };
  const fixture = parseLeagueEntityRow(rows[0]);
  if (fixture.stats_processed === true || Number(fixture.stats_processed || 0) === 1 || String(fixture.stats_processed || '').toLowerCase() === 'true') {
    return { synced: false, reason: 'already_processed' };
  }

  const homeScore = Number(match.home_score || 0);
  const awayScore = Number(match.away_score || 0);
  const winnerClubId = homeScore > awayScore ? fixture.home_club_id : awayScore > homeScore ? fixture.away_club_id : null;
  const winnerClubName = String(winnerClubId || '') === String(fixture.home_club_id || '') ? fixture.home_club_name
    : String(winnerClubId || '') === String(fixture.away_club_id || '') ? fixture.away_club_name
      : null;
  const nextFixture = {
    ...fixture,
    home_score: homeScore,
    away_score: awayScore,
    winner_club_id: winnerClubId,
    winner_club_name: winnerClubName,
    status: 'completed',
    stats_processed: true,
  };
  await updateLeagueEntityData('competition_fixture', sourceFixtureId, nextFixture, { status: 'completed' });

  if (String(fixture.phase || 'league') === 'league') {
    const standingRows = await EXECUTESQL(
      `SELECT * FROM league_entities
        WHERE entity_type = 'competition_standing'
          AND season_id = ?
          AND club_id IN (?, ?)`,
      [fixture.season_id, fixture.home_club_id, fixture.away_club_id],
    );
    const parsed = standingRows.map(parseLeagueEntityRow);
    const homeRow = parsed.find(row => String(row.club_id) === String(fixture.home_club_id));
    const awayRow = parsed.find(row => String(row.club_id) === String(fixture.away_club_id));
    if (homeRow && awayRow) {
      const isDraw = homeScore === awayScore;
      const homeWin = homeScore > awayScore;
      const homeUpdate = buildStandingUpdate(homeRow, homeScore, awayScore, homeWin ? 'W' : isDraw ? 'D' : 'L');
      const awayUpdate = buildStandingUpdate(awayRow, awayScore, homeScore, !homeWin && !isDraw ? 'W' : isDraw ? 'D' : 'L');
      const nextHomeStanding = { ...homeRow, ...homeUpdate };
      const nextAwayStanding = { ...awayRow, ...awayUpdate };
      await updateLeagueEntityData('competition_standing', homeRow.id, nextHomeStanding);
      await updateLeagueEntityData('competition_standing', awayRow.id, nextAwayStanding);

      const allRows = await EXECUTESQL(
        `SELECT * FROM league_entities
          WHERE entity_type = 'competition_standing' AND season_id = ?`,
        [fixture.season_id],
      );
      const sorted = sortStandingRows(allRows.map(row => {
        if (row.id === homeRow.id) return nextHomeStanding;
        if (row.id === awayRow.id) return nextAwayStanding;
        return parseLeagueEntityRow(row);
      }));
      for (let index = 0; index < sorted.length; index += 1) {
        await updateLeagueEntityData('competition_standing', sorted[index].id, { ...sorted[index], position: index + 1 });
      }
    }
  }

  return { synced: true, source_fixture_type: 'competition_fixture', fixture: nextFixture };
}

async function syncRegionalLeagueFixtureResult(match, sourceFixtureId) {
  const rows = await EXECUTESQL(
    `SELECT * FROM league_entities
      WHERE id = ? AND entity_type = 'regional_league_fixture'
      LIMIT 1`,
    [sourceFixtureId],
  );
  if (!rows.length) return { synced: false, reason: 'regional_league_fixture_not_found' };
  const fixture = parseLeagueEntityRow(rows[0]);
  if (fixture.stats_processed === true || Number(fixture.stats_processed || 0) === 1 || String(fixture.stats_processed || '').toLowerCase() === 'true') {
    return { synced: false, reason: 'already_processed' };
  }

  const homeScore = Number(match.home_score || 0);
  const awayScore = Number(match.away_score || 0);
  const winnerClubId = homeScore > awayScore ? fixture.home_club_id : awayScore > homeScore ? fixture.away_club_id : null;
  const winnerClubName = String(winnerClubId || '') === String(fixture.home_club_id || '') ? fixture.home_club_name
    : String(winnerClubId || '') === String(fixture.away_club_id || '') ? fixture.away_club_name
      : null;
  const nextFixture = {
    ...fixture,
    home_score: homeScore,
    away_score: awayScore,
    winner_club_id: winnerClubId,
    winner_club_name: winnerClubName,
    status: 'played',
    stats_processed: true,
  };
  await updateLeagueEntityData('regional_league_fixture', sourceFixtureId, nextFixture, { status: 'played' });

  const standingRows = await EXECUTESQL(
    `SELECT * FROM league_entities
      WHERE entity_type = 'regional_league_standing'
        AND league_id = ?
        AND club_id IN (?, ?)`,
    [fixture.league_id, fixture.home_club_id, fixture.away_club_id],
  );
  const parsed = standingRows.map(parseLeagueEntityRow);
  const homeRow = parsed.find(row => String(row.club_id) === String(fixture.home_club_id));
  const awayRow = parsed.find(row => String(row.club_id) === String(fixture.away_club_id));
  if (homeRow && awayRow) {
    const isDraw = homeScore === awayScore;
    const homeWin = homeScore > awayScore;
    const homeUpdate = buildStandingUpdate(homeRow, homeScore, awayScore, homeWin ? 'W' : isDraw ? 'D' : 'L');
    const awayUpdate = buildStandingUpdate(awayRow, awayScore, homeScore, !homeWin && !isDraw ? 'W' : isDraw ? 'D' : 'L');
    const nextHomeStanding = { ...homeRow, ...homeUpdate };
    const nextAwayStanding = { ...awayRow, ...awayUpdate };
    await updateLeagueEntityData('regional_league_standing', homeRow.id, nextHomeStanding);
    await updateLeagueEntityData('regional_league_standing', awayRow.id, nextAwayStanding);

    const allRows = await EXECUTESQL(
      `SELECT * FROM league_entities
        WHERE entity_type = 'regional_league_standing' AND league_id = ?`,
      [fixture.league_id],
    );
    const sorted = sortStandingRows(allRows.map(row => {
      if (row.id === homeRow.id) return nextHomeStanding;
      if (row.id === awayRow.id) return nextAwayStanding;
      return parseLeagueEntityRow(row);
    }));
    for (let index = 0; index < sorted.length; index += 1) {
      await updateLeagueEntityData('regional_league_standing', sorted[index].id, { ...sorted[index], position: index + 1 });
    }
  }

  return { synced: true, source_fixture_type: 'regional_league_fixture', fixture: nextFixture };
}

async function markEngineFixtureCompleted(match) {
  const fixtureRows = await model.selectFixtureByMatch(match.id);
  if (!fixtureRows.length) return null;
  const fixture = fixtureRows[0];
  const homeScore = Number(match.home_score || 0);
  const awayScore = Number(match.away_score || 0);
  const winnerParticipantId = homeScore > awayScore
    ? fixture.home_participant_id
    : awayScore > homeScore
      ? fixture.away_participant_id
      : null;
  await EXECUTESQL(
    `UPDATE competition_fixtures
      SET status = 'completed',
          home_score = ?,
          away_score = ?,
          winner_participant_id = ?,
          stats_processed = 1,
          updated_date = CURRENT_TIMESTAMP
      WHERE id = ?`,
    [homeScore, awayScore, winnerParticipantId, fixture.id],
  );
  return { ...fixture, status: 'completed', home_score: homeScore, away_score: awayScore, winner_participant_id: winnerParticipantId };
}

async function resolveReadyRecipients(instance) {
  const recipients = new Set();
  const admins = await EXECUTESQL(
    'SELECT email FROM users WHERE role_id IN (0, 2) AND email IS NOT NULL LIMIT 50',
  ).catch(() => []);
  admins.forEach(user => {
    if (user.email) recipients.add(user.email);
  });

  if (instance?.created_by_user_id) {
    const creatorRows = await EXECUTESQL(
      'SELECT email FROM users WHERE id = ? AND email IS NOT NULL LIMIT 1',
      [instance.created_by_user_id],
    ).catch(() => []);
    if (creatorRows[0]?.email) recipients.add(creatorRows[0].email);
  }

  if (instance?.legacy_source_type === 'tournament' && instance.legacy_source_id) {
    const rows = await EXECUTESQL(
      'SELECT organizer_email, creator_email FROM tournaments WHERE id = ? LIMIT 1',
      [instance.legacy_source_id],
    ).catch(() => []);
    if (rows[0]?.organizer_email) recipients.add(rows[0].organizer_email);
    if (rows[0]?.creator_email) recipients.add(rows[0].creator_email);
  }

  if (instance?.legacy_source_type && instance?.legacy_source_id && instance.legacy_source_type !== 'tournament') {
    const rows = await EXECUTESQL(
      'SELECT data_json FROM league_entities WHERE id = ? AND entity_type = ? LIMIT 1',
      [instance.legacy_source_id, instance.legacy_source_type],
    ).catch(() => []);
    const data = parseJson(rows[0]?.data_json, {});
    for (const key of ['organizer_email', 'creator_email', 'admin_email']) {
      if (data?.[key]) recipients.add(data[key]);
    }
  }

  return [...recipients].filter(Boolean);
}

async function markPhaseReadyAndNotify({ competitionInstanceId, format, phase, round }) {
  const stateId = deterministicId(`competition_phase_state:${competitionInstanceId}:${phase}:${round}`);
  const existingRows = await EXECUTESQL('SELECT * FROM competition_phase_states WHERE id = ? LIMIT 1', [stateId]);
  if (existingRows[0]?.ready_to_advance) return { notified: false, reason: 'already_ready' };

  await EXECUTESQL(
    `INSERT INTO competition_phase_states
      (id, competition_instance_id, format, phase, round, status, ready_to_advance, idempotency_key)
     VALUES (?, ?, ?, ?, ?, 'ready', 1, ?)
     ON DUPLICATE KEY UPDATE
       status = 'ready',
       ready_to_advance = 1,
       updated_date = CURRENT_TIMESTAMP`,
    [
      stateId,
      competitionInstanceId,
      format || null,
      phase,
      round,
      `phase_ready:${competitionInstanceId}:${phase}:${round}`,
    ],
  );

  const instanceRows = await model.selectInstance(competitionInstanceId);
  const instance = instanceRows[0] || null;
  const recipients = await resolveReadyRecipients(instance);
  const title = `${instance?.name || 'Competition'} is ready to advance`;
  const body = `All fixtures for ${phase} round ${round} are completed.`;
  const link = '/admin/leagues';
  for (const email of recipients) {
    const notification = {
      id: deterministicId(`notification:phase_ready:${stateId}:${email}`),
      recipient_email: email,
      type: 'phase_ready',
      title,
      body,
      read: 0,
      link,
    };
    const inbox = {
      id: deterministicId(`inbox:phase_ready:${stateId}:${email}`),
      recipient_email: email,
      sender_email: 'system@stageleagues.com',
      subject: title,
      body,
      message_type: 'phase_ready',
      status: 'unread',
      is_read: 0,
      related_entity_id: stateId,
      related_entity_type: 'competition_phase_state',
    };
    await EXECUTESQL(
      `INSERT IGNORE INTO notifications
        (id, recipient_email, type, title, body, \`read\`, link, created_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [notification.id, notification.recipient_email, notification.type, notification.title, notification.body, notification.read, notification.link],
    );
    await EXECUTESQL(
      `INSERT IGNORE INTO inbox_messages
        (id, recipient_email, sender_email, subject, body, message_type, status, is_read, related_entity_id, related_entity_type, created_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        inbox.id,
        inbox.recipient_email,
        inbox.sender_email,
        inbox.subject,
        inbox.body,
        inbox.message_type,
        inbox.status,
        inbox.is_read,
        inbox.related_entity_id,
        inbox.related_entity_type,
      ],
    );
    if (typeof broadcastNotification === 'function') broadcastNotification(notification);
    if (typeof broadcastInbox === 'function') broadcastInbox(inbox);
  }

  return { notified: true, recipients: recipients.length, phase_state_id: stateId };
}

async function notifyPhaseReady(fixture) {
  if (!fixture?.competition_instance_id) return { notified: false, reason: 'fixture_missing_instance' };
  const phase = fixture.phase || 'main';
  const round = Number(fixture.round || fixture.matchday || 1);
  const rows = await EXECUTESQL(
    `SELECT * FROM competition_fixtures
      WHERE competition_instance_id = ?
        AND COALESCE(phase, 'main') = ?
        AND COALESCE(round, matchday, 1) = ?`,
    [fixture.competition_instance_id, phase, round],
  );
  if (!rows.length) return { notified: false, reason: 'no_phase_fixtures' };
  const finished = new Set(['completed', 'forfeit']);
  if (rows.some(row => !finished.has(String(row.status || '').toLowerCase()))) {
    return { notified: false, reason: 'phase_not_complete' };
  }

  return markPhaseReadyAndNotify({
    competitionInstanceId: fixture.competition_instance_id,
    format: fixture.format || null,
    phase,
    round,
  });
}

async function notifyLegacyPhaseReady({ fixture, sourceType }) {
  if (!fixture) return { notified: false, reason: 'fixture_missing' };
  const isRegional = sourceType === 'regional_league' || sourceType === 'regional_league_fixture';
  const productType = isRegional ? 'regional_league' : 'official_competition';
  const legacySourceType = isRegional ? 'regional_league' : 'competition_season';
  const legacySourceId = isRegional ? fixture.league_id : fixture.season_id;
  if (!legacySourceId) return { notified: false, reason: 'legacy_parent_missing' };

  const instanceRows = await model.selectInstanceBySource(productType, legacySourceType, legacySourceId);
  const instance = instanceRows[0];
  if (!instance?.id) return { notified: false, reason: 'engine_instance_missing' };

  const phase = fixture.phase || fixture.stage || 'league';
  const round = Number(fixture.round || fixture.matchday || 1);
  const parentKey = isRegional ? 'league_id' : 'season_id';
  const fixtureType = isRegional ? 'regional_league_fixture' : 'competition_fixture';
  const fixtureRows = await EXECUTESQL(
    `SELECT * FROM league_entities WHERE entity_type = ? AND \`${parentKey}\` = ? LIMIT 1000`,
    [fixtureType, legacySourceId],
  );
  const matching = fixtureRows
    .map(parseLeagueEntityRow)
    .filter(row => String(row.phase || row.stage || 'league') === String(phase))
    .filter(row => Number(row.round || row.matchday || 1) === round);
  if (!matching.length) return { notified: false, reason: 'no_legacy_phase_fixtures' };
  const finished = new Set(isRegional ? ['played', 'completed', 'forfeit'] : ['completed', 'forfeit']);
  if (matching.some(row => !finished.has(String(row.status || '').toLowerCase()))) {
    return { notified: false, reason: 'legacy_phase_not_complete' };
  }

  return markPhaseReadyAndNotify({
    competitionInstanceId: instance.id,
    format: fixture.format || (isRegional ? 'regional_league' : 'official_competition'),
    phase,
    round,
  });
}

async function syncMatchResultToSource(matchOrId) {
  const match = typeof matchOrId === 'string'
    ? (await EXECUTESQL('SELECT * FROM matches WHERE id = ? LIMIT 1', [matchOrId]))[0]
    : matchOrId;
  if (!match?.id || match.status !== 'completed') return { synced: false, reason: 'match_not_completed' };

  const engineFixture = await markEngineFixtureCompleted(match);
  let sourceType = match.source_fixture_type || null;
  let sourceId = match.source_fixture_id || null;
  if (sourceType === 'competition_engine' && engineFixture) {
    sourceType = engineFixture.legacy_fixture_type;
    sourceId = engineFixture.legacy_fixture_id;
  }

  let legacyResult = { synced: false, reason: 'no_supported_source' };
  if (sourceId && (sourceType === 'competition' || sourceType === 'competition_fixture')) {
    legacyResult = await syncCompetitionFixtureResult(match, sourceId);
  } else if (sourceId && (sourceType === 'regional_league' || sourceType === 'regional_league_fixture')) {
    legacyResult = await syncRegionalLeagueFixtureResult(match, sourceId);
  }

  const ready = engineFixture
    ? await notifyPhaseReady(engineFixture)
    : legacyResult.fixture
      ? await notifyLegacyPhaseReady({ fixture: legacyResult.fixture, sourceType })
      : { notified: false, reason: 'no_engine_or_legacy_fixture' };
  return { synced: Boolean(engineFixture || legacyResult.synced), legacy: legacyResult, ready };
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
  syncMatchResultToSource,
  notifyPhaseReady,
};

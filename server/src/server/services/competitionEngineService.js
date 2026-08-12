const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { EXECUTESQL } = require('../db/database');
const CompetitionEngineModel = require('../models/competitionEngineModel');
const Match = require('../models/matchModel');
const {
  broadcastMatch,
  broadcastInbox,
  broadcastNotification,
  broadcastTournament,
} = require('../utils/socketBroadcast');
const {
  awardClubTrophyToClubAndPlayers,
  awardPlayerOnlyTrophy,
} = require('./trophyAwardService');

const model = new CompetitionEngineModel();

const STAGE_QUALIFICATION_RULES = [
  { positions: [1, 2], competitionSlug: 'supreme' },
  { positions: [3, 4], competitionSlug: 'elite' },
  { positions: [5, 6], competitionSlug: 'challenger' },
];

const CROSS_COMPETITION_QUALIFICATION_RULES = [
  { fromSlug: 'elite', toSlug: 'supreme', positions: [1] },
  { fromSlug: 'challenger', toSlug: 'elite', positions: [1] },
];

const RELEGATION_SPOTS = 2;
const PROMOTION_SPOTS = 2;

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
    // `matches.tournament_id` must reference `tournaments.id` when non-null.
    // Competition-engine fixtures are stored outside `tournaments`.
    tournament_id: null,
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

function isFinishedStatus(status, { regional = false } = {}) {
  const finished = regional
    ? new Set(['played', 'completed', 'forfeit'])
    : new Set(['completed', 'forfeit']);
  return finished.has(String(status || '').toLowerCase());
}

function clubFromStanding(row) {
  return {
    club_id: row.club_id,
    club_name: row.club_name,
    club_logo_url: row.club_logo_url || '',
    club_tag: row.club_tag || '',
  };
}

function fixtureClubFields(prefix, club) {
  return {
    [`${prefix}_club_id`]: club.club_id,
    [`${prefix}_club_name`]: club.club_name,
    [`${prefix}_club_logo_url`]: club.club_logo_url || '',
    [`${prefix}_club_tag`]: club.club_tag || '',
  };
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

async function insertLeagueEntity(entityType, row, indexed = {}) {
  const id = row.id || uuidv4();
  const data = { ...row, id };
  await EXECUTESQL(
    `INSERT INTO league_entities
      (id, entity_type, data_json, status, scheduling_status, slug, league_id, season_id,
       competition_id, club_id, is_active, tier, division, region, platform, season_number,
       created_date, updated_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
     ON DUPLICATE KEY UPDATE updated_date = updated_date`,
    [
      id,
      entityType,
      JSON.stringify(data),
      indexed.status ?? data.status ?? null,
      indexed.scheduling_status ?? data.scheduling_status ?? null,
      indexed.slug ?? data.slug ?? null,
      indexed.league_id ?? data.league_id ?? null,
      indexed.season_id ?? data.season_id ?? null,
      indexed.competition_id ?? data.competition_id ?? null,
      indexed.club_id ?? data.club_id ?? null,
      indexed.is_active ?? data.is_active ?? null,
      indexed.tier ?? data.tier ?? null,
      indexed.division ?? data.division ?? null,
      indexed.region ?? data.region ?? null,
      indexed.platform ?? data.platform ?? null,
      indexed.season_number ?? data.season_number ?? null,
    ],
  );
  return data;
}

async function selectLeagueEntityById(entityType, id) {
  const rows = await EXECUTESQL(
    'SELECT * FROM league_entities WHERE id = ? AND entity_type = ? LIMIT 1',
    [id, entityType],
  ).catch(() => []);
  return rows.length ? parseLeagueEntityRow(rows[0]) : null;
}

async function selectCompetitionBySlug(slug) {
  const rows = await EXECUTESQL(
    `SELECT * FROM league_entities
      WHERE entity_type = 'competition'
        AND slug = ?
      LIMIT 1`,
    [slug],
  ).catch(async () => EXECUTESQL(
    `SELECT * FROM league_entities
      WHERE entity_type = 'competition'
        AND JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.slug')) = ?
      LIMIT 1`,
    [slug],
  ).catch(() => []));
  return rows.length ? parseLeagueEntityRow(rows[0]) : null;
}

async function qualificationEntryExists({ clubId, targetCompetitionId, sourceType }) {
  if (!clubId || !targetCompetitionId) return true;
  const rows = await EXECUTESQL(
    `SELECT * FROM league_entities
      WHERE entity_type = 'qualification_entry'
        AND club_id = ?
        AND status IN ('pending', 'confirmed')
        AND JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.target_competition_id')) = ?
        AND JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.source_type')) = ?
      LIMIT 1`,
    [clubId, targetCompetitionId, sourceType],
  ).catch(() => []);
  return rows.length > 0;
}

async function createQualificationEntry(row) {
  return insertLeagueEntity('qualification_entry', row, {
    status: row.status,
    club_id: row.club_id,
    competition_id: row.target_competition_id,
    tier: row.target_competition_tier,
    region: row.club_region,
    platform: row.club_platform,
  });
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
  const progression = await advanceAfterFinalResult({
    id: fixture.match_id,
    status: 'completed',
    home_score: homeScore,
    away_score: awayScore,
    source_fixture_type: 'competition_engine',
    source_fixture_id: fixture.id,
    tournament_id: null,
  });
  return { status: 'completed', home_score: homeScore, away_score: awayScore, winner_participant_id: winnerParticipantId, progression };
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

async function listLegacyCompetitionFixtures(seasonId) {
  const rows = await EXECUTESQL(
    'SELECT * FROM league_entities WHERE entity_type = ? AND `season_id` = ? LIMIT 1000',
    ['competition_fixture', seasonId],
  );
  return rows.map(parseLeagueEntityRow);
}

async function listLegacyCompetitionStandings(seasonId) {
  const rows = await EXECUTESQL(
    "SELECT * FROM league_entities WHERE entity_type = 'competition_standing' AND season_id = ?",
    [seasonId],
  );
  return sortStandingRows(rows.map(parseLeagueEntityRow));
}

async function listLegacyRegionalLeagueFixtures(leagueId) {
  const rows = await EXECUTESQL(
    `SELECT * FROM league_entities
      WHERE entity_type = 'regional_league_fixture'
        AND league_id = ?
      LIMIT 1000`,
    [leagueId],
  );
  return rows.map(parseLeagueEntityRow);
}

async function listLegacyRegionalLeagueStandings(leagueId) {
  const rows = await EXECUTESQL(
    "SELECT * FROM league_entities WHERE entity_type = 'regional_league_standing' AND league_id = ?",
    [leagueId],
  );
  return sortStandingRows(rows.map(parseLeagueEntityRow));
}

async function selectLinkedRegionalLeague(league) {
  if (!league?.linked_league_slug) return null;
  const rows = await EXECUTESQL(
    `SELECT * FROM league_entities
      WHERE entity_type = 'regional_league'
        AND slug = ?
      LIMIT 1`,
    [league.linked_league_slug],
  ).catch(async () => EXECUTESQL(
    `SELECT * FROM league_entities
      WHERE entity_type = 'regional_league'
        AND JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.slug')) = ?
      LIMIT 1`,
    [league.linked_league_slug],
  ).catch(() => []));
  return rows.length ? parseLeagueEntityRow(rows[0]) : null;
}

async function legacyCompetitionPhaseExists(seasonId, phase) {
  const rows = await EXECUTESQL(
    `SELECT * FROM league_entities
      WHERE entity_type = 'competition_fixture'
        AND season_id = ?
        AND phase = ?
      LIMIT 1`,
    [seasonId, phase],
  ).catch(async () => EXECUTESQL(
    `SELECT * FROM league_entities
      WHERE entity_type = 'competition_fixture'
        AND season_id = ?
        AND JSON_UNQUOTE(JSON_EXTRACT(data_json, '$.phase')) = ?
      LIMIT 1`,
    [seasonId, phase],
  ));
  return rows.length > 0;
}

async function setLegacyCompetitionSeasonStatus(seasonId, status) {
  const rows = await EXECUTESQL(
    "SELECT * FROM league_entities WHERE id = ? AND entity_type = 'competition_season' LIMIT 1",
    [seasonId],
  ).catch(() => []);
  if (!rows.length) return;
  const season = parseLeagueEntityRow(rows[0]);
  await updateLeagueEntityData('competition_season', seasonId, { ...season, status }, { status });
}

function legacyCompetitionFixtureBase(season, sourceFixture, phase) {
  const now = new Date();
  return {
    season_id: sourceFixture.season_id,
    competition_id: sourceFixture.competition_id,
    competition_name: sourceFixture.competition_name,
    competition_tier: sourceFixture.competition_tier,
    competition_slug: sourceFixture.competition_slug,
    season_number: sourceFixture.season_number,
    platform: sourceFixture.platform,
    region: sourceFixture.region,
    status: 'scheduled',
    stats_processed: false,
    home_score: 0,
    away_score: 0,
    scheduling_status: 'open',
    window_start: now.toISOString(),
    window_end: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    window_days: 5,
    proposal_count: 0,
    phase,
    format: sourceFixture.format || season?.format || 'official_competition',
  };
}

async function createLegacyCompetitionFixture(row) {
  return insertLeagueEntity('competition_fixture', row, {
    status: row.status,
    scheduling_status: row.scheduling_status,
    season_id: row.season_id,
    competition_id: row.competition_id,
    tier: row.competition_tier,
    region: row.region,
    platform: row.platform,
    season_number: row.season_number,
  });
}

async function generateLegacyOfficialPlayoffRound(sourceFixture, standings) {
  const phase = 'playoff_round';
  if (await legacyCompetitionPhaseExists(sourceFixture.season_id, phase)) {
    return { advanced: false, reason: 'next_phase_exists', next_phase: phase };
  }
  const sorted = sortStandingRows(standings);
  const participants = sorted.slice(8, 24);
  if (participants.length < 16) {
    return { advanced: false, reason: 'not_enough_playoff_participants', next_phase: phase };
  }
  const base = legacyCompetitionFixtureBase(null, sourceFixture, phase);
  let created = 0;
  for (let index = 0; index < 8; index += 1) {
    const higher = clubFromStanding(participants[index]);
    const lower = clubFromStanding(participants[15 - index]);
    const tieId = `playoff-${sourceFixture.season_id}-${index + 1}`;
    await createLegacyCompetitionFixture({
      ...base,
      ...fixtureClubFields('home', lower),
      ...fixtureClubFields('away', higher),
      id: deterministicId(`legacy_competition_fixture:${sourceFixture.season_id}:${phase}:${index + 1}:1`),
      tie_id: tieId,
      leg: 1,
      bracket_position: index + 1,
      round: 1,
    });
    await createLegacyCompetitionFixture({
      ...base,
      ...fixtureClubFields('home', higher),
      ...fixtureClubFields('away', lower),
      id: deterministicId(`legacy_competition_fixture:${sourceFixture.season_id}:${phase}:${index + 1}:2`),
      tie_id: tieId,
      leg: 2,
      bracket_position: index + 1,
      round: 2,
    });
    created += 2;
  }
  await setLegacyCompetitionSeasonStatus(sourceFixture.season_id, phase);
  return { advanced: true, next_phase: phase, fixtures_created: created };
}

function aggregateClubWinner(legs) {
  const sorted = [...legs].sort((a, b) => Number(a.leg || 1) - Number(b.leg || 1));
  const [leg1, leg2] = sorted;
  if (!leg1) return null;
  if (!leg2) {
    const home = Number(leg1.home_score || 0);
    const away = Number(leg1.away_score || 0);
    if (leg1.winner_club_id) {
      return String(leg1.winner_club_id) === String(leg1.home_club_id) ? {
        club_id: leg1.home_club_id, club_name: leg1.home_club_name, club_logo_url: leg1.home_club_logo_url || '', club_tag: leg1.home_club_tag || '',
      } : {
        club_id: leg1.away_club_id, club_name: leg1.away_club_name, club_logo_url: leg1.away_club_logo_url || '', club_tag: leg1.away_club_tag || '',
      };
    }
    if (home === away) return null;
    return home > away ? {
      club_id: leg1.home_club_id, club_name: leg1.home_club_name, club_logo_url: leg1.home_club_logo_url || '', club_tag: leg1.home_club_tag || '',
    } : {
      club_id: leg1.away_club_id, club_name: leg1.away_club_name, club_logo_url: leg1.away_club_logo_url || '', club_tag: leg1.away_club_tag || '',
    };
  }
  if (leg2.winner_club_id) {
    return String(leg2.winner_club_id) === String(leg2.home_club_id) ? {
      club_id: leg2.home_club_id, club_name: leg2.home_club_name, club_logo_url: leg2.home_club_logo_url || '', club_tag: leg2.home_club_tag || '',
    } : {
      club_id: leg2.away_club_id, club_name: leg2.away_club_name, club_logo_url: leg2.away_club_logo_url || '', club_tag: leg2.away_club_tag || '',
    };
  }
  const lowerGoals = Number(leg1.home_score || 0) + Number(leg2.away_score || 0);
  const higherGoals = Number(leg1.away_score || 0) + Number(leg2.home_score || 0);
  if (lowerGoals === higherGoals) return null;
  return lowerGoals > higherGoals ? {
    club_id: leg1.home_club_id, club_name: leg1.home_club_name, club_logo_url: leg1.home_club_logo_url || '', club_tag: leg1.home_club_tag || '',
  } : {
    club_id: leg1.away_club_id, club_name: leg1.away_club_name, club_logo_url: leg1.away_club_logo_url || '', club_tag: leg1.away_club_tag || '',
  };
}

function groupByBracketPosition(fixtures) {
  const groups = new Map();
  for (const fixture of fixtures) {
    const key = Number(fixture.bracket_position || fixture.group_number || 1);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(fixture);
  }
  return [...groups.entries()].sort(([a], [b]) => a - b).map(([, rows]) => rows);
}

function previouslyPlayedPairSet(fixtures) {
  const pairs = new Set();
  for (const fixture of fixtures) {
    if (!fixture.home_club_id || !fixture.away_club_id) continue;
    pairs.add([String(fixture.home_club_id), String(fixture.away_club_id)].sort().join(':'));
  }
  return pairs;
}

function makeSeededPairs(seeded, unseeded, previousPairs) {
  const remaining = [...unseeded];
  return seeded.map((seed, index) => {
    let chosenIndex = remaining.findIndex(candidate =>
      !previousPairs.has([String(seed.club_id), String(candidate.club_id)].sort().join(':'))
    );
    if (chosenIndex === -1) chosenIndex = Math.max(0, remaining.length - 1 - index);
    const opponent = remaining.splice(Math.max(0, chosenIndex), 1)[0];
    return { seeded: seed, unseeded: opponent };
  }).filter(pair => pair.seeded && pair.unseeded);
}

async function generateLegacyOfficialR16(sourceFixture, standings, fixtures) {
  const phase = 'knockout_r16';
  if (await legacyCompetitionPhaseExists(sourceFixture.season_id, phase)) {
    return { advanced: false, reason: 'next_phase_exists', next_phase: phase };
  }
  const playoffFixtures = fixtures.filter(row => row.phase === 'playoff_round');
  const winners = [];
  for (const legs of groupByBracketPosition(playoffFixtures)) {
    const winner = aggregateClubWinner(legs);
    if (!winner) return { advanced: false, reason: 'tie_winner_missing', next_phase: phase };
    winners.push(winner);
  }
  if (winners.length < 8) return { advanced: false, reason: 'not_enough_playoff_winners', next_phase: phase };
  const direct = sortStandingRows(standings).slice(0, 8).map(clubFromStanding);
  const previousPairs = previouslyPlayedPairSet(fixtures);
  const pairs = makeSeededPairs(direct, winners.slice().reverse(), previousPairs);
  const base = legacyCompetitionFixtureBase(null, sourceFixture, phase);
  let created = 0;
  for (let index = 0; index < pairs.length; index += 1) {
    const { seeded, unseeded } = pairs[index];
    const tieId = `r16-${sourceFixture.season_id}-${index + 1}`;
    await createLegacyCompetitionFixture({
      ...base,
      ...fixtureClubFields('home', unseeded),
      ...fixtureClubFields('away', seeded),
      id: deterministicId(`legacy_competition_fixture:${sourceFixture.season_id}:${phase}:${index + 1}:1`),
      tie_id: tieId,
      leg: 1,
      bracket_position: index + 1,
      round: 1,
    });
    await createLegacyCompetitionFixture({
      ...base,
      ...fixtureClubFields('home', seeded),
      ...fixtureClubFields('away', unseeded),
      id: deterministicId(`legacy_competition_fixture:${sourceFixture.season_id}:${phase}:${index + 1}:2`),
      tie_id: tieId,
      leg: 2,
      bracket_position: index + 1,
      round: 2,
    });
    created += 2;
  }
  await setLegacyCompetitionSeasonStatus(sourceFixture.season_id, phase);
  return { advanced: true, next_phase: phase, fixtures_created: created };
}

async function generateLegacyOfficialNextKnockout(sourceFixture, fixtures, currentPhase, nextPhase) {
  if (await legacyCompetitionPhaseExists(sourceFixture.season_id, nextPhase)) {
    return { advanced: false, reason: 'next_phase_exists', next_phase: nextPhase };
  }
  const currentFixtures = fixtures.filter(row => row.phase === currentPhase);
  const winners = [];
  for (const legs of groupByBracketPosition(currentFixtures)) {
    const winner = aggregateClubWinner(legs);
    if (!winner) return { advanced: false, reason: 'tie_winner_missing', next_phase: nextPhase };
    winners.push(winner);
  }
  if (winners.length < 2) return { advanced: false, reason: 'not_enough_winners', next_phase: nextPhase };
  const base = legacyCompetitionFixtureBase(null, sourceFixture, nextPhase);
  const previousPairs = previouslyPlayedPairSet(fixtures);
  let created = 0;
  if (nextPhase === 'knockout_final') {
    const pairs = makeSeededPairs([winners[0]], [winners[1]], previousPairs);
    const { seeded, unseeded } = pairs[0] || {};
    if (!seeded || !unseeded) return { advanced: false, reason: 'not_enough_winners', next_phase: nextPhase };
    await createLegacyCompetitionFixture({
      ...base,
      ...fixtureClubFields('home', seeded),
      ...fixtureClubFields('away', unseeded),
      id: deterministicId(`legacy_competition_fixture:${sourceFixture.season_id}:${nextPhase}:1`),
      bracket_position: 1,
      round: 1,
    });
    created = 1;
  } else {
    const half = Math.floor(winners.length / 2);
    const pairs = makeSeededPairs(winners.slice(0, half), winners.slice(half).reverse(), previousPairs);
    for (let index = 0; index < pairs.length; index += 1) {
      const { seeded, unseeded } = pairs[index];
      const tieId = `${nextPhase}-${sourceFixture.season_id}-${index + 1}`;
      await createLegacyCompetitionFixture({
        ...base,
        ...fixtureClubFields('home', unseeded),
        ...fixtureClubFields('away', seeded),
        id: deterministicId(`legacy_competition_fixture:${sourceFixture.season_id}:${nextPhase}:${index + 1}:1`),
        tie_id: tieId,
        leg: 1,
        bracket_position: index + 1,
        round: 1,
      });
      await createLegacyCompetitionFixture({
        ...base,
        ...fixtureClubFields('home', seeded),
        ...fixtureClubFields('away', unseeded),
        id: deterministicId(`legacy_competition_fixture:${sourceFixture.season_id}:${nextPhase}:${index + 1}:2`),
        tie_id: tieId,
        leg: 2,
        bracket_position: index + 1,
        round: 2,
      });
      created += 2;
    }
  }
  await setLegacyCompetitionSeasonStatus(sourceFixture.season_id, nextPhase);
  return { advanced: true, next_phase: nextPhase, fixtures_created: created };
}

async function processOfficialSeasonEndQualification(season, standings) {
  const rule = CROSS_COMPETITION_QUALIFICATION_RULES.find(entry => entry.fromSlug === season?.competition_slug);
  if (!rule) return { qualified: 0 };
  const targetCompetition = await selectCompetitionBySlug(rule.toSlug);
  if (!targetCompetition) return { qualified: 0, reason: 'target_competition_missing' };

  const sorted = sortStandingRows(standings);
  let qualified = 0;
  for (const position of rule.positions) {
    const standing = sorted[position - 1];
    if (!standing?.club_id) continue;
    const exists = await qualificationEntryExists({
      clubId: standing.club_id,
      targetCompetitionId: targetCompetition.id,
      sourceType: 'competition_season',
    });
    if (exists) continue;
    await createQualificationEntry({
      id: deterministicId(`qualification_entry:competition_season:${season.id}:${targetCompetition.id}:${standing.club_id}:${position}`),
      source_type: 'competition_season',
      regional_league_id: null,
      regional_league_name: null,
      regional_finish_position: position,
      target_competition_id: targetCompetition.id,
      target_competition_name: targetCompetition.name,
      target_competition_tier: targetCompetition.tier,
      target_season_id: null,
      target_season_number: null,
      club_id: standing.club_id,
      club_name: standing.club_name,
      club_logo_url: standing.club_logo_url || '',
      club_tag: standing.club_tag || '',
      club_region: standing.region || season.region || '',
      club_platform: standing.platform || season.platform || '',
      status: 'pending',
    });
    qualified += 1;
  }
  return { qualified };
}

async function completeLegacyOfficialCompetition(sourceFixture, fixtures) {
  const finalFixture = fixtures.find(row => row.phase === 'knockout_final');
  const winner = finalFixture ? aggregateClubWinner([finalFixture]) : null;
  const rows = await EXECUTESQL(
    "SELECT * FROM league_entities WHERE id = ? AND entity_type = 'competition_season' LIMIT 1",
    [sourceFixture.season_id],
  ).catch(() => []);
  let qualification = { qualified: 0 };
  if (rows.length) {
    const season = parseLeagueEntityRow(rows[0]);
    await updateLeagueEntityData('competition_season', sourceFixture.season_id, {
      ...season,
      status: 'completed',
      winner_club_id: winner?.club_id || season.winner_club_id || null,
      winner_club_name: winner?.club_name || season.winner_club_name || null,
    }, { status: 'completed' });
    const standings = await listLegacyCompetitionStandings(sourceFixture.season_id).catch(() => []);
    qualification = await processOfficialSeasonEndQualification(season, standings).catch((err) => ({
      qualified: 0,
      error: err.message,
    }));
  }
  return {
    advanced: true,
    next_phase: 'completed',
    winner_club_id: winner?.club_id || null,
    qualifications_created: qualification.qualified || 0,
  };
}

async function advanceLegacyOfficialCompetitionIfReady(fixture) {
  if (!fixture?.season_id || String(fixture.entity_type || fixture.source_fixture_type || '') === 'regional_league_fixture') {
    return { advanced: false, reason: 'unsupported_fixture' };
  }
  const currentPhase = fixture.phase || 'league';
  const allFixtures = await listLegacyCompetitionFixtures(fixture.season_id);
  const phaseFixtures = allFixtures.filter(row => String(row.phase || 'league') === String(currentPhase));
  if (!phaseFixtures.length) return { advanced: false, reason: 'no_phase_fixtures' };
  if (phaseFixtures.some(row => !isFinishedStatus(row.status))) {
    return { advanced: false, reason: 'phase_not_complete' };
  }

  const standings = await listLegacyCompetitionStandings(fixture.season_id);
  if (currentPhase === 'league') {
    return generateLegacyOfficialPlayoffRound(fixture, standings);
  }
  if (currentPhase === 'playoff_round') {
    return generateLegacyOfficialR16(fixture, standings, allFixtures);
  }
  const nextPhase = {
    knockout_r16: 'knockout_qf',
    knockout_qf: 'knockout_sf',
    knockout_sf: 'knockout_final',
  }[currentPhase];
  if (nextPhase) {
    return generateLegacyOfficialNextKnockout(fixture, allFixtures, currentPhase, nextPhase);
  }
  if (currentPhase === 'knockout_final') {
    return completeLegacyOfficialCompetition(fixture, allFixtures);
  }
  return { advanced: false, reason: 'no_next_phase' };
}

async function processRegionalDivisionOneEnd(league, standings) {
  const sorted = sortStandingRows(standings);
  const total = sorted.length;
  const linkedLeague = await selectLinkedRegionalLeague(league);
  let qualified = 0;
  let relegated = 0;

  for (const rule of STAGE_QUALIFICATION_RULES) {
    const competition = await selectCompetitionBySlug(rule.competitionSlug);
    if (!competition) continue;
    for (const position of rule.positions) {
      const standing = sorted[position - 1];
      if (!standing?.club_id) continue;
      const exists = await qualificationEntryExists({
        clubId: standing.club_id,
        targetCompetitionId: competition.id,
        sourceType: 'regional_league',
      });
      if (!exists) {
        await createQualificationEntry({
          id: deterministicId(`qualification_entry:regional_league:${league.id}:${competition.id}:${standing.club_id}:${position}`),
          source_type: 'regional_league',
          regional_league_id: league.id,
          regional_league_name: league.name,
          regional_finish_position: position,
          target_competition_id: competition.id,
          target_competition_name: competition.name,
          target_competition_tier: competition.tier,
          target_season_id: null,
          target_season_number: null,
          club_id: standing.club_id,
          club_name: standing.club_name,
          club_logo_url: standing.club_logo_url || '',
          club_tag: standing.club_tag || '',
          club_region: standing.region || league.region || '',
          club_platform: standing.platform || league.platform || '',
          status: 'pending',
        });
        qualified += 1;
      }
      await updateLeagueEntityData('regional_league_standing', standing.id, {
        ...standing,
        is_stage_qualified: true,
        stage_competition_slug: rule.competitionSlug,
        final_position: position,
      });
    }
  }

  const relegatedRows = sorted.slice(Math.max(0, total - RELEGATION_SPOTS));
  for (const standing of relegatedRows) {
    const position = sorted.indexOf(standing) + 1;
    await updateLeagueEntityData('regional_league_standing', standing.id, {
      ...standing,
      is_relegated: true,
      final_position: position,
      ...(linkedLeague ? { relegation_target_league_id: linkedLeague.id } : {}),
    });
    relegated += 1;
  }

  for (let index = 0; index < total; index += 1) {
    const position = index + 1;
    const standing = sorted[index];
    const alreadyHandled = STAGE_QUALIFICATION_RULES.some(rule => rule.positions.includes(position))
      || index >= total - RELEGATION_SPOTS;
    if (alreadyHandled) continue;
    await updateLeagueEntityData('regional_league_standing', standing.id, {
      ...standing,
      final_position: position,
    });
  }

  return { type: 'div1', qualified, relegated };
}

async function processRegionalDivisionTwoEnd(league, standings) {
  const sorted = sortStandingRows(standings);
  const total = sorted.length;
  const linkedLeague = await selectLinkedRegionalLeague(league);
  const promotedRows = sorted.slice(0, Math.min(PROMOTION_SPOTS, total));
  let promoted = 0;
  let relegated = 0;

  for (const standing of promotedRows) {
    const position = sorted.indexOf(standing) + 1;
    await updateLeagueEntityData('regional_league_standing', standing.id, {
      ...standing,
      is_promoted: true,
      final_position: position,
      ...(linkedLeague ? { promotion_target_league_id: linkedLeague.id } : {}),
    });
    promoted += 1;
  }

  const shouldRelegate = total > RELEGATION_SPOTS + PROMOTION_SPOTS;
  const relegatedRows = shouldRelegate ? sorted.slice(total - RELEGATION_SPOTS) : [];
  for (const standing of relegatedRows) {
    const position = sorted.indexOf(standing) + 1;
    await updateLeagueEntityData('regional_league_standing', standing.id, {
      ...standing,
      is_relegated: true,
      final_position: position,
    });
    relegated += 1;
  }

  const lastMidIndex = shouldRelegate ? total - RELEGATION_SPOTS : total;
  for (let index = PROMOTION_SPOTS; index < lastMidIndex; index += 1) {
    const standing = sorted[index];
    if (!standing) continue;
    await updateLeagueEntityData('regional_league_standing', standing.id, {
      ...standing,
      final_position: index + 1,
    });
  }

  return { type: 'div2', promoted, relegated };
}

async function advanceRegionalLeagueIfReady(fixture) {
  if (!fixture?.league_id) return { advanced: false, reason: 'unsupported_fixture' };
  const fixtures = await listLegacyRegionalLeagueFixtures(fixture.league_id);
  if (!fixtures.length) return { advanced: false, reason: 'no_league_fixtures' };
  if (fixtures.some(row => !isFinishedStatus(row.status, { regional: true }))) {
    return { advanced: false, reason: 'league_not_complete' };
  }

  const league = await selectLeagueEntityById('regional_league', fixture.league_id);
  if (!league) return { advanced: false, reason: 'league_not_found' };
  if (String(league.status || '').toLowerCase() === 'completed') {
    return { advanced: false, reason: 'already_completed' };
  }

  const standings = await listLegacyRegionalLeagueStandings(fixture.league_id);
  if (!standings.length) return { advanced: false, reason: 'no_standings' };

  const result = Number(league.division || 1) === 1
    ? await processRegionalDivisionOneEnd(league, standings)
    : await processRegionalDivisionTwoEnd(league, standings);

  await updateLeagueEntityData('regional_league', league.id, {
    ...league,
    status: 'completed',
  }, { status: 'completed' });

  return { advanced: true, ...result };
}

function communityWinnerFromMatch(match) {
  if (match.winner_club_id) {
    const isHome = String(match.winner_club_id) === String(match.home_club_id);
    return {
      id: match.winner_club_id,
      name: isHome ? match.home_club_name : match.away_club_name,
      owner_email: isHome ? match.home_owner_email : match.away_owner_email,
    };
  }
  if (match.winner_player_id) {
    const isHome = String(match.winner_player_id) === String(match.home_player_id);
    return {
      id: match.winner_player_id,
      name: isHome ? match.home_player_name : match.away_player_name,
      email: isHome ? match.home_player_email : match.away_player_email,
      player: true,
    };
  }
  return null;
}

function communityTeamFromClubMatch(match, clubId) {
  if (!clubId) return null;
  if (String(clubId) === String(match.home_club_id)) return { id: match.home_club_id, name: match.home_club_name };
  if (String(clubId) === String(match.away_club_id)) return { id: match.away_club_id, name: match.away_club_name };
  return { id: clubId, name: 'Club' };
}

function broadcastCommunityTournamentState(tournament, patch = {}) {
  if (typeof broadcastTournament === 'function') {
    broadcastTournament({ ...tournament, ...patch, id: tournament.id });
  }
}

function addCommunityStanding(table, id, name) {
  if (!id) return null;
  if (!table[id]) table[id] = { id, name: name || 'Club', P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, Pts: 0 };
  return table[id];
}

function calculateCommunityStandings(matches, filterFn = () => true) {
  const table = {};
  matches.filter(row => filterFn(row) && isFinishedStatus(row.status)).forEach((row) => {
    const home = addCommunityStanding(table, row.home_club_id, row.home_club_name);
    const away = addCommunityStanding(table, row.away_club_id, row.away_club_name);
    if (!home || !away) return;
    const homeScore = Number(row.home_score || 0);
    const awayScore = Number(row.away_score || 0);
    home.P += 1; away.P += 1;
    home.GF += homeScore; home.GA += awayScore;
    away.GF += awayScore; away.GA += homeScore;
    home.GD = home.GF - home.GA; away.GD = away.GF - away.GA;
    if (String(row.winner_club_id || '') === String(row.home_club_id || '')) {
      home.W += 1; home.Pts += 3; away.L += 1;
    } else if (String(row.winner_club_id || '') === String(row.away_club_id || '')) {
      away.W += 1; away.Pts += 3; home.L += 1;
    } else {
      home.D += 1; away.D += 1; home.Pts += 1; away.Pts += 1;
    }
  });
  return Object.values(table).sort((a, b) => b.Pts - a.Pts || b.GD - a.GD || b.GF - a.GF || String(a.name || '').localeCompare(String(b.name || '')));
}

function calculateCommunityGroupStandings(matches, numGroups = 2) {
  return Array.from({ length: Math.max(1, Number(numGroups) || 2) }, (_, groupIndex) =>
    calculateCommunityStandings(matches, row =>
      ['group', 'group_stage'].includes(String(row.type || '')) &&
      Number(row.group_number ?? row.group ?? 0) === groupIndex
    )
  );
}

function communityGroupPairs(groupStandings) {
  const groups = groupStandings.filter(group => group.length);
  if (groups.length < 2) {
    const teams = groups.flat().slice(0, 2);
    return teams.length === 2 ? [[teams[0], teams[1]]] : [];
  }
  const pairs = [];
  for (let index = 0; index < groups.length; index += 2) {
    const groupA = groups[index];
    const groupB = groups[index + 1];
    if (groupA?.[0] && groupB?.[1] && String(groupA[0].id) !== String(groupB[1].id)) pairs.push([groupA[0], groupB[1]]);
    if (groupB?.[0] && groupA?.[1] && String(groupB[0].id) !== String(groupA[1].id)) pairs.push([groupB[0], groupA[1]]);
  }
  if (pairs.length) return pairs;
  const teams = groups.flatMap(group => group.slice(0, 2));
  const fallback = [];
  for (let index = 0; index < teams.length; index += 2) {
    if (teams[index] && teams[index + 1] && String(teams[index].id) !== String(teams[index + 1].id)) {
      fallback.push([teams[index], teams[index + 1]]);
    }
  }
  return fallback;
}

function communityKnockoutTypeForTieCount(tieCount) {
  if (tieCount >= 8) return 'round_of_16';
  if (tieCount >= 4) return 'quarter_final';
  if (tieCount >= 2) return 'semi_final';
  return 'final';
}

async function insertCommunityTwoLegTie(tournament, home, away, round, type, groupIndex) {
  if (!home?.id || !away?.id || String(home.id) === String(away.id)) return 0;
  await insertCommunityTournamentMatch(tournament, home, away, round, type, { group_number: groupIndex });
  await insertCommunityTournamentMatch(tournament, away, home, round + 1, type, { group_number: groupIndex });
  return 2;
}

function communityTwoLegResult(legs) {
  if (!legs.length) return null;
  const sorted = [...legs].sort((a, b) => Number(a.round || 0) - Number(b.round || 0));
  const totals = {};
  const names = {};
  for (const leg of sorted) {
    if (leg.home_club_id) {
      totals[leg.home_club_id] = (totals[leg.home_club_id] || 0) + Number(leg.home_score || 0);
      names[leg.home_club_id] = leg.home_club_name;
    }
    if (leg.away_club_id) {
      totals[leg.away_club_id] = (totals[leg.away_club_id] || 0) + Number(leg.away_score || 0);
      names[leg.away_club_id] = leg.away_club_name;
    }
  }
  const ids = Object.keys(totals);
  if (ids.length < 2) return null;
  const [a, b] = ids;
  let winnerId = totals[a] > totals[b] ? a : totals[b] > totals[a] ? b : null;
  if (!winnerId) winnerId = [...sorted].reverse().find(leg => leg.winner_club_id)?.winner_club_id || null;
  if (!winnerId) return null;
  const loserId = String(winnerId) === String(a) ? b : a;
  return {
    winner: { id: winnerId, name: names[winnerId] || 'Winner' },
    loser: { id: loserId, name: names[loserId] || 'Club' },
  };
}

async function advanceCommunityGroupStage(tournament, allMatches) {
  const groupMatches = allMatches.filter(row => ['group', 'group_stage'].includes(String(row.type || '')));
  if (!groupMatches.length) return { advanced: false, reason: 'no_group_matches' };
  if (groupMatches.some(row => !isFinishedStatus(row.status))) return { advanced: false, reason: 'group_stage_not_complete' };
  const existingKnockouts = allMatches.filter(row => !['group', 'group_stage'].includes(String(row.type || '')));
  if (existingKnockouts.length) return advanceCommunityKnockoutRounds(tournament, allMatches);
  const pairs = communityGroupPairs(calculateCommunityGroupStandings(groupMatches, tournament.num_groups || 2));
  if (!pairs.length) return { advanced: false, reason: 'not_enough_group_qualifiers' };
  const nextRound = Math.max(Number(tournament.current_round || 1) + 1, 2);
  const type = communityKnockoutTypeForTieCount(pairs.length);
  let created = 0;
  for (let index = 0; index < pairs.length; index += 1) {
    created += await insertCommunityTwoLegTie(tournament, pairs[index][0], pairs[index][1], nextRound, type, index);
  }
  await EXECUTESQL('UPDATE tournaments SET current_round = ?, updated_date = NOW() WHERE id = ?', [nextRound, tournament.id]);
  broadcastCommunityTournamentState(tournament, { current_round: nextRound });
  return { advanced: true, next_round: nextRound, matches_created: created, phase: type };
}

async function createCommunityNextFromTieResults(tournament, tieResults, nextRound) {
  if (tieResults.length === 2) {
    await insertCommunityTournamentMatch(tournament, tieResults[0].winner, tieResults[1].winner, nextRound, 'final');
    if (tieResults[0].loser?.id && tieResults[1].loser?.id) {
      await insertCommunityTournamentMatch(tournament, tieResults[0].loser, tieResults[1].loser, nextRound, 'third_place');
      return 2;
    }
    return 1;
  }
  const winners = tieResults.map(result => result.winner);
  const type = communityKnockoutTypeForTieCount(winners.length / 2);
  let created = 0;
  for (let index = 0; index < winners.length; index += 2) {
    if (!winners[index + 1]) continue;
    created += await insertCommunityTwoLegTie(tournament, winners[index], winners[index + 1], nextRound, type, index / 2);
  }
  return created;
}

async function completeCommunityTournament(tournament, match, currentRound) {
  const winner = communityWinnerFromMatch(match);
  await EXECUTESQL(
    `UPDATE tournaments SET
      status = 'completed',
      winner_club_id = ?,
      winner_club_name = ?,
      winner_player_id = ?,
      winner_player_name = ?,
      current_round = ?,
      end_date = COALESCE(end_date, NOW()),
      updated_date = NOW()
     WHERE id = ?`,
    [
      winner?.player ? null : winner?.id || null,
      winner?.player ? null : winner?.name || null,
      winner?.player ? winner?.id || null : null,
      winner?.player ? winner?.name || null : null,
      currentRound,
      tournament.id,
    ],
  );
  if (winner?.player) {
    await awardPlayerOnlyTrophy({
      playerId: winner.id,
      trophyItemId: tournament.trophy_item_id,
      tournamentId: tournament.id,
      tournament,
    }).catch(err => console.error('[community tournament player trophy award]', err.message));
  } else if (winner?.id) {
    await awardClubTrophyToClubAndPlayers({
      clubId: winner.id,
      trophyItemId: tournament.trophy_item_id,
      tournamentId: tournament.id,
      tournament,
    }).catch(err => console.error('[community tournament club trophy award]', err.message));
  }
  broadcastCommunityTournamentState(tournament, {
    status: 'completed',
    winner_club_id: winner?.player ? null : winner?.id || null,
    winner_club_name: winner?.player ? null : winner?.name || null,
    winner_player_id: winner?.player ? winner?.id || null : null,
    winner_player_name: winner?.player ? winner?.name || null : null,
    current_round: currentRound,
  });
  return { advanced: true, completed: true, winner_id: winner?.id || null };
}

async function advanceCommunityKnockoutRounds(tournament, allMatches) {
  const currentRound = Number(tournament.current_round || 1);
  const currentMatches = allMatches.filter(row => Number(row.round || 1) === currentRound);
  if (!currentMatches.length) return { advanced: false, reason: 'round_not_found' };
  if (currentMatches.some(row => !isFinishedStatus(row.status))) return { advanced: false, reason: 'round_not_complete' };
  const currentType = String(currentMatches[0]?.type || '');
  if (currentMatches.some(row => ['final', 'third_place', 'third-place', 'bronze'].includes(String(row.type || '').toLowerCase()))) {
    const finalMatch = currentMatches.find(row => String(row.type || '').toLowerCase() === 'final') || currentMatches[0];
    if (finalMatch?.winner_club_id || finalMatch?.winner_player_id) return completeCommunityTournament(tournament, finalMatch, currentRound);
  }

  const twoLegTypes = new Set(['round_of_16', 'quarter_final', 'semi_final', 'ucl_playoff', 'ucl_r16', 'ucl_qf', 'ucl_sf']);
  if (twoLegTypes.has(currentType)) {
    const nextLegs = allMatches.filter(row => Number(row.round || 1) === currentRound + 1 && String(row.type || '') === currentType);
    if (nextLegs.length === currentMatches.length) {
      if (nextLegs.some(row => !isFinishedStatus(row.status))) {
        await EXECUTESQL('UPDATE tournaments SET current_round = ?, updated_date = NOW() WHERE id = ?', [currentRound + 1, tournament.id]);
        broadcastCommunityTournamentState(tournament, { current_round: currentRound + 1 });
        return { advanced: true, next_round: currentRound + 1, next_leg: true };
      }
      const byTie = new Map();
      [...currentMatches, ...nextLegs].forEach((row) => {
        const key = String(row.group_number ?? row.group ?? row.id);
        if (!byTie.has(key)) byTie.set(key, []);
        byTie.get(key).push(row);
      });
      const tieResults = Array.from(byTie.values()).map(communityTwoLegResult).filter(Boolean);
      if (tieResults.length !== currentMatches.length) return { advanced: false, reason: 'tie_winner_missing' };
      const nextRound = currentRound + 2;
      if (allMatches.some(row => Number(row.round || 1) === nextRound)) {
        await EXECUTESQL('UPDATE tournaments SET current_round = ?, updated_date = NOW() WHERE id = ?', [nextRound, tournament.id]);
        broadcastCommunityTournamentState(tournament, { current_round: nextRound });
        return { advanced: false, reason: 'next_round_exists', next_round: nextRound };
      }
      const created = await createCommunityNextFromTieResults(tournament, tieResults, nextRound);
      await EXECUTESQL('UPDATE tournaments SET current_round = ?, updated_date = NOW() WHERE id = ?', [nextRound, tournament.id]);
      broadcastCommunityTournamentState(tournament, { current_round: nextRound });
      return { advanced: true, next_round: nextRound, matches_created: created, aggregate: true };
    }
  }

  const winners = currentMatches.map(communityWinnerFromMatch).filter(Boolean);
  if (winners.length <= 1) return completeCommunityTournament(tournament, currentMatches[0], currentRound);
  const nextRound = currentRound + 1;
  if (allMatches.some(row => Number(row.round || 1) === nextRound)) {
    await EXECUTESQL('UPDATE tournaments SET current_round = ?, updated_date = NOW() WHERE id = ?', [nextRound, tournament.id]);
    broadcastCommunityTournamentState(tournament, { current_round: nextRound });
    return { advanced: false, reason: 'next_round_exists', next_round: nextRound };
  }
  let created = 0;
  for (let index = 0; index < winners.length; index += 2) {
    if (!winners[index + 1]) continue;
    const isFinal = winners.length === 2;
    await insertCommunityTournamentMatch(tournament, winners[index], winners[index + 1], nextRound, isFinal ? 'final' : 'knockout');
    created += 1;
  }
  await EXECUTESQL('UPDATE tournaments SET current_round = ?, updated_date = NOW() WHERE id = ?', [nextRound, tournament.id]);
  broadcastCommunityTournamentState(tournament, { current_round: nextRound });
  return { advanced: true, next_round: nextRound, matches_created: created };
}

async function advanceCommunitySwissUcl(tournament, allMatches) {
  const phaseRows = type => allMatches.filter(row => String(row.type || '') === type);
  const phaseComplete = rows => rows.length > 0 && rows.every(row => isFinishedStatus(row.status));
  const phaseExists = type => phaseRows(type).length > 0;
  const leagueMatches = phaseRows('ucl_league');
  const standings = calculateCommunityStandings(leagueMatches, row => String(row.type || '') === 'ucl_league');

  if (phaseComplete(leagueMatches) && !phaseExists('ucl_playoff')) {
    const participants = standings.slice(8, 24);
    if (participants.length < 16) return { advanced: false, reason: 'not_enough_playoff_participants' };
    let created = 0;
    for (let index = 0; index < 8; index += 1) {
      created += await insertCommunityTwoLegTie(tournament, participants[15 - index], participants[index], 9, 'ucl_playoff', index);
    }
    await EXECUTESQL("UPDATE tournaments SET current_round = ?, ucl_phase = 'playoff', updated_date = NOW() WHERE id = ?", [9, tournament.id]);
    broadcastCommunityTournamentState(tournament, { current_round: 9, ucl_phase: 'playoff' });
    return { advanced: true, next_round: 9, phase: 'ucl_playoff', matches_created: created };
  }

  const playoffRows = phaseRows('ucl_playoff');
  if (phaseComplete(playoffRows) && !phaseExists('ucl_r16')) {
    const byTie = new Map();
    playoffRows.forEach((row) => {
      const key = String(row.group_number ?? row.group ?? row.id);
      if (!byTie.has(key)) byTie.set(key, []);
      byTie.get(key).push(row);
    });
    const playoffWinners = Array.from(byTie.values()).map(communityTwoLegResult).filter(Boolean).map(result => result.winner);
    const direct = standings.slice(0, 8);
    if (direct.length < 8 || playoffWinners.length < 8) return { advanced: false, reason: 'not_enough_r16_participants' };
    let created = 0;
    for (let index = 0; index < 8; index += 1) {
      created += await insertCommunityTwoLegTie(tournament, playoffWinners[7 - index], direct[index], 11, 'ucl_r16', index);
    }
    await EXECUTESQL("UPDATE tournaments SET current_round = ?, ucl_phase = 'r16', updated_date = NOW() WHERE id = ?", [11, tournament.id]);
    broadcastCommunityTournamentState(tournament, { current_round: 11, ucl_phase: 'r16' });
    return { advanced: true, next_round: 11, phase: 'ucl_r16', matches_created: created };
  }

  const transitions = [
    { from: 'ucl_r16', to: 'ucl_qf', round: 13, phase: 'qf' },
    { from: 'ucl_qf', to: 'ucl_sf', round: 15, phase: 'sf' },
  ];
  for (const transition of transitions) {
    const rows = phaseRows(transition.from);
    if (!phaseComplete(rows) || phaseExists(transition.to)) continue;
    const byTie = new Map();
    rows.forEach((row) => {
      const key = String(row.group_number ?? row.group ?? row.id);
      if (!byTie.has(key)) byTie.set(key, []);
      byTie.get(key).push(row);
    });
    const winners = Array.from(byTie.values()).map(communityTwoLegResult).filter(Boolean).map(result => result.winner);
    if (winners.length < 2) return { advanced: false, reason: 'not_enough_winners' };
    let created = 0;
    for (let index = 0; index < winners.length; index += 2) {
      if (!winners[index + 1]) continue;
      created += await insertCommunityTwoLegTie(tournament, winners[index], winners[index + 1], transition.round, transition.to, index / 2);
    }
    await EXECUTESQL('UPDATE tournaments SET current_round = ?, ucl_phase = ?, updated_date = NOW() WHERE id = ?', [transition.round, transition.phase, tournament.id]);
    broadcastCommunityTournamentState(tournament, { current_round: transition.round, ucl_phase: transition.phase });
    return { advanced: true, next_round: transition.round, phase: transition.to, matches_created: created };
  }

  const sfRows = phaseRows('ucl_sf');
  if (phaseComplete(sfRows) && !allMatches.some(row => String(row.type || '') === 'final')) {
    const byTie = new Map();
    sfRows.forEach((row) => {
      const key = String(row.group_number ?? row.group ?? row.id);
      if (!byTie.has(key)) byTie.set(key, []);
      byTie.get(key).push(row);
    });
    const finalists = Array.from(byTie.values()).map(communityTwoLegResult).filter(Boolean).map(result => result.winner);
    if (finalists.length < 2) return { advanced: false, reason: 'not_enough_finalists' };
    await insertCommunityTournamentMatch(tournament, finalists[0], finalists[1], 17, 'final');
    await EXECUTESQL("UPDATE tournaments SET current_round = ?, ucl_phase = 'final', updated_date = NOW() WHERE id = ?", [17, tournament.id]);
    broadcastCommunityTournamentState(tournament, { current_round: 17, ucl_phase: 'final' });
    return { advanced: true, next_round: 17, phase: 'final', matches_created: 1 };
  }

  return advanceCommunityKnockoutRounds(tournament, allMatches);
}

async function insertCommunityTournamentMatch(tournament, home, away, round, type, extra = {}) {
  const isPlayer = Boolean(home.player || away.player) || String(tournament.participant_type || '').toLowerCase() === 'player';
  const match = {
    id: deterministicId(`community_tournament_match:${tournament.id}:${round}:${home.id}:${away.id}:${type}`),
    tournament_id: tournament.id,
    home_club_id: isPlayer ? null : home.id,
    away_club_id: isPlayer ? null : away.id,
    home_club_name: isPlayer ? null : home.name,
    away_club_name: isPlayer ? null : away.name,
    home_owner_email: isPlayer ? null : home.owner_email,
    away_owner_email: isPlayer ? null : away.owner_email,
    home_player_id: isPlayer ? home.id : null,
    home_player_name: isPlayer ? home.name : null,
    home_player_email: isPlayer ? home.email : null,
    away_player_id: isPlayer ? away.id : null,
    away_player_name: isPlayer ? away.name : null,
    away_player_email: isPlayer ? away.email : null,
    status: 'scheduled',
    mode: isPlayer ? 'player' : 'club',
    type,
    round,
    home_score: 0,
    away_score: 0,
    stats_processed: 0,
    ...extra,
  };
  await new Match(match).create();
  if (typeof broadcastMatch === 'function') broadcastMatch(match);
  return match;
}

async function advanceCommunityTournamentIfReady(match) {
  if (!match?.tournament_id || !isFinishedStatus(match.status)) {
    return { advanced: false, reason: 'not_completed_tournament_match' };
  }
  const tournamentRows = await EXECUTESQL('SELECT * FROM tournaments WHERE id = ? LIMIT 1', [match.tournament_id]);
  const tournament = tournamentRows[0];
  if (!tournament) return { advanced: false, reason: 'tournament_not_found' };
  const allMatches = await EXECUTESQL(
    'SELECT * FROM matches WHERE tournament_id = ? ORDER BY round, group_number, scheduled_date, created_date',
    [match.tournament_id],
  );
  const type = String(tournament.type || '').toLowerCase();
  if (type === 'league') {
    const leagueMatches = allMatches.filter(row => String(row.type || '') === 'league');
    if (!leagueMatches.length || leagueMatches.some(row => !isFinishedStatus(row.status))) {
      return { advanced: false, reason: 'league_not_complete' };
    }
    const winner = calculateCommunityStandings(leagueMatches, row => String(row.type || '') === 'league')[0] || null;
    if (!winner) return { advanced: false, reason: 'winner_missing' };
    await EXECUTESQL(
      `UPDATE tournaments SET status = 'completed', winner_club_id = ?, winner_club_name = ?,
        current_round = ?, end_date = COALESCE(end_date, NOW()), updated_date = NOW()
       WHERE id = ?`,
      [winner.id, winner.name, Number(tournament.current_round || match.round || 1), tournament.id],
    );
    await awardClubTrophyToClubAndPlayers({
      clubId: winner.id,
      trophyItemId: tournament.trophy_item_id,
      tournamentId: tournament.id,
      tournament,
    }).catch(err => console.error('[community league trophy award]', err.message));
    broadcastCommunityTournamentState(tournament, {
      status: 'completed',
      winner_club_id: winner.id,
      winner_club_name: winner.name,
      current_round: Number(tournament.current_round || match.round || 1),
    });
    return { advanced: true, completed: true, winner_id: winner.id };
  }
  if (type === 'group_stage') return advanceCommunityGroupStage(tournament, allMatches);
  if (type === 'swiss_ucl') return advanceCommunitySwissUcl(tournament, allMatches);
  if (['knockout', 'double_elimination'].includes(type)) return advanceCommunityKnockoutRounds(tournament, allMatches);
  return { advanced: false, reason: 'unsupported_tournament_format' };
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
  const advance = legacyResult.fixture && (sourceType === 'competition' || sourceType === 'competition_fixture')
    ? await advanceLegacyOfficialCompetitionIfReady(legacyResult.fixture).catch((err) => ({
      advanced: false,
      reason: 'advance_error',
      error: err.message,
    }))
    : legacyResult.fixture && (sourceType === 'regional_league' || sourceType === 'regional_league_fixture')
      ? await advanceRegionalLeagueIfReady(legacyResult.fixture).catch((err) => ({
        advanced: false,
        reason: 'advance_error',
        error: err.message,
      }))
      : { advanced: false, reason: 'unsupported_source' };
  return { synced: Boolean(engineFixture || legacyResult.synced), legacy: legacyResult, ready, advance };
}

async function advanceAfterFinalResult(finalResult, options = {}) {
  const match = options.match || finalResult?.match || (
    finalResult?.id && !finalResult?.fixture ? finalResult : null
  );
  if (match) {
    const matchStatus = String(match.status || '').toLowerCase();
    if (!isFinishedStatus(matchStatus)) {
      return { triggered: false, reason: 'match_not_final' };
    }
    const sync = matchStatus === 'completed'
      ? await syncMatchResultToSource(match).catch((err) => ({
        synced: false,
        reason: 'sync_error',
        error: err.message,
      }))
      : { synced: false, reason: 'non_played_final_result' };
    const community = await advanceCommunityTournamentIfReady(match).catch((err) => ({
      advanced: false,
      reason: 'community_advance_error',
      error: err.message,
    }));
    return {
      triggered: true,
      source: 'match',
      match_id: match.id,
      sync,
      community,
      advance: sync?.advance || community,
    };
  }

  const fixture = options.fixture || finalResult?.fixture || finalResult;
  const sourceType = options.sourceType || finalResult?.sourceType || finalResult?.fixture_type || null;
  const isRegional = sourceType === 'regional_league' || sourceType === 'regional_league_fixture';
  const isCompetition = sourceType === 'competition' || sourceType === 'competition_fixture';
  if (!fixture?.id) return { triggered: false, reason: 'fixture_missing' };
  if (!isCompetition && !isRegional) return { triggered: false, reason: 'unsupported_source' };
  if (!isFinishedStatus(fixture.status, { regional: isRegional })) {
    return { triggered: false, reason: 'fixture_not_final' };
  }

  const ready = await notifyLegacyPhaseReady({ fixture, sourceType }).catch((err) => ({
    notified: false,
    reason: 'ready_error',
    error: err.message,
  }));
  const advance = isCompetition
    ? await advanceLegacyOfficialCompetitionIfReady(fixture).catch((err) => ({
      advanced: false,
      reason: 'advance_error',
      error: err.message,
    }))
    : await advanceRegionalLeagueIfReady(fixture).catch((err) => ({
      advanced: false,
      reason: 'advance_error',
      error: err.message,
    }));
  return {
    triggered: true,
    source: 'fixture',
    source_type: sourceType,
    fixture_id: fixture.id,
    ready,
    advance,
  };
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
  advanceAfterFinalResult,
  advanceLegacyOfficialCompetitionIfReady,
  advanceRegionalLeagueIfReady,
  advanceCommunityTournamentIfReady,
  notifyPhaseReady,
};

const express = require('express');
const router = express.Router();
const { EXECUTESQL } = require('../db/database');

const COMPLETE_STATUSES = new Set(['completed', 'confirmed', 'played', 'forfeit']);
const DEFENSIVE_POSITIONS = new Set(['GK', 'CB', 'LCB', 'RCB', 'LB', 'RB', 'LWB', 'RWB']);
const FULLBACK_POSITIONS = new Set(['LB', 'RB', 'LWB', 'RWB']);
const MIDFIELD_POSITIONS = new Set(['CDM', 'CM', 'CAM', 'LM', 'RM']);
const ATTACK_POSITIONS = new Set(['LW', 'RW', 'CF', 'ST', 'LS', 'RS']);

function n(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function text(value) {
  return String(value || '').trim();
}

function upper(value) {
  return text(value).toUpperCase();
}

function parseJson(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return {}; }
}

function normalizeStatus(value) {
  return text(value).toLowerCase();
}

function safeRankSort(a, b) {
  return (b.ranking_points || 0) - (a.ranking_points || 0) ||
    (b.wins || b.ranking_wins || 0) - (a.wins || a.ranking_wins || 0) ||
    (b.matches_ranked || b.ranking_matches || 0) - (a.matches_ranked || a.ranking_matches || 0) ||
    text(a.name || a.gamertag).localeCompare(text(b.name || b.gamertag));
}

function phaseMultiplier(phase) {
  const p = text(phase).toLowerCase();
  if (p.includes('final') && !p.includes('semi')) return 2;
  if (p.includes('semi')) return 1.65;
  if (p.includes('quarter') || p === 'qf') return 1.45;
  if (p.includes('16') || p === 'r16') return 1.25;
  if (p.includes('playoff') || p.includes('knockout')) return 1.15;
  return 1;
}

function competitionMultiplier(fixture) {
  if (fixture.source_type === 'tournament') return 1.25 * phaseMultiplier(fixture.phase);
  if (fixture.source_type === 'regional_league') {
    const division = Math.max(1, n(fixture.competition_tier || fixture.division, 1));
    return division <= 1 ? 1.05 : division === 2 ? 0.9 : 0.8;
  }
  const slug = text(fixture.competition_slug).toLowerCase();
  if (slug.includes('supreme')) return 2 * phaseMultiplier(fixture.phase);
  if (slug.includes('elite')) return 1.55 * phaseMultiplier(fixture.phase);
  if (slug.includes('challenger')) return 1.25 * phaseMultiplier(fixture.phase);
  const tier = n(fixture.competition_tier, 3);
  return (tier <= 1 ? 1.75 : tier === 2 ? 1.4 : 1.15) * phaseMultiplier(fixture.phase);
}

function isCompleted(row) {
  return COMPLETE_STATUSES.has(normalizeStatus(row.status));
}

function resolveResult(goalsFor, goalsAgainst) {
  if (goalsFor > goalsAgainst) return 'W';
  if (goalsFor < goalsAgainst) return 'L';
  return 'D';
}

function clubShell(club) {
  return {
    id: club.id,
    name: club.name || 'Unknown Club',
    tag: club.tag,
    logo_url: club.logo_url,
    banner_url: club.banner_url,
    banner_position: club.banner_position,
    banner_zoom: club.banner_zoom,
    platform: club.platform,
    region: club.region || 'Global',
    country_code: club.country_code || '',
    ranking_points: 0,
    global_rank: null,
    regional_rank: null,
    country_rank: null,
    matches_ranked: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goals_scored: 0,
    goals_conceded: 0,
    clean_sheets: 0,
    competition_wins: 0,
    podium_finishes: 0,
    form: [],
  };
}

function playerShell(player) {
  const position = upper(player.position || 'ST');
  return {
    id: player.id,
    user_id: player.user_id,
    email: player.email,
    gamertag: player.gamertag || player.player_gamertag || 'Unknown Player',
    avatar_url: player.avatar_url,
    position,
    secondary_position: upper(player.secondary_position),
    platform: player.platform,
    country: player.country,
    country_code: player.country_code || '',
    club_id: player.club_id || player.current_club_id || null,
    club_name: player.club_name || null,
    club_tag: player.club_tag || null,
    region: player.region || player.club_region || 'Global',
    overall_rating: n(player.overall_rating, 0),
    is_verified: n(player.is_verified, 0),
    ranking_points: 0,
    global_rank: null,
    regional_rank: null,
    country_rank: null,
    position_rank: null,
    ranking_matches: 0,
    ranking_wins: 0,
    ranking_draws: 0,
    ranking_losses: 0,
    ranking_win_rate: 0,
    ranking_goals: 0,
    ranking_assists: 0,
    ranking_clean_sheets: 0,
    ranking_motm: 0,
    ranking_avg_rating: 0,
    rating_total: 0,
    competition_wins: 0,
    finishes_score: 0,
  };
}

function addClubMatch(row, goalsFor, goalsAgainst, multiplier) {
  const result = resolveResult(goalsFor, goalsAgainst);
  const gd = goalsFor - goalsAgainst;
  const base = result === 'W' ? 100 : result === 'D' ? 45 : 12;
  const closeLossBonus = result === 'L' && Math.abs(gd) === 1 ? 8 : 0;
  const resultPoints = (base + Math.max(gd, 0) * 8 + goalsFor * 3 + (goalsAgainst === 0 ? 15 : 0) + closeLossBonus) * multiplier;

  row.matches_ranked += 1;
  row.goals_scored += goalsFor;
  row.goals_conceded += goalsAgainst;
  row.clean_sheets += goalsAgainst === 0 ? 1 : 0;
  row.ranking_points += Math.round(resultPoints);
  row.form.push(result);
  if (row.form.length > 5) row.form.shift();
  if (result === 'W') row.wins += 1;
  else if (result === 'D') row.draws += 1;
  else row.losses += 1;
}

function positionGroup(position) {
  const pos = upper(position);
  if (pos === 'GK') return 'Goalkeepers';
  if (['CB', 'LCB', 'RCB'].includes(pos)) return 'Centre Backs';
  if (FULLBACK_POSITIONS.has(pos)) return 'Fullbacks';
  if (['CDM', 'CM'].includes(pos)) return 'Midfielders';
  if (['CAM', 'LM', 'RM', 'LW', 'RW'].includes(pos)) return 'Creators';
  return 'Attackers';
}

function playerFormula(row) {
  const position = upper(row.position);
  const matches = Math.max(1, row.ranking_matches);
  const winRate = row.ranking_matches ? row.ranking_wins / row.ranking_matches : 0;
  const rating = row.ranking_avg_rating || 0;
  const ovr = Math.min(40, row.overall_rating * 0.45);
  const availability = Math.min(140, row.ranking_matches * 10);
  const winning = row.ranking_wins * 22 + row.ranking_draws * 7 + winRate * 80;
  const ratingScore = Math.max(0, rating - 6) * 28;
  const motm = row.ranking_motm * 32;
  const titleScore = row.competition_wins * 220 + row.finishes_score;

  let roleScore = 0;
  if (position === 'GK' || ['CB', 'LCB', 'RCB'].includes(position)) {
    roleScore = row.ranking_clean_sheets * 44 + row.ranking_assists * 8 + row.ranking_goals * 8;
  } else if (FULLBACK_POSITIONS.has(position)) {
    roleScore = row.ranking_clean_sheets * 26 + row.ranking_assists * 30 + row.ranking_goals * 14;
  } else if (MIDFIELD_POSITIONS.has(position)) {
    roleScore = row.ranking_assists * 28 + row.ranking_goals * 20 + row.ranking_clean_sheets * 10;
  } else if (ATTACK_POSITIONS.has(position)) {
    roleScore = row.ranking_goals * 38 + row.ranking_assists * 24;
  } else {
    roleScore = row.ranking_goals * 25 + row.ranking_assists * 22 + row.ranking_clean_sheets * 12;
  }

  const perGameBalance = ((row.ranking_goals + row.ranking_assists) / matches) * 45;
  return Math.round(availability + winning + ratingScore + motm + roleScore + perGameBalance + titleScore + ovr);
}

async function query(sql, params = []) {
  return EXECUTESQL(sql, params).catch((err) => {
    console.error('[rankings]', err.message);
    return [];
  });
}

function mapPhysicalFixture(row, sourceType) {
  const homeScore = n(row.home_score);
  const awayScore = n(row.away_score);
  return {
    id: `${sourceType}:${row.id}`,
    raw_id: row.id,
    source_type: sourceType,
    match_id: row.match_id || (sourceType === 'tournament' ? row.id : null),
    competition_name: row.competition_name || row.league_name || row.tournament_name || 'STAGE Competition',
    competition_slug: row.competition_slug || row.competition_context || '',
    competition_tier: row.competition_tier || row.division || null,
    division: row.division,
    phase: row.phase || row.type || 'league',
    status: row.status,
    home_club_id: row.home_club_id,
    away_club_id: row.away_club_id,
    home_score: homeScore,
    away_score: awayScore,
    winner_club_id: row.winner_club_id || (homeScore === awayScore ? null : homeScore > awayScore ? row.home_club_id : row.away_club_id),
  };
}

function mapEntityFixture(row, sourceType) {
  const data = parseJson(row.data_json);
  const homeScore = n(data.home_score);
  const awayScore = n(data.away_score);
  return {
    id: `entity:${sourceType}:${row.id}`,
    raw_id: row.id,
    source_type: sourceType,
    match_id: data.match_id || data.matchId || null,
    competition_name: data.competition_name || data.league_name || data.name || 'STAGE Competition',
    competition_slug: data.competition_slug || data.stage_competition_slug || '',
    competition_tier: data.competition_tier || data.division || null,
    division: data.division,
    phase: data.phase || data.type || 'league',
    status: data.status || row.status,
    home_club_id: data.home_club_id,
    away_club_id: data.away_club_id,
    home_score: homeScore,
    away_score: awayScore,
    winner_club_id: data.winner_club_id || (homeScore === awayScore ? null : homeScore > awayScore ? data.home_club_id : data.away_club_id),
  };
}

async function getOfficialFixtures() {
  const fixtures = [];
  const seen = new Set();
  const add = (fixture) => {
    if (!fixture.home_club_id || !fixture.away_club_id || !isCompleted(fixture)) return;
    if (!fixture.match_id) fixture.match_id = fixture.raw_id;
    const key = `${fixture.source_type}:${fixture.raw_id || fixture.match_id}`;
    if (seen.has(key)) return;
    seen.add(key);
    fixtures.push(fixture);
  };

  const competitionFixtures = await query(
    `SELECT id, match_id, competition_name, competition_tier, competition_slug, phase, status,
            home_club_id, away_club_id, home_score, away_score, winner_club_id
       FROM competition_fixtures
      WHERE status IN ('completed','confirmed','played','forfeit')`
  );
  competitionFixtures.forEach((row) => add(mapPhysicalFixture(row, 'competition')));

  const regionalFixtures = await query(
    `SELECT id, match_id, league_name, region_slug, division, status,
            home_club_id, away_club_id, home_score, away_score, winner_club_id
       FROM regional_league_fixtures
      WHERE status IN ('completed','confirmed','played','forfeit')`
  );
  regionalFixtures.forEach((row) => add(mapPhysicalFixture(row, 'regional_league')));

  const tournamentMatches = await query(
    `SELECT m.id, m.id AS match_id, m.competition_context, m.type, m.status,
            m.home_club_id, m.away_club_id, m.home_score, m.away_score, m.winner_club_id,
            t.name AS tournament_name
       FROM matches m
       LEFT JOIN tournaments t ON t.id = m.tournament_id
      WHERE m.tournament_id IS NOT NULL
        AND m.status IN ('completed','confirmed','played','forfeit')`
  );
  tournamentMatches.forEach((row) => add(mapPhysicalFixture(row, 'tournament')));

  const entityFixtures = await query(
    `SELECT id, entity_type, data_json, status
       FROM league_entities
      WHERE entity_type IN ('competition_fixture','regional_league_fixture')
        AND status IN ('completed','confirmed','played','forfeit')`
  );
  entityFixtures.forEach((row) => {
    add(mapEntityFixture(row, row.entity_type === 'regional_league_fixture' ? 'regional_league' : 'competition'));
  });

  return fixtures;
}

async function getClubs() {
  return query('SELECT * FROM clubs');
}

async function getTitleBonuses() {
  const rows = [];
  const addRows = (items, sourceType) => {
    for (const item of items) {
      if (item.winner_club_id) rows.push({ club_id: item.winner_club_id, points: 300, source_type: sourceType });
      if (item.runner_up_club_id) rows.push({ club_id: item.runner_up_club_id, points: 160, source_type: sourceType });
    }
  };
  addRows(await query(`SELECT winner_club_id, runner_up_club_id FROM competition_seasons WHERE winner_club_id IS NOT NULL`), 'competition');
  addRows(await query(`SELECT winner_club_id, runner_up_club_id FROM tournaments WHERE winner_club_id IS NOT NULL`), 'tournament');

  const entitySeasons = await query(
    `SELECT data_json FROM league_entities
      WHERE entity_type IN ('competition_season','regional_league')
        AND JSON_EXTRACT(data_json, '$.winner_club_id') IS NOT NULL`
  );
  for (const row of entitySeasons) {
    const data = parseJson(row.data_json);
    if (data.winner_club_id) rows.push({ club_id: data.winner_club_id, points: 300, source_type: 'competition' });
    if (data.runner_up_club_id) rows.push({ club_id: data.runner_up_club_id, points: 160, source_type: 'competition' });
  }
  return rows;
}

async function getPlayersForStats() {
  return query(
    `SELECT p.*,
            c.name AS club_name,
            c.tag AS club_tag,
            c.region AS club_region,
            c.country_code AS club_country_code
       FROM players p
       LEFT JOIN clubs c ON c.id = p.club_id`
  );
}

async function getOfficialPlayerStats(matchIds) {
  if (!matchIds.length) return [];
  const placeholders = matchIds.map(() => '?').join(',');
  return query(
    `SELECT mps.*,
            p.id AS resolved_player_id,
            p.user_id AS resolved_user_id,
            p.email AS resolved_email,
            p.gamertag AS resolved_gamertag,
            p.avatar_url,
            p.position,
            p.secondary_position,
            p.platform,
            p.country,
            p.country_code,
            p.overall_rating,
            p.club_id AS current_club_id,
            p.is_verified,
            c.name AS club_name,
            c.tag AS club_tag,
            c.region AS club_region,
            c.country_code AS club_country_code
       FROM match_player_stats mps
       LEFT JOIN players p
         ON (mps.player_id IS NOT NULL AND p.id = mps.player_id)
         OR (mps.player_email IS NOT NULL AND LOWER(p.email) = LOWER(mps.player_email))
         OR (mps.player_gamertag IS NOT NULL AND LOWER(p.gamertag) = LOWER(mps.player_gamertag))
       LEFT JOIN clubs c ON c.id = COALESCE(mps.club_id, p.club_id)
      WHERE mps.match_id IN (${placeholders})`,
    matchIds
  );
}

function buildClubRankings(clubs, fixtures, titleBonuses) {
  const map = new Map();
  clubs.forEach((club) => map.set(club.id, clubShell(club)));

  for (const fixture of fixtures) {
    const home = map.get(fixture.home_club_id);
    const away = map.get(fixture.away_club_id);
    if (!home || !away) continue;
    const multiplier = competitionMultiplier(fixture);
    addClubMatch(home, n(fixture.home_score), n(fixture.away_score), multiplier);
    addClubMatch(away, n(fixture.away_score), n(fixture.home_score), multiplier);
  }

  for (const title of titleBonuses) {
    const row = map.get(title.club_id);
    if (!row) continue;
    row.competition_wins += title.points >= 300 ? 1 : 0;
    row.podium_finishes += 1;
    row.ranking_points += title.points;
  }

  const rows = [...map.values()].map((row) => ({
    ...row,
    ranking_points: Math.max(0, Math.round(row.ranking_points)),
    win_rate: row.matches_ranked ? Math.round((row.wins / row.matches_ranked) * 1000) / 10 : 0,
  }));

  assignRanks(rows, 'global_rank');
  assignScopedRanks(rows, 'region', 'regional_rank');
  assignScopedRanks(rows, 'country_code', 'country_rank');
  return rows;
}

function buildPlayerRankings(players, fixtures, statRows, clubRankings) {
  const fixtureByMatch = new Map(fixtures.filter((f) => f.match_id).map((f) => [String(f.match_id), f]));
  const playerById = new Map(players.map((p) => [p.id, p]));
  const playerByEmail = new Map(players.filter((p) => p.email).map((p) => [String(p.email).toLowerCase(), p]));
  const playerByGamertag = new Map(players.filter((p) => p.gamertag).map((p) => [String(p.gamertag).toLowerCase(), p]));
  const clubById = new Map(clubRankings.map((c) => [c.id, c]));
  const map = new Map();

  function getPlayer(stat) {
    return playerById.get(stat.resolved_player_id || stat.player_id) ||
      playerByEmail.get(String(stat.resolved_email || stat.player_email || '').toLowerCase()) ||
      playerByGamertag.get(String(stat.resolved_gamertag || stat.player_gamertag || '').toLowerCase()) ||
      null;
  }

  for (const stat of statRows) {
    const fixture = fixtureByMatch.get(String(stat.match_id));
    if (!fixture) continue;
    const player = getPlayer(stat);
    if (!player?.id) continue;
    if (!map.has(player.id)) {
      const shell = playerShell({ ...player, ...stat, region: stat.club_region || player.club_region || player.region });
      map.set(player.id, shell);
    }
    const row = map.get(player.id);
    const clubId = stat.club_id || player.club_id || stat.current_club_id;
    const isHome = clubId && String(clubId) === String(fixture.home_club_id);
    const isAway = clubId && String(clubId) === String(fixture.away_club_id);
    if (!isHome && !isAway) continue;

    const goalsFor = isHome ? n(fixture.home_score) : n(fixture.away_score);
    const goalsAgainst = isHome ? n(fixture.away_score) : n(fixture.home_score);
    const result = resolveResult(goalsFor, goalsAgainst);
    const goals = n(stat.goals);
    const assists = n(stat.assists);
    const rating = n(stat.rating);
    const position = upper(stat.position || player.position || row.position);
    const cleanSheet = n(stat.clean_sheet) || (DEFENSIVE_POSITIONS.has(position) && goalsAgainst === 0 ? 1 : 0);
    const motm = n(stat.is_motm) || (rating >= 8.7 ? 1 : 0);

    row.ranking_matches += 1;
    row.ranking_goals += goals;
    row.ranking_assists += assists;
    row.ranking_clean_sheets += cleanSheet ? 1 : 0;
    row.ranking_motm += motm ? 1 : 0;
    row.rating_total += rating;
    row.region = row.region || clubById.get(clubId)?.region || 'Global';
    row.country_code = row.country_code || player.country_code || '';
    row.club_id = clubId || row.club_id;
    row.club_name = row.club_name || clubById.get(clubId)?.name || stat.club_name;
    row.club_tag = row.club_tag || clubById.get(clubId)?.tag || stat.club_tag;
    if (result === 'W') row.ranking_wins += 1;
    else if (result === 'D') row.ranking_draws += 1;
    else row.ranking_losses += 1;
  }

  for (const row of map.values()) {
    const club = row.club_id ? clubById.get(row.club_id) : null;
    row.competition_wins = club?.competition_wins || 0;
    row.finishes_score = (club?.podium_finishes || 0) * 25;
    row.ranking_avg_rating = row.ranking_matches ? Math.round((row.rating_total / row.ranking_matches) * 100) / 100 : 0;
    row.ranking_win_rate = row.ranking_matches ? Math.round((row.ranking_wins / row.ranking_matches) * 1000) / 10 : 0;
    row.ranking_points = playerFormula(row);
  }

  const rows = [...map.values()].filter((row) => row.ranking_matches > 0);
  assignRanks(rows, 'global_rank');
  assignScopedRanks(rows, 'region', 'regional_rank');
  assignScopedRanks(rows, 'country_code', 'country_rank');
  assignScopedRanks(rows, 'position', 'position_rank');
  return rows;
}

function assignRanks(rows, field) {
  rows.sort(safeRankSort).forEach((row, index) => { row[field] = index + 1; });
}

function assignScopedRanks(rows, scopeField, rankField) {
  const groups = new Map();
  for (const row of rows) {
    const key = text(row[scopeField]) || 'Unknown';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  for (const group of groups.values()) {
    group.sort(safeRankSort).forEach((row, index) => { row[rankField] = index + 1; });
  }
}

async function buildRankings() {
  const [clubs, players, fixtures, titleBonuses] = await Promise.all([
    getClubs(),
    getPlayersForStats(),
    getOfficialFixtures(),
    getTitleBonuses(),
  ]);
  const clubRankings = buildClubRankings(clubs, fixtures, titleBonuses);
  const officialMatchIds = [...new Set(fixtures.map((f) => f.match_id).filter(Boolean).map(String))];
  const playerStats = await getOfficialPlayerStats(officialMatchIds);
  const playerRankings = buildPlayerRankings(players, fixtures, playerStats, clubRankings);
  const positions = Object.values(playerRankings.reduce((acc, player) => {
    const group = positionGroup(player.position);
    if (!acc[group]) acc[group] = { group, players: [] };
    acc[group].players.push(player);
    return acc;
  }, {})).map((group) => ({
    ...group,
    players: group.players.sort(safeRankSort).slice(0, 10),
  }));

  return {
    clubs: clubRankings.sort(safeRankSort),
    players: playerRankings.sort(safeRankSort),
    positions,
    meta: {
      official_fixtures_count: fixtures.length,
      official_match_ids_count: officialMatchIds.length,
      player_stat_rows_count: playerStats.length,
      club_count: clubRankings.length,
      ranked_player_count: playerRankings.length,
      source_counts: fixtures.reduce((acc, fixture) => {
        acc[fixture.source_type] = (acc[fixture.source_type] || 0) + 1;
        return acc;
      }, {}),
      generated_at: new Date().toISOString(),
    },
  };
}

function filterScope(rows, query, playerMode = false) {
  let out = [...rows];
  const scope = text(query.scope || 'global').toLowerCase();
  if (scope === 'regional' && query.region) out = out.filter((r) => text(r.region).toLowerCase() === text(query.region).toLowerCase());
  if (scope === 'country' && query.country_code) out = out.filter((r) => text(r.country_code).toLowerCase() === text(query.country_code).toLowerCase());
  if (playerMode && query.position) out = out.filter((r) => upper(r.position) === upper(query.position));
  return out.sort(safeRankSort).slice(0, Math.min(n(query.limit, 100), 250));
}

async function persistRankings(summary) {
  await EXECUTESQL(
    `UPDATE clubs
        SET ranking_points = 0,
            global_rank = NULL,
            regional_rank = NULL,
            country_rank = NULL,
            matches_ranked = 0,
            wins = 0,
            draws = 0,
            losses = 0,
            goals_scored = 0,
            goals_conceded = 0,
            form = NULL`
  );
  for (const club of summary.clubs) {
    await EXECUTESQL(
      `UPDATE clubs
          SET ranking_points = ?,
              global_rank = ?,
              regional_rank = ?,
              country_rank = ?,
              matches_ranked = ?,
              wins = ?,
              draws = ?,
              losses = ?,
              goals_scored = ?,
              goals_conceded = ?,
              form = ?
        WHERE id = ?`,
      [
        club.ranking_points,
        club.global_rank,
        club.regional_rank,
        club.country_rank,
        club.matches_ranked,
        club.wins,
        club.draws,
        club.losses,
        club.goals_scored,
        club.goals_conceded,
        club.form.join(''),
        club.id,
      ]
    );
  }

  await EXECUTESQL(
    `UPDATE players
        SET ranking_points = 0,
            global_rank = NULL,
            regional_rank = NULL,
            country_rank = NULL,
            position_rank = NULL,
            ranking_matches = 0,
            ranking_wins = 0,
            ranking_draws = 0,
            ranking_losses = 0,
            ranking_win_rate = 0,
            ranking_goals = 0,
            ranking_assists = 0,
            ranking_clean_sheets = 0,
            ranking_motm = 0,
            ranking_avg_rating = 0,
            ranking_competition_wins = 0,
            ranking_finishes_score = 0`
  );
  for (const player of summary.players) {
    await EXECUTESQL(
      `UPDATE players
          SET ranking_points = ?,
              global_rank = ?,
              regional_rank = ?,
              country_rank = ?,
              position_rank = ?,
              ranking_matches = ?,
              ranking_wins = ?,
              ranking_draws = ?,
              ranking_losses = ?,
              ranking_win_rate = ?,
              ranking_goals = ?,
              ranking_assists = ?,
              ranking_clean_sheets = ?,
              ranking_motm = ?,
              ranking_avg_rating = ?,
              ranking_competition_wins = ?,
              ranking_finishes_score = ?
        WHERE id = ?`,
      [
        player.ranking_points,
        player.global_rank,
        player.regional_rank,
        player.country_rank,
        player.position_rank,
        player.ranking_matches,
        player.ranking_wins,
        player.ranking_draws,
        player.ranking_losses,
        player.ranking_win_rate,
        player.ranking_goals,
        player.ranking_assists,
        player.ranking_clean_sheets,
        player.ranking_motm,
        player.ranking_avg_rating,
        player.competition_wins,
        player.finishes_score,
        player.id,
      ]
    );
  }
}

async function requireAdmin(req, res) {
  const rows = await EXECUTESQL('SELECT id, email, role_id FROM users WHERE id = ? LIMIT 1', [req.user?.id]).catch(() => []);
  const user = rows[0];
  if (Number(user?.role_id) !== 0) {
    res.status(403).json({ error: 'Admin access required' });
    return null;
  }
  return user;
}

router.get('/summary', async (_req, res) => {
  try {
    const summary = await buildRankings();
    res.json({
      ...summary,
      clubs: summary.clubs.slice(0, 100),
      players: summary.players.slice(0, 100),
    });
  } catch (err) {
    console.error('[rankings] summary failed:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/clubs', async (req, res) => {
  try {
    const summary = await buildRankings();
    res.json(filterScope(summary.clubs, req.query));
  } catch (err) {
    console.error('[rankings] clubs failed:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/players', async (req, res) => {
  try {
    const summary = await buildRankings();
    res.json(filterScope(summary.players, req.query, true));
  } catch (err) {
    console.error('[rankings] players failed:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/rebuild', async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const summary = await buildRankings();
    await persistRankings(summary);
    await EXECUTESQL(
      `INSERT INTO admin_audit_log
        (admin_user_id, admin_email, action, entity_type, entity_id, old_value, new_value, reason, created_date)
       VALUES (?, ?, 'rankings_rebuilt', 'rankings', 'global', NULL, ?, ?, NOW())`,
      [
        admin.id,
        admin.email,
        JSON.stringify(summary.meta),
        req.body?.reason || 'Rebuilt official STAGE rankings',
      ]
    ).catch(() => {});
    res.json({
      success: true,
      ...summary,
      clubs: summary.clubs.slice(0, 100),
      players: summary.players.slice(0, 100),
    });
  } catch (err) {
    console.error('[rankings] rebuild failed:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

const { v4: uuidv4 } = require('uuid');
const { EXECUTESQL } = require('../db/database');

const PHASE_LABELS = {
  knockout_r16: 'the round of 16',
  round_of_16: 'the round of 16',
  knockout_qf: 'the quarter-finals',
  quarter_final: 'the quarter-finals',
  knockout_sf: 'the semi-finals',
  semi_final: 'the semi-finals',
  knockout_final: 'the final',
  final: 'the final',
  third_place: 'the third-place match',
};

const PHASE_STAMPS = {
  knockout_r16: 'R16',
  round_of_16: 'R16',
  knockout_qf: 'QF',
  quarter_final: 'QF',
  knockout_sf: 'SF',
  semi_final: 'SF',
  knockout_final: 'FINAL',
  final: 'FINAL',
  third_place: '3RD',
  r16: 'R16',
  qf: 'QF',
  sf: 'SF',
  playoff: 'PLAYOFF',
  league: 'LEAGUE',
  live: 'LIVE',
  field: 'FIELD',
  champion: 'CHAMPION',
};

const CLUB_CONTRACT_RE = /\b(offered(?: a)?(?: trial)?(?: contract)?|offered renewal|cancelled a contract offer|terminated|released)\b/i;
const PLAYER_SIGNED_RE = /\b(joined|has accepted|signed)\b/i;

function parseJson(value, fallback) {
  if (Array.isArray(value) || (value && typeof value === 'object')) return value;
  if (typeof value !== 'string' || !value.trim()) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function isLeagueCompetition(tournament = {}) {
  const type = String(tournament.type || '').toLowerCase();
  return type.includes('league');
}

async function publishTournamentStory(tournament, { title, body, type } = {}) {
  const section = newsSectionForTournament(tournament);
  return publishNewsItem({
    title,
    body,
    type: type || (section === 'competitions' ? 'league' : 'tournament'),
    category: section,
    tags: [section],
    tournament_id: tournament.id || null,
    tournament_name: tournament.name || null,
    link: tournament.id ? `/tournaments/${tournament.id}` : '',
  });
}

function newsSectionForTournament(tournament = {}) {
  return isLeagueCompetition(tournament) ? 'competitions' : 'tournament';
}

function phaseLabel(phase) {
  return PHASE_LABELS[String(phase || '').toLowerCase()] || 'the next round';
}

async function publishNewsItem({
  title,
  body = '',
  type,
  category,
  tags = [],
  club_id = null,
  club_name = null,
  club_logo_url = null,
  player_id = null,
  player_name = null,
  player_avatar_url = null,
  tournament_id = null,
  tournament_name = null,
  link = '',
  transfer_fee_stc = 0,
  transfer_id = null,
} = {}) {
  if (!title) return null;
  try {
    await EXECUTESQL(
      `INSERT INTO news_items
        (id, type, category, title, body, club_id, club_name, club_logo_url,
         player_id, player_name, player_avatar_url, tournament_id, tournament_name,
         is_featured, is_global, published_at, link, transfer_fee_stc, tags, transfer_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, NOW(), ?, ?, ?, ?)`,
      [
        uuidv4(),
        type || category || 'announcement',
        category || type || 'announcement',
        title,
        body,
        club_id,
        club_name,
        club_logo_url,
        player_id,
        player_name,
        player_avatar_url,
        tournament_id,
        tournament_name,
        link || '',
        Number(transfer_fee_stc || 0),
        JSON.stringify(tags),
        transfer_id,
      ],
    );
  } catch (err) {
    console.error('[newsFeed]', err.message);
  }
  return null;
}

function registeredCount(tournament = {}) {
  const clubs = parseJson(tournament.registered_clubs, []);
  const players = parseJson(tournament.registered_players, []);
  return Math.max(Array.isArray(clubs) ? clubs.length : 0, Array.isArray(players) ? players.length : 0);
}

function storyText(item = {}) {
  return `${item.title || ''} ${item.body || ''}`;
}

function participatingCountries(records = []) {
  const seen = new Map();
  for (const row of records) {
    const code = String(row?.country_code || row?.country || '').trim().toUpperCase();
    if (!code || code === 'NULL') continue;
    const current = seen.get(code) || { code, count: 0 };
    current.count += 1;
    seen.set(code, current);
  }
  return [...seen.values()].sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
}

function tournamentKickoffCopy(tournament = {}, { entries = 0, countries = [], trophyName = '' } = {}) {
  const who = String(tournament.participant_type || '').toLowerCase() === 'player' ? 'players' : 'clubs';
  const countryCount = Array.isArray(countries) ? countries.length : 0;
  const countryList = (countries || []).map((row) => row.code).slice(0, 12).join(', ');
  const countryBit = countryCount
    ? ` from ${countryCount} ${countryCount === 1 ? 'country' : 'countries'}${countryList ? ` (${countryList})` : ''}`
    : '';
  const trophyBit = trophyName ? ` The cup on the line is ${trophyName}.` : '';
  return `${tournament.name} has kicked off with ${entries} participating ${who}${countryBit}.${trophyBit} The field is set and the first round is live.`;
}

function phaseStamp(phase) {
  const key = String(phase || '').toLowerCase();
  return PHASE_STAMPS[key] || String(phase || 'LIVE').replace(/_/g, ' ').toUpperCase();
}

function matchPhaseKey(match = {}) {
  const type = String(match.type || '').toLowerCase();
  if (PHASE_LABELS[type] || PHASE_STAMPS[type]) return type;
  if (Number(match.round) > 0) return `round_${match.round}`;
  return type || 'live';
}

function buildPhaseBoard(matches = []) {
  const groups = new Map();
  for (const match of matches) {
    const key = matchPhaseKey(match);
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: PHASE_LABELS[key] ? phaseLabel(key).replace(/^the /, '') : String(key).replace(/_/g, ' '),
        stamp: phaseStamp(key),
        advancers: [],
        matches: [],
      });
    }
    const winner = match.winner_club_name || match.winner_player_name || null;
    const row = {
      id: match.id,
      home: match.home_club_name || match.home_player_name || 'TBD',
      away: match.away_club_name || match.away_player_name || 'TBD',
      winner,
      status: match.status || '',
      score: [match.home_score, match.away_score].every((value) => value !== null && value !== undefined)
        ? `${match.home_score}-${match.away_score}`
        : '',
    };
    groups.get(key).matches.push(row);
    if (winner && !groups.get(key).advancers.includes(winner)) groups.get(key).advancers.push(winner);
  }
  return [...groups.values()];
}

function currentPhaseStamp(tournament = {}, matches = []) {
  if (String(tournament.status || '').toLowerCase() === 'completed' || tournament.winner_club_name || tournament.winner_player_name) {
    return 'champion';
  }
  if (tournament.ucl_phase) return String(tournament.ucl_phase).toLowerCase();
  const knockout = [...matches].reverse().find((match) => PHASE_STAMPS[String(match.type || '').toLowerCase()]);
  if (knockout) return String(knockout.type).toLowerCase();
  if (String(tournament.status || '').toLowerCase() === 'in_progress') return 'live';
  return 'field';
}

function tournamentFieldCard(tournament = {}, { countries = [], matches = [], trophyName = '', trophyUrl = '' } = {}) {
  const phases = buildPhaseBoard(matches);
  const stamp = currentPhaseStamp(tournament, matches);
  return {
    id: tournament.id,
    name: tournament.name,
    type: tournament.type,
    status: tournament.status,
    season: tournament.season || null,
    stamp: phaseStamp(stamp),
    current_phase: stamp,
    current_phase_label: stamp === 'champion'
      ? 'champion'
      : (PHASE_LABELS[stamp] ? phaseLabel(stamp).replace(/^the /, '') : String(stamp).replace(/_/g, ' ')),
    country_count: countries.length,
    countries,
    entry_count: registeredCount(tournament),
    participant_type: tournament.participant_type || 'club',
    trophy_name: trophyName || null,
    trophy_url: trophyUrl || tournament.trophy_url || null,
    winner_name: tournament.winner_club_name || tournament.winner_player_name || null,
    winner_id: tournament.winner_club_id || tournament.winner_player_id || null,
    phases,
    link: tournament.id ? `/tournaments/${tournament.id}` : '',
  };
}

function clubStoryKind(item = {}) {
  const cat = String(item.category || item.type || '').toLowerCase();
  const text = storyText(item);
  if (cat === 'stadium' || /stadium|capacity/.test(text)) return 'stadium';
  if (cat === 'shirts' || /\bshirts?\b/.test(text)) return 'shirts';
  if (cat === 'tickets' || /\btickets?\b/.test(text)) return 'tickets';
  if (cat === 'trophy' || /\b(trophy|lifted|champion)\b/i.test(text)) return 'trophy';
  if (cat === 'contracts' || cat === 'transfers' || CLUB_CONTRACT_RE.test(text) || /\b(transfer fee|paid .+ fee)\b/i.test(text)) {
    return 'contract';
  }
  return 'club';
}

function playerStoryKind(item = {}) {
  const cat = String(item.category || item.type || '').toLowerCase();
  const text = storyText(item);
  if (cat === 'lifestyle') return 'lifestyle';
  if (cat === 'ranking') return 'ranking';
  if (cat === 'motm' || /man of the match/i.test(text)) return 'motm';
  if (PLAYER_SIGNED_RE.test(text)) return 'signed';
  if (cat === 'achievement') return 'achievement';
  return 'player';
}

function dailyStoryKind(item = {}) {
  const cat = String(item.category || item.type || '').toLowerCase();
  if (cat === 'announcement' || cat === 'app_update') return 'announcement';
  return 'commentary';
}

function storyBeat(item = {}) {
  const tagged = parseJson(item.tags, []);
  if (Array.isArray(tagged) && tagged.length) {
    if (tagged.includes('club_news')) return 'club_news';
    if (tagged.includes('player_news')) return 'player_news';
    if (tagged.includes('tournament')) return 'tournament';
    if (tagged.includes('competitions')) return 'competitions';
    if (tagged.includes('daily_news')) return 'daily_news';
    if (tagged.includes('mercato')) return 'mercato';
  }
  const cat = String(item.category || item.type || '').toLowerCase();
  if (['club_news', 'stadium', 'shirts', 'tickets', 'trophy'].includes(cat)) return 'club_news';
  if (['player_news', 'lifestyle', 'ranking', 'motm', 'achievement'].includes(cat)) return 'player_news';
  if (cat === 'tournament') return 'tournament';
  if (cat === 'competitions' || cat === 'league') return 'competitions';
  if (['announcement', 'general', 'app_update'].includes(cat)) return 'daily_news';
  if (['contracts', 'transfers'].includes(cat)) {
    const text = storyText(item);
    if (PLAYER_SIGNED_RE.test(text)) return 'player_news';
    if (CLUB_CONTRACT_RE.test(text) || /\b(transfer fee|paid .+ fee)\b/i.test(text)) return 'club_news';
    return 'daily_news';
  }
  return 'daily_news';
}

function storyKindForBeat(item, beat) {
  if (beat === 'club_news') return clubStoryKind(item);
  if (beat === 'player_news') return playerStoryKind(item);
  if (beat === 'daily_news') return dailyStoryKind(item);
  if (beat === 'tournament' || beat === 'competitions') {
    const text = storyText(item);
    if (/won |lifted |champion/i.test(text)) return 'champion';
    if (/quarter|semi|round of 16|final/i.test(text)) return 'phase';
    if (/underway|kicked off|field is set/i.test(text)) return 'field';
    return 'cup';
  }
  return beat;
}

async function tournamentFieldFacts(tournament = {}) {
  const clubIds = parseJson(tournament.registered_clubs, []);
  const playerIds = parseJson(tournament.registered_players, []);
  let records = [];
  if (Array.isArray(clubIds) && clubIds.length) {
    const ids = clubIds.map(String);
    records = await EXECUTESQL(
      `SELECT country_code FROM clubs WHERE id IN (${ids.map(() => '?').join(',')})`,
      ids,
    ).catch(() => []);
  } else if (Array.isArray(playerIds) && playerIds.length) {
    const ids = playerIds.map(String);
    records = await EXECUTESQL(
      `SELECT country_code, country FROM players WHERE id IN (${ids.map(() => '?').join(',')})`,
      ids,
    ).catch(() => []);
  }
  let trophyName = null;
  let trophyUrl = tournament.trophy_url || null;
  if (tournament.trophy_item_id) {
    const rows = await EXECUTESQL(
      'SELECT name, image_url FROM trophy_items WHERE id = ? LIMIT 1',
      [tournament.trophy_item_id],
    ).catch(() => []);
    trophyName = rows[0]?.name || null;
    trophyUrl = rows[0]?.image_url || trophyUrl;
  }
  return {
    entries: registeredCount(tournament),
    countries: participatingCountries(records),
    trophyName,
    trophyUrl,
  };
}

async function publishRankingBulletin(summary = {}) {
  const top = Array.isArray(summary.players) ? summary.players.slice(0, 5) : [];
  if (!top.length) return null;
  const leader = top[0];
  const name = leader.gamertag || leader.player_name || leader.name || 'A player';
  const body = top
    .map((row, index) => `${index + 1}. ${row.gamertag || row.player_name || row.name} — ${Number(row.ranking_points || 0).toLocaleString()} pts`)
    .join('\n');
  return publishNewsItem({
    title: `${name} leads the STAGE ranking`,
    body,
    type: 'ranking',
    category: 'ranking',
    tags: ['player_news'],
    player_id: leader.id || leader.player_id || null,
    player_name: name,
    player_avatar_url: leader.avatar_url || null,
    link: '/rankings',
  });
}

function isPublishedToday(value, now = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const current = now instanceof Date ? now : new Date(now);
  return date.getUTCFullYear() === current.getUTCFullYear()
    && date.getUTCMonth() === current.getUTCMonth()
    && date.getUTCDate() === current.getUTCDate();
}

async function publishClubTrophyStory(tournament, winner = {}) {
  if (!winner?.name) return null;
  const facts = await tournamentFieldFacts(tournament);
  const trophy = facts.trophyName || tournament.name;
  const isPlayer = String(tournament.participant_type || '').toLowerCase() === 'player';
  return publishNewsItem({
    title: `${winner.name} lifted the ${trophy} trophy`,
    body: `${winner.name} won ${tournament.name}.${facts.entries ? ` ${facts.entries} sides entered.` : ''}${facts.countries.length ? ` ${facts.countries.length} countries were in the field.` : ''}`,
    type: isPlayer ? 'player_news' : 'trophy',
    category: isPlayer ? 'player_news' : 'trophy',
    tags: [isPlayer ? 'player_news' : 'club_news'],
    club_id: isPlayer ? null : (winner.id || null),
    club_name: isPlayer ? null : winner.name,
    player_id: isPlayer ? (winner.id || null) : null,
    player_name: isPlayer ? winner.name : null,
    tournament_id: tournament.id || null,
    tournament_name: tournament.name || null,
    link: isPlayer && winner.id ? `/players/${winner.id}` : (winner.id ? `/clubs/${winner.id}` : ''),
  });
}

module.exports = {
  buildPhaseBoard,
  clubStoryKind,
  currentPhaseStamp,
  dailyStoryKind,
  isLeagueCompetition,
  isPublishedToday,
  newsSectionForTournament,
  participatingCountries,
  phaseLabel,
  phaseStamp,
  playerStoryKind,
  publishClubTrophyStory,
  publishNewsItem,
  publishRankingBulletin,
  publishTournamentStory,
  registeredCount,
  storyBeat,
  storyKindForBeat,
  tournamentFieldCard,
  tournamentFieldFacts,
  tournamentKickoffCopy,
};

'use strict';

const parse = (value, fallback = {}) => { try { return typeof value === 'string' ? JSON.parse(value) : value || fallback; } catch { return fallback; } };
const yes = value => value === true || value === 1 || value === '1';
const confirmedStates = new Set(['confirmed', 'auto_confirmed_timeout', 'admin_confirmed', 'admin_resolved']);
function isConfirmedResult(match) {
  if (!['completed', 'forfeit'].includes(String(match.status))) return false;
  const state = String(match.result_state || '').toLowerCase();
  if (state && !confirmedStates.has(state)) return false;
  return match.status === 'forfeit' || confirmedStates.has(state) || yes(match.stats_processed);
}
function ranking(rows, key, ascending = false, activity = 'appearances') {
  const sorted = [...rows].sort((a, b) => Number(b[activity] > 0) - Number(a[activity] > 0)
    || Number(a[key] == null) - Number(b[key] == null)
    || (ascending ? 1 : -1) * ((a[key] ?? 0) - (b[key] ?? 0))
    || String(a.name).localeCompare(String(b.name)) || String(a.id).localeCompare(String(b.id)));
  let rank = 0;
  return sorted.map((row, index) => {
    const previous = sorted[index - 1];
    if (!previous || row[key] !== previous[key] || Boolean(row[activity]) !== Boolean(previous[activity])) rank = index + 1;
    return { ...row, rank: row[activity] > 0 && row[key] != null ? rank : null };
  });
}

function aggregateTournamentStatistics(tournament, matchRows, statRows, participants = [], playerProfiles = []) {
  const playerTournament = tournament.participant_type === 'player';
  const kind = playerTournament ? 'player' : 'club';
  const registered = parse(tournament[playerTournament ? 'registered_players' : 'registered_clubs'], []);
  const profiles = new Map(participants.map(p => [String(p.id), p]));
  const playerMap = new Map(playerProfiles.map(p => [String(p.id), p]));
  const totals = new Map();
  const ensure = (id, name) => {
    if (!id) return null;
    id = String(id);
    if (!totals.has(id)) {
      const profile = profiles.get(id);
      totals.set(id, { id, name: profile?.gamertag || profile?.name || name || 'Participant', avatar: profile?.avatar_url || profile?.logo_url || null, appearances: 0, goals: 0, conceded: 0 });
    }
    return totals.get(id);
  };
  registered.forEach(id => ensure(id));
  const matches = new Map();
  for (const match of matchRows) {
    if (String(match.tournament_id) !== String(tournament.id)) continue;
    ensure(match[`home_${kind}_id`], match[`home_${kind}_name`]);
    ensure(match[`away_${kind}_id`], match[`away_${kind}_name`]);
    if (isConfirmedResult(match)) matches.set(String(match.id), match);
  }
  for (const match of matches.values()) {
    if (match.home_score == null || match.away_score == null) continue;
    for (const side of ['home', 'away']) {
      const row = ensure(match[`${side}_${kind}_id`], match[`${side}_${kind}_name`]);
      if (!row) continue;
      row.appearances++;
      row.goals += Number(match[`${side}_score`]);
      row.conceded += Number(match[`${side === 'home' ? 'away' : 'home'}_score`]);
    }
  }
  const individual = new Map();
  const seen = new Set();
  for (const stat of [...statRows].sort((a, b) => String(b.created_date || '').localeCompare(String(a.created_date || '')) || String(b.id || '').localeCompare(String(a.id || '')))) {
    if (yes(stat.is_superseded)) continue;
    const match = matches.get(String(stat.match_id));
    if (!match || match.status !== 'completed' || yes(match.administrative_result) || playerTournament || !stat.player_id || !stat.club_id) continue;
    const side = String(stat.club_id) === String(match.home_club_id) ? 'home' : String(stat.club_id) === String(match.away_club_id) ? 'away' : null;
    if (!side) continue;
    const report = parse(match[`${side}_submission`]);
    const reportStat = (report.player_stats || []).find(p => String(p.player_id) === String(stat.player_id));
    const ids = (report.participating_player_ids || []).map(String);
    const events = parse(match[`${side}_goal_events`], []);
    const eventEvidence = events.some(e => [e.scorer_player_id, e.assist_player_id].filter(Boolean).map(String).includes(String(stat.player_id)));
    if (!yes(stat.participation_verified) && !(reportStat && ids.includes(String(stat.player_id))) && !eventEvidence) continue;
    const appearanceKey = `${match.id}:${stat.player_id}`;
    if (seen.has(appearanceKey)) continue;
    seen.add(appearanceKey);
    const key = `${stat.player_id}:${stat.club_id}`;
    if (!individual.has(key)) individual.set(key, { id: key, player_id: stat.player_id, club_id: stat.club_id, club_name: match[`${side}_club_name`] || 'Club', name: stat.player_gamertag || playerMap.get(String(stat.player_id))?.gamertag || 'Player', avatar: playerMap.get(String(stat.player_id))?.avatar_url || null, appearances: 0, goals: 0, assists: 0, awards: 0, rating_sum: 0, rated_matches: 0, goalkeeper_appearances: 0, goalkeeper_rated_matches: 0, goalkeeper_rating_sum: 0, goalkeeper_conceded: 0, clean_sheets: 0 });
    const row = individual.get(key);
    row.appearances++;
    row.goals += Number(stat.goals || 0); row.assists += Number(stat.assists || 0);
    row.awards += yes(stat.is_motm) ? 1 : 0;
    const rating = stat.rating != null && stat.rating !== '' ? Number(stat.rating) : null;
    const rated = rating != null && Number.isFinite(rating) && rating >= 1 && rating <= 10;
    if (rated) { row.rating_sum += rating; row.rated_matches++; }
    const fullKeeper = String(stat.position || reportStat?.position || '').toUpperCase() === 'GK' && (yes(stat.goalkeeper_full_match) || yes(reportStat?.goalkeeper_full_match));
    if (fullKeeper) {
      const conceded = Number(match[`${side === 'home' ? 'away' : 'home'}_score`]);
      row.goalkeeper_appearances++; row.goalkeeper_conceded += conceded;
      if (conceded === 0) row.clean_sheets++;
      if (rated) { row.goalkeeper_rating_sum += rating; row.goalkeeper_rated_matches++; }
    }
  }
  const players = [...individual.values()].map(row => ({ ...row, average_rating: row.rated_matches ? row.rating_sum / row.rated_matches : null, goalkeeper_average_rating: row.goalkeeper_rated_matches ? row.goalkeeper_rating_sum / row.goalkeeper_rated_matches : null, conceded_per_match: row.goalkeeper_appearances ? row.goalkeeper_conceded / row.goalkeeper_appearances : null }));
  const keepers = players.filter(p => p.goalkeeper_appearances > 0);
  return {
    participant_type: kind, confirmed_matches: matches.size,
    participants: { goals: ranking([...totals.values()], 'goals'), conceded: ranking([...totals.values()], 'conceded'), fewest_conceded: ranking([...totals.values()], 'conceded', true) },
    players: playerTournament ? null : { goals: ranking(players, 'goals'), assists: ranking(players, 'assists'), rating: ranking(players, 'average_rating'), awards: ranking(players, 'awards'), appearances: ranking(players, 'appearances') },
    goalkeepers: playerTournament ? null : { clean_sheets: ranking(keepers, 'clean_sheets', false, 'goalkeeper_appearances'), conceded_per_match: ranking(keepers, 'conceded_per_match', true, 'goalkeeper_appearances'), rating: ranking(keepers, 'goalkeeper_average_rating', false, 'goalkeeper_appearances') },
  };
}
const CATEGORIES = [
  { key: 'most_goals_scored', title: 'Most Goals Scored', scope: 'participant', group: 'participants', list: 'goals', types: ['player', 'club'] },
  { key: 'most_goals_conceded', title: 'Most Goals Conceded', scope: 'participant', group: 'participants', list: 'conceded', types: ['player', 'club'] },
  { key: 'fewest_goals_conceded', title: 'Fewest Goals Conceded', scope: 'participant', group: 'participants', list: 'fewest_conceded', types: ['player', 'club'] },
  { key: 'top_scorers', title: 'Top Scorers', scope: 'player', group: 'players', list: 'goals', types: ['club'] },
  { key: 'top_assists', title: 'Top Assists', scope: 'player', group: 'players', list: 'assists', types: ['club'] },
  { key: 'highest_average_rating', title: 'Highest Average Rating', scope: 'player', group: 'players', list: 'rating', types: ['club'] },
  { key: 'most_player_of_the_match', title: 'Most Player of the Match Awards', scope: 'player', group: 'players', list: 'awards', types: ['club'] },
  { key: 'most_appearances', title: 'Most Appearances', scope: 'player', group: 'players', list: 'appearances', types: ['club'] },
  { key: 'most_clean_sheets', title: 'Most Clean Sheets', scope: 'goalkeeper', group: 'goalkeepers', list: 'clean_sheets', types: ['club'] },
  { key: 'fewest_goals_conceded_per_match', title: 'Fewest Goals Conceded per Match', scope: 'goalkeeper', group: 'goalkeepers', list: 'conceded_per_match', types: ['club'] },
  { key: 'highest_average_goalkeeper_rating', title: 'Highest Average Goalkeeper Rating', scope: 'goalkeeper', group: 'goalkeepers', list: 'rating', types: ['club'] },
];

function statisticsCategories(participantType) {
  const type = participantType === 'player' ? 'player' : 'club';
  return CATEGORIES.filter((category) => category.types.includes(type)).map(({ key, title, scope }) => ({ key, title, scope }));
}

function dataStatus(row, scope) {
  if (scope === 'goalkeeper') return row.goalkeeper_appearances > 0 ? 'verified_goalkeeper' : 'no_verified_goalkeeper';
  if (Number(row.appearances) > 0) return 'recorded';
  return scope === 'participant' ? 'no_confirmed_matches' : 'no_recorded_statistics';
}

function parseStatisticsPage(query = {}) {
  const limit = query.limit === undefined ? 20 : Number(query.limit);
  const offset = query.offset === undefined ? 0 : Number(query.offset);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    const error = new Error('limit must be an integer from 1 to 100');
    error.status = 400;
    throw error;
  }
  if (!Number.isInteger(offset) || offset < 0) {
    const error = new Error('offset must be an integer of 0 or more');
    error.status = 400;
    throw error;
  }
  return { limit, offset };
}

function pageStatisticsCategory(statistics, categoryKey, query = {}) {
  const category = CATEGORIES.find((item) => item.key === categoryKey && item.types.includes(statistics.participant_type === 'player' ? 'player' : 'club'));
  if (!category) {
    const error = new Error('Unknown statistics category for this tournament');
    error.status = 400;
    throw error;
  }
  const page = parseStatisticsPage(query);
  const source = statistics[category.group]?.[category.list] || [];
  const rows = source.slice(page.offset, page.offset + page.limit).map((row) => ({
    ...row,
    badge: row.avatar || null,
    data_status: dataStatus(row, category.scope),
    played: Number(row.appearances) > 0,
  }));
  return {
    participant_type: statistics.participant_type,
    category: { key: category.key, title: category.title, scope: category.scope },
    order: ['activity', 'value', 'name', 'id'],
    tie_policy: 'equal_primary_values_share_rank',
    total: source.length,
    limit: page.limit,
    offset: page.offset,
    has_more: page.offset + rows.length < source.length,
    rows,
  };
}

module.exports = {
  aggregateTournamentStatistics,
  isConfirmedResult,
  ranking,
  statisticsCategories,
  pageStatisticsCategory,
};

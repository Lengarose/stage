const assert = require('node:assert/strict');
const test = require('node:test');
const { aggregateTournamentStatistics: aggregate } = require('../tournamentStatistics');
const tournament = { id: 'cup', participant_type: 'club', registered_clubs: ['a', 'b', 'c'] };
const match = { id: 'm1', tournament_id: 'cup', status: 'completed', result_state: 'CONFIRMED', home_club_id: 'a', away_club_id: 'b', home_club_name: 'Historic A', away_club_name: 'B', home_score: 2, away_score: 0 };
const stat = { id: 's1', match_id: 'm1', player_id: 'p', player_gamertag: 'Player', club_id: 'a', participation_verified: 1, goals: 0, assists: 0, rating: null };
test('all participants remain present; inactive participants do not lead defensive rankings', () => {
  const t = { id: 'cup', participant_type: 'player', registered_players: Array.from({ length: 16 }, (_, i) => `p${i}`) };
  const m = { ...match, home_player_id: 'p0', away_player_id: 'p1', home_score: 3, away_score: 2 };
  const result = aggregate(t, [m, m, { ...m, id: 'other', tournament_id: 'elsewhere' }], []);
  assert.equal(result.participants.goals.length, 16);
  assert.equal(result.participants.goals[0].goals, 3);
  assert.equal(result.participants.fewest_conceded[0].id, 'p0');
  assert.equal(result.participants.fewest_conceded.at(-1).appearances, 0);
  assert.equal(result.players, null);
});
test('unconfirmed, voided, cancelled and bye results never inflate totals', () => {
  const variants = ['scheduled', 'cancelled', 'bye', 'disputed'].map((status, i) => ({ ...match, id: String(i), status }));
  variants.push({ ...match, id: 'pending', result_state: 'AWAITING_AWAY_CONFIRMATION' }, { ...match, id: 'void', result_state: 'VOIDED' });
  assert.equal(aggregate(tournament, variants, []).confirmed_matches, 0);
});
test('club totals come from the score, appearances require evidence, duplicate rows count once', () => {
  const result = aggregate(tournament, [match], [stat, stat, { ...stat, id: 'bench', player_id: 'bench', participation_verified: null }]);
  assert.equal(result.participants.goals[0].goals, 2);
  assert.equal(result.players.appearances.length, 1);
  assert.equal(result.players.appearances[0].appearances, 1);
  assert.equal(result.players.goals[0].goals, 0);
});
test('missing ratings do not become zero; averages use the numeric value and historical club', () => {
  const second = { ...match, id: 'm2', home_club_id: 'b', away_club_id: 'a', home_club_name: 'B', away_club_name: 'Historic A' };
  const result = aggregate(tournament, [match, second], [stat, { ...stat, id: 's2', match_id: 'm2', rating: 8.5 }], [], [{ id: 'p', club_id: 'new-club' }]);
  const row = result.players.rating[0];
  assert.equal(row.appearances, 2); assert.equal(row.rated_matches, 1); assert.equal(row.average_rating, 8.5);
  assert.equal(row.club_id, 'a'); assert.equal(row.club_name, 'Historic A');
});
test('players representing multiple clubs have separate rows; equal totals share sporting rank', () => {
  const m2 = { ...match, id: 'm2' };
  const result = aggregate(tournament, [match, m2], [stat, { ...stat, id: 's2', match_id: 'm2', club_id: 'b' }]);
  assert.equal(result.players.goals.length, 2);
  assert.equal(result.players.goals[0].rank, result.players.goals[1].rank);
});
test('only full-match goalkeeper participation qualifies; rating is optional', () => {
  const keeper = { ...stat, position: 'GK', goalkeeper_full_match: 1 };
  const notKeeper = { ...stat, id: 's2', player_id: 'defender', position: 'CB', goalkeeper_full_match: 1 };
  const result = aggregate(tournament, [match], [keeper, notKeeper]);
  assert.equal(result.goalkeepers.clean_sheets.length, 1);
  assert.equal(result.goalkeepers.clean_sheets[0].clean_sheets, 1);
  assert.equal(result.goalkeepers.rating[0].goalkeeper_rated_matches, 0);
  assert.equal(result.goalkeepers.rating[0].goalkeeper_average_rating, null);
});
test('administrative forfeits never create footballer appearances and superseded stats stay excluded', () => {
  assert.equal(aggregate(tournament, [{ ...match, status: 'forfeit' }], [stat]).players.appearances.length, 0);
  assert.equal(aggregate(tournament, [match], [{ ...stat, is_superseded: 1 }]).players.appearances.length, 0);
  assert.equal(aggregate(tournament, [{ ...match, home_score: 5 }], []).participants.goals[0].goals, 5);
});
test('historical reports can establish zero-goal appearances but an unused bench cannot', () => {
  const m = { ...match, home_submission: JSON.stringify({ participating_player_ids: ['p'], player_stats: [stat, { ...stat, player_id: 'bench' }] }) };
  const result = aggregate(tournament, [m], [{ ...stat, participation_verified: null }, { ...stat, id: 'bench', player_id: 'bench', participation_verified: null }]);
  assert.equal(result.players.appearances.length, 1);
});

test('goalkeeper averages, rating samples and explicit awards remain separate', () => {
  const second = { ...match, id: 'm2', away_score: 3 };
  const keeper = { ...stat, position: 'GK', goalkeeper_full_match: 1, is_motm: 1, rating: 8.222 };
  const result = aggregate(tournament, [match, second], [keeper, { ...keeper, id: 's2', match_id: 'm2', rating: null, is_motm: 0 }]);
  const row = result.goalkeepers.conceded_per_match[0];
  assert.equal(row.goalkeeper_appearances, 2); assert.equal(row.goalkeeper_conceded, 3);
  assert.equal(row.conceded_per_match, 1.5); assert.equal(row.clean_sheets, 1);
  assert.equal(row.goalkeeper_average_rating, 8.222); assert.equal(row.goalkeeper_rated_matches, 1);
  assert.equal(result.players.awards[0].awards, 1);
});

const assert = require('node:assert/strict');
const test = require('node:test');
const { planTournamentProgression: plan, resolvedTie, eligibleThird } = require('../tournamentProgression');
const cup = { id: 'cup', status: 'in_progress', type: 'knockout', participant_type: 'club' };
const m = (i, extra = {}) => ({ id: `m${i}`, round: 1, type: 'knockout', group_number: i, home_club_id: `h${i}`, away_club_id: `a${i}`, home_club_name: `H${i}`, away_club_name: `A${i}`, home_score: 2, away_score: 1, status: 'completed', result_state: 'CONFIRMED', ...extra });
test('clubs wait for the entire round and make one persisted target per pairing', () => {
  const rows = [0, 1, 2, 3].map(i => m(i));
  assert.equal(plan(cup, rows.map((r, i) => i === 3 ? { ...r, status: 'scheduled' } : r)).fixtures.length, 0);
  const next = plan(cup, rows, list => list);
  assert.equal(next.fixtures.length, 2);
  assert.deepEqual(next.fixtures.map(f => f.home.id), ['h0', 'h2']);
  assert.equal(new Set(next.fixtures.map(f => f.progression_key)).size, 2);
});
test('an unconfirmed final required result blocks the draw', () => {
  assert.equal(plan(cup, [m(0), m(1, { result_state: 'DISPUTED' })]).fixtures.length, 0);
});
test('player winners fill bracket slots individually; no schedulable unknown opponent', () => {
  const t = { ...cup, participant_type: 'player' };
  const rows = [0, 1].map(i => m(i, { home_player_id: `p${i}`, away_player_id: `q${i}`, status: i === 1 ? 'scheduled' : 'completed' }));
  const next = plan(t, rows);
  assert.equal(next.fixtures.length, 1);
  assert.equal(next.fixtures[0].home.id, 'p0'); assert.equal(next.fixtures[0].away, null);
});
test('two-leg results require both legs and never mistake a leg winner for an aggregate winner', () => {
  const first = m(0, { type: 'semi_final' });
  const second = m(0, { id: 'return', round: 2, home_club_id: 'a0', away_club_id: 'h0', home_score: 1, away_score: 0, winner_club_id: 'a0' });
  assert.equal(resolvedTie([first], cup, 2), null);
  assert.equal(resolvedTie([first, second], cup, 2), null);
  assert.equal(resolvedTie([first, { ...second, decided_on_penalties: 1, penalty_winner_side: 'away' }], cup, 2).winner.id, 'h0');
});
test('semifinal losers create exactly one single-match Third-Place Playoff', () => {
  const next = plan(cup, [m(0), m(1)], list => list);
  assert.equal(next.fixtures.filter(f => f.type === 'third_place').length, 1);
  const third = next.fixtures.find(f => f.type === 'third_place');
  assert.deepEqual([third.home.id, third.away.id], ['a0', 'a1']);
  assert.equal(eligibleThird({ type: 'swiss_ucl' }), false); assert.equal(eligibleThird({ type: 'league' }), false); assert.equal(eligibleThird({ type: 'double_elimination' }), false);
});
test('incorrect third-place records with activity conflict; idle records are safely identified', () => {
  const t = { ...cup, type: 'swiss_ucl' };
  const third = m(9, { type: 'third_place', status: 'unscheduled', result_state: null });
  assert.deepEqual(plan(t, [third]).remove, ['m9']);
  assert.equal(plan(t, [{ ...third, scheduled_date: '2026-10-23 18:00:00' }]).conflicts.length, 1);
  assert.equal(plan(t, [{ ...third, status: 'completed' }]).remove.length, 0);
});
test('league-only tournaments finish from standings without a knockout round', () => {
  const result = plan({ ...cup, type: 'league' }, [m(0, { type: 'league' })]);
  assert.equal(result.completed, true); assert.equal(result.winner.id, 'h0'); assert.equal(result.fixtures.length, 0);
});
test('group qualification waits for the whole phase and uses cross-group restrictions', () => {
  const rows = [m(0, { type: 'group', group_number: 0 }), m(1, { type: 'group', group_number: 1 })];
  const t = { ...cup, type: 'group_stage', num_groups: 2 };
  assert.equal(plan(t, [rows[0], { ...rows[1], status: 'disputed' }]).fixtures.length, 0);
  const next = plan(t, rows);
  assert.equal(next.fixtures.length, 4);
  assert.deepEqual([next.fixtures[0].home.id, next.fixtures[0].away.id], ['h0', 'a1']);
});
test('byes resolve qualification without played scores', () => {
  const result = resolvedTie([m(0, { away_club_id: null, status: 'bye', home_score: null, away_score: null })], cup);
  assert.equal(result.winner.id, 'h0'); assert.equal(result.loser, null);
});

test('a bye cannot invent a semifinal loser or a third-place opponent', () => {
  const result = plan(cup, [m(0), m(1, { status: 'bye', away_club_id: null })], list => list);
  assert.equal(result.fixtures.filter(f => f.type === 'final').length, 1);
  assert.equal(result.fixtures.filter(f => f.type === 'third_place').length, 0);
});
test('two-legged club rounds wait for the final required second leg', () => {
  const firsts = [m(0, { type: 'semi_final' }), m(1, { type: 'semi_final' })];
  const returns = firsts.map(r => ({ ...r, id: `${r.id}-return`, round: 2, home_club_id: r.away_club_id, away_club_id: r.home_club_id, home_score: 0, away_score: 2 }));
  const t = { ...cup, knockout_legs: 2 };
  assert.equal(plan(t, [...firsts, returns[0], { ...returns[1], status: 'scheduled' }]).fixtures.length, 0);
  assert.deepEqual(plan(t, [...firsts, ...returns]).fixtures.map(f => f.type), ['final', 'third_place']);
});
test('a complete player bracket reaches completion after its populated successor is unchanged', () => {
  const t = { ...cup, participant_type: 'player' };
  const semis = [0, 1].map(i => m(i, { home_player_id: `p${i}`, away_player_id: `q${i}` }));
  const generated = plan(t, semis).fixtures.map((f, i) => ({ ...m(i + 10), id: `generated-${i}`, type: f.type, round: f.round, group_number: f.group_number, progression_key: f.progression_key, home_player_id: f.home.id, away_player_id: f.away.id }));
  assert.equal(plan(t, [...semis, ...generated]).completed, true);
});
test('reconciliation repairs a missing playoff beside an existing idle final', () => {
  const final = m(3, { type: 'final', round: 2, status: 'unscheduled', result_state: null, home_club_id: 'h0', away_club_id: 'h1' });
  const result = plan(cup, [m(0), m(1), final]);
  assert.deepEqual(result.fixtures.map(f => f.type), ['third_place']);
  assert.equal(plan(cup, [m(0), m(1), { ...final, status: 'completed', result_state: 'CONFIRMED' }]).conflicts.length, 1);
});
test('a premature idle club successor is removed; an active successor requires review', () => {
  const rows = [m(0), m(1, { status: 'scheduled' }), m(2, { round: 2, type: 'final', status: 'unscheduled', result_state: null })];
  assert.deepEqual(plan(cup, rows).remove, ['m2']);
  assert.equal(plan(cup, rows.map(r => r.id === 'm2' ? { ...r, scheduled_date: '2026-10-23 18:00:00' } : r)).conflicts.length, 1);
});
test('UCL qualification waits for all eight matchdays and never adds a third-place playoff', () => {
  const t = { ...cup, type: 'swiss_ucl' };
  const league = Array.from({ length: 8 }, (_, r) => Array.from({ length: 18 }, (_, i) => m(r * 18 + i, { type: 'ucl_league', round: r + 1, home_club_id: `c${i * 2}`, away_club_id: `c${i * 2 + 1}`, home_score: i + 2 }))).flat();
  assert.equal(plan(t, league.slice(0, 126)).fixtures.length, 0);
  assert.equal(plan(t, [...league.slice(0, -1), { ...league.at(-1), status: 'disputed' }]).fixtures.length, 0);
  const next = plan(t, league);
  assert.equal(next.fixtures.length, 16);
  assert(next.fixtures.every(f => f.type === 'ucl_playoff'));
});

test('a resolved UCL player playoff tie advances independently; the equivalent club phase waits', () => {
  const t = { ...cup, type: 'swiss_ucl', participant_type: 'player' };
  const league = Array.from({ length: 8 }, (_, r) => Array.from({ length: 18 }, (_, i) => m(r * 18 + i, { type: 'ucl_league', round: r + 1, home_player_id: `p${i * 2}`, away_player_id: `p${i * 2 + 1}`, home_score: i + 2 }))).flat();
  const playoffs = plan(t, league).fixtures.map((f, i) => m(200 + i, { type: f.type, round: f.round, group_number: f.group_number, home_player_id: f.home.id, away_player_id: f.away.id, home_score: f.round === 9 ? 2 : 0, away_score: f.round === 9 ? 0 : 1, status: f.group_number === 0 ? 'completed' : 'scheduled' }));
  const next = plan(t, [...league, ...playoffs]);
  assert.equal(next.fixtures.length, 2);
  assert(next.fixtures.every(f => f.type === 'ucl_r16' && f.home && f.away));
  const clubs = [...league, ...playoffs].map(row => ({ ...row, home_club_id: row.home_player_id, away_club_id: row.away_player_id }));
  assert.equal(plan({ ...t, participant_type: 'club' }, clubs).fixtures.length, 0);
});

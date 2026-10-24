import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { calculateStandings } from '../standingsCore.js';
import { calculateLeagueStandings, calculateUCLStandings } from '../tournamentEngine.js';
const require = createRequire(import.meta.url);
const server = require('../../../server/src/server/lib/standingsCore.js');
const { planTournamentProgression } = require('../../../server/src/server/lib/tournamentProgression.js');

test('server must not pick an arbitrary league champion from unresolved sporting ties', () => {
  const plan = planTournamentProgression({ id: 't', type: 'league', status: 'in_progress', participant_type: 'player', registered_players: ['a', 'b'] }, [
    { id: 'x', tournament_id: 't', type: 'league', status: 'completed', result_state: 'CONFIRMED', home_player_id: 'a', away_player_id: 'b', home_score: 1, away_score: 1 },
    { id: 'y', tournament_id: 't', type: 'league', status: 'completed', result_state: 'CONFIRMED', home_player_id: 'b', away_player_id: 'a', home_score: 1, away_score: 1 },
  ]);
  assert.equal(plan.completed, false);
  assert.ok(plan.conflicts.length);
});

test('cross-runtime standings adapters stay identical', () => {
  const options = { participants: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] };
  assert.deepEqual(calculateStandings([], options), server.calculateStandings([], options));
});

for (const participant_type of ['player', 'club']) {
  for (const [type, calculate] of [['league', calculateLeagueStandings], ['ucl_league', calculateUCLStandings]]) {
    const roster = Array.from({ length: 20 }, (_, i) => ({ id: String(i + 1), name: `Entrant ${i + 1}` }));
    const options = { participant_type, participants: roster, tournament_id: 't' };
    const match = (i = 0) => ({ id: `m${i}`, tournament_id: 't', type, status: 'completed', result_state: 'confirmed',
      [`home_${participant_type}_id`]: String(i * 2 + 1), [`away_${participant_type}_id`]: String(i * 2 + 2), home_score: 2, away_score: 1 });
    test(`${participant_type} ${type}: all twenty registered entrants start at zero`, () => {
      const rows = calculate([], options);
      assert.equal(rows.length, 20);
      assert.ok(rows.every(r => r.name && r.P === 0 && r.Pts === 0));
    });
    test(`${participant_type} ${type}: ten score-only wins preserve identities and invariants`, () => {
      const rows = calculate(Array.from({ length: 10 }, (_, i) => match(i)), options);
      assert.equal(rows.length, 20);
      assert.equal(rows.filter(r => r.W === 1 && r.Pts === 3).length, 10);
      assert.equal(rows.reduce((n, r) => n + r.P, 0), 20);
      assert.equal(rows.reduce((n, r) => n + r.GF - r.GA, 0), 0);
      assert.ok(rows.every(r => r.P === r.W + r.D + r.L && r.GD === r.GF - r.GA));
    });
    test(`${participant_type} ${type}: partial results, invalid identities and duplicate representations`, () => {
      const valid = match();
      const rows = calculate([valid, { ...valid }, { ...match(1), [`home_${participant_type}_id`]: null },
        { ...match(2), [`away_${participant_type}_id`]: '5' }], options);
      assert.equal(rows.length, 20);
      assert.equal(rows.reduce((n, r) => n + r.P, 0), 2);
    });
    test(`${participant_type} ${type}: scope, confirmation and missing scores are enforced`, () => {
      const rows = calculate([match(), ...[
        { id: 'pending', result_state: 'submitted' }, { id: 'disputed', result_state: 'disputed' },
        { id: 'preview', status: 'scheduled' }, { id: 'void', status: 'voided' },
        { id: 'other', tournament_id: 'other' }, { id: 'knockout', type: 'final' },
        { id: 'missing', home_score: null }, { id: 'negative', home_score: -1 },
        { id: 'fraction', home_score: 1.5 }, { id: 'bye', status: 'bye' },
        { id: 'obsolete', obsolete: true }, { id: 'preview-flag', is_preview: true },
        { id: 'winner', [`winner_${participant_type}_id`]: '2' },
      ].map(patch => ({ ...match(), ...patch }))], options);
      assert.equal(rows.reduce((n, r) => n + r.P, 0), 2);
    });
    test(`${participant_type} ${type}: normalized duplicate registration, draws and administrative awards`, () => {
      const opts = { ...options, participants: [...roster, { id: 1, name: 'Duplicate' }] };
      const draw = { ...match(), home_score: 0, away_score: 0, [`home_${participant_type}_id`]: 1 };
      let rows = calculate([draw], opts);
      assert.equal(rows.length, 20);
      assert.equal(rows.filter(r => r.D === 1 && r.Pts === 1).length, 2);
      const forfeit = { ...draw, status: 'forfeit', [`winner_${participant_type}_id`]: '2' };
      rows = calculate([forfeit], opts);
      assert.equal(rows.find(r => r.id === '2').W, 1);
      assert.equal(rows.find(r => r.id === '2').Pts, 3);
      const serverOptions = { ...opts, phase: type };
      assert.deepEqual(calculateStandings([forfeit], serverOptions), server.calculateStandings([forfeit], serverOptions));
    });
    test(`${participant_type} ${type}: missing profile remains distinct; corrected result replaces totals`, () => {
      const unresolved = calculateStandings([match()], { ...options, phase: type, participants: roster.map(p => p.id === '1' ? { id: p.id } : p) });
      assert.ok(unresolved.issues.some(i => i.code === 'missing_profile'));
      assert.match(unresolved.rows.find(r => r.id === '1').name, /Unavailable/);
      const corrected = calculate([{ ...match(), home_score: 0, away_score: 3 }], options);
      assert.equal(corrected.find(r => r.id === '2').Pts, 3);
      assert.equal(corrected.find(r => r.id === '1').GF, 0);
    });
    test(`${participant_type} ${type}: edition isolation and conflicting duplicates cannot inflate totals`, () => {
      const result = calculateStandings([{ ...match(), edition_id: 'current' }, { ...match(1), edition_id: 'previous' }], { ...options, phase: type, edition_id: 'current' });
      assert.equal(result.counted, 1);
      const conflict = calculateStandings([match(), { ...match(), home_score: 5 }], { ...options, phase: type });
      assert.equal(conflict.counted, 0);
      assert.ok(conflict.issues.some(i => i.code === 'conflicting_duplicate'));
    });
  }
}

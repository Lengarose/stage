const test = require('node:test');
const assert = require('node:assert/strict');
const { reviewStandings } = require('../standingIntegrity');
function scope() {
  return { source_type: 'regional_league', edition_id: 'l:1', root: { id: 'l', registered_club_ids: ['a','b','c'] },
    participants: ['a','b','c'].map(id => ({ id, name: id })),
    standings: [{ id: 'sa', club_id: 'a', played: 9 }, { id: 'duplicate', club_id: 'a' }],
    matches: [{ id: 'm', tournament_id: 'l', type: 'league', status: 'completed', result_state: 'CONFIRMED', home_club_id: 'a', away_club_id: 'b', home_score: 2, away_score: 1 }] };
}
test('review finds missing/duplicate rows and rebuilds totals without summing duplicates', () => {
  const r = reviewStandings(scope());
  assert.deepEqual(r.missing, ['b','c']);
  assert.deepEqual(r.duplicates, ['a']);
  assert.equal(r.expected.find(s => s.club_id === 'a').points, 3);
  assert.equal(r.expected.find(s => s.club_id === 'c').played, 0);
  assert.ok(r.mismatches.includes('a'));
});
test('uncertain history and invalid registrations prevent repairs', () => {
  const s = scope(); s.matches[0].home_score = null;
  assert.ok(reviewStandings(s).conflicts.length);
  delete s.root.registered_club_ids;
  assert.ok(reviewStandings(s).conflicts.includes('Authoritative registered_club_ids roster is unavailable'));
});

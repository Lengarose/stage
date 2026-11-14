import test from 'node:test';
import assert from 'node:assert/strict';
import { tournamentStartState } from '../tournamentStartState.js';
const t = { participant_type: 'club', max_teams: 2, registered_clubs: ['a', 'b'] };
const draw = [{ home_club_id: 'a', away_club_id: 'b', status: 'scheduled' }];
test('the Start control unlocks only for a saved draw of the full confirmed field', () => {
  assert.equal(tournamentStartState(t).canStart, false);
  assert.equal(tournamentStartState(t).canDraw, true);
  assert.equal(tournamentStartState(t, draw).canStart, true);
  assert.equal(tournamentStartState(t, draw).canDraw, false);
  assert.equal(tournamentStartState({ ...t, registered_clubs: ['a'] }, draw).canStart, false);
  assert.equal(tournamentStartState({ ...t, registered_clubs: ['a', 'replacement'] }, draw).canStart, false);
  assert.equal(tournamentStartState({ ...t, registration_proofs: { club: { b: { status: 'withdrawn' } } } }, draw).confirmed, 1);
});

'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { policy } = require('../tournamentWithdrawalService');
const { planTournamentProgression } = require('../../lib/tournamentProgression');
const future = { entries: [{ starts_at: '2030-01-01T19:00:00Z' }] };
const t = { status: 'registration', entry_credits: 50, entry_fee_stc: 100 };
const paid = { credits_spent: 50, stc_locked: 100, submitted_by_user_id: 'payer' };
test('immediate withdrawal ends at the draw or first published kickoff', () => {
  assert.equal(policy(t, [], future, paid, Date.parse('2029-01-01')).mode, 'immediate');
  assert.equal(policy(t, [{ status: 'unscheduled' }], future, paid, Date.parse('2029-01-01')).mode, 'request');
  assert.equal(policy(t, [], future, paid, Date.parse('2030-01-01T19:00:00Z')).mode, 'request');
  assert.equal(policy({ ...t, status: 'in_progress' }, [], future, paid).mode, 'request');
  assert.equal(policy({ ...t, status: 'completed' }, [], future, paid).mode, 'closed');
});
test('legacy missing payments require review; free Admin entry cannot manufacture a refund', () => {
  assert.equal(policy(t, [], future, null).mode, 'request');
  assert.equal(policy(t, [], future, { ...paid, credits_spent: 0, stc_locked: 0 }).mode, 'immediate');
});
test('an approved withdrawal pauses progression without inventing results', () => {
  const fixture = { id: 'unchanged', status: 'scheduled', home_score: 0, away_score: 0 };
  const plan = planTournamentProgression({ type: 'league', status: 'in_progress', registration_proofs: { club: { club: { status: 'withdrawn', withdrawal_resolution_required: true } } } }, [fixture]);
  assert.equal(plan.conflicts.length, 1); assert.deepEqual(plan.fixtures, []); assert.deepEqual(plan.remove, []);
  assert.equal(fixture.status, 'scheduled'); assert.equal(fixture.home_score, 0);
});

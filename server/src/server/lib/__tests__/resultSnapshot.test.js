const test = require('node:test');
const assert = require('node:assert/strict');
const { assertResultSnapshotCurrent } = require('../matchResultNegotiation');
const proposal = { home_score: 2, away_score: 2, decided_on_penalties: 0, penalty_winner_side: null, goal_events: [{ minute: 1, scorer_player_id: 'player' }], player_stats: [{ player_id: 'player', rating: 7, details: { played: true, role: 'ST' } }] };
const match = () => ({ status: 'in_progress', result_state: 'AWAITING_AWAY_CONFIRMATION', result_submit_side: 'home', correction_count: 0, home_counter_count: 0, home_submission: JSON.stringify(proposal), away_submission: null, result_history: [{ action: 'submit', side: 'home', data: { home_score: 2, away_score: 2 } }], home_dispute_submission: null, away_dispute_submission: null });
function reverseKeys(value) {
  if (Array.isArray(value)) return value.map(reverseKeys);
  return value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).reverse().map(([k, v]) => [k, reverseKeys(v)])) : value;
}
test('unchanged 2–2 proposal survives string/object, whitespace, reordered and nested keys', () => {
  for (const value of [proposal, JSON.stringify(proposal, null, 2), JSON.stringify(reverseKeys(proposal)), reverseKeys(proposal)]) {
    assert.doesNotThrow(() => assertResultSnapshotCurrent(match(), { ...match(), home_submission: value }));
  }
});
test('history object key ordering is not an event change, but history array order remains meaningful', () => {
  const original = match();
  assert.doesNotThrow(() => assertResultSnapshotCurrent(original, { ...original, result_history: JSON.stringify(reverseKeys(original.result_history)) }));
  const two = { ...original, result_history: [...original.result_history, { action: 'correction', side: 'away' }] };
  assert.throws(() => assertResultSnapshotCurrent(two, { ...two, result_history: [...two.result_history].reverse() }), { code: 'RESULT_CHANGED' });
});
test('real score, penalty winner, correction and terminal-state changes remain conflicts', () => {
  const original = match();
  for (const patch of [
    { result_submit_side: 'away' },
    { correction_count: 1 },
    { home_submission: { ...proposal, home_score: 3 } },
    { home_submission: { ...proposal, decided_on_penalties: 1, penalty_winner_side: 'away' } },
    { away_dispute_submission: { ...proposal, away_score: 3 } },
    { status: 'completed', result_state: 'CONFIRMED' },
    { result_state: 'AWAITING_HOME_REVIEW' },
  ]) assert.throws(() => assertResultSnapshotCurrent(original, { ...original, ...patch }), { code: 'RESULT_CHANGED' });
});

test('bookkeeping and presentation are not proposals; absent and empty submissions mean unsubmitted', () => {
  const original = match();
  assert.doesNotThrow(() => assertResultSnapshotCurrent(original, { ...original, stream_url: 'changed', updated_date: 'later', result_history: [...original.result_history, { event: 'reminder_sent', at: 'later' }] }));
  assert.doesNotThrow(() => assertResultSnapshotCurrent({ ...original, away_submission: undefined }, { ...original, away_submission: '' }));
  for (const patch of [{ home_submission: '{bad' }, { home_submission: '[]' }, { result_history: '{bad' }]) {
    const invalid = { ...original, ...patch };
    assert.throws(() => assertResultSnapshotCurrent(invalid, invalid), error => error.code === 'INVALID_RESULT_DATA' && !JSON.stringify(error.conflict).includes('player_stats'));
  }
});
test('legacy seven-field browser snapshots remain usable without ignoring their proposal/history', () => {
  const current = { ...match(), correction_count: 1 };
  const legacy = { ...current }; delete legacy.result_submit_side; delete legacy.correction_count; delete legacy.home_counter_count;
  assert.doesNotThrow(() => assertResultSnapshotCurrent(legacy,current));
  assert.throws(() => assertResultSnapshotCurrent(legacy,{ ...current, home_submission: { ...proposal, home_score: 3 } }), { code: 'RESULT_CHANGED' });
});

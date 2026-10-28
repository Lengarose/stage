import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resultSnapshot, sameResultSnapshot } from '../gameDayResultFlow.js';
const { assertResultSnapshotCurrent } = createRequire(import.meta.url)('../../../server/src/server/lib/matchResultNegotiation.js');
test('browser and server agree on semantic snapshots, meaningful history and lifecycle fields', () => {
  const before = { status: 'in_progress', result_state: 'AWAITING_AWAY_CONFIRMATION', home_submission: '{"home_score":2,"away_score":2}', result_history: [{ event: 'initial_result', side: 'home' }] };
  for (const patch of [{ home_submission: { away_score: 2, home_score: 2 } }, { result_history: '[{"side":"home","event":"initial_result"}]' }, { updated_date: 'later', stream_url: 'changed' }, { result_history: [...before.result_history, { event: 'reminder_sent' }] }, { home_submission: { home_score: 3, away_score: 2 } }, { result_submit_side: 'away' }, { result_state: 'DISPUTED' }]) {
    const after = { ...before, ...patch };
    let accepted = true; try { assertResultSnapshotCurrent(resultSnapshot(before), after); } catch { accepted = false; }
    assert.equal(sameResultSnapshot(before,after),accepted);
  }
});

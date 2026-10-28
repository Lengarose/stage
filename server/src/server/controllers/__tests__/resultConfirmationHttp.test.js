const test = require('node:test');
const assert = require('node:assert/strict');
const { setup } = require('../../services/__tests__/resultConfirmationFixture.cjs');
const express = require('express');

test('unchanged 2–2 through real submit/confirm HTTP, wager refund, replay and permissions', async () => {
  const env = setup();
  const app = express(); app.use(express.json()); app.use((req, res, next) => { req.user = { id: req.headers['x-test-user'] }; next(); }); app.use('/api/stage/functions', env.router);
  const server = await new Promise((resolve, reject) => { const s = app.listen(0,'127.0.0.1', () => resolve(s)); s.on('error', reject); });
  const post = (body, user) => fetch(`http://127.0.0.1:${server.address().port}/api/stage/functions/matchKickoff`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-test-user': user }, body: JSON.stringify({ match_id: 'match', ...body }) });
  try {
    assert.equal((await post({ action: 'submit_result', home_score: 2, away_score: 2, proof_url: '/uploads/controlled.png' }, 'home-user')).status, 200);
    const reviewed = env.snapshot();
    // Mimic native JSON ordering/formatting through the client and database boundaries.
    reviewed.home_submission = Object.fromEntries(Object.entries(JSON.parse(reviewed.home_submission)).reverse());
    reviewed.result_history = JSON.stringify(reviewed.result_history, null, 2);
    assert.equal((await post({ action: 'confirm_result', expected_result_snapshot: reviewed }, 'stranger')).status, 403);
    assert.equal((await post({ action: 'confirm_result', expected_result_snapshot: reviewed }, 'home-user')).status, 403);
    const body = { action: 'confirm_result', expected_result_snapshot: reviewed, player_stats: [] };
    const concurrent = await Promise.all([post(body, 'away-user'), post(body, 'away-user')]);
    for (const result of concurrent) assert.equal(result.status, 200, await result.clone().text());
    assert.equal(env.state.match.home_score, 2); assert.equal(env.state.match.away_score, 2);
    assert.equal(env.state.match.winner_player_id, null); assert.equal(env.state.match.wager_status, 'refunded');
    assert.deepEqual(env.state.accounts.map(a => a.stc), ['110.01','110.01']); assert.equal(env.state.ledger.length, 2);
    assert(env.state.ledger.every(row => row.category === 'wager_refund'));
    const count = env.state.notifications.size;
    for (let i = 0; i < 2; i++) { const replay = await post(body, 'away-user'); assert.equal(replay.status, 200, await replay.clone().text()); assert.equal((await replay.json()).data.skipped, true); }
    assert.equal(env.state.finalisations, 1); assert.equal(env.state.ledger.length, 2);
    assert.deepEqual(env.state.accounts.map(a => a.appearances), [1,1]); assert.equal(env.state.notifications.size, count);
    const stale = { ...reviewed, home_submission: { ...reviewed.home_submission, home_score: 3 } };
    assert.equal((await post({ ...body, expected_result_snapshot: stale }, 'away-user')).status, 409);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('failure between confirmation and finalisation rolls back the sheet and safely retries', async () => {
  const env = setup();
  await env.invoke({ action: 'submit_result', home_score: 2, away_score: 2, proof_url: '/uploads/controlled.png' }, 'home-user');
  const reviewed = env.snapshot(); env.failure = 'finalisation';
  await assert.rejects(env.invoke({ action: 'confirm_result', expected_result_snapshot: reviewed }), /Injected finalisation failure/);
  assert.equal(env.state.match.away_submission, null); assert.equal(env.state.match.report_finalized, 0); assert.equal(env.state.ledger.length, 0);
  await env.invoke({ action: 'confirm_result', expected_result_snapshot: reviewed });
  assert.equal(env.state.match.result_state, 'CONFIRMED'); assert.equal(env.state.finalisations, 1); assert.equal(env.state.ledger.length, 2);
});

for (const club of [false,true]) test(`${club ? 'club' : 'player'} amendment races and semantic-only updates retain concurrency protection`, async () => {
  const env = setup({ wager: false, club });
  await env.invoke({ action: 'submit_result', home_score: 2, away_score: 2 }, 'home-user');
  const reviewed = env.snapshot();
  env.state.match.stream_url = 'https://example.test/stream'; env.state.match.updated_date = 'later';
  env.state.match.result_history = JSON.stringify([...JSON.parse(env.state.match.result_history), { event: 'reminder_sent', at: 'later' }]);
  const results = await Promise.allSettled([
    env.invoke({ action: 'amend_result', home_score: 3, away_score: 2, expected_result_snapshot: reviewed }, 'home-user'),
    env.invoke({ action: 'confirm_result', expected_result_snapshot: reviewed }),
  ]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter(r => r.status === 'rejected' && r.reason.code === 'RESULT_CHANGED').length, 1);
  assert(JSON.parse(env.state.match.result_history).some(event => event.event === 'reminder_sent'));
  assert(env.state.finalisations <= 1);
  if (!env.state.finalisations) {
    await assert.rejects(env.invoke({ action: 'confirm_result', expected_result_snapshot: reviewed }), { code: 'RESULT_CHANGED' });
    assert.equal(JSON.parse(env.state.match.home_submission).home_score, 3);
  }
});

test('a temporary wager-ledger failure can be retried without repeating careers or notifications', async () => {
  const env = setup();
  await env.invoke({ action: 'submit_result', home_score: 2, away_score: 2, proof_url: '/uploads/controlled.png' }, 'home-user');
  const reviewed = env.snapshot(); env.failure = 'wager';
  await env.invoke({ action: 'confirm_result', expected_result_snapshot: reviewed });
  assert.equal(env.state.match.wager_status, 'active'); assert.equal(env.state.ledger.length, 0);
  const notifications = env.state.notifications.size;
  await env.invoke({ action: 'confirm_result', expected_result_snapshot: reviewed });
  assert.equal(env.state.match.wager_status, 'refunded'); assert.equal(env.state.ledger.length, 2);
  assert.deepEqual(env.state.accounts.map(a => a.appearances), [1,1]); assert.equal(env.state.notifications.size, notifications);
});

test('deadline-driven terminal changes require review and stranger requests cannot trigger them', async () => {
  const env = setup({ wager: false });
  await env.invoke({ action: 'submit_result', home_score: 2, away_score: 2 }, 'home-user');
  const reviewed = env.snapshot(); env.state.match.confirmation_due_at = '2000-01-01 00:00:00';
  await assert.rejects(env.invoke({ action: 'confirm_result', expected_result_snapshot: reviewed }, 'stranger'), { code: 'MATCH_PARTICIPANT_REQUIRED' });
  assert.equal(env.state.finalisations, 0);
  await assert.rejects(env.invoke({ action: 'confirm_result', expected_result_snapshot: reviewed }), { code: 'RESULT_CHANGED' });
  assert.equal(env.state.match.result_state, 'AUTO_CONFIRMED_TIMEOUT'); assert.equal(env.state.finalisations, 1);
});

for (const submitSide of ['home','away']) test(`${submitSide}-authored proposal: correction acceptance and matching retry retain the corrected result`, async () => {
  const env = setup({ wager: false }); env.state.match.result_submit_side = submitSide;
  const originalUser = `${submitSide}-user`, correctingUser = submitSide === 'home' ? 'away-user' : 'home-user';
  await env.invoke({ action: 'submit_result', home_score: 2, away_score: 2 }, originalUser);
  await env.invoke({ action: 'propose_correction', home_score: 2, away_score: 3, expected_result_snapshot: env.snapshot() }, correctingUser);
  const reviewed = env.snapshot();
  await env.invoke({ action: 'accept_correction', expected_result_snapshot: reviewed }, originalUser);
  assert.equal(env.state.match.home_score, 2); assert.equal(env.state.match.away_score, 3);
  assert.equal((await env.invoke({ action: 'accept_correction', expected_result_snapshot: reviewed }, originalUser)).data.skipped, true);
  assert.equal(env.state.finalisations, 1);
});

test('a dispute remains nonofficial and blocks the previously reviewed confirmation', async () => {
  const env = setup({ wager: false });
  await env.invoke({ action: 'submit_result', home_score: 2, away_score: 2 }, 'home-user');
  const reviewed = env.snapshot();
  await env.invoke({ action: 'dispute_result', home_score: 3, away_score: 2, proof_url: '/uploads/controlled.png', expected_result_snapshot: reviewed });
  assert.equal(env.state.match.result_state, 'DISPUTED');
  await assert.rejects(env.invoke({ action: 'confirm_result', expected_result_snapshot: reviewed }), { code: 'RESULT_CHANGED' });
  assert.equal(env.state.finalisations, 0); assert.equal(env.state.ledger.length, 0);
});

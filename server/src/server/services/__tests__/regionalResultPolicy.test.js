'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createService } = require('../regionalResultPolicyService');
const { VERSION } = require('../../lib/regionalResultPolicy');

test('new captured regional windows enable review; existing windows and community tournaments retain their conditions', async () => {
  let root = { participation_window_snapshot: { result_policy_version: VERSION } };
  const service = createService({ context: async () => ({ official: true, root }) });
  const match = { id: 'm', source_fixture_type: 'competition_engine' };
  assert.deepEqual(await service.policyForMatch(match), { version: VERSION, responseHours: 24, reviewOnTimeout: true, allowEitherInitial: true });
  root = { participation_window_snapshot: { result_policy_version: 'regional_result_review_v1' } };
  assert.deepEqual(await service.policyForMatch(match), { version: 'regional_result_review_v1', responseHours: 24, reviewOnTimeout: true, allowEitherInitial: false });
  root = { participation_window_snapshot: { policy_version: 'regional_registration_v1' } };
  assert.equal(await service.policyForMatch(match), null);
  assert.equal(await createService({ context: async () => ({ official: false }) }).policyForMatch(match), null);
  assert.equal(await service.policyForMatch({ id: 'arranged', source_fixture_type: 'arranged_game', result_policy_version: VERSION }), null);
});

test('league result policy comes from its stored registration window; missing or unknown policy fails closed', async () => {
  let window = { result_policy_version: VERSION };
  const service = createService({ context: async id => { assert.equal(id, 'm'); return { official: true, root: { regional_registration_window_id: 'w' } }; }, windows: { selectOne: async id => { assert.equal(id, 'w'); return window; } } });
  const match = { id: 'm', source_fixture_type: 'regional_league' };
  assert.equal((await service.policyForMatch(match)).responseHours, 24);
  window = { result_policy_version: 'unknown' };
  await assert.rejects(service.policyForMatch(match), error => error.code === 'RESULT_POLICY_UNAVAILABLE');
  window = null;
  await assert.rejects(service.policyForMatch(match), error => error.code === 'RESULT_POLICY_UNAVAILABLE');
});

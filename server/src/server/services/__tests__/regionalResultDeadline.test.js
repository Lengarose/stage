'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createService } = require('../regionalResultDeadlineService');

test('deadline scan reviews only newly opted-in regional matches and continues after one conflict', async () => {
  const calls = [], errors = [];
  const service = createService({ query: async () => [{ id: 'legacy' }, { id: 'conflict' }, { id: 'new' }], policyForMatch: async row => row.id === 'legacy' ? null : { reviewOnTimeout: true }, settle: async (row, now) => { calls.push(row.id); assert.equal(now.toISOString(), '2026-11-04T20:00:00.000Z'); if (row.id === 'conflict') throw Object.assign(Error('Changed'), { code: 'RESULT_CHANGED' }); return { data: { event: 'response_timeout_admin_review' } }; }, clock: () => new Date('2026-11-04T20:00:00Z'), logger: { error: (...args) => errors.push(args) } });
  assert.deepEqual(await service.tick(), { reviewed: 1 });
  assert.deepEqual(calls, ['conflict', 'new']);
  assert.equal(errors.length, 0);
});

test('full batches advance past legacy matches and wrap for retries; overlapping scans are skipped', async () => {
  const cursors = [];
  let release;
  let block = true;
  const service = createService({ query: async (_, args) => { cursors.push(args[0]); if (block) await new Promise(resolve => { release = resolve; }); return cursors.length === 1 ? Array.from({ length: 80 }, (_, i) => ({ id: String(i).padStart(3, '0') })) : []; }, policyForMatch: async () => null });
  const first = service.tick();
  assert.deepEqual(await service.tick(), { skipped: true });
  block = false; release(); await first;
  await service.tick(); await service.tick();
  assert.deepEqual(cursors, ['', '079', '']);
});

test('database and policy failures are retried without settling an unknown policy', async () => {
  let fail = true;
  let settled = 0;
  const errors = [];
  const service = createService({ query: async () => { if (fail) throw Error('Storage unavailable'); return [{ id: 'm' }]; }, policyForMatch: async () => { throw Error('Unknown policy'); }, settle: async () => { settled += 1; }, logger: { error: (...args) => errors.push(args) } });
  assert.equal((await service.tick()).failed, true);
  fail = false;
  assert.deepEqual(await service.tick(), { reviewed: 0 });
  assert.equal(settled, 0); assert.equal(errors.length, 2);
});

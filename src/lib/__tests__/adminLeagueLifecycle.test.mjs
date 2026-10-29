import test from 'node:test';
import assert from 'node:assert/strict';
import { fixtureState, submitEditionLifecycle, managementPreviewReady, loadEditionFixtureCount, adminEndpointError, buildLeagueManagementRequest } from '../adminLeagueLifecycle.js';

test('started edition without actual fixtures can draw but cannot simulate, regardless of legacy flag', () => {
  const empty = { id: 'season-2', status: 'in_progress', fixtures_generated: true, actual_fixtures_count: 0 };
  assert.equal(fixtureState(empty).canDraw, true);
  assert.equal(fixtureState(empty).canSimulate, false);
  assert.match(fixtureState(empty).explanation, /Draw fixtures/);
  assert.equal(fixtureState({ ...empty, actual_fixtures_count: 12 }).canSimulate, true);
  assert.equal(fixtureState({ ...empty, actual_fixtures_count: undefined }).canSimulate, false);
  assert.equal(fixtureState({ ...empty, actual_fixtures_count: undefined }).canDraw, false);
  assert.equal(fixtureState({ ...empty, status: 'completed', actual_fixtures_count: 12 }).canSimulate, false);
  assert.equal(fixtureState({ ...empty, status: 'league_phase' }).canDraw, true);
});
test('draw, complete and abandon always target exact selected edition with reason and confirmation', async () => {
  const calls = [];
  const client = { http: { post: async (...args) => { calls.push(args); return { applied: true }; } } };
  for (const action of ['draw', 'complete', 'abandon']) await submitEditionLifecycle(client, 'regional_league', { id: 'season-2', permanent_league_id: 'original' }, action, ' reviewed ', true);
  assert.deepEqual(calls.map(([path]) => path), Array(3).fill('/competition-views/regional_league/season-2/lifecycle'));
  assert.deepEqual(calls[0][1], { action: 'draw', reason: 'reviewed', confirmation: true });
  await assert.rejects(submitEditionLifecycle(client, 'regional_league', { id: 'season-2' }, 'complete', 'reason', false), /confirmation/);
  await assert.rejects(submitEditionLifecycle(client, 'regional_league', { id: 'season-2' }, 'complete', ' ', true), /reason/);
  assert.equal(calls.length, 3);
});
test('management apply requires a revision and explicit empty blockers', () => {
  assert.equal(managementPreviewReady(null), false);
  assert.equal(managementPreviewReady({ revision: 'r1' }), false);
  assert.equal(managementPreviewReady({ blockers: [] }), false);
  assert.equal(managementPreviewReady({ revision: 'r1', blockers: ['financial history'] }), false);
  assert.equal(managementPreviewReady({ revision: 'r1', blockers: [] }), true);
  assert.equal(managementPreviewReady({ revision: 'r1', blockers: [], applied: true }), false);
});

test('create request omits stale league selection and existing-league actions omit definition', () => {
  const definition = { name: 'New Division', division: 3 };
  const create = buildLeagueManagementRequest({ action: 'create', league_id: 'previous-selection', definition, reason: ' reviewed ' });
  assert.deepEqual(create, { action: 'create', definition, reason: 'reviewed' });
  assert.equal(Object.hasOwn(JSON.parse(JSON.stringify(create)), 'league_id'), false);
  for (const action of ['review', 'retire', 'delete']) {
    assert.deepEqual(buildLeagueManagementRequest({ action, league_id: 'original', definition, reason: ' reviewed ' }), { action, league_id: 'original', reason: 'reviewed' });
  }
});
test('actual fixture inventory is scoped to selected edition, paginated and never simulated', async () => {
  const calls = [];
  const result = await loadEditionFixtureCount({ http: { get: async (path, query) => {
    calls.push({ path, query });
    return query.offset ? [{ id: 'last' }] : Array.from({ length: 500 }, (_, i) => ({ id: String(i) }));
  } } }, 'competition_season', { id: 'selected' });
  assert.equal(result.actual_fixtures_count, 501);
  assert.deepEqual(calls.map(c => c.query.offset), [0, 500]);
  assert.ok(calls.every(c => c.path === '/competition-fixtures' && c.query.season_id === 'selected'));
});
test('missing endpoint errors do not report success or trigger a legacy mutation', async () => {
  const calls = [];
  const error = { status: 404, message: 'Not found' };
  await assert.rejects(submitEditionLifecycle({ http: { post: async path => { calls.push(path); throw error; } } }, 'regional_league', { id: 'selected' }, 'draw', 'reason', true), e => e === error);
  assert.equal(calls.length, 1);
  assert.match(adminEndpointError(error), /unavailable/);
});

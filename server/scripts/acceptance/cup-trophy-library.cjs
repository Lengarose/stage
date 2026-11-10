'use strict';
// Exercises the real local HTTP routes against the isolated walkthrough only.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const fixture = JSON.parse(fs.readFileSync('/private/tmp/stage-admin-walkthrough.json', 'utf8'));
if (fixture.port !== 18089 || !/^stage_acceptance_[a-f0-9]{12}$/.test(fixture.database)) throw Error('An isolated walkthrough database is required.');
const base = `http://127.0.0.1:${fixture.port}/api/stage`;
async function request(route, method = 'GET', body, token) {
  const response = await fetch(`${base}/${route}`, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, data: await response.json() };
}
async function main() {
  const login = await request('auth/login', 'POST', { email: fixture.adminEmail, password: fixture.password });
  assert.equal(login.status, 200);
  const token = login.data.accessToken;
  const call = async (route, method, body) => {
    const result = await request(route, method, body, token);
    assert.ok(result.status < 300, `${result.status}: ${JSON.stringify(result.data)}`);
    return result.data;
  };
  const cups = await call('regional-leagues/cups');
  const cup = cups.definitions.find(c => c.region_slug === 'uk-ireland');
  assert.ok(cup);
  const route = `regional-leagues/cups/${cup.id}/trophy`;
  const original = await call(route);
  const snapshots = JSON.stringify(cups.editions);
  const before = await call('trophy-items');
  const originalItem = before.find(item => item.id === original.trophy?.id);
  const bad = await request('trophy-items', 'POST', { name: 'Invalid Cup link', image_url: '/uploads/demo/trophy.svg', linked_source_type: 'regional_cup', linked_source_id: 'missing-cup' }, token);
  assert.equal(bad.status, 404);
  assert.equal((await call('trophy-items')).length, before.length, 'invalid links must not leave a half-created catalogue item');
  const playerLogin = await request('auth/login', 'POST', { email: fixture.ownerEmail, password: fixture.password });
  const denied = await request('trophy-items', 'POST', { name: 'Forbidden Cup link', image_url: '/uploads/demo/trophy.svg', linked_source_type: 'regional_cup', linked_source_id: cup.id }, playerLogin.data.accessToken);
  assert.equal(denied.status, 403);
  const make = name => call('trophy-items', 'POST', { name, image_url: '/uploads/demo/trophy.svg', linked_source_type: 'regional_cup', linked_source_id: cup.id, linked_source_name: 'Client label must not be trusted' });
  const a = await make('Library Cup trophy A');
  assert.equal(a.linked_source_name, cup.name);
  assert.equal((await call(route)).trophy.id, a.id, 'creation must select the Cup default');
  await call(`trophy-items/${a.id}`, 'PATCH', { image_url: '/uploads/demo/trophy.svg?updated=1' });
  assert.equal((await call(route)).trophy.image_url, '/uploads/demo/trophy.svg?updated=1');
  const b = await make('Library Cup trophy B');
  assert.equal((await call(route)).trophy.id, b.id);
  assert.equal((await call(`trophy-items/${a.id}`)).linked_source_id, null, 'replacement must remove a conflicting reverse link');
  await call(`trophy-items/${b.id}`, 'PATCH', { linked_source_type: null, linked_source_id: null, linked_source_name: null });
  assert.equal((await call(route)).state, 'unassigned', 'unlink must clear the corresponding Cup default');
  const cleared = await call(route);
  await call(route, 'POST', { trophy_item_id: original.trophy?.id || null, revision: cleared.revision, reason: 'Restore the isolated demo Cup after library acceptance test' });
  if (originalItem?.linked_source_type === 'regional_cup') await call(`trophy-items/${originalItem.id}`, 'PATCH', {
    linked_source_type: originalItem.linked_source_type, linked_source_id: originalItem.linked_source_id, linked_source_name: originalItem.linked_source_name,
  });
  assert.equal(JSON.stringify((await call('regional-leagues/cups')).editions), snapshots, 'library edits must not mutate captured Cup editions');
  for (const item of [a, b]) await call(`trophy-items/${item.id}`, 'DELETE');
  const result = { scope: 'isolated local HTTP', passed: ['invalid target rolls back', 'non-Admin denied', 'create selects Cup default', 'replace image updates default artwork', 'replacement clears conflicting library link', 'unlink clears default', 'existing edition snapshots unchanged', 'original default restored'], cup: cup.name };
  const output = path.resolve(__dirname, '../../../output/playwright/admin-walkthrough-2026-11-09/cup-trophy-library-test.json');
  fs.writeFileSync(output, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });

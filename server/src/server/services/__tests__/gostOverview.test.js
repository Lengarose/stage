const test = require('node:test');
const assert = require('node:assert/strict');
const dbPath = require.resolve('../../db/database');
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { EXECUTESQL: async () => [], withTransaction: fn => fn(async () => []) } };
const service = require('../gostOverviewService');
const rewards = require('../rewardConfigurationService');
const admin = { id: 'admin', role_id: 2, email: 'admin@example.test' };
function fixture() {
  const entity = (id, entity_type, data) => ({ id, entity_type, data_json: JSON.stringify(data), status: data.status || null });
  const rows = [entity('sup', 'competition', { name: 'Supreme', slug: 'supreme', tier: 1, format: 'league_36_8md' }), entity('season', 'competition_season', { competition_id: 'sup', season_number: 2, status: 'registration', format: 'league_36_8md', registered_club_ids: ['club', 'club'], max_clubs: 36 }), entity('past', 'competition_season', { competition_id: 'sup', season_number: 1, status: 'archived' }), entity('capture', 'competition_settlement', { source_type: 'competition_season', source_id: 'past', config: { trophy_item_id: 'old', trophy_snapshot: { id: 'old', name: 'Captured cup', image_url: '/uploads/captured.png' } } })];
  rows.push(entity(rewards.key('competition', 'sup'), 'reward_configuration', { version: 1, trophy_item_id: 'sup-cup', participant_count: 36 }));
  const items = [{ id: 'sup-cup', name: 'Renamable silver cup', image_url: '/uploads/sup.png' }, { id: 'elite-cup', name: 'Anything', image_url: '/uploads/elite.png' }, { id: 'challenger-cup', name: 'Anything', image_url: '/uploads/challenger.png' }];
  const config = ['participation', 'winner_bonus', 'runner_up_bonus'].map((component_key, i) => ({ source_id: 'sup', config_version: 1, component_key, stc_amount: String([10, 30, 20][i]) }));
  const audit = [], writes = [];
  const query = async (sql, args = []) => {
    if (sql.startsWith('SELECT * FROM league_entities WHERE entity_type IN')) return structuredClone(rows);
    if (sql.includes("entity_type='competition' AND id=?")) return rows.filter(r => r.entity_type === 'competition' && r.id === args[0]);
    if (sql.includes("entity_type='reward_configuration' AND id=?")) return rows.filter(r => r.id === args[0]);
    if (sql.includes('FROM trophy_items')) return structuredClone(items);
    if (sql.includes('FROM trophy_awards')) return [];
    if (sql.includes('FROM reward_configs')) return structuredClone(config);
    if (sql.startsWith('INSERT INTO admin_audit_log')) { audit.push(args); return {}; }
    if (sql.startsWith('INSERT INTO league_entities')) { writes.push(sql); const row = rows.find(r => r.id === args[0]); if (row) row.data_json = args[1]; else rows.push(entity(args[0], 'reward_configuration', JSON.parse(args[1]))); return {}; }
    if (sql.startsWith('UPDATE league_entities')) { writes.push(sql); rows.find(r => r.id === args[1]).data_json = args[0]; return {}; }
    throw new Error(`Unexpected query: ${sql}`);
  };
  return { rows, items, query, audit, writes, transaction: fn => fn(query) };
}
test('all tiers resolve only stable explicit IDs despite catalogue ordering and names', () => {
  const items = ['supreme', 'elite', 'challenger'].map(slug => ({ id: `id-${slug}`, name: 'Same renamed display name', image_url: `/uploads/${slug}.png` })).reverse();
  for (const slug of ['supreme', 'elite', 'challenger']) assert.equal(service.resolveAssignment({ id: slug }, { trophy_item_id: `id-${slug}` }, items).trophy.image_url, `/uploads/${slug}.png`);
  assert.equal(service.resolveAssignment({ id: 'supreme' }, {}, items).state, 'unassigned');
  assert.equal(service.resolveAssignment({ id: 'supreme' }, { trophy_item_id: 'missing' }, items).state, 'invalid');
});
test('reverse links are exact and conflicting explicit links are surfaced', () => {
  const items = [{ id: 'one', linked_source_type: 'competition', linked_source_id: 'sup' }, { id: 'two' }];
  assert.equal(service.resolveAssignment({ id: 'sup' }, {}, items).trophy.id, 'one');
  assert.equal(service.resolveAssignment({ id: 'sup' }, { trophy_item_id: 'two' }, items).state, 'conflict');
  assert.equal(service.resolveAssignment({ id: 'different' }, { trophy_item_id: 'one' }, items).state, 'invalid');
});
test('overview is read-only, public-safe and retains edition trophy snapshots', async () => {
  const env = fixture();
  const result = await service.overview(env.query);
  const comp = result.competitions[0];
  assert.equal(comp.assignment.trophy.id, 'sup-cup');
  assert.equal(comp.current.state, 'Registration');
  assert.equal(comp.current.registered, 1);
  assert.equal(comp.current.prizes.participation, '10.00');
  assert.equal(comp.current.prizes.budget, null, 'maximum capacity is not a captured participant basis');
  assert.equal(comp.archive[0].trophy.name, 'Captured cup');
  assert.equal(comp.archive[0].prizes, null, 'current configuration must not fill historical gaps');
  assert.equal(comp.current.journey.playoff_legs, 2);
  assert.equal(env.writes.length, 0);
  assert.equal(JSON.stringify(result).includes('admin@example'), false);
});
test('admin assignment persists without financial, award or edition writes; stale saves fail', async () => {
  const env = fixture();
  const before = await service.assignment('sup', env.query);
  const historical = structuredClone(env.rows.filter(r => r.entity_type === 'competition_settlement' || r.entity_type === 'competition_season'));
  const input = { trophy_item_id: 'elite-cup', reason: 'Reviewed source artwork only', revision: before.revision };
  const saved = await service.assign('sup', input, admin, env.transaction);
  assert.equal(saved.trophy.id, 'elite-cup');
  assert.equal((await service.assignment('sup', env.query)).trophy.id, 'elite-cup');
  assert.equal(env.audit.length, 1);
  assert.equal(env.audit[0][1], admin.id);
  assert.deepEqual(env.rows.filter(r => r.entity_type === 'competition_settlement' || r.entity_type === 'competition_season'), historical);
  assert.equal(env.writes.some(sql => /trophy_awards|stc_transactions|competition_payouts/.test(sql)), false);
  await assert.rejects(service.assign('sup', input, admin, env.transaction), { status: 409 });
  await assert.rejects(service.assign('sup', input, { id: 'user', role_id: 1 }, env.transaction), { status: 403 });
  const current = await service.assignment('sup', env.query);
  await assert.rejects(service.assign('sup', { ...input, trophy_item_id: 'invalid', revision: current.revision }, admin, env.transaction), { status: 409 });
});
test('foreign designs and conflicting reverse links cannot be silently assigned', async () => {
  const env = fixture(); env.items[1].tournament_id = 'other-event';
  let current = await service.assignment('sup', env.query);
  await assert.rejects(service.assign('sup', { revision: current.revision, trophy_item_id: 'elite-cup', reason: 'Test' }, admin, env.transaction), { status: 409 });
  env.items[0].linked_source_type = 'competition'; env.items[0].linked_source_id = 'sup';
  current = await service.assignment('sup', env.query);
  await assert.rejects(service.assign('sup', { revision: current.revision, trophy_item_id: 'challenger-cup', reason: 'Test' }, admin, env.transaction), { status: 409 });
  assert.equal(env.audit.length, 0);
});
test('prize totals require an established basis; format controls journey', () => {
  const rows = ['participation', 'winner_bonus', 'runner_up_bonus'].map((component_key, i) => ({ component_key, stc_amount: [10, 30, 20][i] }));
  assert.equal(service.prizeDetails({ rows, participant_count: 36 }, 36).budget, '410.00');
  assert.equal(service.prizeDetails({ rows: [...rows, rows[0]] }, 36), null);
  assert.equal(service.journeyFor({ format: 'league' }, {}).kind, 'league');
  assert.equal(service.journeyFor(null, {}).kind, 'unavailable');
  assert.equal(service.safeImage('javascript:alert(1)'), null);
});

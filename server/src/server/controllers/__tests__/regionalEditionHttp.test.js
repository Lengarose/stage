const test = require('node:test');
const assert = require('node:assert/strict');

function fixture() {
  const rows = new Map();
  const audits = [];
  const names = ['league_entities', 'matches', 'match_player_stats', 'club_fixture_lineups', 'club_fixture_availability', 'live_matches', 'live_match_events', 'competition_instances', 'competition_participants', 'competition_fixtures', 'competition_schedule_proposals', 'competition_result_submissions', 'competition_phase_states', 'competition_standings', 'competition_payouts', 'reward_configs', 'stc_transactions', 'player_stc_transactions', 'user_purchases', 'trophy_items', 'trophy_awards', 'trophy_placements', 'club_achievements', 'player_achievements', 'fixture_admin_actions', 'inbox_messages', 'notifications', 'predictions', 'rating_history'];
  const tables = Object.fromEntries(names.map(name => [name, []]));
  async function query(sql, values = []) {
    if (/FROM users/.test(sql)) return [{ id: values[0], email: 'admin@test.local', role_id: values[0] === 'admin' ? 2 : 1 }];
    if (/information_schema.tables/.test(sql)) return names.map(name => ({ name }));
    if (/@@transaction_isolation/.test(sql)) return [{ isolation_level: 'REPEATABLE-READ' }];
    if (/regional-edition-write-lock|league-lifecycle-write-lock/.test(sql)) return [];
    if (/INSERT INTO admin_audit_log/.test(sql)) { audits.push({ id: values[0], values }); return {}; }
    if (/SELECT \* FROM admin_audit_log/.test(sql)) return audits.filter(row => row.id === values[0]);
    if (/INSERT INTO `league_entities`/.test(sql)) {
      const columns = sql.slice(sql.indexOf('(') + 1, sql.indexOf(')')).split(',').map(s => s.trim().replace(/`/g, ''));
      const row = Object.fromEntries(columns.map((key, index) => [key, values[index]]));
      row.created_date = '2026-10-26 12:00:00'; row.updated_date = '2026-10-26 12:00:00';
      if (row.regional_edition_key && [...rows.values()].some(other => other.regional_edition_key === row.regional_edition_key)) throw Object.assign(new Error('Duplicate key'), { code: 'ER_DUP_ENTRY' });
      rows.set(row.id, row); return {};
    }
    if (/UPDATE league_entities SET data_json=\?,regional_edition_key=\?/.test(sql)) {
      const id = values.at(-1), record = JSON.parse(values[0]);
      if (values[1] && [...rows.values()].some(other => other.id !== id && other.regional_edition_key === values[1])) throw new Error('Duplicate identity');
      const indexed = ['status', 'slug', 'region', 'division', 'platform', 'season_number', 'league_id', 'is_active'];
      rows.set(id, { ...rows.get(id), ...Object.fromEntries(indexed.map(key => [key, record[key] ?? null])), data_json: values[0], regional_edition_key: values[1], updated_date: 'changed-' + audits.length }); return {};
    }
    if (/UPDATE league_entities SET regional_edition_key=/.test(sql)) { rows.get(values[1]).regional_edition_key = values[0]; return {}; }
    if (/UPDATE league_entities SET regional_league_key=NULL/.test(sql)) { rows.get(values[0]).regional_league_key=null; return {}; }
    if (/UPDATE league_entities SET regional_league_key=/.test(sql)) { rows.get(values[1]).regional_league_key=values[0]; return {}; }
    if (/UPDATE trophy_items SET linked_source_id=/.test(sql)) { const item=tables.trophy_items.find(row=>row.id===values[1]&&row.linked_source_id===values[2]);if(item)item.linked_source_id=values[0];return {}; }
    if (/DELETE FROM league_entities WHERE id/.test(sql)) { rows.delete(values[0]); return {}; }
    if (/SELECT \* FROM league_entities WHERE entity_type='regional_league'/.test(sql)) return [...rows.values()].filter(row => row.entity_type === 'regional_league').sort((a, b) => a.id.localeCompare(b.id));
    if (/SELECT \* FROM `league_entities` WHERE id/.test(sql)) return rows.has(values[0]) ? [rows.get(values[0])] : [];
    const scan = /SELECT \* FROM `([a-z_]+)`/.exec(sql);
    if (scan) return scan[1] === 'league_entities' ? [...rows.values()] : tables[scan[1]];
    throw new Error(`Unexpected fixture SQL: ${sql}`);
  }
  const db = require.resolve('../../db/database');
  const route = require.resolve('../leagueEntityController');
  let queue = Promise.resolve();
  const withTransaction = fn => {
    const operation = queue.then(async () => {
      const before = structuredClone([...rows]), auditCount = audits.length;
      try { return await fn(query); } catch (err) { rows.clear(); for (const [id, row] of before) rows.set(id, row); audits.splice(auditCount); throw err; }
    });
    queue = operation.catch(() => {}); return operation;
  };
  require.cache[db] = { id: db, filename: db, loaded: true, exports: { EXECUTESQL: query, withTransaction } };
  for (const name of ['../../services/regionalEditionService', '../../services/regionalEditionReviewService']) delete require.cache[require.resolve(name)];
  delete require.cache[route];
  const router = require(route).makeRouter('regional_league');
  async function create(body) {
    const layer = router.stack.find(layer => layer.route?.path === '/' && layer.route.methods.post);
    const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    await layer.route.stack[0].handle({ body, user: { id: 'admin' }, query: {} }, res);
    return res;
  }
  function legacy(record) { rows.set(record.id, { ...Object.fromEntries(['id', 'status', 'slug', 'region', 'division', 'platform', 'season_number'].map(key => [key, record[key]])), entity_type: 'regional_league', data_json: JSON.stringify(record), regional_edition_key: null }); }
  return { rows, audits, query, create, router, tables, legacy };
}

test('generic regional creation retries reuse the same logical league edition', async () => {
  const env = fixture();
  const body = { name: 'STAGE North American League', slug: 'north-american-league', region: 'north_america', division: 1, season_number: 1, platform: 'crossplay' };
  const first = await env.create(body);
  const retry = await env.create(body);
  assert.ok(first.code < 300, JSON.stringify(first.body));
  assert.ok(retry.code < 300, JSON.stringify(retry.body));
  assert.equal(env.rows.size, 1, 'retry must not create a second edition');
  assert.equal(first.body.id, retry.body.id);
});

module.exports = { fixture };

test('concurrent seeds, retry recovery, divisions, seasons, platforms and protected updates', async () => {
  const env = fixture();
  const service = require('../../services/regionalEditionService');
  const base = { name: 'Same display name', slug: 'north-america-div-1', region_slug: 'north-america', division: 1, season_number: 1, platform: 'Cross-Platform', status: 'registration' };
  const batches = await Promise.all(Array.from({ length: 8 }, () => service.seed([base], { id: 'admin' })));
  assert.equal(env.rows.size, 1);
  assert.equal(batches.filter(batch => batch.results[0].outcome === 'created').length, 1);
  const initial = [...env.rows.values()][0];
  assert.equal((await env.create({ ...base, id: 'stale-browser-new-id', platform: 'crossplay' })).body.id, initial.id);
  await service.create({ ...base, slug: 'north-america-div-2', division: 2 }, { id: 'admin' });
  await assert.rejects(service.create({ ...base, slug: 'north-america-div-1-s2', season_number: 2 }, { id: 'admin' }), /protected next-season/);
  await service.create({ ...base, platform: 'PlayStation' }, { id: 'admin' });
  await service.create({ ...base, platform: 'Xbox' }, { id: 'admin' });
  assert.equal(env.rows.size, 4, 'legitimate platform/division differences survive; new editions use rollover');
  const consoleRecord = [...env.rows.values()].find(row => row.platform === 'playstation');
  await assert.rejects(service.update(consoleRecord.id, { platform: 'crossplay' }, { id: 'admin' }), /already exists/);
  await assert.rejects(service.create(base, { id: 'stranger' }), /Admin/);
  const snapshots = [...env.rows.values()].map(row => row.data_json);
  await assert.rejects(service.update(initial.id, { next_season_id: 'conflicting' }, { id: 'admin' }), /protected next-season/);
  assert.deepEqual([...env.rows.values()].map(row => row.data_json), snapshots);
});

test('next-season creation is idempotent and conflicting links are preserved', async () => {
  const env = fixture(), service = require('../../services/regionalEditionService');
  env.legacy({ id: 'parent-fixture', name: 'North American test', slug: 'north-america-div-1', region_slug: 'north-america', division: 1, season_number: 1, platform: 'Cross-Platform', status: 'completed' });
  const [first, second] = await Promise.all([service.nextSeason('parent-fixture', { id: 'admin' }), service.nextSeason('parent-fixture', { id: 'admin' })]);
  assert.equal(first.record.id, second.record.id);
  assert.equal(env.rows.size, 2);
  assert.equal(JSON.parse(env.rows.get('parent-fixture').data_json).next_season_id, first.record.id);
  assert.equal(first.record.previous_season_id, 'parent-fixture');
  assert.equal(first.record.prize_pool_stc, '757000000.00');
  const parent = env.rows.get('parent-fixture');
  parent.data_json = JSON.stringify({ ...JSON.parse(parent.data_json), next_season_id: 'unrelated-fixture' });
  await assert.rejects(service.nextSeason('parent-fixture', { id: 'admin' }), /different record/);
});

test('generic regional updates cannot perform closed lifecycle actions or invalidate an edition', async () => {
  const env = fixture(), service = require('../../services/regionalEditionService');
  env.legacy({ id: 'edition', name: 'League', slug: 'uk-ireland-div-1', region_slug: 'uk-ireland', division: 1, season_number: 1, platform: 'cross-platform', status: 'registration' });
  const before = JSON.stringify([...env.rows]);
  for (const status of ['completed', 'archived', 'reset', 'cancelled', 'canceled', 'superseded', 'abandoned', 'retired', ' RESET ']) {
    await assert.rejects(service.update('edition', { status }, { id: 'admin' }), /dedicated league lifecycle action/);
  }
  await assert.rejects(service.update('edition', { edition_invalidated: true }, { id: 'admin' }), /reviewed league lifecycle/);
  assert.equal(JSON.stringify([...env.rows]), before); assert.equal(env.audits.length, 0);
});

test('old reset series and stale Regional editions cannot create or relink successors', async () => {
  const base = { name: 'League', slug: 'uk-ireland-div-1', region_slug: 'uk-ireland', division: 1, season_number: 1, platform: 'cross-platform', status: 'completed' };
  for (const mode of ['series', 'pointer', 'newer']) {
    const env = fixture(), service = require('../../services/regionalEditionService');
    env.legacy({ ...base, id: 'original', ...(mode === 'pointer' ? { current_edition_id: 'another-edition' } : {}) });
    if (mode !== 'pointer') env.legacy({ ...base, id: 'later', permanent_league_id: 'original', slug: mode === 'series' ? 'uk-ireland-div-1-reset-1' : 'uk-ireland-div-1-s3', reset_series: mode === 'series' ? 1 : 0, season_number: mode === 'series' ? 1 : 3 });
    const before = JSON.stringify([...env.rows]);
    await assert.rejects(service.nextSeason('original', { id: 'admin' }), /historical|stale/);
    assert.equal(JSON.stringify([...env.rows]), before); assert.equal(env.audits.length, 0);
  }
});

test('historical Regional rollover retries return their existing successor without rewinding current selection', async () => {
  const env = fixture(), service = require('../../services/regionalEditionService');
  env.legacy({ id: 'original', name: 'League', slug: 'uk-ireland-div-1', region_slug: 'uk-ireland', division: 1, season_number: 1, platform: 'cross-platform', status: 'completed' });
  const second = (await service.nextSeason('original', { id: 'admin' })).record;
  env.legacy({ ...second, status: 'completed' });
  const third = (await service.nextSeason(second.id, { id: 'admin' })).record;
  const before = JSON.stringify([...env.rows]), audits = env.audits.length;
  assert.equal((await service.nextSeason('original', { id: 'admin' })).record.id, second.id);
  assert.equal(JSON.parse(env.rows.get('original').data_json).current_edition_id, third.id);
  assert.equal(JSON.stringify([...env.rows]), before); assert.equal(env.audits.length, audits);
  env.legacy({ ...third, id: 'reset-current', reset_series: 1, season_number: 1, slug: 'uk-ireland-div-1-reset-1' });
  assert.equal((await service.nextSeason('original', { id: 'admin' })).record.id, second.id);
  assert.equal(JSON.parse(env.rows.get('original').data_json).current_edition_id, third.id);
});

test('Regional rollover preserves the indexed reset series and includes it in the season label', async () => {
  const env = fixture(), service = require('../../services/regionalEditionService');
  const base = { name: 'League', region_slug: 'uk-ireland', division: 2, platform: 'cross-platform', season_number: 1 };
  env.legacy({ ...base, id: 'original', slug: 'uk-ireland-div-2', status: 'reset', current_edition_id: 'reset-current' });
  env.legacy({ ...base, id: 'reset-current', slug: 'uk-ireland-div-2-reset-2', permanent_league_id: 'original', reset_series: 2, status: 'completed' });
  const result = await service.nextSeason('reset-current', { id: 'admin' });
  assert.equal(result.record.season_label, 'Series 2 \u00b7 Season 2');
  assert.equal(env.rows.get(result.record.id).reset_series, 2);
});

test('a retired permanent Regional league cannot open or start its draft child', async () => {
  const env = fixture(), service = require('../../services/regionalEditionService');
  const base = { name: 'League', region_slug: 'uk-ireland', division: 1, platform: 'cross-platform' };
  env.legacy({ ...base, id: 'original', slug: 'uk-ireland-div-1', season_number: 1, status: 'completed', retired_at: '2026-10-29' });
  env.legacy({ ...base, id: 'child', slug: 'uk-ireland-div-1-s2', permanent_league_id: 'original', season_number: 2, status: 'draft' });
  const before = JSON.stringify([...env.rows]);
  for (const status of ['registration', 'in_progress', 'active']) await assert.rejects(service.update('child', { status }, { id: 'admin' }), /Retired leagues/);
  assert.equal(JSON.stringify([...env.rows]), before); assert.equal(env.audits.length, 0);
});

test('only an authorised abandoned Regional edition can roll over from cancelled status', async () => {
  const env = fixture(), service = require('../../services/regionalEditionService');
  const root = { id: 'original', name: 'League', region_slug: 'uk-ireland', division: 1, platform: 'cross-platform', slug: 'uk-ireland-div-1', season_number: 1, status: 'cancelled' };
  env.legacy(root);
  await assert.rejects(service.nextSeason(root.id, { id: 'admin' }), /authorised Abandon/);
  env.legacy({ ...root, abandoned_at: '2026-10-29', abandonment_reason: 'Withdrawals' });
  const next = await service.nextSeason(root.id, { id: 'admin' });
  assert.equal(next.record.season_number, 2); assert.deepEqual(next.record.registered_club_ids, []);
  assert.equal((await service.nextSeason(root.id, { id: 'admin' })).record.id, next.record.id);
});

test('review preview is read only; dependent histories and stale states block repair; safe repair is idempotent', async () => {
  const env = fixture(), service = require('../../services/regionalEditionService'), review = require('../../services/regionalEditionReviewService');
  const base = { name: 'North American test fixture', slug: 'north-america-div-1', region_slug: 'north-america', division: 1, season_number: 1, platform: 'Cross-Platform', status: 'registration' };
  env.legacy({ ...base, id: 'source-fixture' }); env.legacy({ ...base, id: 'canonical-fixture' });
  const body = { source_id: 'source-fixture', canonical_id: 'canonical-fixture' }, actor = { id: 'admin' };
  const before = JSON.stringify([...env.rows]);
  const diagnostic = await review.diagnostics(actor);
  assert.equal(diagnostic.conflicts.length, 1);
  const report = await review.repair(body, actor);
  assert.equal(report.changes.length, 2);
  assert.equal(JSON.stringify([...env.rows]), before);
  await assert.rejects(service.create(base, actor), /Conflicting/);
  env.tables.competition_payouts.push({ id: 'payment-fixture', source_id: 'source-fixture', amount: '54000000.00' });
  const blocked = await review.preview(body, actor);
  assert.equal(blocked.source_inventory.dependencies.competition_payouts.length, 1);
  await assert.rejects(review.repair({ ...body, apply: true, expected_revision: blocked.revision, reason: 'fixture review' }, actor), /blocked/);
  env.tables.competition_payouts.length = 0;
  const fresh = await review.preview(body, actor);
  env.rows.get('source-fixture').updated_date = 'changed-after-preview';
  await assert.rejects(review.repair({ ...body, apply: true, expected_revision: fresh.revision, reason: 'fixture review' }, actor), /changed since preview/);
  const latest = await review.preview(body, actor);
  const canonicalJson = env.rows.get('canonical-fixture').data_json;
  const applied = await review.repair({ ...body, apply: true, expected_revision: latest.revision, reason: 'Explicit unused fixture removal' }, actor);
  assert.equal(applied.applied, true);
  assert.equal(env.rows.size, 1);
  assert.equal(env.rows.get('canonical-fixture').data_json, canonicalJson, 'binding identity must not rewrite historical JSON');
  assert.equal((await review.repair({ ...body, apply: true, expected_revision: latest.revision, reason: 'Retry' }, actor)).already_applied, true);
  assert.equal(env.audits.length, 1);
  for (const name of ['competition_payouts', 'stc_transactions', 'trophy_awards', 'trophy_placements']) assert.equal(env.tables[name].length, 0);
});

test('inventory follows JSON, match, financial and award dependencies; malformed/missing evidence blocks removal', async () => {
  const env = fixture(), review = require('../../services/regionalEditionReviewService');
  const root = { id: 'source-fixture', slug: 'north-america-div-1', region_slug: 'north-america', division: 1, season_number: 1, platform: 'crossplay', status: 'registration' };
  env.legacy(root);
  env.rows.set('fixture-link', { id: 'fixture-link', entity_type: 'regional_league_fixture', data_json: JSON.stringify({ league: { id: root.id } }) });
  env.tables.matches.push({ id: 'match-fixture', source_fixture_id: 'fixture-link', result_state: 'CONFIRMED' });
  env.tables.match_player_stats.push({ id: 'stat-fixture', match_id: 'match-fixture' });
  env.tables.trophy_awards.push({ id: 'award-fixture', metadata_json: JSON.stringify({ source_id: root.id }) });
  env.tables.trophy_placements.push({ id: 'placement-fixture', award_id: 'award-fixture', locked_at: '2026-10-26' });
  const report = await review.inventory(env.rows.get(root.id), env.query);
  assert.equal(report.dependency_count, 5);
  assert.equal(report.dependencies.matches.length, 1);
  assert.equal(report.dependencies.trophy_placements.length, 1);
  env.rows.get('fixture-link').data_json = JSON.stringify({ league_id: root.id, match_id: 'match-without-back-reference' });
  env.tables.matches.push({ id: 'match-without-back-reference', result_state: 'CONFIRMED' });
  env.tables.competition_instances.push({ id: 'instance-fixture', legacy_source_id: root.id });
  env.tables.competition_standings.push({ competition_instance_id: 'instance-fixture', participant_id: 'club-a', points: 3 }, { competition_instance_id: 'instance-fixture', participant_id: 'club-b', points: 0 });
  const complete = await review.inventory(env.rows.get(root.id), env.query);
  assert.equal(complete.dependencies.competition_standings.length, 2, 'composite-key rows must not collapse');
  assert.ok(complete.dependencies.matches.some(row => row.id === 'match-without-back-reference'));
  const missing = review.collect(env.rows.get(root.id), { rows: [], missing: ['matches'] });
  assert.ok(missing.blockers.length);
});

test('reset rejects edition collapse without deleting or modifying any history', () => {
  const env = fixture(), service = require('../../services/regionalEditionService');
  const base = { region_slug: 'north-america', division: 1, platform: 'Cross-Platform' };
  assert.throws(() => service.assertResetSafe([{ ...base, id: 'season-one', slug: 'north-america-div-1', season_number: 1 }, { ...base, id: 'season-two', slug: 'north-america-div-1-s2', season_number: 2 }]), /collapse/);
  assert.equal(env.rows.size, 0);
});

test('unrelated entity types keep ordinary CRUD and do not acquire regional identity keys', async () => {
  const env = fixture();
  const router = require('../leagueEntityController').makeRouter('ranking_config');
  const create = router.stack.find(layer => layer.route?.path === '/' && layer.route.methods.post).route.stack[0].handle;
  for (let i = 0; i < 2; i++) {
    const response = { status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
    await create({ body: { slug: 'north-america-div-1', season_number: 1 }, user: { id: 'admin' } }, response);
    assert.equal(response.code, 201);
  }
  assert.equal(env.rows.size, 2);
  assert.ok([...env.rows.values()].every(row => !row.regional_edition_key));
});

test('distinct platform editions and unverified legacy identities get inventories but cannot be merged', async () => {
  const env = fixture(), review = require('../../services/regionalEditionReviewService');
  const base = { slug: 'north-america-div-1', region_slug: 'north-america', division: 1, season_number: 1, status: 'registration' };
  env.legacy({ ...base, id: 'cross-platform-fixture', platform: 'Cross-Platform' });
  env.legacy({ ...base, id: 'console-fixture', platform: 'PlayStation' });
  const distinct = await review.preview({ source_id: 'cross-platform-fixture', canonical_id: 'console-fixture' }, { id: 'admin' });
  assert.equal(distinct.classification, 'distinct_logical_editions');
  assert.equal(distinct.changes.length, 0);
  assert.ok(distinct.source_inventory);
  env.legacy({ ...base, id: 'unknown-platform-fixture' });
  const unknown = await review.preview({ source_id: 'unknown-platform-fixture', canonical_id: 'console-fixture' }, { id: 'admin' });
  assert.equal(unknown.classification, 'unverified_identity');
  assert.ok(unknown.blockers.length);
  assert.ok(unknown.source_inventory);
});

test('new regional endpoints are exercised over local HTTP with authenticated-admin fixtures', async () => {
  const express = require('express');
  const env = fixture();
  const app = express(); app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: req.headers['x-fixture-user'] || 'admin' }; next(); });
  app.use('/api/stage/regional-leagues', env.router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const origin = `http://127.0.0.1:${server.address().port}/api/stage/regional-leagues`;
  async function request(path, body, method = 'POST', headers = {}) {
    const response = await fetch(origin + path, { method, headers: { 'Content-Type': 'application/json', ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, data: await response.json() };
  }
  try {
    const definition = { name: 'fixture league', region_slug: 'north-america', slug: 'north-america-div-1', division: 1, season_number: 1, platform: 'Cross-Platform', status: 'registration' };
    assert.equal((await request('/seed', { definitions: [definition] })).status, 200);
    assert.equal((await request('/seed', { definitions: [definition] })).data.results[0].outcome, 'existing');
    assert.equal((await request('/edition-review', null, 'GET')).status, 200);
    assert.equal((await request('/edition-review', null, 'GET', { 'x-fixture-user': 'ordinary' })).status, 403);
    const canonical = [...env.rows.values()][0];
    env.legacy({ ...definition, id: 'duplicate-fixture' });
    const body = { source_id: 'duplicate-fixture', canonical_id: canonical.id };
    const preview = await request('/edition-review', body);
    assert.equal(preview.status, 200);
    assert.equal((await request('/edition-review', { ...body, apply: true, expected_revision: preview.data.revision, reason: 'Explicit local fixture approval' })).status, 200);
    const root = env.rows.get(canonical.id); root.status = 'completed'; root.data_json = JSON.stringify({ ...JSON.parse(root.data_json), status: 'completed' });
    assert.equal((await request(`/${canonical.id}/next-season`, {})).status, 200);
    assert.equal((await request(`/${canonical.id}/next-season`, {})).data.outcome, 'existing');
  } finally { await new Promise(resolve => server.close(resolve)); }
});

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

function fixture() {
  const tables = ['league_entities', 'matches', 'match_player_stats', 'club_fixture_lineups', 'club_fixture_availability', 'live_matches', 'live_match_events', 'competition_instances', 'competition_participants', 'competition_fixtures', 'competition_schedule_proposals', 'competition_result_submissions', 'competition_phase_states', 'competition_standings', 'competition_payouts', 'reward_configs', 'stc_transactions', 'player_stc_transactions', 'user_purchases', 'trophy_items', 'trophy_awards', 'trophy_placements', 'club_achievements', 'player_achievements', 'fixture_admin_actions', 'inbox_messages', 'notifications', 'predictions', 'rating_history', 'players', 'tournaments', 'admin_audit_log'];
  let state = Object.fromEntries(tables.map(t => [t, []]));
  let failure;
  let enumValues = null;
  const queries = [];
  const entity = (id, entity_type, record) => ({ id, entity_type, ...record, data_json: JSON.stringify({ ...record, id }) });
  async function query(sql, values = []) {
    queries.push(sql);
    if (failure && sql.includes(failure)) throw new Error('Injected reset failure');
    if (/FROM users/.test(sql)) return [{ id: values[0], email: 'admin@test.local', role_id: values[0] === 'super' ? 0 : 2 }];
    if (/information_schema.tables/.test(sql)) return tables.map(name => ({ name }));
    if (/information_schema.columns/.test(sql)) return [{ data_type: enumValues ? 'enum' : 'varchar', column_type: enumValues || 'varchar(50)' }];
    if (/@@transaction_isolation/.test(sql)) return [{ isolation_level: 'REPEATABLE-READ' }];
    if (/write-lock/.test(sql)) return [];
    if (/^SELECT/.test(sql)) {
      const table = /FROM\s+`?(\w+)/.exec(sql)[1];
      let rows = structuredClone(state[table] || []);
      if (table === 'league_entities') {
        if (/entity_type IN/.test(sql)) rows = rows.filter(r => ['regional_league', 'competition_season'].includes(r.entity_type));
        const kind = /entity_type='([^']+)'/.exec(sql)?.[1];
        if (kind) rows = rows.filter(r => r.entity_type === kind);
      }
      if (/source_type IN/.test(sql)) rows = rows.filter(r => values.includes(r.source_type));
      if (/status='earned'/.test(sql)) rows = rows.filter(r => r.status === 'earned');
      if (/status IN \('completed','archived'\)/.test(sql)) rows = rows.filter(r => ['completed', 'archived'].includes(r.status));
      let i = 0;
      for (const match of sql.matchAll(/\b(id|owner_id|owner_type|club_id)\s*=\s*\?/g)) { const value = values[i++]; rows = rows.filter(r => r[match[1]] === value); }
      if (/JSON_UNQUOTE/.test(sql)) rows = rows.filter(r => JSON.parse(r.data_json).winner_club_id === values[0]);
      return rows;
    }
    if (/^INSERT INTO/.test(sql)) {
      const table = /INTO\s+`?(\w+)/.exec(sql)[1];
      const columns = /\(([^)]+)\)/.exec(sql)[1].split(',').map(s => s.trim().replace(/`/g, ''));
      const row = Object.fromEntries(columns.map((c, i) => [c, values[i]]));
      if (row.regional_edition_key && state[table].some(r => r.regional_edition_key === row.regional_edition_key)) throw new Error('Duplicate regional edition key');
      state[table].push(row); return { affectedRows: 1 };
    }
    if (/JSON_SET\(data_json/.test(sql)) {
      const row = state.league_entities.find(r => r.id === values[2]);
      row.current_edition_id = values[0]; row.data_json = JSON.stringify({ ...JSON.parse(row.data_json), current_edition_id: values[0], active_reset_series: values[1] }); return {};
    }
    if (/^UPDATE league_entities/.test(sql)) {
      const row = state.league_entities.find(r => r.id === values.at(sql.includes('entity_type=?') ? -2 : -1));
      const record = JSON.parse(values[0]);
      if (/regional_edition_key/.test(sql)) {
        if (state.league_entities.some(r => r.id !== row.id && r.regional_edition_key === values[1])) throw new Error('Duplicate regional edition key');
        row.regional_edition_key = values[1];
      }
      Object.assign(row, record, { data_json: values[0] }); return { affectedRows: 1 };
    }
    if (/^UPDATE trophy_awards/.test(sql)) {
      Object.assign(state.trophy_awards.find(r => r.id === values[2]), { status: values[0], revoked_reason: values[1] }); return {};
    }
    if (/^UPDATE players SET ranking_competition_wins/.test(sql)) {
      state.players.find(r => r.id === values[1]).ranking_competition_wins = values[0]; return {};
    }
    if (/badge_type='revoked'/.test(sql)) {
      const table = /^UPDATE (\w+)/.exec(sql)[1]; Object.assign(state[table].find(r => r.id === values[1]), { source_type: values[0], badge_type: 'revoked' }); return {};
    }
    if (/^UPDATE `/.test(sql) && /SET status=\?/.test(sql)) {
      const table = /^UPDATE `(\w+)`/.exec(sql)[1]; const row = state[table].find(r => r.id === values[1]); row.status = values[0]; if (/ready_to_advance=0/.test(sql)) row.ready_to_advance = 0; return {};
    }
    throw new Error(`Unexpected reset fixture SQL: ${sql}`);
  }
  let queue = Promise.resolve();
  const withTransaction = fn => {
    const work = queue.then(async () => { const before = structuredClone(state); try { return await fn(query); } catch (error) { state = before; throw error; } });
    queue = work.catch(() => {}); return work;
  };
  const db = require.resolve('../../db/database');
  require.cache[db] = { id: db, filename: db, loaded: true, exports: { EXECUTESQL: query, withTransaction } };
  for (const file of ['../leagueResetService', '../competitionHistoryResetService', '../regionalEditionService', '../regionalEditionReviewService', '../rewardConfigurationService', '../trophyEntitlementService', '../../models/trophyAwardModel', '../../models/regionalLeagueModel']) delete require.cache[require.resolve(file)];
  const service = require('../leagueResetService');
  const regional = (id, extra = {}) => entity(id, 'regional_league', { name: 'North America', region_slug: 'north-america', region: 'north-america', division: 1, platform: 'Cross-Platform', season_number: 1, slug: 'north-america-div-1', status: 'completed', trophy_item_id: 'trophy', default_rules: { legs: 2 }, default_rewards: [{ position: 1, amount: 50 }], ...extra });
  state.league_entities.push(regional('original', { current_edition_id: 'season-two', winner_club_id: 'winner' }), regional('season-two', { permanent_league_id: 'original', season_number: 2, slug: 'north-america-div-1-s2', status: 'registration' }), regional('unrelated', { region_slug: 'europe', region: 'europe', slug: 'europe-div-1', status: 'registration' }));
  state.league_entities.push(entity('fixture', 'regional_league_fixture', { league_id: 'original', status: 'played', home_score: 3, away_score: 1, match_id: 'match' }));
  state.matches.push({ id: 'match', source_fixture_id: 'fixture', status: 'completed', home_score: 3, away_score: 1 });
  state.competition_instances.push({ id: 'engine', product_type: 'regional_league', legacy_source_id: 'original', status: 'completed' });
  state.competition_fixtures.push({ id: 'engine-fixture', competition_instance_id: 'engine', legacy_fixture_id: 'fixture', match_id: 'match', status: 'completed' });
  state.competition_phase_states.push({ id: 'phase', competition_instance_id: 'engine', phase: 'league', status: 'completed', ready_to_advance: 1 });
  const award = (id, source) => ({ id, owner_id: 'winner', owner_type: 'club', source_type: 'regional_league', source_id: source, edition_id: source + ':1', status: 'earned', trophy_item_id: 'trophy', award_key: id, metadata_json: JSON.stringify({ version: 1, winning_id: 'winner', award_role: 'club_champion', ranking_eligible: true }) });
  state.trophy_awards.push(award('selected-award', 'original'), award('other-award', 'unrelated'));
  state.trophy_placements.push({ id: 'cabinet', owner_id: 'winner', owner_type: 'club', award_id: 'selected-award', trophy_item_id: 'trophy', locked_at: '2026-10-01' });
  state.players.push({ id: 'player', club_id: 'winner', ranking_competition_wins: 2 });
  state.club_achievements.push({ id: 'achievement', source_type: 'regional_league', source_id: 'original', badge_type: 'winner', stc_awarded: '50.00' });
  state.stc_transactions.push({ id: 'paid', source_id: 'original', amount: '50.00' });
  const input = { scope: 'regional', selected_permanent_ids: ['original'] };
  const actor = { id: 'super' };
  const preview = () => service.preview(input, actor);
  const apply = review => service.apply({ ...input, confirmation: 'RESET LEAGUES', reason: 'Explicit test reset', review_revision: review.revision }, actor);
  return { service, query, queries, input, actor, preview, apply, entity, regional, get state() { return state; }, fail(text) { failure = text; }, enum(value) { enumValues = value; } };
}

test('reported completed Season 1 -> Season 2 -> reset preserves originals and creates exactly one new series edition', async () => {
  const env = fixture();
  const report = await env.preview();
  assert.deepEqual(report.blockers, []);
  assert.equal(report.award_count, 1);
  assert.equal(report.title_counts[0].after.official_ranking, 1);
  const money = structuredClone(env.state.stc_transactions);
  const originalBefore = JSON.parse(env.state.league_entities.find(r => r.id === 'original').data_json);
  const result = await env.apply(report);
  assert.equal(result.reset_regional_leagues, 1);
  assert.equal(result.fresh_editions.length, 1);
  const original = env.state.league_entities.find(r => r.id === 'original');
  const second = env.state.league_entities.find(r => r.id === 'season-two');
  assert.equal(original.season_number, 1);
  const resetOriginal = JSON.parse(original.data_json);
  assert.deepEqual(resetOriginal, { ...originalBefore, status: 'reset', edition_invalidated: true, current_edition_id: original.current_edition_id, active_reset_series: 1, reset_operation_id: result.operation_id, reset_at: resetOriginal.reset_at, entity_type: 'regional_league' });
  assert.equal(second.season_number, 2);
  assert.equal(second.status, 'reset');
  const fresh = JSON.parse(env.state.league_entities.find(r => r.id === original.current_edition_id).data_json);
  assert.equal(fresh.permanent_league_id, 'original');
  assert.equal(fresh.reset_series, 1);
  assert.equal(fresh.season_label, 'Series 1 \u00b7 Season 1');
  assert.equal(fresh.trophy_item_id, 'trophy');
  assert.deepEqual(fresh.default_rules, { legs: 2 });
  assert.deepEqual(fresh.default_rewards, [{ position: 1, amount: 50 }]);
  assert.equal(env.state.league_entities.filter(r => r.entity_type === 'regional_league' && (!r.permanent_league_id || r.permanent_league_id === r.id)).length, 2);
  assert.equal(env.state.trophy_awards[0].status, 'revoked');
  assert.equal(env.state.trophy_awards[1].status, 'earned');
  assert.equal(env.state.players[0].ranking_competition_wins, 1);
  assert.equal(env.state.club_achievements[0].badge_type, 'revoked');
  assert.equal(env.state.trophy_placements[0].locked_at, '2026-10-01');
  assert.equal(env.state.matches[0].status, 'cancelled');
  assert.equal(env.state.matches[0].home_score, 3);
  assert.equal(env.state.competition_phase_states[0].status, 'cancelled');
  assert.equal(env.state.competition_phase_states[0].ready_to_advance, 0);
  assert.deepEqual(env.state.stc_transactions, money);
  assert.equal(env.state.admin_audit_log.at(-1).admin_user_id, 'super');
  const lifecycleLock = env.queries.findIndex(sql => /league-lifecycle-write-lock/.test(sql));
  const regionalLock = env.queries.findIndex(sql => /regional-edition-write-lock/.test(sql));
  const evidenceLock = env.queries.findIndex(sql => /FROM `league_entities`/.test(sql) && /FOR UPDATE/.test(sql));
  assert.ok(lifecycleLock >= 0 && lifecycleLock < regionalLock && regionalLock < evidenceLock);
  assert.match(env.queries[evidenceLock], /NOT IN \('league_lifecycle_lock'/);
});

test('concurrent applies and retries reuse the committed operation, while a newly reviewed reset advances the series', async () => {
  const env = fixture(), review = await env.preview();
  const [first, retry] = await Promise.all([env.apply(review), env.apply(review)]);
  assert.deepEqual(first.fresh_editions, retry.fresh_editions);
  assert.equal(retry.already_applied, true);
  const nextReview = await env.preview();
  const next = await env.apply(nextReview);
  assert.equal(next.fresh_editions[0].reset_series, 2);
});

test('a failure after revocation and invalidation rolls back everything; retry succeeds', async () => {
  const env = fixture(), review = await env.preview();
  const before = structuredClone(env.state);
  env.fail('INSERT INTO `league_entities`');
  await assert.rejects(env.apply(review), /Injected reset failure/);
  assert.deepEqual(env.state, before);
  env.fail(null);
  assert.equal((await env.apply(review)).success, true);
});

test('fixture, rule, financial and placement edits invalidate the complete preview revision', async () => {
  for (const mutate of [s => { s.matches[0].home_score++; }, s => { s.league_entities[0].data_json = JSON.stringify({ ...JSON.parse(s.league_entities[0].data_json), default_rules: { legs: 1 } }); }, s => { s.stc_transactions[0].amount = '51.00'; }, s => { s.trophy_placements[0].x_percent = 25; }]) {
    const env = fixture(), report = await env.preview();
    mutate(env.state);
    const before = structuredClone(env.state);
    await assert.rejects(env.apply(report), /changed since preview/);
    assert.deepEqual(env.state, before);
  }
});

test('superadmin, reason, confirmation and explicit permanent scope are enforced', async () => {
  const env = fixture();
  await assert.rejects(env.service.preview(env.input, { id: 'admin' }), /Super admin/);
  assert.ok((await env.service.preview({ scope: 'regional', selected_permanent_ids: ['season-two'] }, env.actor)).blockers.length);
  await assert.rejects(env.service.preview({ selected_permanent_ids: [] }, env.actor), /nonempty/);
  const report = await env.preview();
  await assert.rejects(env.service.apply({ ...env.input, confirmation: 'RESET LEAGUES', review_revision: report.revision }, env.actor), /reason/);
  await assert.rejects(env.service.apply({ ...env.input, reason: 'test', review_revision: report.revision }, env.actor), /Type/);
});

test('an independent legacy rollover duplicate blocks mutation pending explicit consolidation', async () => {
  const env = fixture();
  delete env.state.league_entities[1].permanent_league_id;
  const json = JSON.parse(env.state.league_entities[1].data_json); delete json.permanent_league_id;
  env.state.league_entities[1].data_json = JSON.stringify(json);
  const report = await env.preview();
  assert.ok(report.blockers.some(b => /consolidation/.test(b)));
  await assert.rejects(env.apply(report), /review/);
});

test('GOST reset retains its permanent competition and previous season numbers', async () => {
  const env = fixture();
  env.state.league_entities.push(env.entity('gost', 'competition', { name: 'Supreme', status: 'active', trophy_item_id: 'gost-trophy', current_season_id: 'gost-two' }), env.entity('gost-one', 'competition_season', { competition_id: 'gost', season_number: 1, status: 'completed' }), env.entity('gost-two', 'competition_season', { competition_id: 'gost', season_number: 2, status: 'active' }));
  const input = { scope: 'gost', selected_permanent_ids: ['gost'] };
  const report = await env.service.preview(input, env.actor);
  assert.deepEqual(report.blockers, []);
  const result = await env.service.apply({ ...input, confirmation: 'RESET LEAGUES', reason: 'Test GOST', review_revision: report.revision }, env.actor);
  assert.equal(result.reset_competitions, 1);
  assert.equal(env.state.league_entities.find(r => r.id === 'gost-two').season_number, 2);
  const fresh = env.state.league_entities.find(r => r.id === result.fresh_editions[0].edition_id);
  assert.equal(fresh.competition_id, 'gost');
  assert.equal(JSON.parse(fresh.data_json).trophy_item_id, 'gost-trophy');
  assert.equal(fresh.status, 'draft');
  assert.equal(fresh.competition_edition_key, require('../leagueLifecycleService').competitionEditionKey('gost', 1, 1));
  assert.equal(env.state.trophy_awards.filter(r => r.status === 'earned').length, 2);
});

test('deployed enum statuses use allowed invalidation states and block unsupported schemas before mutation', async () => {
  const env = fixture();
  env.enum("enum('scheduled','completed','voided')");
  const review = await env.preview();
  assert.equal(review.sql_statuses.matches, 'voided');
  await env.apply(review);
  assert.equal(env.state.matches[0].status, 'voided');
  const blocked = fixture();
  blocked.enum("enum('scheduled','completed')");
  const report = await blocked.preview();
  assert.ok(report.blockers.some(b => /No supported invalidation status/.test(b)));
  const before = structuredClone(blocked.state);
  await assert.rejects(blocked.apply(report), /review/);
  assert.deepEqual(blocked.state, before);
});

test('the existing reset function is exercised over local HTTP with authenticated fixture identities', async () => {
  const env = fixture();
  const express = require('express');
  const { HANDLERS } = require('../../functions/legacyFunctions');
  const { createFunctionsRouter } = require('../../functions/functionsRouter');
  const app = express(); app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: req.headers['x-fixture-user'] || 'super' }; next(); });
  app.use('/api/stage/functions', createFunctionsRouter({ adminResetLeagueCompetitionData: HANDLERS.adminResetLeagueCompetitionData }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  try {
    const url = `http://127.0.0.1:${server.address().port}/api/stage/functions/adminResetLeagueCompetitionData`;
    const request = (body, user = 'super') => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-fixture-user': user }, body: JSON.stringify(body) });
    assert.equal((await request({ ...env.input, dry_run: true, _auth_user_id: 'super' }, 'admin')).status, 403);
    const preview = await request({ ...env.input, dry_run: true });
    assert.equal(preview.status, 200);
    const review = (await preview.json()).data;
    const response = await request({ ...env.input, confirmation: 'RESET LEAGUES', reason: 'Local HTTP fixture test', review_revision: review.revision });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.fresh_editions.length, 1);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('verified legacy honours without stored awards cannot reappear from the preserved original winner', async () => {
  const { setup } = require('./rewardFlowFixture.cjs');
  const env = setup();
  env.setRoot({ status: 'completed', winner_club_id: 'club-1', trophy_item_id: null });
  env.state.items.length = 0;
  const reset = require('../competitionHistoryResetService');
  const selection = { edition_ids: ['edition'] };
  assert.equal((await reset.preview('regional', env.query, false, selection)).award_count, 1);
  await reset.revoke('regional', env.query, { id: 'admin' }, 'Explicit legacy reset', selection);
  assert.equal(env.root.status, 'completed');
  assert.equal(env.root.winner_club_id, 'club-1');
  assert.equal(env.state.awards[0].status, 'revoked');
  const report = await require('../trophyEntitlementService').review('club-1', 'club', env.query);
  assert.equal(report.titles.all_time, 0);
  assert.equal((await reset.revoke('regional', env.query, { id: 'admin' }, 'Retry legacy reset', selection)).revoked_awards, 0);
});

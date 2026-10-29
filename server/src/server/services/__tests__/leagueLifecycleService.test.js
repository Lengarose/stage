const test = require('node:test');
const assert = require('node:assert/strict');
const { createLifecycleService, planFixtures, assertEditionWritable } = require('../leagueLifecycleService');

function fixture(kind = 'regional_league', count = 4) {
  let state = { roots: {}, fixtures: [], audits: [], payments: [], awards: [], standings: [], captures: 0, completions: 0 };
  const root = { id: 'edition', status: 'in_progress', registered_club_ids: Array.from({ length: count }, (_, i) => `club-${i}`),
    max_clubs: count, target_clubs: kind === 'regional_league' ? count : 36, season_number: 1,
    permanent_league_id: 'permanent', reset_series: 0, competition_id: 'gost', competition_slug: 'supreme',
    platform: 'cross-platform', region_slug: 'uk-ireland', division: 3, num_league_matchdays: 8 };
  state.roots.edition = structuredClone(root);
  state.roots.permanent = { id: 'permanent', status: 'active' };
  state.roots.gost = { id: 'gost', name: 'Supreme', slug: 'supreme', tier: 1, status: 'active', trophy_item_id: 'permanent-cup', rules: 'Permanent rules' };
  let failInsert = 0, queue = Promise.resolve();
  const users = { admin: { id: 'admin', email: 'real@admin.test', role_id: 2 }, super: { id: 'super', role_id: 0 }, player: { id: 'player', role_id: 1 } };
  const clubs = root.registered_club_ids.map(id => ({ id, name: id }));
  state.standings = clubs.map((c, i) => ({ id: `standing-${i}`, club_id: c.id, club_name: c.name, league_id: root.id, season_id: root.id }));
  async function withTransaction(fn) {
    let release, snapshot;
    const query = async (sql, v = []) => {
      if (sql.startsWith('SELECT id FROM league_entities') && sql.includes('league-lifecycle-write-lock')) {
        const previous = queue; queue = new Promise(resolve => { release = resolve; }); await previous; return [];
      }
      if (sql.includes('league-lifecycle-write-lock')) return [];
      if (sql.includes('FROM users')) return users[v[0]] ? [users[v[0]]] : [];
      if (sql.includes('FROM clubs')) return clubs;
      if (sql.includes('FROM competition_payouts')) return state.payments;
      if (sql.includes('FROM trophy_awards')) return state.awards;
      if (sql === 'SELECT * FROM league_entities WHERE id=? AND entity_type=? FOR UPDATE') return state.roots[v[0]] ? [{ ...state.roots[v[0]], data_json: '{}' }] : [];
      if (sql.includes("entity_type='competition'")) return state.roots[v[0]] ? [{ ...state.roots[v[0]], data_json: '{}' }] : [];
      if (sql.includes("entity_type='competition_season'")) return Object.values(state.roots).filter(r => r.competition_id === v[0]).map(r => ({ ...r, data_json: '{}' }));
      if (sql.startsWith('INSERT INTO admin_audit_log')) { snapshot ||= structuredClone(state); state.audits.push(v); return {}; }
      if (sql.startsWith('UPDATE league_entities')) { snapshot ||= structuredClone(state); state.roots[v[2]] = JSON.parse(v[0]); return {}; }
      if (sql.startsWith('INSERT INTO league_entities')) {
        snapshot ||= structuredClone(state);
        if (sql.includes("'competition_season'")) {
          const r = JSON.parse(v[1]);
          const columns = sql.slice(sql.indexOf('(') + 1, sql.indexOf(')')).split(',').map(s => s.trim());
          const valueTokens = sql.slice(sql.indexOf('VALUES (') + 8).split(',');
          let parameter = 0;
          const indexed = {};
          columns.forEach((column, index) => { if (valueTokens[index]?.trim() === '?') indexed[column] = v[parameter++]; });
          assert.equal(indexed.reset_series, r.reset_series, 'indexed reset series must match the edition JSON');
          state.roots[r.id] = { ...r, reset_series: indexed.reset_series ?? 0 }; return {};
        }
        if (failInsert && --failInsert === 0) throw new Error('Injected fixture insert failure');
        state.fixtures.push(JSON.parse(v[2])); return {};
      }
      throw new Error(`Unhandled SQL: ${sql}`);
    };
    try { return await fn(query); } catch (error) { if (snapshot) state = snapshot; throw error; } finally { release?.(); }
  }
  const scopeModel = { async selectOne(source_type, id) {
    if (!state.roots[id]) throw Object.assign(new Error('Not found'), { status: 404 });
    const fixtures = state.fixtures.filter(f => (source_type === 'regional_league' ? f.league_id : f.season_id) === id);
    const matches = fixtures.map(f => ({ ...f, fixture_id: f.id, tournament_id: id, type: f.phase || 'league', status: f.status === 'played' ? 'completed' : f.status }));
    return structuredClone({ source_type, edition_id: id, root: state.roots[id], fixtures, matches,
      standings: state.standings, participants: clubs });
  } };
  const engine = { async advanceLeagueEdition(source_type, f, options) {
    assert.ok(options.admin.email === users.admin.email || options.admin.id === 'super');
    assert.equal(source_type === 'regional_league' ? f.league_id : f.season_id, 'edition');
    state.completions++;
    return withTransaction(async query => {
      await query('UPDATE league_entities SET data_json=?,status=? WHERE id=?', [JSON.stringify({ ...state.roots.edition, status: 'completed' }), 'completed', 'edition']);
      await query('INSERT INTO admin_audit_log', ['canonical-completion']);
      return { advanced: true, next_phase: 'completed' };
    });
  } };
  const service = createLifecycleService({ withTransaction, scopeModel, engine, prizes: { capture: async () => { state.captures++; return { config: {} }; } }, allowTestMode: true });
  return { service, clubs, kind, get state() { return state; }, root: () => state.roots.edition,
    failAt: n => { failInsert = n; }, draw: (body = {}, actor = { id: 'admin' }) => service.action(kind, 'edition', { action: 'draw', ...body }, actor),
    action: (action, body = {}) => service.action(kind, 'edition', { action, ...body }, { id: 'admin' }) };
}

test('Regional started edition draws a complete mirrored schedule with stable edition references, including Division 3', async () => {
  const env = fixture(); const result = await env.draw();
  assert.equal(result.fixtures_created, 12); assert.equal(result.matchdays, 6);
  assert.equal(env.state.audits.length, 1);
  assert.equal(env.state.audits[0][1], 'admin'); assert.equal(env.state.audits[0][2], 'real@admin.test');
  assert.ok(env.state.fixtures.every(f => f.league_id === 'edition' && f.division === 3 && f.home_score === null && f.status === 'unscheduled'));
  const pairs = new Set(env.state.fixtures.map(f => `${f.home_club_id}:${f.away_club_id}`));
  assert.equal(pairs.size, 12);
  for (let day = 1; day <= 6; day++) assert.equal(new Set(env.state.fixtures.filter(f => f.matchday === day).flatMap(f => [f.home_club_id, f.away_club_id])).size, 4);
  assert.equal(env.root().permanent_league_id, 'permanent');
});

test('concurrent and repeated draw requests cannot duplicate or overwrite fixtures', async () => {
  const env = fixture();
  const results = await Promise.allSettled([env.draw(), env.draw()]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(env.state.fixtures.length, 12); assert.equal(env.state.audits.length, 1);
  const before = structuredClone(env.state.fixtures);
  await assert.rejects(env.draw(), { status: 409 }); assert.deepEqual(env.state.fixtures, before);
});

test('a failed draw rolls back all fixture writes and status; retry succeeds', async () => {
  const env = fixture(); env.failAt(4);
  await assert.rejects(env.draw(), /Injected fixture insert failure/);
  assert.equal(env.state.fixtures.length, 0); assert.equal(env.state.audits.length, 0); assert.equal(env.root().fixtures_generated, undefined);
  await env.draw(); assert.equal(env.state.fixtures.length, 12);
});

test('production Regional capacity is enforced and reduced testing requires an explicitly enabled edition and superadmin', async () => {
  const env = fixture(); env.root().max_clubs = 20;
  await assert.rejects(env.draw(), /requires 20/);
  await assert.rejects(env.draw({ test_mode: true }), { status: 403 });
  env.root().test_mode = true;
  await assert.rejects(env.draw({ test_mode: true }), { status: 403 });
  await env.draw({ test_mode: true }, { id: 'super' });
  assert.equal(env.state.fixtures.length, 12);
});

test('GOST production draw requires 36 clubs and only generates configured league rounds', async () => {
  const env = fixture('competition_season', 36);
  const result = await env.draw();
  assert.equal(result.fixtures_created, 144); assert.equal(result.matchdays, 8);
  assert.ok(env.state.fixtures.every(f => f.season_id === 'edition' && f.competition_id === 'gost' && f.phase === 'league'));
  assert.equal(env.root().status, 'league_phase');
  for (const club of env.clubs) assert.equal(env.state.fixtures.filter(f => [f.home_club_id, f.away_club_id].includes(club.id)).length, 8);
  const small = fixture('competition_season', 4); await assert.rejects(small.draw(), /requires 36/);
  small.root().target_clubs = 4; await assert.rejects(small.draw(), /Invalid production participant target/);
});

test('invalid schedule configuration, malformed registration, duplicate/excluded standings and missing clubs fail before capture', async () => {
  for (const change of [e => { e.root().num_league_matchdays = 7; }, e => { e.root().num_league_matchdays = 100; }]) {
    const env = fixture('competition_season', 36); change(env); await assert.rejects(env.draw(), /matchday configuration/); assert.equal(env.state.captures, 0);
  }
  for (const change of [e => { e.root().registered_club_ids[1] = 'club-0'; }, e => { e.state.standings[1].club_id = 'club-0'; }, e => { e.state.standings[0].is_excluded = true; }, e => { e.clubs.pop(); }]) {
    const env = fixture(); change(env); await assert.rejects(env.draw(), { status: 409 }); assert.equal(env.state.captures, 0);
  }
});

test('actual database role, exact edition and terminal lifecycle state are enforced', async () => {
  const env = fixture();
  await assert.rejects(env.draw({}, { id: 'player', role_id: 0 }), { status: 403 });
  await assert.rejects(env.draw({}, { email: 'real@admin.test', role_id: 0 }), { status: 403 });
  await assert.rejects(env.draw({ edition_id: 'different' }), { status: 409 });
  await assert.rejects(env.draw({ season_number: 2 }), { status: 409 });
  env.root().status = 'cancelled'; await assert.rejects(env.draw(), { status: 409 });
  assert.equal(env.state.fixtures.length, 0);
});

test('empty and unconfirmed schedules cannot complete or create outcomes', async () => {
  const env = fixture();
  await assert.rejects(env.action('complete'), /Cannot complete/);
  await env.draw(); await assert.rejects(env.action('complete'), /unconfirmed/);
  for (const f of env.state.fixtures) Object.assign(f, { status: 'played', stats_processed: true, result_state: 'AWAITING_AWAY_CONFIRMATION' });
  await assert.rejects(env.action('complete'), /unconfirmed/);
  assert.equal(env.state.completions, 0); assert.equal(env.root().status, 'in_progress');
});

function confirmedRegional(env) {
  env.state.fixtures.push(...planFixtures('regional_league', env.root(), env.clubs));
  const stats = new Map(env.state.standings.map(s => [s.club_id, s]));
  for (const f of env.state.fixtures) {
    const homeWins = Number(f.home_club_id.split('-')[1]) < Number(f.away_club_id.split('-')[1]);
    Object.assign(f, { home_score: homeWins ? 1 : 0, away_score: homeWins ? 0 : 1, status: 'completed', result_state: 'CONFIRMED', stats_processed: true });
    for (const [id, score, against] of [[f.home_club_id, f.home_score, f.away_score], [f.away_club_id, f.away_score, f.home_score]]) {
      const s = stats.get(id); const win = score > against;
      for (const [key, delta] of Object.entries({ played: 1, wins: Number(win), losses: Number(!win), goals_for: score, goals_against: against, goal_difference: score - against, points: win ? 3 : 0 })) s[key] = (s[key] || 0) + delta;
    }
  }
}

test('valid Regional completion delegates to canonical server outcomes only after schedule and standings validation', async () => {
  const env = fixture(); confirmedRegional(env);
  const result = await env.action('complete'); assert.equal(result.advanced, true);
  assert.equal(env.state.completions, 1); assert.equal(env.root().status, 'completed');
});

test('missing/duplicate Regional fixtures and stale standings prevent authoritative completion', async () => {
  for (const change of [e => e.state.fixtures.pop(), e => { e.state.fixtures[0] = { ...e.state.fixtures[1] }; }, e => { e.state.standings[0].points = 999; }]) {
    const env = fixture(); confirmedRegional(env); change(env);
    await assert.rejects(env.action('complete'), { status: 409 }); assert.equal(env.state.completions, 0);
  }
});

test('GOST cannot complete without every required playoff and final stage', async () => {
  const env = fixture('competition_season', 36); await env.draw();
  for (const f of env.state.fixtures) Object.assign(f, { home_score: 1, away_score: 0, status: 'completed', stats_processed: true, result_state: 'CONFIRMED' });
  await assert.rejects(env.action('complete'), /playoff_round/); assert.equal(env.state.completions, 0);
});

function confirmedGost(env) {
  env.state.fixtures.push(...planFixtures('competition_season', env.root(), env.clubs));
  for (const f of env.state.fixtures) Object.assign(f, { home_score: 1, away_score: 0, status: 'completed', stats_processed: true, result_state: 'CONFIRMED' });
  const { calculateStandings } = require('../../lib/standingsCore');
  const table = calculateStandings(env.state.fixtures.map(f => ({ ...f, type: 'league' })), { participants: env.clubs }).rows;
  for (const row of env.state.standings) {
    const r = table.find(c => c.id === row.club_id);
    Object.assign(row, { played: r.P, wins: r.W, draws: r.D, losses: r.L, points: r.Pts, goals_for: r.GF, goals_against: r.GA, goal_difference: r.GD });
  }
  for (const [phase, count] of [['playoff_round', 8], ['knockout_r16', 8], ['knockout_qf', 4], ['knockout_sf', 2], ['knockout_final', 1]]) {
    for (let i = 0; i < count; i++) for (let leg = 1; leg <= (phase === 'knockout_final' ? 1 : 2); leg++) {
      env.state.fixtures.push({ id: `${phase}:${i}:${leg}`, season_id: 'edition', phase, tie_id: `${phase}:${i}`, leg, round: leg,
        home_club_id: `club-${leg === 1 ? i * 2 : i * 2 + 1}`, away_club_id: `club-${leg === 1 ? i * 2 + 1 : i * 2}`,
        home_score: leg === 1 ? 2 : 0, away_score: leg === 1 ? 0 : 1, status: 'completed', stats_processed: true, result_state: 'CONFIRMED' });
    }
  }
  env.root().status = 'knockout';
}

test('complete GOST schedule delegates final outcomes and accepts a confirmed penalty winner', async () => {
  const env = fixture('competition_season', 36); confirmedGost(env);
  const final = env.state.fixtures.at(-1);
  Object.assign(final, { home_score: 1, away_score: 1, decided_on_penalties: true, penalty_winner_side: 'home', winner_club_id: final.home_club_id });
  const result = await env.action('complete'); assert.equal(result.advanced, true); assert.equal(env.state.completions, 1);
});

test('GOST missing aggregate legs, unresolved finals and disputed finals block all outcomes', async () => {
  for (const change of [e => e.state.fixtures.splice(e.state.fixtures.findIndex(f => f.phase === 'knockout_sf'), 1),
    e => Object.assign(e.state.fixtures.at(-1), { home_score: 0, away_score: 0 }),
    e => { e.state.fixtures.at(-1).result_state = 'DISPUTED'; }]) {
    const env = fixture('competition_season', 36); confirmedGost(env); change(env);
    await assert.rejects(env.action('complete'), { status: 409 }); assert.equal(env.state.completions, 0);
  }
});

test('abandon requires confirmation/reason, is audited and retryable, and preserves fixtures and unpaid financial obligations', async () => {
  const env = fixture(); await env.draw(); const before = structuredClone(env.state.fixtures);
  env.state.payments.push({ id: 'obligation', status: 'pending' });
  await assert.rejects(env.action('abandon', { reason: 'Cancelled' }), { status: 400 });
  await assert.rejects(env.action('abandon', { confirm: true, reason: ' ' }), { status: 400 });
  const result = await env.action('abandon', { confirm: true, reason: 'Club withdrawals' });
  assert.equal(result.record.status, 'cancelled'); assert.equal(result.record.financial_review_required, true);
  assert.equal(result.record.winner_club_id, undefined); assert.deepEqual(env.state.fixtures, before);
  assert.equal(env.state.payments.length, 1); assert.equal(env.state.completions, 0); assert.equal(env.state.awards.length, 0);
  assert.equal((await env.action('abandon', { confirm: true, reason: 'Retry' })).outcome, 'existing');
  assert.equal(env.state.audits.length, 2); await assert.rejects(env.action('complete'), /closed/);
});

test('paid financial obligations and earned honours block abandonment for explicit review', async () => {
  for (const change of [e => e.state.payments.push({ status: 'paid' }), e => e.state.awards.push({ id: 'earned-award' })]) {
    const env = fixture(); change(env);
    await assert.rejects(env.action('abandon', { confirm: true, reason: 'Withdrawals' }), { status: 409 });
    assert.equal(env.root().status, 'in_progress'); assert.equal(env.state.audits.length, 0);
  }
});

test('abandon accepts the shared UI confirmation contract and preserves GOST provisional playoff positions', async () => {
  const env = fixture('competition_season', 36); env.state.standings[0].final_position = 25;
  const result = await env.action('abandon', { confirmation: true, reason: 'Competition withdrawn' });
  assert.equal(result.record.status, 'cancelled'); assert.equal(env.state.completions, 0);
});

test('live suspended clubs cannot be drawn even with otherwise valid standing snapshots', async () => {
  const env = fixture(); env.clubs[0].status = 'suspended';
  await assert.rejects(env.draw(), /ineligible/); assert.equal(env.state.fixtures.length, 0);
});

test('retired permanent parents block child draw and live writable guards while completed corrections remain available', async () => {
  for (const kind of ['regional_league', 'competition_season']) {
    const env = fixture(kind, kind === 'regional_league' ? 4 : 36);
    const parentId = kind === 'regional_league' ? 'permanent' : 'gost';
    env.state.roots[parentId].retired = true; env.root().status = 'draft';
    await assert.rejects(env.draw(), /permanent competition is retired/);
    assert.equal(env.state.captures, 0); assert.equal(env.state.fixtures.length, 0);
    const query = async (sql, values) => {
      assert.match(sql, /FOR UPDATE$/);
      const record = env.state.roots[values[0]]; return record ? [{ ...record, data_json: '{}' }] : [];
    };
    await assert.rejects(assertEditionWritable(query, kind, 'edition', { allowCompleted: false }), /retired/);
    env.root().status = 'completed';
    assert.equal((await assertEditionWritable(query, kind, 'edition')).id, 'edition');
  }
});

test('odd Regional rosters retain byes and both legs without losing a participant', async () => {
  const env = fixture('regional_league', 5); const result = await env.draw();
  assert.equal(result.fixtures_created, 20); assert.equal(result.matchdays, 10);
  for (const club of env.clubs) assert.equal(env.state.fixtures.filter(f => [f.home_club_id, f.away_club_id].includes(club.id)).length, 8);
});

test('GOST concurrent rollover creates one fresh edition inheriting permanent defaults and preserves past data', async () => {
  const env = fixture('competition_season', 36); env.root().status = 'completed';
  const previous = structuredClone(env.root());
  const [a, b] = await Promise.all([env.action('rollover'), env.action('rollover')]);
  assert.equal(a.record.id, b.record.id); assert.equal(a.record.trophy_item_id, 'permanent-cup');
  assert.equal(a.record.rules, 'Permanent rules'); assert.equal(a.record.season_number, 2);
  assert.deepEqual(a.record.registered_club_ids, []); assert.equal(a.record.previous_season_id, 'edition');
  assert.deepEqual(env.root(), { ...previous, next_season_id: a.record.id });
  assert.equal(env.state.roots.gost.current_season_id, a.record.id);
  assert.equal(Object.values(env.state.roots).filter(r => r.competition_id === 'gost').length, 2);
  assert.equal(env.state.audits.length, 1); assert.equal(env.state.captures, 0);
});

test('GOST rollover rejects active editions and ambiguous successors', async () => {
  const env = fixture('competition_season', 36); await assert.rejects(env.action('rollover'), /Complete or abandon/);
  env.root().status = 'completed'; env.state.roots.conflict = { id: 'conflict', competition_id: 'gost', season_number: 2, status: 'draft' };
  await assert.rejects(env.action('rollover'), /successor/); assert.equal(env.state.audits.length, 0);
});

test('GOST rollover persists indexed reset series and labels repeated season numbers unambiguously', async () => {
  const env = fixture('competition_season', 36);
  env.root().reset_series = 2; env.root().status = 'completed'; env.state.roots.gost.reset_series = 2;
  const result = await env.action('rollover');
  assert.equal(result.record.reset_series, 2); assert.equal(result.record.season_label, 'Series 2 \u00b7 Season 2');
  assert.equal(env.state.roots[result.record.id].reset_series, 2);
});

test('lifecycle HTTP route exercises draw, completion, abandonment and rollover with isolated service fixtures', async () => {
  const express = require('express');
  const serviceModule = require('../leagueLifecycleService');
  const originalAction = serviceModule.action;
  const regional = fixture(), gost = fixture('competition_season', 36);
  serviceModule.action = (kind, id, body, actor) => (kind === 'regional_league' ? regional : gost).service.action(kind, id, body, actor);
  const app = express(); app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: req.headers['x-fixture-user'] || 'admin' }; next(); });
  app.use('/api/stage/competition-views', require('../../controllers/competitionViewsController'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  async function post(kind, action, extra = {}, user = 'admin') {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/stage/competition-views/${kind}/edition/lifecycle`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-fixture-user': user }, body: JSON.stringify({ action, ...extra }),
    });
    return { status: response.status, data: await response.json() };
  }
  try {
    assert.equal((await post('regional_league', 'draw', {}, 'player')).status, 403);
    assert.equal((await post('regional_league', 'draw')).data.fixtures_created, 12);
    assert.equal((await post('regional_league', 'draw')).status, 409);
    assert.equal((await post('regional_league', 'complete')).status, 409);
    assert.equal((await post('regional_league', 'abandon', { confirmation: true, reason: 'Isolated fixture cancellation' })).status, 200);
    confirmedGost(gost);
    assert.equal((await post('competition_season', 'complete')).status, 200);
    const next = await post('competition_season', 'rollover');
    assert.equal(next.status, 200, JSON.stringify(next.data));
    assert.equal(next.data.record.season_number, 2);
  } finally {
    await new Promise(resolve => server.close(resolve));
    serviceModule.action = originalAction;
  }
});

test('generic GOST initial-season HTTP creation is authorised, idempotent and cannot bypass rollover', async () => {
  const express = require('express'), env = fixture('competition_season', 36);
  delete env.state.roots.edition;
  const serviceModule = require('../leagueLifecycleService');
  const original = serviceModule.createInitialCompetitionSeason;
  serviceModule.createInitialCompetitionSeason = env.service.createInitialCompetitionSeason;
  const app = express(); app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: req.headers['x-fixture-user'] || 'admin' }; next(); });
  app.use('/api/stage/competition-seasons', require('../../controllers/leagueEntityController').makeRouter('competition_season'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  async function create(body = {}, user = 'admin') {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/stage/competition-seasons`, {
      method:'POST',headers:{'content-type':'application/json','x-fixture-user':user},body:JSON.stringify({competition_id:'gost',...body}),
    });
    return {status:response.status,data:await response.json()};
  }
  try {
    assert.equal((await create({}, 'player')).status,403);
    const first=await create(); assert.equal(first.status,201,JSON.stringify(first.data));
    assert.equal(first.data.trophy_item_id,'permanent-cup');
    const again=await create(); assert.equal(again.status,200); assert.equal(again.data.id,first.data.id);
    assert.equal((await create({season_number:2})).status,409);
    assert.equal((await create({status:'completed'})).status,400);
  } finally { await new Promise(resolve=>server.close(resolve)); serviceModule.createInitialCompetitionSeason=original; }
});

test('generic GOST initial POST is protected, idempotent and cannot create subsequent seasons', async () => {
  const express = require('express');
  const serviceModule = require('../leagueLifecycleService');
  const originalCreate = serviceModule.createInitialCompetitionSeason;
  const env = fixture('competition_season', 36); delete env.state.roots.edition;
  serviceModule.createInitialCompetitionSeason = (body, actor) => env.service.createInitialCompetitionSeason(body, actor);
  const app = express(); app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: req.headers['x-fixture-user'] || 'admin' }; next(); });
  app.use('/api/stage/competition-seasons', require('../../controllers/leagueEntityController').makeRouter('competition_season'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  const body = { competition_id: 'gost', season_number: 1, platform: 'cross-platform', region: 'Europe', status: 'draft', registered_club_ids: [], num_league_matchdays: 8, league_matchday_total: 8, max_clubs: 36, target_clubs: 36 };
  async function post(patch = {}, user = 'admin') {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/stage/competition-seasons`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-fixture-user': user }, body: JSON.stringify({ ...body, ...patch }) });
    return { status: response.status, data: await response.json() };
  }
  try {
    assert.equal((await post({ role_id: 0 }, 'player')).status, 403);
    const created = await post(); assert.equal(created.status, 201, JSON.stringify(created.data));
    const retries = await Promise.all([post(), post()]);
    assert.ok(retries.every(r => r.status === 200 && r.data.id === created.data.id));
    assert.equal(created.data.reset_series, 0); assert.equal(created.data.trophy_item_id, 'permanent-cup');
    assert.equal(env.state.roots.gost.current_season_id, created.data.id); assert.equal(env.state.audits.length, 1);
    assert.equal((await post({ season_number: 2 })).status, 409);
    assert.equal((await post({ status: 'completed' })).status, 400);
    env.state.roots[created.data.id].status = 'completed';
    assert.equal((await post()).status, 409);
    assert.equal(Object.values(env.state.roots).filter(r => r.competition_id === 'gost').length, 1);
  } finally {
    await new Promise(resolve => server.close(resolve)); serviceModule.createInitialCompetitionSeason = originalCreate;
  }
});

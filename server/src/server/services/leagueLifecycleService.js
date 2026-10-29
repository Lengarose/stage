'use strict';
const { v4: uuid } = require('uuid');
const { createHash } = require('node:crypto');
const database = require('../db/database');
const { CompetitionScopeModel, unpack } = require('../models/competitionScopeModel');
const { roundReadiness } = require('../lib/leagueRoundReadiness');
const { reviewStandings } = require('../lib/standingIntegrity');
const { sortStandingRows } = require('../lib/competitionStandings');

const phases = ['league', 'playoff_round', 'knockout_r16', 'knockout_qf', 'knockout_sf', 'knockout_final'];
const terminal = ['completed', 'archived', 'cancelled', 'abandoned', 'retired', 'reset', 'superseded'];
function fail(message, status = 409, details) {
  const error = new Error(message); Object.assign(error, { status, details }); throw error;
}
function list(value) {
  if (typeof value === 'string') { try { value = JSON.parse(value); } catch { return null; } }
  return Array.isArray(value) ? value : null;
}
const normalize = value => String(value || '').toLowerCase().replace(/[ _]/g, '-');
const competitionEditionKey = (parentId, series, season) => createHash('sha256').update(JSON.stringify([String(parentId), Number(series), Number(season)])).digest('hex');
const leagueOnly = root => root.format === 'league' || root.league_only === true;

async function assertParentNotRetired(query, kind, root) {
  const parentId = kind === 'regional_league' ? root.permanent_league_id || root.id : root.competition_id;
  const parentKind = kind === 'regional_league' ? 'regional_league' : 'competition';
  const [stored] = parentId === root.id && kind === parentKind ? [root] :
    await query('SELECT * FROM league_entities WHERE id=? AND entity_type=? FOR UPDATE', [parentId, parentKind]);
  if (!stored) fail('Permanent competition not found', 404);
  const parent = stored.data_json === undefined ? stored : unpack(stored);
  if (parent.retired_at || [true, 1, '1', 'true'].includes(parent.retired) || normalize(parent.status) === 'retired') fail('The permanent competition is retired; live edition actions are blocked');
}

async function assertEditionWritable(query, kind, id, { allowCompleted = true } = {}) {
  if (!['regional_league', 'competition_season'].includes(kind) || typeof id !== 'string' || !id.trim()) fail('An exact supported edition ID is required', 400);
  // Use the caller's write transaction so reset/abandon cannot interleave after this check.
  const [stored] = await query('SELECT * FROM league_entities WHERE id=? AND entity_type=? FOR UPDATE', [id, kind]);
  if (!stored) fail('Competition edition not found', 404);
  const root = unpack(stored);
  const status = normalize(root.status).trim();
  const invalidated = [true, 1, '1', 'true'].includes(root.edition_invalidated);
  if (invalidated || ['cancelled', 'canceled', 'abandoned', 'reset', 'superseded', 'retired'].includes(status)) fail('This competition edition is closed or invalidated; result and simulation writes are blocked');
  if (!allowCompleted && ['completed', 'archived'].includes(status)) fail('Completed or archived editions require the authorised correction review path');
  if (!['completed', 'archived'].includes(status)) await assertParentNotRetired(query, kind, root);
  return root;
}

// The circle rotation and mirrored return legs are the existing competitionUtils draw.
// Keep planning pure: validation precedes any fixture writes, and no later rounds are drawn here.
function planFixtures(kind, root, clubs) {
  const regional = kind === 'regional_league';
  const circle = clubs.length % 2 ? [...clubs, null] : [...clubs];
  const rounds = [];
  for (let r = 0; r < circle.length - 1; r++) {
    const day = [];
    for (let i = 0; i < circle.length / 2; i++) {
      const home = circle[i], away = circle[circle.length - 1 - i];
      if (home && away) day.push({ home, away });
    }
    rounds.push(day);
    circle.splice(1, 0, circle.pop());
  }
  const days = regional ? rounds.length * 2 : Number(root.num_league_matchdays ?? root.league_matchday_total ?? 8);
  if (!regional && root.num_league_matchdays != null && root.league_matchday_total != null && Number(root.num_league_matchdays) !== Number(root.league_matchday_total)) fail('League matchday settings disagree');
  if (!Number.isInteger(days) || days < 2 || days % 2 || days > rounds.length * 2) fail('Invalid league matchday configuration');
  if (!regional && clubs.length % 2) fail('GOST requires an even participant count');
  if (root.legs != null && Number(root.legs) !== 2) fail('This format requires home and away legs');
  const first = rounds.slice(0, days / 2);
  const matchdays = [...first, ...first.map(day => day.map(({ home, away }) => ({ home: away, away: home })))];
  const fields = (side, club) => ({ [`${side}_club_id`]: club.id, [`${side}_club_name`]: club.name,
    [`${side}_club_logo_url`]: club.logo_url || '', [`${side}_club_tag`]: club.tag || '' });
  return matchdays.flatMap((day, i) => day.map(({ home, away }) => ({
    id: uuid(), ...(regional ? { league_id: root.id, league_name: root.name, region_slug: root.region_slug, division: root.division } :
      { season_id: root.id, competition_id: root.competition_id, competition_name: root.competition_name, competition_slug: root.competition_slug, competition_tier: root.competition_tier }),
    season_number: root.season_number || 1, phase: 'league', matchday: i + 1,
    ...fields('home', home), ...fields('away', away), status: 'unscheduled', scheduling_status: 'open',
    home_score: null, away_score: null, stats_processed: false, window_start: null, window_end: null, window_days: null, proposal_count: 0,
  })));
}

function validateRoster(scope, body, user, allowTestMode) {
  const { root, standings, participants } = scope;
  const registered = list(root.registered_club_ids);
  if (!registered || registered.some(id => typeof id !== 'string' || !id.trim()) || new Set(registered).size !== registered.length) fail('Registered participants are missing, invalid or duplicated');
  const regional = scope.source_type === 'regional_league';
  const target = Number(regional ? root.max_clubs ?? 20 : root.target_clubs ?? root.max_clubs ?? 36);
  const test = body.test_mode === true;
  if (test && !(allowTestMode && Number(user.role_id) === 0 && root.test_mode === true)) fail('Reduced-size test mode is not authorised for this edition', 403);
  if (!Number.isInteger(target) || target < 2 || target > 100 || (!regional && !test && target !== 36)) fail('Invalid production participant target');
  if ((!test && registered.length !== target) || registered.length < (regional ? 2 : 4) || registered.length > target) fail(`This edition requires ${target} registered clubs`, 409, { registered: registered.length, required: target });
  if (standings.length !== registered.length || new Set(standings.map(s => s.club_id)).size !== registered.length || standings.some(s => !registered.includes(s.club_id) || s.is_excluded)) fail('Participant standings are missing, duplicated, excluded or unregistered');
  const clubs = registered.map(id => participants.find(p => p.id === id));
  if (clubs.some(c => !c) || participants.length !== clubs.length) fail('A registered club is missing or an unregistered participant exists');
  const platform = normalize(root.platform);
  for (const standing of standings) {
    const candidate = normalize(standing.platform);
    if (platform && platform !== 'cross-platform' && candidate && candidate !== 'cross-platform' && candidate !== platform) fail('A participant is ineligible for the edition platform');
    if (regional && standing.region_slug && root.region_slug && standing.region_slug !== root.region_slug) fail('A participant is ineligible for the edition region');
  }
  return clubs;
}

async function save(query, kind, root) {
  await query('UPDATE league_entities SET data_json=?,status=?,updated_date=NOW() WHERE id=? AND entity_type=?', [JSON.stringify(root), root.status, root.id, kind]);
}
async function audit(query, user, kind, id, action, before, after, reason) {
  await query(`INSERT INTO admin_audit_log (id,admin_user_id,admin_email,action,entity_type,entity_id,old_value,new_value,reason,created_date) VALUES (?,?,?,?,?,?,?,?,?,NOW())`,
    [uuid(), user.id, user.email, `league_lifecycle_${action}`, kind, id, JSON.stringify(before), JSON.stringify(after), reason || action]);
}

function createLifecycleService(options = {}) {
  const transaction = options.withTransaction || database.withTransaction;
  const model = options.scopeModel || new CompetitionScopeModel();
  const engine = () => options.engine || require('./competitionEngineService');
  const prizes = () => options.prizes || require('./competitionPrizeService');
  let mutexQueue = Promise.resolve();
  async function admin(query, actor) {
    const [user] = await query('SELECT id,email,role_id FROM users WHERE id=? LIMIT 1', [actor?.id || null]);
    if (!user || !['0', '2'].includes(String(user.role_id))) fail('Admin access required', 403);
    return user;
  }
  function withMutex(callback) {
    // Only this durable mutex is held while canonical progression uses its own transactions.
    // Do not lock edition rows on this connection: capture/progression lock them themselves.
    // Queue local waiters before acquiring connections; otherwise a full pool of
    // mutex waiters can starve the holder's canonical progression transaction.
    const pending = mutexQueue.then(() => transaction(async query => {
      await query("INSERT INTO league_entities (id,entity_type,data_json) VALUES ('league-lifecycle-write-lock','league_lifecycle_lock','{}') ON DUPLICATE KEY UPDATE id=id");
      await query("SELECT id FROM league_entities WHERE id='league-lifecycle-write-lock' FOR UPDATE");
      return callback();
    }));
    mutexQueue = pending.catch(() => {});
    return pending;
  }
  async function action(kind, id, body = {}, actor) {
    if (!['regional_league', 'competition_season'].includes(kind)) fail('Unsupported competition kind', 400);
    if (!id || !body || !['draw', 'complete', 'abandon', 'rollover'].includes(body.action)) fail('Expected draw, complete, abandon or rollover action', 400);
    // Authenticate before allocating the mutex; never trust role/email from the request.
    await transaction(query => admin(query, actor));
    return withMutex(async () => {
      const prepared = await transaction(async query => {
        const user = await admin(query, actor);
        const scope = await model.selectOne(kind, id, query, true);
        const { root } = scope;
        if (String(root.id) !== String(id)) fail('Selected edition does not match the lifecycle target');
        if (body.edition_id != null && String(body.edition_id) !== String(scope.edition_id)) fail('Selected edition changed; reload before continuing');
        if (body.season_number != null && Number(body.season_number) !== Number(root.season_number || 1)) fail('Selected season changed; reload before continuing');
        if (body.action === 'rollover') return rollover(query, scope, body, user);
        if (body.action === 'abandon') return abandon(query, scope, body, user);
        if (terminal.includes(root.status) && !(body.action === 'complete' && root.status === 'completed')) fail('This edition is closed');
        if (body.action === 'draw') {
          await assertParentNotRetired(query, kind, root);
          if (!['draft', 'setup', 'registration', 'seeded', 'active', 'in_progress', 'league_phase'].includes(root.status)) fail('This edition cannot draw initial fixtures in its current state');
          if (scope.fixtures.length || scope.matches.length) fail('Fixtures already exist; view the existing schedule', 409, { fixtures: scope.fixtures.length });
          const clubs = validateRoster(scope, body, user, options.allowTestMode === true);
          planFixtures(kind, root, clubs);
          return { scope, user };
        }
        const clubs = validateRoster(scope, body, user, options.allowTestMode === true);
        // Validate the entire required schedule, including every GOST tie, before outcomes.
        const required = kind === 'regional_league' || leagueOnly(root) ? ['league'] : phases;
        for (const phase of required) {
          const readiness = roundReadiness(scope, phase);
          if (!readiness.ready) fail(`Cannot complete: ${phase}: ${readiness.reason}`, 409, readiness);
        }
        if (scope.matches.some(m => [m.home_score, m.away_score].some(score => score == null || String(score).trim() === '' || !Number.isInteger(Number(score)) || Number(score) < 0))) fail('Required results contain missing or invalid scores');
        if (scope.matches.some(m => !required.includes(m.type))) fail('Unexpected stages require review before completion');
        const integrity = reviewStandings(scope);
        if (integrity.requires_review) fail('Standings integrity requires review before completion', 409, integrity);
        if (scope.participants.length !== clubs.length) fail('Edition participants changed');
        return { scope, user };
      });
      if (!prepared.scope) return prepared;
      const { scope, user } = prepared;
      if (body.action === 'complete') {
        // This is the authoritative server path: it locks/revalidates the round,
        // applies qualification/promotion, audits, and runs idempotent settlement.
        const phase = kind === 'regional_league' || leagueOnly(scope.root) ? 'league' : 'knockout_final';
        const fixture = scope.fixtures.find(f => (f.phase || 'league') === phase);
        const result = await engine().advanceLeagueEdition(kind, fixture, { admin: user, reason: body.reason || 'Normal season completion' });
        if (!result.advanced && result.reason !== 'already_completed') fail(result.reason || 'Canonical completion was blocked', 409, result);
        return { action: 'complete', source_type: kind, source_id: id, edition_id: scope.edition_id, ...result };
      }
      // Snapshot existing reward policy through its canonical service; a failed draw
      // may leave a pending snapshot, but never partial fixtures or a payout.
      const captured = await prizes().capture(kind, id, { admin: user, reason: body.reason || 'Capture rewards before drawing fixtures' });
      if (!captured?.config) fail('Review and save the reward configuration before drawing this edition');
      return transaction(async query => {
        await admin(query, actor);
        const fresh = await model.selectOne(kind, id, query, true);
        await assertParentNotRetired(query, kind, fresh.root);
        if (fresh.fixtures.length || fresh.matches.length || terminal.includes(fresh.root.status)) fail('Edition changed before fixture generation');
        validateRoster(fresh, body, user, options.allowTestMode === true);
        const ids = list(fresh.root.registered_club_ids);
        const profiles = await query(`SELECT id,name,logo_url,tag,status,platform FROM clubs WHERE id IN (${ids.map(() => '?').join(',')}) FOR UPDATE`, ids);
        if (profiles.length !== ids.length || profiles.some(p => ['banned', 'suspended', 'retired', 'dissolved', 'deleted', 'inactive'].includes(normalize(p.status)))) fail('A registered club is unavailable or ineligible');
        const platform = normalize(fresh.root.platform);
        if (platform && platform !== 'cross-platform' && profiles.some(p => p.platform && normalize(p.platform) !== platform && normalize(p.platform) !== 'cross-platform')) fail('A registered club is ineligible for the edition platform');
        if (captured.config.roster && JSON.stringify([...ids].sort()) !== JSON.stringify([...captured.config.roster].sort())) fail('Registered clubs changed after reward capture');
        fresh.participants = profiles;
        const clubs = sortStandingRows(fresh.standings).map(s => fresh.participants.find(p => p.id === s.club_id));
        const fixtures = planFixtures(kind, fresh.root, clubs);
        const fixtureType = kind === 'regional_league' ? 'regional_league_fixture' : 'competition_fixture';
        for (const fixture of fixtures) await query(`INSERT INTO league_entities (id,entity_type,data_json,status,scheduling_status,league_id,season_id,competition_id,season_number,created_date,updated_date) VALUES (?,?,?,?,?,?,?,?,?,NOW(),NOW())`,
          [fixture.id, fixtureType, JSON.stringify(fixture), fixture.status, fixture.scheduling_status, fixture.league_id || null, fixture.season_id || null, fixture.competition_id || null, fixture.season_number]);
        const matchdays = Math.max(...fixtures.map(f => f.matchday));
        const next = { ...fresh.root, status: kind === 'regional_league' ? 'in_progress' : 'league_phase', fixtures_generated: true,
          num_clubs: fresh.participants.length, league_matchday_total: matchdays, num_league_matchdays: matchdays, current_matchday: 1,
          ...(kind === 'regional_league' ? { seeding_mode: false, placement_locked: true, launch_seeding_closed_at: fresh.root.launch_seeding_closed_at || new Date().toISOString() } : {}) };
        await save(query, kind, next);
        const result = { action: 'draw', source_type: kind, source_id: id, edition_id: fresh.edition_id, fixtures_created: fixtures.length, matchdays };
        await audit(query, user, kind, id, 'draw', fresh.root, { ...next, fixture_ids: fixtures.map(f => f.id) }, body.reason);
        return result;
      });
    });
  }
  async function abandon(query, scope, body, user) {
    const { root, source_type: kind } = scope;
    if (!(body.confirm === true || body.confirmation === true) || typeof body.reason !== 'string' || !body.reason.trim()) fail('Abandon requires confirmation and a reason', 400);
    if (root.status === 'cancelled' && root.abandoned_at) return { action: 'abandon', outcome: 'existing', record: root };
    if (terminal.includes(root.status)) fail('A closed edition cannot be abandoned');
    const payments = await query('SELECT * FROM competition_payouts WHERE source_type=? AND source_id=? AND edition_id=? FOR UPDATE', [kind, root.id, scope.edition_id]);
    const awards = await query("SELECT id FROM trophy_awards WHERE source_type=? AND source_id=? AND status='earned' FOR UPDATE", [kind, root.id]);
    if (awards.length || payments.some(p => p.status === 'paid') || root.winner_club_id || scope.standings.some(s => s.is_promoted || s.is_relegated || s.is_stage_qualified || (kind === 'regional_league' && s.final_position))) fail('Established honours, sporting outcomes or paid obligations require authorised review before abandonment');
    const next = { ...root, status: 'cancelled', abandoned_at: new Date().toISOString(), abandoned_by: user.id,
      abandonment_reason: body.reason.trim(), qualification_void: true, promotion_relegation_void: true,
      financial_review_required: payments.length > 0, abandonment_consequences: 'No champion, qualification or promotion/relegation is awarded. Existing financial records are preserved for policy review.' };
    await save(query, kind, next);
    await audit(query, user, kind, root.id, 'abandon', root, next, body.reason.trim());
    return { action: 'abandon', outcome: 'abandoned', record: next };
  }
  async function rollover(query, scope, body, user) {
    if (scope.source_type !== 'competition_season') fail('Use the regional next-season service for Regional rollover', 400);
    const { root } = scope;
    if (!['completed', 'archived', 'cancelled'].includes(root.status)) fail('Complete or abandon the current season before rollover');
    const [stored] = await query("SELECT * FROM league_entities WHERE entity_type='competition' AND id=? FOR UPDATE", [root.competition_id]);
    if (!stored) fail('Permanent competition not found', 404);
    const parent = unpack(stored), series = Number(root.reset_series || 0);
    const allSeasons = (await query("SELECT * FROM league_entities WHERE entity_type='competition_season' AND competition_id=? FOR UPDATE", [parent.id])).map(unpack);
    if (!Number.isSafeInteger(series) || series < 0 || Number(parent.reset_series || 0) > series || allSeasons.some(s => Number(s.reset_series || 0) > series)) fail('This reset series is historical; use the current series for rollover');
    if (parent.retired || parent.retired_at || parent.status === 'retired') fail('A retired competition cannot create another season');
    const seasons = allSeasons.filter(s => Number(s.reset_series || 0) === series);
    const number = Number(root.season_number) + 1;
    if (!Number.isInteger(number) || number < 2) fail('Invalid season numbering');
    const existing = seasons.filter(s => Number(s.season_number) === number || s.previous_season_id === root.id);
    if (existing.length === 1 && existing[0].previous_season_id === root.id && Number(existing[0].season_number) === number && (!root.next_season_id || root.next_season_id === existing[0].id)) return { action: 'rollover', outcome: 'existing', record: existing[0] };
    if (existing.length || root.next_season_id || seasons.some(s => Number(s.season_number) > Number(root.season_number) || (!terminal.includes(s.status) && s.id !== root.id))) fail('A successor or another active season already exists; review before rollover');
    const next = { id: uuid(), competition_id: parent.id, competition_name: parent.name, competition_slug: parent.slug, competition_tier: parent.tier,
      previous_season_id: root.id, reset_series: series, season_number: number, season_label: series > 0 ? `Series ${series} \u00b7 Season ${number}` : `Season ${number}`, status: 'draft',
      registered_club_ids: [], num_clubs: 0, fixtures_generated: false, current_matchday: 1, max_clubs: 36, target_clubs: 36,
      format: 'league_36_8md', playoff_format: '9_24_bracket', num_league_matchdays: 8, league_matchday_total: 8 };
    for (const key of ['platform', 'region', 'rules', 'trophy_item_id']) next[key] = parent[key] ?? root[key] ?? null;
    next.format = parent.format ?? root.format ?? 'league_36_8md';
    next.league_only = parent.league_only ?? root.league_only ?? false;
    next.num_league_matchdays = Number(parent.num_league_matchdays ?? root.num_league_matchdays ?? 8);
    next.league_matchday_total = next.num_league_matchdays;
    planFixtures('competition_season', next, Array.from({ length: 36 }, (_, i) => ({ id: String(i) })));
    await query(`INSERT INTO league_entities (id,entity_type,data_json,status,competition_id,season_number,platform,region,competition_edition_key,reset_series,created_date,updated_date) VALUES (?,'competition_season',?,'draft',?,?,?,?,?,?,NOW(),NOW())`,
      [next.id, JSON.stringify(next), parent.id, number, next.platform, next.region, competitionEditionKey(parent.id, series, number), series]);
    await save(query, 'competition_season', { ...root, next_season_id: next.id });
    await save(query, 'competition', { ...parent, current_season: number, current_season_id: next.id, current_edition_id: next.id });
    await audit(query, user, 'competition_season', next.id, 'rollover', { previous: root, parent }, next, body.reason);
    return { action: 'rollover', outcome: 'created', record: next };
  }
  async function createInitialCompetitionSeason(body = {}, actor) {
    if (!body || typeof body.competition_id !== 'string' || !body.competition_id.trim()) fail('A permanent competition ID is required', 400);
    await transaction(query => admin(query, actor));
    return withMutex(() => transaction(async query => {
      const user = await admin(query, actor);
      if (Number(body.season_number ?? 1) !== 1 || Number(body.reset_series ?? 0) !== 0 || body.previous_season_id || body.next_season_id) fail('Use the lifecycle rollover action to create subsequent seasons');
      if ((body.status != null && body.status !== 'draft') || body.fixtures_generated || Number(body.num_clubs || 0) !== 0 || (body.registered_club_ids != null && (!list(body.registered_club_ids) || list(body.registered_club_ids).length))) fail('An initial season must be an empty draft', 400);
      const [stored] = await query("SELECT * FROM league_entities WHERE entity_type='competition' AND id=? FOR UPDATE", [body.competition_id]);
      if (!stored) fail('Permanent competition not found', 404);
      const parent = unpack(stored);
      if (parent.retired || parent.retired_at || parent.status === 'retired' || Number(parent.reset_series || 0) !== 0) fail('This competition cannot create an initial season');
      const seasons = (await query("SELECT * FROM league_entities WHERE entity_type='competition_season' AND competition_id=? FOR UPDATE", [parent.id])).map(unpack);
      if (seasons.length) {
        const first = seasons[0];
        if (seasons.length !== 1 || Number(first.season_number) !== 1 || Number(first.reset_series || 0) !== 0 || first.previous_season_id || terminal.includes(first.status)) fail('Season history already exists; use the lifecycle rollover action');
        if (['platform', 'region'].some(key => body[key] != null && normalize(body[key]) !== normalize(first[key]))) fail('Initial season scope differs from the existing edition');
        return { outcome: 'existing', record: first };
      }
      const days = Number(body.num_league_matchdays ?? parent.num_league_matchdays ?? 8);
      if (body.league_matchday_total != null && Number(body.league_matchday_total) !== days) fail('League matchday settings disagree', 400);
      if ([body.max_clubs, body.target_clubs].some(n => n != null && Number(n) !== 36)) fail('GOST production seasons require 36 clubs', 400);
      const format = parent.format ?? body.format ?? 'league_36_8md';
      if (!['league', 'league_36_8md'].includes(format)) fail('Unsupported GOST initial season format', 400);
      const budget = String(parent.prize_pool_stc ?? body.prize_pool_stc ?? '0.00');
      if (!/^\d{1,12}(\.\d{1,2})?$/.test(budget)) fail('Invalid initial prize budget', 400);
      const record = { id: uuid(), competition_id: parent.id, competition_name: parent.name, competition_slug: parent.slug, competition_tier: parent.tier,
        season_number: 1, reset_series: 0, season_label: 'Season 1', status: 'draft', registered_club_ids: [], num_clubs: 0,
        fixtures_generated: false, current_matchday: 1, format, league_only: parent.league_only ?? body.league_only === true,
        playoff_format: '9_24_bracket', num_league_matchdays: days, league_matchday_total: days, max_clubs: 36, target_clubs: 36, prize_pool_stc: budget };
      for (const key of ['platform', 'region']) record[key] = body[key] ?? parent[key] ?? null;
      for (const key of ['rules', 'trophy_item_id']) record[key] = parent[key] ?? null;
      planFixtures('competition_season', record, Array.from({ length: 36 }, (_, i) => ({ id: String(i) })));
      await query(`INSERT INTO league_entities (id,entity_type,data_json,status,competition_id,season_number,platform,region,competition_edition_key,reset_series,created_date,updated_date) VALUES (?,'competition_season',?,'draft',?,?,?,?,?,?,NOW(),NOW())`,
        [record.id, JSON.stringify(record), parent.id, 1, record.platform, record.region, competitionEditionKey(parent.id, 0, 1), 0]);
      await save(query, 'competition', { ...parent, current_season: 1, current_season_id: record.id, current_edition_id: record.id });
      await audit(query, user, 'competition_season', record.id, 'create_initial', { parent }, record, body.reason || 'Create initial competition season');
      return { outcome: 'created', record };
    }));
  }
  return { action, withMutex, createInitialCompetitionSeason };
}
module.exports = { ...createLifecycleService(), createLifecycleService, planFixtures, competitionEditionKey, assertEditionWritable };

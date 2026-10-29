'use strict';
const crypto = require('crypto');
const { EXECUTESQL, withTransaction } = require('../db/database');
const { unpack, identity, describe, fail } = require('../lib/regionalEditionIdentity');
const regional = require('./regionalEditionService');
const history = require('./competitionHistoryResetService');
const evidenceService = require('./regionalEditionReviewService');
const { audit } = require('./rewardConfigurationService');
const CONFIRMATION = 'RESET LEAGUES';
const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const operationId = revision => `league-reset-${revision.slice(0, 23)}`;
const generated = new Set(['regional_league_fixture', 'regional_league_standing', 'competition_fixture', 'competition_standing', 'qualification_entry', 'season_registration']);
const financial = new Set(['competition_payouts', 'stc_transactions', 'player_stc_transactions', 'user_purchases']);
const data = row => unpack(row);
function normalize(input) {
  const scope = String(input.scope || 'all').toLowerCase();
  if (!['all', 'regional', 'gost'].includes(scope)) fail('Choose an explicit regional, GOST or all history reset scope', 400);
  const requested = input.selected_permanent_ids ?? input.permanent_ids;
  if (requested !== undefined && (!Array.isArray(requested) || !requested.length || requested.some(id => typeof id !== 'string' || !id.trim()))) fail('Provide a nonempty array of selected permanent IDs', 400);
  return { scope, selected_permanent_ids: requested === undefined ? null : [...new Set(requested)].sort() };
}
async function superadmin(actor, query, lock = false) {
  const [user] = await query(`SELECT id,email,role_id FROM users WHERE id=? LIMIT 1${lock ? ' FOR UPDATE' : ''}`, [actor?.id]);
  if (!user || Number(user.role_id) !== 0) fail('Super admin only', 403);
  return user;
}
function configuration(root) {
  const fields = new Set(['name', 'competition_name', 'region', 'region_slug', 'country_code', 'division', 'platform', 'league_id', 'tier', 'max_clubs', 'target_clubs', 'capacity', 'format', 'type', 'league_only', 'playoff_format', 'promoted_slots', 'relegated_slots', 'relegation_spots', 'linked_league_slug', 'linked_league_id', 'entry_credits', 'entry_fee', 'prize_pool_stc', 'num_league_matchdays', 'league_matchday_total', 'legs', 'home_and_away', 'schedule_config', 'qualification_rules', 'promotion_rules', 'relegation_rules']);
  const historical = new Set(['reward_snapshot', 'trophy_snapshot', 'reward_settlement_id', 'reward_entitlements']);
  return Object.fromEntries(Object.entries(root).filter(([key]) => !historical.has(key) && (fields.has(key) || /^(default_|trophy_|reward_|rules(?:_|$))/.test(key))));
}
function linked(row, ids) {
  const record = data(row);
  return ['league_id', 'season_id', 'edition_id', 'regional_league_id', 'source_id', 'source_edition_id', 'target_edition_id', 'competition_season_id', 'qualified_from_season_id'].some(key => ids.has(record[key]));
}
async function plan(input, query = EXECUTESQL) {
  const options = normalize(input);
  const evidence = await evidenceService.readEvidence(query);
  evidence.rows = evidence.rows.filter(e => e.table !== 'league_entities' || !['regional_edition_lock', 'league_lifecycle_lock', 'league_reset_lock', 'reset_operation'].includes(e.row.entity_type));
  const entities = evidence.rows.filter(e => e.table === 'league_entities').map(e => e.row);
  const candidates = entities.filter(r => (options.scope !== 'gost' && r.entity_type === 'regional_league' && (!data(r).permanent_league_id || data(r).permanent_league_id === r.id)) || (options.scope !== 'regional' && r.entity_type === 'competition'));
  const roots = candidates.filter(r => !options.selected_permanent_ids || options.selected_permanent_ids.includes(r.id));
  const blockers = [];
  if (!roots.length) blockers.push('No permanent competitions selected');
  for (const id of options.selected_permanent_ids || []) if (!roots.some(r => r.id === id)) blockers.push(`Not a permanent competition in this scope: ${id}`);
  for (const table of ['league_entities', 'trophy_awards', 'trophy_placements', 'club_achievements', 'player_achievements', 'matches', 'competition_instances', 'competition_fixtures']) if (evidence.missing.includes(table)) blockers.push(`Unavailable evidence table: ${table}`);
  if (evidence.gaps.length) blockers.push('Malformed JSON prevents complete reset planning');
  const rootIds = new Set(roots.map(r => r.id));
  const editions = entities.filter(r => (r.entity_type === 'regional_league' && (rootIds.has(r.id) || rootIds.has(data(r).permanent_league_id))) || (r.entity_type === 'competition_season' && rootIds.has(data(r).competition_id))).filter(r => data(r).status !== 'reset');
  for (const row of editions) if (row.entity_type === 'regional_league') {
    const info = describe(row);
    if (info.identity_error || info.indexed_json_differences.length) blockers.push(`Edition identity/index mismatch requires review: ${row.id}`);
  }
  // Legacy independent rollover rows must be consolidated explicitly, never guessed.
  for (const root of roots.filter(r => r.entity_type === 'regional_league')) {
    try {
      const family = r => { const i = identity({ ...data(r), season_number: 1, slug: '', reset_series: 0 }); return JSON.stringify([i.region_slug, i.platform, i.division]); };
      const key = family(root);
      const conflicts = candidates.filter(r => r.id !== root.id && r.entity_type === 'regional_league' && family(r) === key);
      if (conflicts.length) blockers.push(`Independent regional identities require consolidation: ${root.id}, ${conflicts.map(r => r.id).join(', ')}`);
    } catch (error) { blockers.push(`Unverified regional identity ${root.id}: ${error.message}`); }
  }
  for (const root of roots) {
    const current = data(root).current_edition_id;
    if (current && !entities.some(r => r.id === current && (r.entity_type === 'regional_league' ? (r.id === root.id || data(r).permanent_league_id === root.id) : r.entity_type === 'competition_season' && data(r).competition_id === root.id))) blockers.push(`Invalid current edition reference: ${root.id}`);
  }
  const editionIds = new Set(editions.map(r => r.id));
  const dependencies = entities.filter(r => generated.has(r.entity_type) && linked(r, editionIds));
  const fixtureIds = new Set(dependencies.filter(r => /_fixture$/.test(r.entity_type)).map(r => r.id));
  const instances = evidence.rows.filter(e => e.table === 'competition_instances' && ['regional_league', 'official_competition'].includes(e.row.product_type) && (editionIds.has(e.row.legacy_source_id) || roots.some(r => r.entity_type === 'competition' && r.id === e.row.legacy_source_id))).map(e => e.row);
  const instanceIds = new Set(instances.map(r => r.id));
  const engineFixtures = evidence.rows.filter(e => e.table === 'competition_fixtures' && (instanceIds.has(e.row.competition_instance_id) || fixtureIds.has(e.row.legacy_fixture_id))).map(e => e.row);
  const phaseStates = evidence.rows.filter(e => e.table === 'competition_phase_states' && instanceIds.has(e.row.competition_instance_id)).map(e => e.row);
  const matchIds = new Set([...dependencies, ...engineFixtures].map(r => data(r).match_id).filter(Boolean));
  const matches = evidence.rows.filter(e => e.table === 'matches' && (matchIds.has(e.row.id) || fixtureIds.has(e.row.source_fixture_id) || instanceIds.has(e.row.competition_context))).map(e => e.row);
  const sqlStatuses = {};
  for (const [table, rows] of [['competition_instances', instances], ['competition_fixtures', engineFixtures], ['competition_phase_states', phaseStates], ['matches', matches]]) if (rows.length) {
    try { sqlStatuses[table] = await invalidationStatus(table, query); } catch (error) { blockers.push(error.message); }
  }
  const selection = { edition_ids: [...editionIds].sort(), edition_aliases: editions.map(e => data(e).edition_id).filter(Boolean).sort(), competition_ids: roots.filter(r => r.entity_type === 'competition').map(r => r.id).sort(), fixture_ids: [...fixtureIds].sort(), instance_ids: [...instanceIds].sort() };
  const honours = await history.preview(options.scope, query, false, selection);
  const changes = roots.map(row => {
    const own = editions.filter(e => row.entity_type === 'regional_league' ? e.id === row.id || data(e).permanent_league_id === row.id : data(e).competition_id === row.id);
    const series = Math.max(0, Number(data(row).reset_series || 0), ...own.map(e => Number(data(e).reset_series || 0))) + 1;
    if (!Number.isSafeInteger(series)) blockers.push(`Invalid reset series: ${row.id}`);
    return { permanent_id: row.id, type: row.entity_type, reset_series: series, season_number: 1, invalidated_edition_ids: own.map(e => e.id), preserved_configuration: configuration(data(row)) };
  });
  const beforeCounts = {};
  for (const row of [...editions, ...dependencies]) beforeCounts[row.entity_type] = (beforeCounts[row.entity_type] || 0) + 1;
  // Include full evidence, not only award IDs: changed fixtures, results, settings,
  // financial references and cabinet arrangements all invalidate approval.
  const revision = digest({ options, evidence, honours, changes, sqlStatuses });
  const consequences = { fresh_editions: changes.map(c => ({ permanent_id: c.permanent_id, reset_series: c.reset_series, season_number: 1 })), invalidated_editions: editions.map(e => e.id), invalidated_generated_records: dependencies.length, invalidated_matches: matches.length, financial_mutations: false, original_season_one_preserved: true };
  return { ...honours, dry_run: true, scope: options.scope, selected_permanent_ids: roots.map(r => r.id).sort(), revision, blockers, changes, consequences, before_counts: beforeCounts, honours, sql_statuses: sqlStatuses, financial_reversal: false, financial_records_preserved: evidence.rows.filter(e => financial.has(e.table)).length, recovery: 'All prior records and financial history retained. Inspect reset_operation and admin audit snapshots; do not replay payouts.', selection, roots, editions, dependencies, instances, engineFixtures, phaseStates, matches };
}
async function preview(input, actor) {
  return withTransaction(async query => { await superadmin(actor, query); return plan(input, query); });
}
async function save(row, record, query) {
  if (row.entity_type === 'regional_league') return regional.model.update(record, identity(record).key, query);
  await query('UPDATE league_entities SET data_json=?,status=?,season_number=?,reset_series=?,updated_date=NOW() WHERE id=? AND entity_type=?', [JSON.stringify(record), record.status || null, record.season_number ?? null, record.reset_series ?? 0, row.id, row.entity_type]);
}
async function invalidationStatus(table, query) {
  const [column] = await query('SELECT DATA_TYPE AS data_type,COLUMN_TYPE AS column_type FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=? AND column_name=?', [table, 'status']);
  if (!column) fail(`Cannot verify ${table}.status; reset blocked`, 409);
  if (String(column.data_type).toLowerCase() !== 'enum') return 'cancelled';
  const allowed = [...String(column.column_type).matchAll(/'((?:[^']|'')*)'/g)].map(match => match[1].replace(/''/g, "'"));
  const status = ['cancelled', 'canceled', 'voided', 'abandoned', 'reset'].find(value => allowed.includes(value));
  if (!status) fail(`No supported invalidation status in ${table}.status; reset blocked`, 409);
  return status;
}
async function apply(input, actor) {
  const options = normalize(input);
  if (String(input.confirmation || '').trim() !== CONFIRMATION) fail(`Type "${CONFIRMATION}" to reset league data`, 400);
  if (!String(input.reason || '').trim()) fail('A reset reason is required', 400);
  if (!/^[a-f0-9]{64}$/.test(input.review_revision || '')) fail('Preview the reset before applying', 409);
  return withTransaction(async query => {
    // Acquire the lifecycle mutex on THIS connection. withMutex wraps callbacks
    // in another transaction and would deadlock against evidence locks below.
    await query("INSERT INTO league_entities (id,entity_type,data_json) VALUES ('league-lifecycle-write-lock','league_lifecycle_lock','{}') ON DUPLICATE KEY UPDATE id=id");
    await query("SELECT id FROM league_entities WHERE id='league-lifecycle-write-lock' FOR UPDATE");
    await regional.model.lock(query);
    const user = await superadmin(actor, query, true);
    const id = operationId(input.review_revision);
    const [prior] = await query("SELECT * FROM league_entities WHERE id=? AND entity_type='reset_operation' FOR UPDATE", [id]);
    if (prior) {
      const saved = data(prior);
      if (JSON.stringify(saved.options) !== JSON.stringify(options)) fail('Reset retry scope differs from the reviewed operation', 409);
      return { ...saved.summary, already_applied: true };
    }
    const [isolation] = await query('SELECT @@transaction_isolation AS isolation_level');
    if (!['REPEATABLE-READ', 'SERIALIZABLE'].includes(isolation?.isolation_level)) fail('Reset requires REPEATABLE-READ or SERIALIZABLE isolation', 409);
    const tables = await query('SELECT TABLE_NAME AS name FROM information_schema.tables WHERE table_schema=DATABASE()');
    for (const table of evidenceService.TABLES.filter(name => tables.some(t => t.name === name))) await query(table === 'league_entities' ? "SELECT * FROM `league_entities` WHERE entity_type NOT IN ('league_lifecycle_lock','regional_edition_lock','league_reset_lock') FOR UPDATE" : `SELECT * FROM \`${table}\` FOR UPDATE`);
    const report = await plan(input, query);
    if (report.revision !== input.review_revision) fail('History changed since preview. Review the reset again.', 409);
    if (report.blockers.length) fail('Reset requires identity/dependency review', 409, report.blockers);
    const honours = await history.revoke(options.scope, query, user, input.reason, report.selection);
    const stamp = new Date().toISOString();
    for (const row of [...report.editions, ...report.dependencies]) {
      await save(row, { ...data(row), status: 'reset', edition_invalidated: true, reset_operation_id: id, reset_at: stamp }, query);
    }
    const invalidatedSqlRows = {};
    for (const [table, rows] of [['competition_instances', report.instances], ['competition_fixtures', report.engineFixtures], ['competition_phase_states', report.phaseStates], ['matches', report.matches]]) {
      const status = report.sql_statuses[table] || null;
      for (const row of rows) await query(`UPDATE \`${table}\` SET status=?${table === 'competition_phase_states' ? ',ready_to_advance=0' : ''} WHERE id=?`, [status, row.id]);
      invalidatedSqlRows[table] = { status, ids: rows.map(row => row.id) };
    }
    for (const table of ['club_achievements', 'player_achievements']) {
      for (const row of report.honours[table]) await query(`UPDATE ${table} SET source_type=?,badge_type='revoked' WHERE id=?`, [`reset_${row.source_type}`, row.id]);
    }
    const fresh = [];
    for (const change of report.changes) {
      const row = report.roots.find(r => r.id === change.permanent_id), root = data(row);
      const freshId = require('uuid').v4();
      const record = { ...change.preserved_configuration, id: freshId, edition_id: freshId, reset_series: change.reset_series, season_number: 1, season_label: `Series ${change.reset_series} \u00b7 Season 1`, status: 'registration', registered_club_ids: [], registered_clubs: [], num_clubs: 0, fixtures_generated: false, reset_operation_id: id };
      if (row.entity_type === 'regional_league') {
        record.permanent_league_id = root.id;
        const normalized = identity({ ...record, slug: '' });
        record.slug = `${normalized.canonical_slug}-reset-${change.reset_series}`;
        await regional.model.create(record, normalized.key, query);
        // Original permanent row remains its historical Season 1 edition.
        await query("UPDATE league_entities SET data_json=JSON_SET(data_json,'$.current_edition_id',?,'$.active_reset_series',?),updated_date=NOW() WHERE id=? AND entity_type='regional_league'", [freshId, change.reset_series, root.id]);
      } else {
        record.competition_id = root.id;
        record.status = 'draft';
        record.current_matchday = 1;
        record.competition_name = root.name;
        record.competition_slug = root.slug;
        record.competition_tier = root.tier;
        const key = require('./leagueLifecycleService').competitionEditionKey(root.id, change.reset_series, 1);
        await query('INSERT INTO league_entities (id,entity_type,data_json,status,season_number,competition_id,reset_series,competition_edition_key) VALUES (?,?,?,?,?,?,?,?)', [freshId, 'competition_season', JSON.stringify(record), record.status, 1, root.id, change.reset_series, key]);
        await save(row, { ...root, current_edition_id: freshId, current_season_id: freshId, current_season: 1, reset_series: change.reset_series, registered_club_ids: [], registered_clubs: [], num_clubs: 0, status: 'draft' }, query);
      }
      fresh.push({ permanent_id: root.id, edition_id: freshId, reset_series: change.reset_series, season_number: 1 });
    }
    for (const owner of report.honours.affected_owners) if (owner.startsWith('club:')) await history.refreshCaches(query, owner.slice(5));
    const summary = { success: true, scope: options.scope, operation_id: id, honours, fresh_editions: fresh, selected_permanent_ids: report.selected_permanent_ids, before_counts: report.before_counts, cleared_entity_types: [], deleted_league_entities: 0, deleted_matches: 0, deleted_availability: 0, deleted_lineups: 0, deleted_engine_rows: {}, deleted_club_achievements: 0, deleted_player_achievements: 0, reset_competitions: report.roots.filter(r => r.entity_type === 'competition').length, reset_regional_leagues: report.roots.filter(r => r.entity_type === 'regional_league').length, invalidated_editions: report.editions.length, invalidated_entities: report.dependencies.length, financial_reversal: false };
    summary.invalidated_sql_rows = invalidatedSqlRows;
    await query('INSERT INTO league_entities (id,entity_type,data_json) VALUES (?,?,?)', [id, 'reset_operation', JSON.stringify({ id, options, reviewed_revision: report.revision, summary })]);
    await audit(query, user, 'reset_league_competition_data', 'league_system', options.scope, report, summary, input.reason);
    return summary;
  });
}
module.exports = { preview, plan, apply, CONFIRMATION };

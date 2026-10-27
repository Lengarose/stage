'use strict';
const crypto = require('crypto');
const { EXECUTESQL, withTransaction } = require('../db/database');
const { unpack, describe, fail } = require('../lib/regionalEditionIdentity');
const editions = require('./regionalEditionService');

// Explicit business-data allowlist: never read accounts, tokens or credentials.
const TABLES = ['league_entities', 'matches', 'match_player_stats', 'club_fixture_lineups', 'club_fixture_availability', 'live_matches', 'live_match_events', 'competition_instances', 'competition_participants', 'competition_fixtures', 'competition_schedule_proposals', 'competition_result_submissions', 'competition_phase_states', 'competition_standings', 'competition_payouts', 'reward_configs', 'stc_transactions', 'player_stc_transactions', 'user_purchases', 'trophy_items', 'trophy_awards', 'trophy_placements', 'club_achievements', 'player_achievements', 'fixture_admin_actions', 'inbox_messages', 'notifications', 'predictions', 'rating_history'];
const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const rowKey = item => `${item.table}:${item.row.id || digest(item.row)}`;
const outboundFields = new Set(['match_id', 'fixture_id', 'source_fixture_id', 'legacy_fixture_id', 'competition_instance_id', 'award_id', 'message_id', 'notification_id', 'achievement_id', 'settlement_id']);
function outgoing(value) {
  if (typeof value === 'string' && /^[\[{]/.test(value)) { try { return outgoing(JSON.parse(value)); } catch { return []; } }
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, item]) => outboundFields.has(key) && typeof item === 'string' && item ? [item] : outgoing(item));
}
function references(value, ids) {
  if (typeof value === 'string') {
    if ([...ids].some(id => value === id || value.startsWith(`${id}:`) || value.includes(`:${id}:`) || value.endsWith(`:${id}`) || value.endsWith(`/${id}`))) return true;
    if (/^[\[{]/.test(value)) { try { return references(JSON.parse(value), ids); } catch { return false; } }
    return false;
  }
  if (Array.isArray(value)) return value.some(item => references(item, ids));
  return value && typeof value === 'object' && Object.values(value).some(item => references(item, ids));
}
async function readEvidence(query) {
  const tables = await query('SELECT TABLE_NAME AS name FROM information_schema.tables WHERE table_schema=DATABASE()');
  const available = new Set(tables.map(row => row.name));
  const missing = TABLES.filter(table => !available.has(table));
  const rows = [];
  const gaps = [];
  for (const table of TABLES.filter(table => available.has(table))) {
    for (const row of await query(`SELECT * FROM \`${table}\``)) {
      rows.push({ table, row });
      for (const [field, value] of Object.entries(row)) if (field.endsWith('_json') && typeof value === 'string' && value.trim()) {
        try { JSON.parse(value); } catch { gaps.push({ table, id: row.id, field, issue: 'Unparseable reference-bearing JSON' }); }
      }
    }
  }
  rows.sort((a, b) => rowKey(a).localeCompare(rowKey(b)));
  return { rows, missing, gaps };
}
function collect(stored, evidence) {
  const record = unpack(stored), ids = new Set([stored.id]);
  const found = new Map();
  // Follow fixture -> match -> report/stat/ledger/award -> placement references.
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of evidence.rows) {
      if (item.table === 'league_entities' && item.row.id === stored.id) continue;
      const key = rowKey(item);
      if (found.has(key)) continue;
      const linkedSlug = item.table === 'league_entities' && record.slug && ['linked_league_slug', 'previous_league_slug', 'next_league_slug'].some(field => unpack(item.row)[field] === record.slug);
      if (!ids.has(item.row.id) && !references({ ...item.row, id: null }, ids) && !linkedSlug) continue;
      found.set(key, item);
      if (item.row.id && !ids.has(item.row.id)) { ids.add(item.row.id); changed = true; }
      for (const linkedId of outgoing(item.row)) if (!ids.has(linkedId)) { ids.add(linkedId); changed = true; }
    }
  }
  const rootActivity = [];
  for (const key of ['registered_club_ids', 'registered_clubs', 'registered_players', 'reward_snapshot']) {
    let value = record[key];
    if (typeof value === 'string') { try { value = JSON.parse(value); } catch { rootActivity.push(`Unparseable ${key}`); continue; } }
    if (value && (Array.isArray(value) ? value.length : Object.keys(value).length)) rootActivity.push(key);
  }
  for (const key of ['num_clubs', 'fixtures_generated', 'winner_club_id', 'next_season_id', 'previous_season_id', 'completed_at', 'archived_at', 'prizes_distributed', 'rewards_distributed']) if (record[key]) rootActivity.push(key);
  if (!['draft', 'registration', 'open'].includes(record.status || 'draft')) rootActivity.push(`status:${record.status}`);
  const byTable = Object.fromEntries(TABLES.map(table => [table, [...found.values()].filter(item => item.table === table).map(item => ({ id: item.row.id || null, key: rowKey(item), entity_type: item.row.entity_type, record: item.row }))]));
  const differences = describe(stored).indexed_json_differences;
  const blockers = [...rootActivity.map(field => `Root activity: ${field}`), ...evidence.missing.map(table => `Unavailable evidence table: ${table}`), ...differences.map(diff => `Indexed/JSON mismatch: ${diff.field}`)];
  if (describe(stored).identity_error) blockers.push(`Unverified identity: ${describe(stored).identity_error}`);
  if (evidence.gaps?.length) blockers.push('Malformed reference-bearing JSON prevents proof of non-use');
  if (found.size) blockers.push(`${found.size} dependent/reference records require explicit resolution`);
  const ambiguousFinancial = record.name ? evidence.rows.filter(item => ['stc_transactions', 'player_stc_transactions'].includes(item.table) && !found.has(rowKey(item)) && JSON.stringify(item.row).toLowerCase().includes(String(record.name).toLowerCase())).map(item => ({ table: item.table, id: item.row.id, reason: 'Name-only financial hint is not proof of attribution; inspect manually' })) : [];
  if (ambiguousFinancial.length) blockers.push('Unattributed name-only financial history prevents proof of non-use');
  return { source_id: stored.id, registered_clubs: record.registered_club_ids || record.registered_clubs || [], root_activity: rootActivity, dependencies: byTable, dependency_count: found.size, ambiguous_financial_hints: ambiguousFinancial, missing_evidence: evidence.missing, evidence_gaps: evidence.gaps || [], blockers };
}
async function inventory(stored, query = EXECUTESQL) { return collect(stored, await readEvidence(query)); }
async function diagnostics(actor, query = EXECUTESQL) {
  await editions.admin(actor, query);
  const rows = await editions.model.selectAll(query);
  const records = rows.map(describe);
  const groups = new Map();
  for (const record of records) if (record.identity) groups.set(record.identity.key, [...(groups.get(record.identity.key) || []), record.id]);
  return { dry_run: true, records, conflicts: [...groups.entries()].filter(([, ids]) => ids.length > 1).map(([key, ids]) => ({ key, ids, classification: 'logical_identity_conflict', requires_review: true })), financial_mutations: false };
}
function repairId(source, canonical) { return digest(['regional-unused-duplicate', source, canonical]).slice(0, 36); }
async function preview(body, actor, query = EXECUTESQL) {
  await editions.admin(actor, query);
  const { source_id: sourceId, canonical_id: canonicalId } = body;
  if (!sourceId || !canonicalId || sourceId === canonicalId) fail('Provide different explicit source_id and canonical_id', 400);
  const rows = await editions.model.selectAll(query);
  const source = rows.find(row => row.id === sourceId), canonical = rows.find(row => row.id === canonicalId);
  const [prior] = await query('SELECT * FROM admin_audit_log WHERE id=?', [repairId(sourceId, canonicalId)]);
  if (!source && canonical && prior) return { dry_run: true, already_applied: true, source_id: sourceId, canonical_id: canonicalId, changes: [], blockers: [] };
  if (!source || !canonical) fail('Source and canonical records must exist', 404);
  const sourceIdentity = describe(source).identity, canonicalIdentity = describe(canonical).identity;
  const sameIdentity = sourceIdentity && canonicalIdentity && sourceIdentity.key === canonicalIdentity.key;
  const evidence = await readEvidence(query);
  const sourceInventory = collect(source, evidence), canonicalInventory = collect(canonical, evidence);
  const others = sameIdentity ? editions.matches(rows, unpack(source)).filter(row => ![sourceId, canonicalId].includes(row.id)) : [];
  const blockers = [...sourceInventory.blockers, ...canonicalInventory.missing_evidence.map(table => `Canonical evidence unavailable: ${table}`), ...describe(canonical).indexed_json_differences.map(diff => `Canonical indexed/JSON mismatch: ${diff.field}`), ...others.map(row => `Additional conflicting edition: ${row.id}`)];
  const sourceRecord = unpack(source), canonicalRecord = unpack(canonical);
  const configurationDifferences = ['edition_id', 'linked_league_slug', 'parent_league_id', 'previous_league_id', 'next_league_id', 'trophy_item_id', 'trophy_image_url', 'entry_credits', 'entry_fee', 'max_clubs', 'format', 'qualification_rules', 'promoted_slots', 'relegation_spots', 'prize_pool_stc'].filter(field => {
    const value = sourceRecord[field];
    if (value == null || value === '') return false;
    return (typeof value === 'object' ? JSON.stringify(value) : String(value)) !== (typeof canonicalRecord[field] === 'object' ? JSON.stringify(canonicalRecord[field]) : String(canonicalRecord[field]));
  }).map(field => ({ field, source: sourceRecord[field], canonical: canonicalRecord[field] ?? null }));
  if (configurationDifferences.length) blockers.push('Source configuration, edition provenance or relationship differences require explicit resolution before removal');
  if (describe(canonical).identity_error) blockers.push(`Canonical identity unverified: ${describe(canonical).identity_error}`);
  if (!sameIdentity) blockers.push('Logical identities differ or are not verifiable. Preserve both records.');
  const state = { source, canonical, sourceInventory, canonicalInventory, others, configurationDifferences };
  return { dry_run: true, source_id: sourceId, canonical_id: canonicalId, classification: sameIdentity ? 'logical_identity_conflict' : sourceIdentity && canonicalIdentity ? 'distinct_logical_editions' : 'unverified_identity', canonical_selection: 'Explicit administrator selection; no oldest/newest heuristic', source: describe(source), canonical: describe(canonical), source_inventory: sourceInventory, canonical_inventory: canonicalInventory, configuration_differences: configurationDifferences, revision: digest(state), blockers, changes: blockers.length ? [] : [{ action: 'remove_proven_unused_duplicate', table: 'league_entities', id: sourceId }, { action: 'bind_canonical_identity_key', id: canonicalId, key: canonicalIdentity.key }], preserved: ['All canonical references and both audit histories', 'All results, rewards, financial ledgers and trophy provenance'], financial_mutations: false };
}
async function repair(body, actor) {
  if (body.apply !== true) return withTransaction(query => preview(body, actor, query));
  const user = await editions.admin(actor);
  if (!String(body.reason || '').trim()) fail('A review reason is required', 400);
  return withTransaction(async query => {
    await editions.model.lock(query);
    const [isolation] = await query('SELECT @@transaction_isolation AS isolation_level');
    if (!['REPEATABLE-READ', 'SERIALIZABLE'].includes(isolation?.isolation_level)) fail('Repair requires REPEATABLE-READ or SERIALIZABLE isolation; no records changed');
    await editions.model.selectAll(query, true);
    // All approved evidence tables are locked, including empty ranges, while
    // testing non-use. No dependency can be added between preview and deletion.
    const tables = await query('SELECT TABLE_NAME AS name FROM information_schema.tables WHERE table_schema=DATABASE()');
    for (const table of TABLES.filter(table => tables.some(row => row.name === table))) await query(`SELECT * FROM \`${table}\` FOR UPDATE`);
    const report = await preview(body, actor, query);
    if (report.already_applied) return { ...report, dry_run: false };
    if (!body.expected_revision || report.revision !== body.expected_revision) fail('Records changed since preview; review again', 409, report);
    if (report.blockers.length) fail('Unsafe reconciliation blocked; dependent history needs manual review', 409, report);
    await editions.model.delete(body.source_id, query);
    await editions.model.bindIdentity(body.canonical_id, report.canonical.identity.key, query);
    await query(`INSERT INTO admin_audit_log (id,admin_user_id,admin_email,action,entity_type,entity_id,old_value,new_value,reason,created_date) VALUES (?,?,?,'remove_unused_regional_duplicate','regional_league',?,?,?,?,NOW())`, [repairId(body.source_id, body.canonical_id), user.id, user.email, body.source_id, JSON.stringify(report), JSON.stringify({ canonical_id: body.canonical_id, removed_id: body.source_id, references_changed: [] }), body.reason]);
    return { ...report, dry_run: false, applied: true };
  });
}
module.exports = { TABLES, references, collect, readEvidence, inventory, diagnostics, preview, repair };

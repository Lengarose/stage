'use strict';
const crypto = require('crypto');
const { EXECUTESQL, withTransaction } = require('../db/database');
const { unpack, describe, fail } = require('../lib/regionalEditionIdentity');
const editions = require('./regionalEditionService');
const hierarchy = require('../lib/regionalLeagueHierarchy');

// Explicit business-data allowlist: never read accounts, tokens or credentials.
const TABLES = ['league_entities', 'matches', 'match_player_stats', 'club_fixture_lineups', 'club_fixture_availability', 'live_matches', 'live_match_events', 'competition_instances', 'competition_participants', 'competition_fixtures', 'competition_schedule_proposals', 'competition_result_submissions', 'competition_phase_states', 'competition_standings', 'competition_payouts', 'reward_configs', 'stc_transactions', 'player_stc_transactions', 'user_purchases', 'trophy_items', 'trophy_awards', 'trophy_placements', 'club_achievements', 'player_achievements', 'fixture_admin_actions', 'inbox_messages', 'notifications', 'predictions', 'rating_history'];
const infrastructureTypes = new Set(['league_lifecycle_lock', 'regional_edition_lock', 'league_reset_lock']);
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
      if (table === 'league_entities' && infrastructureTypes.has(row.entity_type)) continue;
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
  const catalogue = hierarchy.buildCatalogue(rows);
  const permanentGroups = new Map(), catalogueConflicts = [];
  const definitions = new Map(catalogue.definitions.map(record => [record.id, record]));
  for (const definition of catalogue.definitions) {
    try {
      const key = hierarchy.leagueKey(definition);
      if (!permanentGroups.has(key)) permanentGroups.set(key, { key, ids: [], edition_ids: [] });
      const group = permanentGroups.get(key);
      group.ids.push(definition.id);
      group.edition_ids.push(...catalogue.editions.filter(record => hierarchy.permanentId(record) === definition.id).map(record => record.id));
    } catch (error) {
      catalogueConflicts.push({ permanent_league_id: definition.id, classification: 'unverified_permanent_identity', reason: error.message, requires_review: true });
    }
  }
  const permanentGroupRecords = [...permanentGroups.values()].map(group => ({ ...group, ids: group.ids.sort(), edition_ids: group.edition_ids.sort(), requires_review: group.ids.length > 1 }));
  const permanentConflicts = permanentGroupRecords.filter(group => group.requires_review).map(group => ({ ...group, classification: 'permanent_identity_conflict' }));
  for (const league of catalogue.leagues) if (league.identity_conflict || league.identity_unverified) catalogueConflicts.push({ permanent_league_id: league.permanent_league_id, current_edition_id: league.current_edition_id, classification: league.identity_unverified ? 'unverified_catalogue_identity' : 'catalogue_identity_conflict', edition_ids: league.editions.map(record => record.id), requires_review: true });
  for (const record of catalogue.editions) if (!definitions.has(hierarchy.permanentId(record))) catalogueConflicts.push({ edition_id: record.id, permanent_league_id: hierarchy.permanentId(record), classification: 'orphan_edition', requires_review: true });
  for (const definition of catalogue.definitions) if (definition.current_edition_id && !catalogue.editions.some(record => record.id === definition.current_edition_id && hierarchy.permanentId(record) === definition.id && !['reset', 'cancelled', 'abandoned', 'superseded', 'retired'].includes(record.status))) catalogueConflicts.push({ permanent_league_id: definition.id, current_edition_id: definition.current_edition_id, classification: 'invalid_current_edition', requires_review: true });
  return { dry_run: true, records, conflicts: [...groups.entries()].filter(([, ids]) => ids.length > 1).map(([key, ids]) => ({ key, ids, classification: 'logical_identity_conflict', requires_review: true })), permanent_groups: permanentGroupRecords, permanent_conflicts: permanentConflicts, catalogue, catalogue_conflicts: catalogueConflicts, financial_mutations: false };
}
async function lockReviewEvidence(query) {
  // Same connection and order as reset; never wrap this in withMutex, whose
  // outer transaction would retain the lifecycle row while this one waits.
  await query("INSERT INTO league_entities (id,entity_type,data_json) VALUES ('league-lifecycle-write-lock','league_lifecycle_lock','{}') ON DUPLICATE KEY UPDATE id=id");
  await query("SELECT id FROM league_entities WHERE id='league-lifecycle-write-lock' FOR UPDATE");
  await editions.model.lock(query);
  const [isolation] = await query('SELECT @@transaction_isolation AS isolation_level');
  if (!['REPEATABLE-READ', 'SERIALIZABLE'].includes(isolation?.isolation_level)) fail('Review requires REPEATABLE-READ or SERIALIZABLE isolation; no records changed');
  const tables = await query('SELECT TABLE_NAME AS name FROM information_schema.tables WHERE table_schema=DATABASE()');
  for (const table of TABLES.filter(name => tables.some(row => row.name === name))) {
    await query(table === 'league_entities' ? "SELECT * FROM `league_entities` WHERE entity_type NOT IN ('league_lifecycle_lock','regional_edition_lock','league_reset_lock') FOR UPDATE" : `SELECT * FROM \`${table}\` FOR UPDATE`);
  }
}
function repairId(source, canonical) { return digest(['regional-unused-duplicate', source, canonical]).slice(0, 36); }
async function preview(body, actor, query = EXECUTESQL) {
  if(body.mode==='consolidate')return consolidationPreview(body,actor,query);
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
  if(body.mode==='consolidate')return consolidate(body,actor);
  if (body.apply !== true) return withTransaction(query => preview(body, actor, query));
  const user = await editions.admin(actor);
  if (!String(body.reason || '').trim()) fail('A review reason is required', 400);
  return withTransaction(async query => {
    await lockReviewEvidence(query);
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
const REQUESTED_REPAIRS = [
  { source_id:'46dbb09f-8319-4607-ab97-ec941745bfd8',canonical_id:'c2d6e60f-89e0-4813-81a1-967551d8d69f',region_slug:'uk-ireland',division:1,source_season_number:2 },
  { source_id:'e582c55b-1e72-45f5-ab63-137c3420404a',canonical_id:'e91c6c27-4fd2-45d9-b6ed-6a3591d7b210',region_slug:'north-america',division:1,source_season_number:1 },
];
async function consolidationPreview(body,actor,query=EXECUTESQL) {
  await editions.admin(actor,query);
  const rows=await editions.model.selectAll(query);
  const source=rows.find(r=>r.id===body.source_id),canonical=rows.find(r=>r.id===body.canonical_id);
  if(!source||!canonical||source.id===canonical.id)fail('Both explicit, different source and retained IDs must exist',404);
  const s=unpack(source),c=unpack(canonical);
  const evidence=await readEvidence(query);
  const sourceInventory=collect(source,evidence),canonicalInventory=collect(canonical,evidence);
  const blockers=[...evidence.missing.map(t=>`Unavailable evidence table: ${t}`),...(evidence.gaps.length?['Malformed reference JSON requires review']:[])];
  for(const row of [source,canonical])for(const mismatch of describe(row).indexed_json_differences)blockers.push(`Indexed/JSON identity mismatch in ${row.id}: ${mismatch.field}`);
  const requested=REQUESTED_REPAIRS.find(p=>p.source_id===source.id&&p.canonical_id===canonical.id);
  if(REQUESTED_REPAIRS.some(p=>p.source_id===source.id)&&!requested)blockers.push('This requested repair must retain the user-selected original ID.');
  try {
    if(hierarchy.leagueKey(s)!==hierarchy.leagueKey(c))blockers.push('Region, division or platform differ; these are not the same permanent league.');
  }catch(e){blockers.push(`Unverified permanent identity: ${e.message}`);}
  if(requested&&(s.region_slug!==requested.region_slug || Number(s.division)!==requested.division || Number(s.season_number)!==requested.source_season_number))blockers.push('The supplied source ID no longer matches its reviewed region, division or season.');
  if(requested&&Number(c.season_number)!==1)blockers.push('The retained original no longer represents the expected original Season 1; review historical provenance.');
  if(hierarchy.permanentId(c)!==c.id)blockers.push('The retained ID is not a permanent league.');
  if(s.permanent_league_id&&s.permanent_league_id!==s.id&&s.permanent_league_id!==c.id)blockers.push('Source already belongs to a different permanent league.');
  if(s.permanent_league_id===c.id)return {dry_run:true,already_applied:true,mode:'consolidate',source_id:s.id,canonical_id:c.id,blockers:[],changes:[],source_inventory:sourceInventory,canonical_inventory:canonicalInventory,financial_mutations:false};
  let series=Number(s.reset_series || 0), status=s.status;
  const sameSlot=rows.some(r=>r.id!==s.id&&hierarchy.permanentId(unpack(r))===c.id&&Number(unpack(r).season_number)===Number(s.season_number)&&Number(unpack(r).reset_series || 0)===series);
  if(sameSlot) {
    const activityTables=['matches','match_player_stats','regional_league_fixture','regional_league_standing','competition_payouts','stc_transactions','player_stc_transactions','trophy_awards'];
    const sporting=Object.entries(sourceInventory.dependencies).flatMap(([table,records])=>records.filter(r=>activityTables.includes(table)||activityTables.includes(r.entity_type)));
    const registered=require('../lib/trophyHistory').parse(sourceInventory.registered_clubs);
    if(sporting.length || sourceInventory.root_activity.length || (Array.isArray(registered)&&registered.length) || s.winner_club_id || s.fixtures_generated)blockers.push('The reset-era source collides with an existing edition and has activity. Reliable season provenance or backup recovery is required; do not relabel or merge results.');
    series=Math.max(...rows.filter(r=>hierarchy.permanentId(unpack(r))===c.id).map(r=>Number(unpack(r).reset_series || 0)),0)+1;
    status='superseded';
  }
  const rewards=require('./rewardConfigurationService');
  const setting=id=>evidence.rows.find(e=>e.table==='league_entities'&&e.row.id===rewards.key('regional_league',id));
  const parse=require('../lib/trophyHistory').parse;
  const sSettings=parse(setting(s.id)?.row.data_json),cSettings=parse(setting(c.id)?.row.data_json);
  const trophyIds=r=>evidence.rows.filter(e=>e.table==='trophy_items'&&e.row.linked_source_type==='regional_league'&&e.row.linked_source_id===r.id).map(e=>e.row.id);
  const st=[...new Set([s.trophy_item_id,sSettings.trophy_item_id,...trophyIds(s)].filter(Boolean))];
  const ct=[...new Set([c.trophy_item_id,cSettings.trophy_item_id,...trophyIds(c)].filter(Boolean))];
  if(st.length>1||ct.length>1||st.length&&ct.length&&st[0]!==ct[0])blockers.push('Default trophy assignments conflict; preserve both and review the explicit catalogue identities.');
  let transferTrophy=!ct.length&&st.length===1?st[0]:null;
  const candidateTrophy=transferTrophy || ct[0];
  const candidateItem=evidence.rows.find(e=>e.table==='trophy_items'&&e.row.id===candidateTrophy)?.row;
  if(candidateItem?.linked_source_id && (candidateItem.linked_source_type!=='regional_league' || ![s.id,c.id].includes(candidateItem.linked_source_id)))blockers.push('The verified trophy belongs to another competition; its assignment cannot be moved.');
  if(candidateItem?.linked_source_id===s.id && candidateItem.linked_source_type==='regional_league')transferTrophy=candidateTrophy;
  if(transferTrophy&&!evidence.rows.some(e=>e.table==='trophy_items'&&e.row.id===transferTrophy&&!e.row.tournament_id))blockers.push('Source trophy design is missing or tournament-specific.');
  const rewardRows=id=>evidence.rows.filter(e=>e.table==='reward_configs'&&e.row.source_type==='regional_league'&&e.row.source_id===id).map(e=>e.row);
  const sourceRewards=rewardRows(s.id),canonicalRewards=rewardRows(c.id);
  if(sourceRewards.length&&!canonicalRewards.length)blockers.push('Source has default reward rows but the retained league has none. Review/default configuration migration is required; historical rows will not be rewritten.');
  const nextSource={...s,permanent_league_id:c.id,reset_series:series,status, ...(sameSlot?{season_label:'Superseded reset-era record; original season history unavailable',identity_review_required:true}:{})};
  const current=Number(s.season_number)>Number(c.season_number)&&!sameSlot?s.id:c.current_edition_id || c.id;
  const nextCanonical={...c,permanent_league_id:c.id,current_edition_id:current,...(transferTrophy?{trophy_item_id:transferTrophy}:{})};
  const preservedDependencies=Object.entries(sourceInventory.dependencies).map(([table,list])=>({table,count:list.length,ids:list.map(r=>r.id),treatment:'Retain original IDs and references to this season edition; no ledger, match or award rewrite'}));
  const review={source,canonical,evidence,nextSource,nextCanonical};
  return {dry_run:true,mode:'consolidate',source_id:s.id,canonical_id:c.id,canonical_selection:'Original permanent identities explicitly selected by the user',revision:digest(review),blockers,
    before_after:{permanent_league_id:c.id,source_id_becomes_edition:s.id,current_edition_id:current,season_number:s.season_number,reset_series:series},source_inventory:sourceInventory,canonical_inventory:canonicalInventory,
    dependencies:preservedDependencies,discrepancies:{canonical_completed_without_fixture_evidence:['completed','archived'].includes(c.status)&&!canonicalInventory.dependencies.league_entities.some(r=>r.entity_type==='regional_league_fixture' && unpack(r.record).league_id===c.id),canonical_awards:canonicalInventory.dependencies.trophy_awards.map(r=>r.id),canonical_financial_records:canonicalInventory.dependencies.competition_payouts.map(r=>r.id)},
    changes:blockers.length?[]:[{action:'convert_independent_identity_to_retained_league_edition',id:s.id,before:s,after:nextSource},{action:'retain_permanent_identity_and_set_current_edition',id:c.id,after:nextCanonical},...(transferTrophy?[{action:'restore_verified_default_trophy',trophy_item_id:transferTrophy,from:s.id,to:c.id}]:[])],
    final_permanent_entries:[{id:c.id,name:c.name,current_edition_id:current}],historical_access:'Both original record IDs and all fixture/award/financial references remain resolvable; the source is an edition, not another permanent league.',financial_mutations:false,_next:{source:nextSource,canonical:nextCanonical,transferTrophy} };
}
async function consolidate(body,actor) {
  if(body.apply!==true)return withTransaction(query=>consolidationPreview(body,actor,query));
  if(!String(body.reason || '').trim())fail('A consolidation reason is required',400);
  await editions.admin(actor);
  return withTransaction(async query=>{
    await lockReviewEvidence(query);
    const admin=await editions.admin(actor,query);
    const report=await consolidationPreview(body,actor,query);
    if(report.already_applied)return {...report,dry_run:false};
    if(report.revision!==body.expected_revision)fail('Records changed since consolidation preview',409);
    if(report.blockers.length)fail('Consolidation conflicts require resolution',409,report);
    const {source,canonical,transferTrophy}=report._next;
    // Release only the redundant permanent key; edition IDs and dependencies survive.
    await query("UPDATE league_entities SET regional_league_key=NULL WHERE id=? AND entity_type='regional_league'",[source.id]);
    await editions.model.update(source,require('../lib/regionalEditionIdentity').identity(source).key,query);
    await editions.model.update(canonical,require('../lib/regionalEditionIdentity').identity(canonical).key,query);
    await query("UPDATE league_entities SET regional_league_key=? WHERE id=? AND entity_type='regional_league'",[require('../lib/regionalLeagueHierarchy').leagueKey(canonical),canonical.id]);
    if(transferTrophy)await query("UPDATE trophy_items SET linked_source_id=? WHERE id=? AND linked_source_type='regional_league' AND linked_source_id=?",[canonical.id,transferTrophy,source.id]);
    await editions.audit(query,admin,'consolidate_permanent_regional_identity',{id:canonical.id,mapping:report.before_after},report,body.reason);
    return {...report,applied:true,dry_run:false,before_after:report.before_after};
  });
}
module.exports = { TABLES, references, collect, readEvidence, inventory, diagnostics, preview, repair, consolidationPreview, consolidate, REQUESTED_REPAIRS };

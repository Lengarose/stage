'use strict';
const { v4: uuid } = require('uuid');
const { EXECUTESQL, withTransaction } = require('../db/database');
const { identity, unpack, describe, fail } = require('../lib/regionalEditionIdentity');
const { RegionalLeagueModel } = require('../models/regionalLeagueModel');
const model = new RegionalLeagueModel();
const { permanentId, leagueKey, buildCatalogue } = require('../lib/regionalLeagueHierarchy');
async function admin(actor, query = EXECUTESQL) {
  const [user] = await query('SELECT id,email,role_id FROM users WHERE id=? LIMIT 1', [actor?.id]);
  if (!user || ![0, 2].includes(Number(user.role_id))) fail('Admin access required', 403);
  return user;
}
async function audit(query, actor, action, record, before, reason) {
  await query(`INSERT INTO admin_audit_log (id,admin_user_id,admin_email,action,entity_type,entity_id,old_value,new_value,reason,created_date) VALUES (?,?,?,?, 'regional_league',?,?,?,?,NOW())`, [uuid(), actor.id, actor.email, action, record.id, JSON.stringify(before ?? null), JSON.stringify(record), reason || action]);
}
function matches(rows, value) {
  const key = identity(value).key;
  return rows.filter(row => { try { return identity(unpack(row)).key === key; } catch { return false; } });
}
function assertConsistent(rows, record) {
  const key = identity(record).key;
  for (const row of rows) {
    const info = describe(row);
    if (!info.identity_error && !info.indexed_json_differences.length) continue;
    const plain = unpack(row);
    let json = {};
    try { json = typeof row.data_json === 'string' ? JSON.parse(row.data_json) : row.data_json || {}; } catch { /* unknown row remains reviewable */ }
    const possible = [plain, { ...plain, ...json }, { ...plain, platform: plain.platform || record.platform }];
    const related = possible.some(value => { try { return identity(value).key === key; } catch { return String(value.slug || '').replace(/-s\d+$/, '') === String(record.slug || '').replace(/-s\d+$/, ''); } });
    if (related) fail('Ambiguous legacy identity or indexed/JSON mismatch; inspect edition review first', 409, { id: row.id });
  }
  const same = matches(rows, record);
  if (same.length > 1) fail('Conflicting regional editions require review', 409, { ids: same.map(row => row.id) });
  if (same.some(row => describe(row).indexed_json_differences.length)) fail('Indexed and JSON identity fields disagree; review before creating or linking editions');
  return same[0];
}
async function createInside(body, query, actor) {
  const normalized = identity(body);
  const rows = await model.selectAll(query, true);
  const existing = assertConsistent(rows, body);
  if (body.id && rows.some(row => row.id === body.id && identity(unpack(row)).key !== normalized.key)) fail('Requested ID belongs to another edition');
  if (existing) return { outcome: 'existing', record: unpack(existing) };
  const record = { ...body, ...normalized, slug: normalized.canonical_slug, id: body.id || uuid(), reset_series: Number(body.reset_series || 0) };
  record.permanent_league_id = body.permanent_league_id || record.id;
  delete record.key; delete record.canonical_slug; delete record.regional_edition_key;
  await model.create(record, normalized.key, query);
  await audit(query, actor, 'create_regional_edition', record, null, body.reason);
  return { outcome: 'created', record };
}
async function create(body, actor) {
  const user = await admin(actor);
  if (body.next_season_id || body.previous_season_id) fail('Use the protected next-season action for edition links');
  if (body.permanent_league_id || Number(body.season_number) !== 1) fail('Use the protected next-season action for editions',400);
  if (!['draft','registration'].includes(body.status || 'draft') || body.winner_club_id || body.fixtures_generated) fail('A new permanent league must start as an unplayed draft or registration edition',400);
  return withTransaction(async query => {
    await model.lock(query);
    const rows = await model.selectAll(query,true);
    const definitions = rows.filter(r=>permanentId(unpack(r))===r.id);
    const same = definitions.filter(r=>{try{return leagueKey(unpack(r))===leagueKey(body);}catch{return false;}});
    if (same.length>1) fail('Conflicting permanent league identities require reviewed consolidation');
    if (same.length===1) return { outcome:'existing', record:unpack(same[0]) };
    return createInside(body,query,user);
  });
}
async function seed(definitions, actor) {
  await admin(actor);
  if (!Array.isArray(definitions) || !definitions.length || definitions.length > 100) fail('Provide 1-100 explicit league definitions', 400);
  const results = [];
  for (const definition of definitions) {
    try { results.push({ slug: definition.slug, ...await create(definition, actor) }); }
    catch (err) { results.push({ slug: definition.slug, outcome: 'conflict', error: err.message, details: err.details }); }
  }
  return { results };
}
async function update(id, patch, actor) {
  const user = await admin(actor);
  return withTransaction(async query => {
    await model.lock(query);
    const rows = await model.selectAll(query, true);
    const stored = rows.find(row => row.id === id);
    if (!stored) fail('Not found', 404);
    const before = unpack(stored);
    if (Object.hasOwn(patch, 'status') && ['registration', 'in_progress', 'active', 'league_phase', 'setup', 'seeded'].includes(String(patch.status).trim().toLowerCase())) {
      const definitionRow = rows.find(row => row.id === permanentId(before));
      if (!definitionRow) fail('Permanent league is unavailable; review identities');
      const definition = unpack(definitionRow);
      if (definition.retired || definition.retired_at || definition.status === 'retired') fail('Retired leagues cannot open or start an edition');
    }
    if (Object.hasOwn(patch, 'status') && ['completed', 'archived', 'reset', 'cancelled', 'canceled', 'superseded', 'abandoned', 'retired'].includes(String(patch.status).trim().toLowerCase())) fail('Use the dedicated league lifecycle action to complete, archive, reset, cancel or retire an edition',409);
    if (['permanent_league_id','reset_series','current_edition_id','edition_invalidated','retired','retired_at'].some(k=>Object.hasOwn(patch,k)&&patch[k]!==before[k])) fail('Use the reviewed league lifecycle action to change permanent identity or series');
    if (before.edition_invalidated || ['completed', 'archived','reset','superseded','cancelled','canceled','abandoned','retired'].includes(before.status)) fail('Closed edition history is read-only');
    const record = { ...before, ...patch, id };
    const next = identity(record);
    const existing = assertConsistent(rows, record);
    if (existing && existing.id !== id) fail('This league edition already exists', 409, { id: existing.id });
    if (identity(before).key !== next.key || (patch.slug !== undefined && patch.slug !== before.slug)) {
      const report = await require('./regionalEditionReviewService').inventory(stored, query);
      if (report.blockers.length) fail('Edition identity has dependent activity; explicit review required', 409, report);
    }
    if (['next_season_id', 'previous_season_id'].some(field => patch[field] !== undefined && (patch[field] || null) !== (before[field] || null))) fail('Use the protected next-season action to change season links');
    const slug = patch.slug === undefined && identity(before).key === next.key ? before.slug : next.canonical_slug;
    Object.assign(record, next, { slug });
    delete record.key; delete record.canonical_slug; delete record.regional_edition_key;
    await model.update(record, next.key, query);
    await audit(query, user, 'update_regional_edition', record, before, patch.reason);
    return record;
  });
}
async function nextSeason(id, actor) {
  const user = await admin(actor);
  return withTransaction(async query => {
    await model.lock(query);
    const rows = await model.selectAll(query, true);
    const stored = rows.find(row => row.id === id);
    if (!stored) fail('Not found', 404);
    const parent = unpack(stored), current = identity(parent);
    const definitionRow = rows.find(r=>r.id===permanentId(parent));
    if (!definitionRow) fail('Permanent league is unavailable; review identities');
    const definition = unpack(definitionRow);
    if (definition.retired_at || definition.retired) fail('Retired leagues cannot create editions');
    assertConsistent(rows, parent);
    if (!['completed', 'archived'].includes(parent.status) && !(parent.status === 'cancelled' && parent.abandoned_at)) fail('Complete or archive the previous season, or use the authorised Abandon action first');
    const number = current.season_number + 1;
    const child = { name: parent.name, region_slug: current.region_slug, region: parent.region, platform: current.platform, division: current.division, season_number: number, slug: `${current.region_slug}-div-${current.division}-s${number}`, previous_season_id: id, linked_league_slug: parent.linked_league_slug || null, country_code: parent.country_code || '', status: 'draft', registered_club_ids: [], num_clubs: 0, max_clubs: Number(parent.max_clubs) || 20, promoted_slots: parent.promoted_slots ?? 2, seeding_mode: false, placement_locked: false };
    Object.assign(child, { permanent_league_id:definition.id, reset_series: Number(parent.reset_series || 0), trophy_item_id:definition.trophy_item_id || null, rules:definition.rules || null, rules_text:definition.rules_text || null, qualification_rules:definition.qualification_rules || null, linked_league_id:definition.linked_league_id || null, promoted_slots:definition.promoted_slots ?? null,relegated_slots:definition.relegated_slots ?? null });
    child.season_label = child.reset_series > 0 ? `Series ${child.reset_series} \u00b7 Season ${number}` : `Season ${number}`;
    const existing = assertConsistent(rows, child);
    if (parent.next_season_id && parent.next_season_id !== existing?.id) fail('Previous season already links to a different record');
    if (existing && unpack(existing).previous_season_id && unpack(existing).previous_season_id !== id) fail('Next edition already links to a different previous season');
    if (existing && permanentId(unpack(existing)) !== definition.id) fail('Next edition belongs to another permanent league');
    // A retry may refer to a historical predecessor. Return its established link
    // without rewinding the permanent league's current-edition pointer.
    if (existing && parent.next_season_id === existing.id && unpack(existing).previous_season_id === id) return { outcome: 'existing', record: unpack(existing) };
    const family = rows.map(unpack).filter(record => permanentId(record) === definition.id);
    const series = Number(parent.reset_series || 0);
    const latestSeries = Math.max(Number(definition.reset_series || 0), ...family.map(record => Number(record.reset_series || 0)));
    if (parent.edition_invalidated || series !== latestSeries) fail('This reset series is historical; use the current edition for rollover');
    if ((definition.current_edition_id && definition.current_edition_id !== id) || family.some(record => record.id !== id && Number(record.reset_series || 0) === series && (Number(record.season_number) > current.season_number || !['completed', 'archived', 'reset', 'superseded', 'cancelled', 'canceled', 'abandoned', 'retired'].includes(record.status)))) fail('This edition is stale; use the current edition for rollover');
    if ([1,2].includes(child.division)) {
      const policy = require('../lib/rewardPolicy');
      child.prize_pool_stc = policy.validateConfiguration('regional_league', policy.regionalRows(child.max_clubs, child), child.max_clubs).budget;
    }
    const result = await createInside(child, query, user);
    const linked = { ...result.record, previous_season_id: id };
    if (!result.record.previous_season_id) await model.update(linked, identity(linked).key, query);
    if (!parent.next_season_id) {
      const nextParent = { ...parent, next_season_id: linked.id };
      await model.update(nextParent, current.key, query);
      await audit(query, user, 'link_regional_next_season', nextParent, parent, 'Create or reuse next season');
    }
    const refreshedDefinition = parent.id === definition.id ? { ...parent,next_season_id:linked.id } : definition;
    await model.update({ ...refreshedDefinition,permanent_league_id:definition.id,current_edition_id:linked.id },identity(definition).key,query);
    await query("UPDATE league_entities SET regional_league_key=? WHERE id=? AND entity_type='regional_league'",[leagueKey(definition),definition.id]);
    return { ...result, record: linked };
  });
}
function assertResetSafe(rows) {
  const keys = new Set();
  for (const row of rows) {
    const record = unpack(row);
    const value = identity({ ...record, slug: String(record.slug).replace(/-s\d+$/, ''), season_number: 1 });
    if (keys.has(value.key)) fail('Reset would collapse distinct editions into the same Season 1. Review regional editions first.');
    keys.add(value.key);
  }
}
async function catalogue(actor,query=EXECUTESQL) { await admin(actor,query);return buildCatalogue(await model.selectAll(query)); }
module.exports = { admin, create, seed, update, nextSeason, assertResetSafe, model, audit, matches, catalogue, createInside };

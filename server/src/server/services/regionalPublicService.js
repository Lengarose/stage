'use strict';
const { EXECUTESQL } = require('../db/database');
const { unpack, describe } = require('../lib/regionalEditionIdentity');
const { parse } = require('../lib/trophyHistory');
const art = require('./gostOverviewService');
const { key } = require('./rewardConfigurationService');
const policy = require('../lib/rewardPolicy');

function publicEdition(root, records, items, configs, awards) {
  const historical = ['completed', 'archived'].includes(root.status);
  const settlement = records.filter(r => r.entity_type === 'competition_settlement').map(unpack).find(s => s.source_type === 'regional_league' && s.source_id === root.id && String(s.edition_id) === String(root.edition_id || `${root.id}:${root.season_number || 1}`));
  const settings = parse(records.find(r => r.id === key('regional_league', root.id))?.data_json);
  const assignment = art.resolveAssignment(root, settings, items, 'regional_league');
  const award = awards.filter(a => a.source_id === root.id && String(a.edition_id) === String(root.edition_id || `${root.id}:${root.season_number || 1}`)).map(a => parse(a.metadata_json)).find(a => a.version === 1);
  const captured = settlement?.config;
  const trophy = historical ? award ? { name: award.design_name, image_url: art.safeImage(award.image_url) } : captured?.trophy_snapshot ? art.publicTrophy(captured.trophy_snapshot) : art.publicTrophy(items.find(i => i.id === captured?.trophy_item_id)) : assignment.trophy;
  const storedRoster = parse(root.registered_club_ids);
  const participant_data_available = Array.isArray(captured?.roster) || Array.isArray(storedRoster);
  const roster = Array.isArray(captured?.roster) ? captured.roster : Array.isArray(storedRoster) ? storedRoster : [];
  const participant_ids = [...new Set(roster.filter(Boolean).map(String))];
  const legacyRows = parse(root.reward_snapshot);
  let rewards = Array.isArray(captured) ? { rows: captured } : captured || (Array.isArray(legacyRows) && legacyRows.length ? { rows: legacyRows, origin: 'saved edition snapshot' } : null);
  if (!rewards && !historical) {
    const rows = configs.filter(r => r.source_id === root.id && Number(r.config_version) === Number(settings.version));
    if (settings.version) rewards = { rows, origin: 'saved configuration' };
    else if ([1,2].includes(Number(root.division)) && !configs.some(r => r.source_id === root.id)) rewards = { rows: policy.regionalRows(Math.min(20, Number(root.max_clubs) || 20), root), origin: 'approved regional default' };
  }
  return { id: root.id, slug: root.slug, name: root.name, region: root.region, region_slug: root.region_slug, country_code: root.country_code, platform: root.platform, division: root.division, season_number: root.season_number, season_label: root.season_label, status: root.status,
    max_clubs: root.max_clubs || 20, participant_ids, participant_data_available, participant_count: participant_data_available ? participant_ids.length : null, winner_club_id: award?.winning_id || root.winner_club_id, winner_club_name: award?.winning_name || root.winner_club_name, completed_at: root.completed_at,
    promoted_slots: root.promoted_slots ?? null, relegated_slots: root.relegated_slots ?? null, qualification_rules: root.qualification_rules || null, rules: root.rules || root.rules_text || null, rules_file_url: art.safeImage(root.rules_file_url), linked_league_id: root.linked_league_id,
    trophy, artwork_state: assignment.state, rewards: rewards ? { rows: rewards.rows?.map(r => ({ ...r, stc_amount: r.stc_amount ?? r.amount, position_label: r.position_label || r.label })), origin: captured ? 'captured edition configuration' : rewards.origin, budget: rewards.budget || null, payment_state: settlement?.state || null } : null };
}
async function overview(query = EXECUTESQL) {
  const records = await query("SELECT * FROM league_entities WHERE entity_type IN ('regional_league','competition_settlement','reward_configuration') ORDER BY id");
  const items = await query('SELECT * FROM trophy_items ORDER BY id');
  const configs = await query("SELECT source_id,config_version,position,position_label,component_key,stc_amount FROM reward_configs WHERE source_type='regional_league'");
  const awards = await query("SELECT source_id,edition_id,metadata_json FROM trophy_awards WHERE source_type='regional_league' AND owner_type='club' AND status='earned' AND award_role='winner'");
  const unique = [...new Map(records.filter(r => r.entity_type === 'regional_league').map(r => [r.id, r])).values()];
  const descriptions = unique.map(describe);
  const groups = new Map();
  for (const d of descriptions) if (d.identity) groups.set(d.identity.key, [...(groups.get(d.identity.key) || []), d.id]);
  return { editions: unique.map(row => {
    const d = descriptions.find(d => d.id === row.id);
    return { ...publicEdition(unpack(row), records, items, configs, awards), ...(d.identity ? { region_slug: d.identity.region_slug, division: d.identity.division } : {}), system_key: d.identity ? `${d.identity.region_slug}:${d.identity.platform}` : `unverified:${row.id}`, division_key: d.identity ? `${d.identity.region_slug}:${d.identity.platform}:${d.identity.division}` : `unverified:${row.id}`, identity_conflict: Boolean(d.identity && groups.get(d.identity.key).length > 1), identity_unverified: Boolean(d.identity_error || d.indexed_json_differences.length) };
  }) };
}
async function participants(id, query = EXECUTESQL) {
  const data = await overview(query);
  const edition = data.editions.find(e => e.id === id);
  if (!edition) throw Object.assign(new Error('Regional edition not found'), { status: 404 });
  if (!edition.participant_data_available) throw Object.assign(new Error('The confirmed edition roster is unavailable and requires Admin review.'), { status: 409 });
  const ids = edition.participant_ids;
  const clubs = ids.length ? await query(`SELECT id,name,tag,logo_url,country_code,platform,region FROM clubs WHERE id IN (${ids.map(() => '?').join(',')})`, ids) : [];
  return { edition, participants: ids.map(id => {
    const c = clubs.find(c => String(c.id) === id);
    return { id, name: c?.name || 'Club unavailable', tag: c?.tag, logo_url: art.safeImage(c?.logo_url), country_code: c?.country_code, platform: c?.platform, region: c?.region, available: Boolean(c) };
  }) };
}
module.exports = { overview, participants, publicEdition };

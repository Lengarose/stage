'use strict';
const crypto = require('crypto');
const { EXECUTESQL, withTransaction } = require('../db/database');
const rewards = require('./rewardConfigurationService');
const { parse } = require('../lib/trophyHistory');
const { validateConfiguration } = require('../lib/rewardPolicy');
const { cents, stc } = require('../lib/competitionPrizes');
const { isConfirmedResult } = require('../lib/tournamentStatistics');
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const publicTrophy = item => item ? { id: item.id, name: item.name, image_url: safeImage(item.image_url) } : null;
function safeImage(url) {
  return typeof url === 'string' && /^(\/uploads\/[^\\\s]*|https?:\/\/[^\s]+)$/.test(url) ? url : null;
}
function rowData(row) { return { ...parse(row.data_json), id: row.id, status: row.status || parse(row.data_json).status }; }
function resolveAssignment(source, settings, items) {
  const reverse = items.filter(item => item.linked_source_type === 'competition' && item.linked_source_id === source.id);
  const ids = [...new Set([settings.trophy_item_id, source.trophy_item_id, ...reverse.map(item => item.id)].filter(Boolean))];
  if (ids.length > 1) return { state: 'conflict', trophy: null, ids, guidance: 'Conflicting explicit trophy links. Review Rewards and the Trophies catalogue before assigning a design.' };
  const item = items.find(item => item.id === ids[0]);
  if (!ids.length) return { state: 'unassigned', trophy: null, ids, guidance: 'Assign a competition trophy in Admin → GOST.' };
  if (!item || item.tournament_id || item.linked_source_id && (item.linked_source_type !== 'competition' || item.linked_source_id !== source.id)) {
    return { state: 'invalid', trophy: null, ids, guidance: 'The assigned trophy is missing or belongs to another event. Review Admin → GOST.' };
  }
  return { state: 'assigned', trophy: publicTrophy(item), ids, guidance: null };
}
async function assignment(id, query = EXECUTESQL, lock = false) {
  const [record] = await query(`SELECT * FROM league_entities WHERE entity_type='competition' AND id=?${lock ? ' FOR UPDATE' : ''}`, [id]);
  if (!record) throw fail('Competition not found', 404);
  const source = rowData(record);
  const [meta] = await query("SELECT * FROM league_entities WHERE entity_type='reward_configuration' AND id=?", [rewards.key('competition', id)]);
  const settings = parse(meta?.data_json);
  const items = await query(`SELECT * FROM trophy_items ORDER BY id${lock ? ' FOR UPDATE' : ''}`);
  const revision = crypto.createHash('sha256').update(JSON.stringify([source, settings, items.map(i => [i.id, i.name, i.image_url, i.linked_source_type, i.linked_source_id, i.tournament_id])])).digest('hex');
  return { source, settings, items, revision, ...resolveAssignment(source, settings, items) };
}
async function assign(id, input, admin, transaction = withTransaction) {
  if (!admin?.id || ![0, 2].includes(Number(admin.role_id))) throw fail('Admin access required', 403);
  if (!String(input.reason || '').trim()) throw fail('A change reason is required');
  if (input.trophy_item_id !== null && typeof input.trophy_item_id !== 'string') throw fail('Select a catalogue trophy');
  return transaction(async query => {
    const before = await assignment(id, query, true);
    if (before.revision !== input.revision) throw fail('Trophy configuration changed. Reload before saving.', 409);
    const selected = input.trophy_item_id || null;
    const nextSource = { ...before.source };
    delete nextSource.trophy_item_id;
    const nextSettings = { ...before.settings, trophy_item_id: selected };
    const resolved = resolveAssignment(nextSource, nextSettings, before.items);
    if (selected && resolved.state !== 'assigned' || !selected && resolved.ids.length) throw fail(resolved.guidance || 'Remove the legacy catalogue link before clearing this assignment.', 409);
    if (!selected || before.items.some(item => item.id === selected)) {
      await query("INSERT INTO league_entities (id,entity_type,data_json,status,created_date,updated_date) VALUES (?,'reward_configuration',?,'active',NOW(),NOW()) ON DUPLICATE KEY UPDATE data_json=VALUES(data_json),updated_date=NOW()", [rewards.key('competition', id), JSON.stringify(nextSettings)]);
      if (before.source.trophy_item_id !== undefined) await query("UPDATE league_entities SET data_json=?,updated_date=NOW() WHERE id=? AND entity_type='competition'", [JSON.stringify(nextSource), id]);
      await rewards.audit(query, admin, 'assign_competition_trophy', 'competition', id,
        { trophy_item_id: before.settings.trophy_item_id || null, legacy_trophy_item_id: before.source.trophy_item_id || null, reverse_ids: before.items.filter(i => i.linked_source_type === 'competition' && i.linked_source_id === id).map(i => i.id) },
        { trophy_item_id: selected, edition_snapshots_unchanged: true }, input.reason);
    }
    return assignment(id, query);
  });
}
function seasonState(season) {
  if (!season) return 'No edition announced';
  const knockout = { knockout_r16: 'Round of 16', knockout_qf: 'Quarterfinals', knockout_sf: 'Semifinals', knockout_final: 'Final' }[season.status];
  if (knockout) return `In progress · ${knockout}`;
  return ({ draft: 'Draft', qualification: 'Qualification', registration: 'Registration', league_phase: 'In progress · League phase', playoff_round: 'In progress · Playoff', playoffs: 'In progress · Playoff', knockout: 'In progress · Knockout', in_progress: 'In progress', completed: 'Completed', archived: 'Archived', cancelled: 'Cancelled' })[season.status] || 'Edition state unavailable';
}
function prizeDetails(config, count) {
  if (!config?.rows) return null;
  try {
    const valid = validateConfiguration('competition', config.rows, config.participant_count || 36);
    const amounts = Object.fromEntries(valid.rows.map(row => [row.component_key, row.stc_amount]));
    return { ...amounts, participant_basis: count, budget: Number.isInteger(count) && count >= 2 ? stc(cents(amounts.participation) * BigInt(count) + cents(amounts.winner_bonus) + cents(amounts.runner_up_bonus)) : null };
  } catch { return null; }
}
function journeyFor(season, source) {
  const format = season?.format || source.format;
  const playoffFormat = season?.playoff_format || source.playoff_format;
  if (season?.league_only || source.league_only || format === 'league') return { kind: 'league', text: 'League phase → final standings. No knockout stage.' };
  if (format === 'league_36_8md' && (!playoffFormat || playoffFormat === '9_24_bracket')) return { kind: 'ucl', direct: 8, playoff_from: 9, playoff_to: 24, playoff_legs: 2, text: 'League phase: top 8 qualify directly for the Round of 16. Positions 9–24 enter a two-legged playoff; eight winners join them. Positions 25 and below are eliminated. Round of 16 → Quarterfinals → Semifinals → Final.' };
  return { kind: 'unavailable', text: 'Competition journey is awaiting confirmed format rules.' };
}
async function overview(query = EXECUTESQL) {
  const records = await query("SELECT * FROM league_entities WHERE entity_type IN ('competition','competition_season','competition_settlement','reward_configuration','qualification_entry','competition_fixture') ORDER BY id");
  const items = await query('SELECT * FROM trophy_items ORDER BY id');
  const awards = await query("SELECT source_id,metadata_json FROM trophy_awards WHERE source_type='competition_season' AND owner_type='club' AND status='earned'");
  const rewardRows = await query("SELECT source_id,config_version,component_key,stc_amount FROM reward_configs WHERE source_type='competition'");
  const byType = type => records.filter(r => r.entity_type === type).map(rowData);
  return { competitions: byType('competition').filter(c => ['supreme', 'elite', 'challenger'].includes(c.slug)).map(source => {
    const settings = byType('reward_configuration').find(c => c.id === rewards.key('competition', source.id)) || {};
    settings.rows = rewardRows.filter(r => r.source_id === source.id && Number(r.config_version) === Number(settings.version));
    const seasons = byType('competition_season').filter(s => s.competition_id === source.id).sort((a, b) => Number(b.season_number) - Number(a.season_number) || a.id.localeCompare(b.id));
    const present = season => {
      const captured = byType('competition_settlement').find(s => s.source_type === 'competition_season' && s.source_id === season.id)?.config;
      const award = awards.filter(a => a.source_id === season.id).map(a => parse(a.metadata_json)).find(a => a.version === 1);
      const historical = ['completed', 'archived'].includes(season.status);
      const trophy = award ? { id: captured?.trophy_item_id || null, name: award.design_name, image_url: safeImage(award.image_url) } : captured?.trophy_snapshot ? publicTrophy(captured.trophy_snapshot) : publicTrophy(items.find(i => i.id === (captured?.trophy_item_id || season.trophy_item_id)));
      const registered = Array.isArray(season.registered_club_ids) ? new Set(season.registered_club_ids.filter(Boolean)).size : null;
      const basis = captured?.roster ? new Set(captured.roster).size : null;
      const qualified = new Set(byType('qualification_entry').filter(e => e.target_season_id === season.id && e.status === 'confirmed').map(e => e.club_id).filter(Boolean)).size;
      const final = byType('competition_fixture').find(f => f.season_id === season.id && f.phase === 'knockout_final' && isConfirmedResult({ ...f, status: f.status === 'played' ? 'completed' : f.status }));
      const winnerSide = final?.winner_club_id === final?.home_club_id && final?.winner_club_id ? 'home' : final?.winner_club_id === final?.away_club_id && final?.winner_club_id ? 'away' : null;
      return { id: season.id, season_number: season.season_number, label: season.season_label || `Season ${season.season_number}`, state: seasonState(season), status: season.status, registered, qualified, maximum: Number(season.max_clubs || season.target_clubs || source.max_clubs_per_season) || null, trophy, winner: award?.winning_name || season.winner_club_name || (winnerSide ? final[`${winnerSide}_club_name`] : null), runner_up: season.runner_up_club_name || (winnerSide ? final[`${winnerSide === 'home' ? 'away' : 'home'}_club_name`] : null), completed_at: season.completed_at || null, prizes: prizeDetails(captured || (!historical && settings.version ? settings : null), basis), journey: journeyFor(season, source) };
    };
    return { id: source.id, slug: source.slug, name: source.name, tier: source.tier, assignment: resolveAssignment(source, settings, items), editions: seasons.map(present), current: seasons.find(s => !['completed', 'archived', 'cancelled'].includes(s.status)) ? present(seasons.find(s => !['completed', 'archived', 'cancelled'].includes(s.status))) : seasons[0] && seasons[0].status !== 'archived' ? present(seasons[0]) : null, archive: seasons.filter(s => ['completed', 'archived'].includes(s.status)).map(present), journey: journeyFor(null, source) };
  }) };
}
// A captured roster is immutable edition evidence; otherwise registrations and
// confirmed qualification entries establish participation, never standings.
function participantDirectory(season, entries, clubs, leagues, capturedRoster) {
  const confirmed = entries.filter(e => e.target_season_id === season.id && e.status === 'confirmed' && e.club_id);
  const ids = [...new Set((Array.isArray(capturedRoster) ? capturedRoster : [
    ...(Array.isArray(season.registered_club_ids) ? season.registered_club_ids : []),
    ...confirmed.map(e => e.club_id),
  ]).filter(Boolean).map(String))];
  return ids.map(id => {
    const club = clubs.find(c => String(c.id) === id);
    const evidence = confirmed.filter(e => String(e.club_id) === id);
    const signatures = new Set(evidence.map(e => JSON.stringify([e.regional_league_id || null, Number(e.regional_finish_position) || null])));
    const entry = signatures.size === 1 ? evidence[0] : null;
    const league = leagues.find(l => l.id === entry?.regional_league_id);
    return { id, name: club?.name || entry?.club_name || 'Club unavailable', logo_url: safeImage(club?.logo_url || entry?.club_logo_url), country_code: club?.country_code || null,
      regional_league_id: entry?.regional_league_id || null, regional_league_name: entry?.regional_league_name || league?.name || null,
      qualification_position: Number(entry?.regional_finish_position) > 0 ? Number(entry.regional_finish_position) : null,
      qualification_conflict: signatures.size > 1, available: Boolean(club) };
  }).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}
async function directory(competitionId, seasonId, query = EXECUTESQL) {
  const records = await query("SELECT * FROM league_entities WHERE entity_type IN ('competition_season','qualification_entry','regional_league','competition_settlement') ORDER BY id");
  const byType = type => records.filter(r => r.entity_type === type).map(rowData);
  const season = byType('competition_season').find(s => s.id === seasonId && s.competition_id === competitionId);
  if (!season) throw fail('Competition edition not found', 404);
  const captured = byType('competition_settlement').find(s => s.source_type === 'competition_season' && s.source_id === seasonId)?.config?.roster;
  const entries = byType('qualification_entry').filter(e => e.target_season_id === seasonId);
  const provisional = participantDirectory(season, entries, [], [], captured);
  const ids = provisional.map(c => c.id);
  const clubs = ids.length ? await query(`SELECT id,name,logo_url,country_code FROM clubs WHERE id IN (${ids.map(() => '?').join(',')})`, ids) : [];
  return { season: { id: season.id, competition_id: season.competition_id, status: season.status }, participants: participantDirectory(season, entries, clubs, byType('regional_league'), captured) };
}
module.exports = { safeImage, publicTrophy, resolveAssignment, assignment, assign, seasonState, prizeDetails, journeyFor, overview, participantDirectory, directory };

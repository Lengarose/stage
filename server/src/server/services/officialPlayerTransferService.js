'use strict';
const { v5: uuid } = require('uuid');
const { fail, unpack } = require('../lib/regionalEditionIdentity');
const { wallClockToOffsetIso } = require('../utils/datetime');
const VERSION = 'regional_player_transfers_v1';
const RULES = 'One official club per player. Only permanent transfers are supported; loans are unavailable. Ordinary transfers close after the common participation confirmation deadline, including placement, and reopen in playing week 6 (Monday 00:00 to the following Monday 00:00, Europe/Brussels) and between seasons. Outside those windows, a free player may join only if they have not actually played for another official club in this cycle. Bench nomination alone is not actual participation. Cup-tied and player sanctions remain applicable.';

function localDate(now) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
function dayOffset(monday, days) {
  return new Date(Date.parse(`${monday}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
}
function ordinaryOpen(window, now) {
  if (now.getTime() < Date.parse(window.confirmation_closes_at)) return true;
  if (!window.league_start_monday) return false; // Placement is already in-season.
  const date = localDate(now);
  if (Number(window.season_number)>1 && date>=dayOffset(window.league_start_monday,-7) && date<window.league_start_monday) return true;
  return (date >= dayOffset(window.league_start_monday, 35) && date < dayOffset(window.league_start_monday, 42))
    || date >= dayOffset(window.league_start_monday, 84);
}
async function windowsForClubs(clubs, query) {
  const ids = [...new Set(clubs.filter(Boolean))];
  if (!ids.length) return [];
  return (await query(`SELECT DISTINCT w.* FROM league_entities w JOIN league_entities r
    ON r.entity_type='season_registration' AND JSON_UNQUOTE(JSON_EXTRACT(r.data_json,'$.registration_window_id'))=w.id
    WHERE w.entity_type='regional_registration_window' AND w.status='published'
      AND JSON_UNQUOTE(JSON_EXTRACT(w.data_json,'$.player_transfer_policy_version'))=?
      AND r.club_id IN (${ids.map(() => '?').join(',')})
      AND r.status IN ('pending','approved') AND JSON_UNQUOTE(JSON_EXTRACT(r.data_json,'$.participation_status')) IN ('registered','confirmed')
    ORDER BY w.id FOR UPDATE`, [VERSION, ...ids])).map(unpack);
}
async function actualClubs(playerId, window, query) {
  const rows = await query(`SELECT m.home_club_id,m.away_club_id,m.home_submission,m.away_submission
    FROM matches m JOIN league_entities s ON s.entity_type='official_match_selection'
      AND JSON_UNQUOTE(JSON_EXTRACT(s.data_json,'$.match_id'))=m.id
    JOIN league_entities e ON e.id=JSON_UNQUOTE(JSON_EXTRACT(s.data_json,'$.edition_id'))
      AND e.entity_type IN ('regional_league','regional_cycle','regional_cup_edition')
    WHERE JSON_UNQUOTE(JSON_EXTRACT(e.data_json,'$.participation_window_snapshot.id'))=?
    ORDER BY m.id FOR UPDATE`, [window.id]);
  const clubs = new Set();
  for (const row of rows) for (const side of ['home', 'away']) {
    let declaration = row[`${side}_submission`];
    if (typeof declaration === 'string') {
      try { declaration = JSON.parse(declaration); } catch { fail('Prior participation evidence requires Admin review.'); }
    }
    if (!declaration) continue;
    const ids = declaration.participating_player_ids;
    if (ids != null && !Array.isArray(ids)) fail('Prior participation evidence requires Admin review.');
    if (ids?.includes(playerId)) clubs.add(row[`${side}_club_id`]);
  }
  return clubs;
}
async function assertCrossRegionFreeEntry(player, windows, query, now) {
  if (player.club_id || !windows.length) return;
  const ids=windows.map(window=>window.id);
  const roots=await query(`SELECT DISTINCT e.data_json FROM matches m
    JOIN league_entities s ON s.entity_type='official_match_selection'
      AND JSON_UNQUOTE(JSON_EXTRACT(s.data_json,'$.match_id'))=m.id
    JOIN league_entities e ON e.id=JSON_UNQUOTE(JSON_EXTRACT(s.data_json,'$.edition_id'))
      AND e.entity_type IN ('regional_league','regional_cycle','regional_cup_edition')
    WHERE JSON_UNQUOTE(JSON_EXTRACT(e.data_json,'$.participation_window_snapshot.id')) NOT IN (${ids.map(()=>'?').join(',')})
      AND (JSON_SEARCH(m.home_submission,'one',?,NULL,'$.participating_player_ids[*]') IS NOT NULL
        OR JSON_SEARCH(m.away_submission,'one',?,NULL,'$.participating_player_ids[*]') IS NOT NULL)
    ORDER BY e.data_json FOR UPDATE`,[...ids,player.id,player.id]);
  for(const row of roots) {
    const root=unpack(row),source=root.participation_window_snapshot;
    if(!source || root.edition_invalidated || root.retired_at || ['reset','retired','superseded','abandoned','cancelled'].includes(root.status))continue;
    if(windows.every(window=>window.region_slug===source.region_slug))continue;
    if(now.getTime()<Date.parse(source.confirmation_closes_at))continue;
    if(source.league_start_monday && localDate(now)>=dayOffset(source.league_start_monday,84))continue;
    fail('Prior actual participation in another active regional cycle requires Admin review. Cross-region cycle rights are not automatically reassigned.',422);
  }
}
async function assertMove({ player, targetClubId, referenceId, actorId = null }, query, now = new Date()) {
  if (!player?.id || !targetClubId) fail('A player and destination club are required for a permanent transfer.', 400);
  if (player.club_id === targetClubId) return;
  const windows = await windowsForClubs([player.club_id, targetClubId], query);
  await assertCrossRegionFreeEntry(player, windows, query, now);
  for (const window of windows) {
    if (!ordinaryOpen(window, now)) {
      if (player.club_id) fail('Official transfers are closed. Permanent club changes are allowed between seasons or in playing week 6.', 422);
      const prior = await actualClubs(player.id, window, query);
      if ([...prior].some(id => id !== targetClubId)) fail('This free player already played for another official club in this cycle. Wait for the transfer window.', 422);
    }
    const id = uuid(`official_player_transfer:${window.id}:${player.id}:${referenceId}`, uuid.URL);
    const record = { id, window_id: window.id, policy_version: VERSION, player_id: player.id,
      from_club_id: player.club_id || null, club_id: targetClubId, reference_id: referenceId,
      actor_user_id: actorId, transferred_at: now.toISOString() };
    await query("INSERT INTO league_entities (id,entity_type,data_json,club_id) VALUES (?,'official_player_transfer',?,?) ON DUPLICATE KEY UPDATE id=id", [id, JSON.stringify(record), targetClubId]);
  }
}
async function assertOfferWindow({ playerId, teamId }, query) {
  const captured=await query("SELECT id FROM league_entities WHERE entity_type='regional_registration_window' AND status='published' AND JSON_UNQUOTE(JSON_EXTRACT(data_json,'$.player_transfer_policy_version'))=? LIMIT 1",[VERSION]);
  if(!captured.length)return false;
  const [player] = await query('SELECT id,club_id FROM players WHERE id=? LIMIT 1', [playerId]);
  if (!player) fail('Player not found.', 404);
  const windows = await windowsForClubs([player.club_id, teamId], query);
  if (!windows.length) return false;
  await assertCrossRegionFreeEntry(player, windows, query, new Date());
  for (const window of windows) if (!ordinaryOpen(window, new Date()) && player.club_id !== teamId) {
    if (player.club_id || [...await actualClubs(player.id, window, query)].some(id=>id!==teamId)) fail('This player is not eligible for a permanent official transfer now. Use the between-season or week-six window, or the eligible free-player exception.', 422);
  }
  return true;
}
async function recruitmentAvailable(userId, query) {
  if (!userId) return false;
  const clubs=await query(`SELECT DISTINCT c.id AS official_club_id FROM clubs c LEFT JOIN players p ON p.club_id=c.id AND p.user_id=?
    WHERE c.president_user_id=? OR c.user_id=? OR p.id IS NOT NULL
    UNION SELECT DISTINCT pc.team_id AS official_club_id FROM player_contracts pc JOIN players recipient ON recipient.id=pc.user_id
    WHERE recipient.user_id=? AND pc.status IN ('pending','pending_window','negotiating')`,[userId,userId,userId,userId]);
  return (await windowsForClubs(clubs.map(row=>row.official_club_id),query)).length>0;
}
async function assertProfileChange(current, patch, query) {
  if (!Object.prototype.hasOwnProperty.call(patch, 'club_id') || (patch.club_id || null) === (current.club_id || null)) return;
  if ((await windowsForClubs([current.club_id, patch.club_id], query)).length) fail('Use the permanent contract or club departure workflow to change official club registration.', 422);
}
async function assertSelection(ctx, selection, query) {
  const window = ctx.root?.participation_window_snapshot;
  if (window?.player_transfer_policy_version !== VERSION || !selection.ids.length) return;
  const records = await query("SELECT * FROM league_entities WHERE entity_type='season_registration' AND club_id=? AND JSON_UNQUOTE(JSON_EXTRACT(data_json,'$.registration_window_id'))=? FOR UPDATE", [selection.club_id, window.id]);
  if (records.length !== 1) fail('Official player registration evidence requires Admin review.', 422);
  const registration = unpack(records[0]);
  const permitted = new Set(registration.club_roster_player_ids || []);
  const moves = await query("SELECT * FROM league_entities WHERE entity_type='official_player_transfer' AND club_id=? AND JSON_UNQUOTE(JSON_EXTRACT(data_json,'$.window_id'))=? FOR UPDATE", [selection.club_id, window.id]);
  for (const row of moves) {
    const move = unpack(row);
    if (move.policy_version === VERSION) permitted.add(move.player_id);
  }
  const invalid = selection.ids.filter(id => !permitted.has(id));
  if (invalid.length) fail('A selected player has no captured roster place or approved permanent transfer for this edition.', 422, { player_ids: invalid });
}
module.exports = { VERSION, RULES, ordinaryOpen, assertMove, assertSelection, actualClubs, assertProfileChange, assertOfferWindow, recruitmentAvailable,
  weekSixStartsAt: window => wallClockToOffsetIso(`${dayOffset(window.league_start_monday, 35)} 00:00:00`, 'Europe/Brussels') };

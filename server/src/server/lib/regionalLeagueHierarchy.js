'use strict';
const { identity, unpack } = require('./regionalEditionIdentity');
const permanentId = record => record.permanent_league_id || record.id;
function leagueKey(record) {
  const scope = identity({ ...record, slug: '', group_code:'A', season_number: 1, reset_series: 0 });
  return scope.key;
}
function buildCatalogue(rows) {
  const editions = rows.map(unpack);
  const definitions = editions.filter(r => permanentId(r) === r.id);
  const groups = definitions.flatMap(root => {
    const family=editions.filter(e=>permanentId(e)===root.id);
    const codes=[...new Set(family.map(e=>e.group_code || 'A'))].sort();
    return codes.map(group_code=>{
    const seasons = family.filter(e=>(e.group_code || 'A')===group_code).sort((a,b) => Number(b.reset_series || 0)-Number(a.reset_series || 0) || Number(b.season_number)-Number(a.season_number) || a.id.localeCompare(b.id));
    const available = seasons.filter(e => !['reset','cancelled','abandoned','superseded'].includes(e.status));
    const pointer = root.group_current_edition_ids?.[group_code] || (group_code==='A'?root.current_edition_id:null);
    const pointed = pointer && available.find(e => e.id === pointer);
    const active = available.filter(e => !['completed','archived'].includes(e.status));
    const current = pointed || (active.length === 1 ? active[0] : active.length ? null : available[0]);
    return { ...(current || seasons[0] || root), group_code, group_key:`${root.id}:${group_code}`, permanent_league_id: root.id, stable_slug: group_code==='A'?root.slug:`${root.slug}-group-${group_code.toLowerCase()}`, retired: Boolean(root.retired_at || root.retired), current_edition_id: current?.id || null, identity_conflict: active.length > 1 && !pointed, editions: seasons.map(e => ({ id:e.id,group_code,season_number:e.season_number,reset_series:e.reset_series || 0,status:e.status,season_label:e.season_label })) };
    });
  });
  const leagues=definitions.map(root=>({...groups.find(g=>g.permanent_league_id===root.id&&g.group_code==='A'),groups:groups.filter(g=>g.permanent_league_id===root.id)}));
  const keys = new Map();
  for (const root of definitions) { try { const key=leagueKey(root);keys.set(key,(keys.get(key)||0)+1); } catch { /* surfaced as unverified */ } }
  for (const row of [...leagues,...groups]) { try { row.identity_conflict ||= keys.get(leagueKey(row))>1; } catch { row.identity_unverified=true; } }
  return { definitions, editions, leagues, groups };
}
module.exports = { permanentId, leagueKey, buildCatalogue };

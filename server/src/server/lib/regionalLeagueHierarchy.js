'use strict';
const { identity, unpack } = require('./regionalEditionIdentity');
const permanentId = record => record.permanent_league_id || record.id;
function leagueKey(record) {
  const scope = identity({ ...record, slug: String(record.slug || '').replace(/-s\d+$/, ''), season_number: 1, reset_series: 0 });
  return scope.key;
}
function buildCatalogue(rows) {
  const editions = rows.map(unpack);
  const definitions = editions.filter(r => permanentId(r) === r.id);
  const leagues = definitions.map(root => {
    const seasons = editions.filter(e => permanentId(e) === root.id).sort((a,b) => Number(b.reset_series || 0)-Number(a.reset_series || 0) || Number(b.season_number)-Number(a.season_number) || a.id.localeCompare(b.id));
    const available = seasons.filter(e => !['reset','cancelled','abandoned','superseded'].includes(e.status));
    const pointed = root.current_edition_id && available.find(e => e.id === root.current_edition_id);
    const active = available.filter(e => !['completed','archived'].includes(e.status));
    const current = pointed || (active.length === 1 ? active[0] : active.length ? null : available[0]);
    return { ...(current || root), permanent_league_id: root.id, stable_slug: root.slug, retired: Boolean(root.retired_at || root.retired), current_edition_id: current?.id || null, identity_conflict: active.length > 1 && !pointed, editions: seasons.map(e => ({ id:e.id,season_number:e.season_number,reset_series:e.reset_series || 0,status:e.status,season_label:e.season_label })) };
  });
  const keys = new Map();
  for (const root of definitions) { try { const key=leagueKey(root);keys.set(key,(keys.get(key)||0)+1); } catch { /* surfaced as unverified */ } }
  for (const row of leagues) { try { row.identity_conflict ||= keys.get(leagueKey(row))>1; } catch { row.identity_unverified=true; } }
  return { definitions, editions, leagues };
}
module.exports = { permanentId, leagueKey, buildCatalogue };

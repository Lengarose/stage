export const regionalTabs = ['overview', 'clubs', 'stages', 'table', 'stats', 'rewards', 'history'].map(value => ({ value, label: value[0].toUpperCase() + value.slice(1) }));
export const historicalRegional = edition => ['completed', 'archived'].includes(edition.status);
export const regionalHref = edition => `/leagues/${encodeURIComponent(edition.stable_slug || edition.slug || edition.id)}?season=${encodeURIComponent(edition.id)}`;
export function selectRegionalEdition(editions, slug, requested) {
  const route = editions.filter(e => e.slug === slug || e.id === slug || e.stable_slug === slug || e.permanent_league_id === slug);
  if (requested) {
    const found = editions.find(e => e.id === requested);
    return found && route.some(r => r.division_key === found.division_key) ? found : null;
  }
  const current = route.filter(e=>e.is_current);
  return current.length===1 ? current[0] : route.length === 1 ? route[0] : null;
}
export function regionalSystems(editions, { archive = false, search = '', region = '', division = '' } = {}) {
  const groups = new Map();
  for (const edition of [...new Map(editions.map(e => [e.id, e])).values()]) {
    if ((archive ? !historicalRegional(edition) : edition.is_current !== undefined ? !edition.is_current || edition.retired : historicalRegional(edition)) || ['superseded', 'cancelled','abandoned','reset'].includes(edition.status)) continue;
    if (region && edition.region_slug !== region || division && String(edition.division) !== division) continue;
    const query = search.trim().toLocaleLowerCase();
    if (query && ![edition.name, edition.region_slug, edition.platform].some(v => String(v || '').toLocaleLowerCase().includes(query))) continue;
    if (!groups.has(edition.system_key)) groups.set(edition.system_key, { key: edition.system_key, region_slug: edition.region_slug, region: edition.region, platform: edition.platform, editions: [] });
    groups.get(edition.system_key).editions.push(edition);
  }
  return [...groups.values()].map(group => ({ ...group, divisions: new Set(editions.filter(e => e.system_key === group.key).map(e => e.division)).size, editions: group.editions.sort((a,b) => Number(a.division)-Number(b.division) || Number(b.season_number)-Number(a.season_number) || a.id.localeCompare(b.id)) })).sort((a,b) => String(a.region_slug).localeCompare(String(b.region_slug)) || a.key.localeCompare(b.key));
}

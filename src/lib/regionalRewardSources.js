const normalized = value => String(value || '').trim().toLowerCase().replace(/[ _]+/g, '-');
export async function loadRegionalRewardSources(client) {
  const catalogue = await loadRegionalLeagueCatalogue(client);
  return regionalRewardSources(catalogue.definitions, catalogue.leagues, catalogue.editions);
}
export async function loadRegionalLeagueCatalogue(client) {
  const catalogue = await client.http.get('/regional-leagues/catalogue');
  if (!Array.isArray(catalogue?.leagues) || !Array.isArray(catalogue?.definitions) || !Array.isArray(catalogue?.editions)) {
    throw new Error('Regional catalogue response is invalid. No records changed.');
  }
  return catalogue;
}
export function rewardSourceIdentity(record) {
  const rawSlug = normalized(record.stable_slug || record.slug);
  const slug = rawSlug.replace(/-s\d+$/, ''), divisionSuffix = /-div-(\d+)$/.exec(slug);
  let region = normalized(record.region_slug || (divisionSuffix ? slug.replace(/-div-\d+$/, '') : ''));
  if (!region && (/north-america/.test(slug) || /north-america/.test(normalized(record.region)))) region = 'north-america';
  region = ({ 'north-american-league': 'north-america', 'north-american': 'north-america', uk: 'uk-ireland', 'uk-and-ireland': 'uk-ireland', 'united-kingdom': 'uk-ireland' })[region] || region;
  const raw = normalized(record.platform);
  const platform = ({ crossplay: 'cross-platform', crossplatform: 'cross-platform', all: 'cross-platform', ps: 'playstation', 'play-station': 'playstation' })[raw] || raw;
  const division = Number(record.division ?? divisionSuffix?.[1]);
  if (!region || !platform || !Number.isSafeInteger(division) || division < 1 || (divisionSuffix && Number(divisionSuffix[1]) !== division)) return null;
  return JSON.stringify([region, division, platform]);
}
export function regionalRewardSources(definitions, currentLeagues = [], editions = []) {
  const unique = [...new Map((definitions || []).filter(record => record?.id && (!record.permanent_league_id || record.permanent_league_id === record.id)).map(record => {
    const current = currentLeagues.find(row => (row.permanent_league_id || row.id) === record.id);
    const currentId = current && Object.hasOwn(current, 'current_edition_id') ? current.current_edition_id
      : Object.hasOwn(record, 'current_edition_id') ? record.current_edition_id : current?.id ?? null;
    const history = [...new Map([
      ...(record.editions || []), ...(current?.editions || []),
      ...editions.filter(row => (row.permanent_league_id || row.id) === record.id),
    ].map(row => [row.id, row])).values()];
    const currentEdition = currentId == null ? null : history.find(row => row.id === currentId) || (current?.id === currentId ? current : record.current_edition || null);
    return [record.id, { ...record, permanent_league_id: record.id, stable_slug: record.stable_slug || record.slug,
      current_edition_id: currentId, current_edition: currentEdition, editions: history,
      identity_conflict: Boolean(record.identity_conflict || current?.identity_conflict),
      identity_unverified: Boolean(record.identity_unverified || current?.identity_unverified),
    }];
  })).values()];
  const counts = new Map();
  for (const record of unique) { const key = rewardSourceIdentity(record); if (key) counts.set(key, (counts.get(key) || 0) + 1); }
  return unique.map(record => ({ ...record, identity_unverified: Boolean(record.identity_unverified || !rewardSourceIdentity(record)), identity_conflict: Boolean(record.identity_conflict || (rewardSourceIdentity(record) && counts.get(rewardSourceIdentity(record)) > 1)) }));
}

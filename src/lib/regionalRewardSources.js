const normalized = value => String(value || '').trim().toLowerCase().replace(/[ _]+/g, '-');
export async function loadRegionalRewardSources(client) {
  const rows = [];
  const seen = new Set();
  for (let offset = 0; ; offset += 500) {
    const batch = await client.http.get('/regional-leagues', { limit: 500, offset });
    if (!Array.isArray(batch)) throw new Error('Regional source response is invalid; no records changed.');
    if (offset && batch.length && batch.every(row => seen.has(row.id))) throw new Error('Regional pagination repeated a page. Deploy the protected backend before loading more sources.');
    batch.forEach(row => seen.add(row.id));
    rows.push(...batch);
    if (batch.length < 500) return regionalRewardSources(rows);
  }
}
export function rewardSourceIdentity(record) {
  const rawSlug = normalized(record.slug), suffix = /-s(\d+)$/.exec(rawSlug);
  const slug = rawSlug.replace(/-s\d+$/, ''), divisionSuffix = /-div-(\d+)$/.exec(slug);
  let region = normalized(record.region_slug || (divisionSuffix ? slug.replace(/-div-\d+$/, '') : ''));
  if (!region && (/north-america/.test(slug) || /north-america/.test(normalized(record.region)))) region = 'north-america';
  region = ({ 'north-american-league': 'north-america', 'north-american': 'north-america', uk: 'uk-ireland', 'uk-and-ireland': 'uk-ireland', 'united-kingdom': 'uk-ireland' })[region] || region;
  const raw = normalized(record.platform);
  const platform = ({ crossplay: 'cross-platform', crossplatform: 'cross-platform', all: 'cross-platform', ps: 'playstation', 'play-station': 'playstation' })[raw] || raw;
  const division = Number(record.division ?? divisionSuffix?.[1]), season = Number(record.season_number ?? suffix?.[1]);
  if (!region || !platform || !Number.isSafeInteger(division) || division < 1 || !Number.isSafeInteger(season) || season < 1 || (divisionSuffix && Number(divisionSuffix[1]) !== division) || (suffix && Number(suffix[1]) !== season)) return null;
  return JSON.stringify([region, division, platform, season]);
}
export function regionalRewardSources(records) {
  const unique = [...new Map((records || []).filter(record => record?.id).map(record => [record.id, record])).values()];
  const counts = new Map();
  for (const record of unique) { const key = rewardSourceIdentity(record); if (key) counts.set(key, (counts.get(key) || 0) + 1); }
  return unique.map(record => ({ ...record, identity_unverified: !rewardSourceIdentity(record), identity_conflict: Boolean(rewardSourceIdentity(record) && counts.get(rewardSourceIdentity(record)) > 1) }));
}

'use strict';
const crypto = require('crypto');
const slugify = value => String(value || '').trim().toLowerCase().replace(/[ _]+/g, '-');
const regionAliases = { 'north-american-league': 'north-america', 'north-american': 'north-america', 'uk': 'uk-ireland', 'uk-and-ireland': 'uk-ireland', 'united-kingdom': 'uk-ireland' };
const platformAliases = { crossplay: 'cross-platform', crossplatform: 'cross-platform', all: 'cross-platform', ps: 'playstation', 'play-station': 'playstation' };
function fail(message, status = 409, details) { throw Object.assign(new Error(message), { status, details }); }
function unpack(row) {
  let data = {};
  try { data = typeof row.data_json === 'string' ? JSON.parse(row.data_json) : row.data_json || {}; } catch { /* reported separately by diagnostics */ }
  return { ...data, ...Object.fromEntries(Object.entries(row).filter(([key, value]) => key !== 'data_json' && value != null)) };
}
function identity(input) {
  const rawSlug = slugify(input.slug);
  const suffix = /-s(\d+)$/.exec(rawSlug);
  const base = rawSlug.replace(/-s\d+$/, '');
  const divisionSuffix = /-div-(\d+)$/.exec(base);
  let region = slugify(input.region_slug || (divisionSuffix ? base.replace(/-div-\d+$/, '') : ''));
  if (!region && /north-america/.test(base)) region = 'north-america';
  if (!region && /north-america/.test(slugify(input.region))) region = 'north-america';
  region = regionAliases[region] || region;
  const division = Number(input.division ?? divisionSuffix?.[1]);
  const season = Number(input.season_number ?? suffix?.[1]);
  const platformRaw = slugify(input.platform);
  const platform = platformAliases[platformRaw] || platformRaw;
  if (!region || !platform || !Number.isSafeInteger(division) || division < 1 || !Number.isSafeInteger(season) || season < 1) fail('Explicit league region, division, platform and season are required', 400);
  if (divisionSuffix && Number(divisionSuffix[1]) !== division) fail('Slug division contradicts stored division');
  if (suffix && Number(suffix[1]) !== season) fail('Slug season contradicts stored season');
  if (divisionSuffix) {
    const slugRegion = base.replace(/-div-\d+$/, '');
    if ((regionAliases[slugRegion] || slugRegion) !== region) fail('Slug region contradicts region_slug');
  }
  const fields = { region_slug: region, division, platform, season_number: season };
  const key = crypto.createHash('sha256').update(JSON.stringify(fields)).digest('hex');
  return { ...fields, key, canonical_slug: `${region}-div-${division}${season === 1 ? '' : `-s${season}`}` };
}
function describe(row) {
  const record = unpack(row);
  let edition = null, error = null;
  try { edition = identity(record); } catch (err) { error = err.message; }
  let json;
  try { json = typeof row.data_json === 'string' ? JSON.parse(row.data_json) : row.data_json || {}; } catch { json = {}; error = 'Malformed data_json'; }
  const differences = ['slug', 'region', 'division', 'platform', 'season_number', 'status'].filter(key => Object.hasOwn(row, key) && Object.hasOwn(json, key) && String(row[key] ?? null) !== String(json[key] ?? null)).map(key => ({ field: key, indexed: row[key], json: json[key] }));
  return { id: row.id, record, raw: row, identity: edition, identity_error: error, indexed_json_differences: differences };
}
module.exports = { identity, unpack, describe, fail };

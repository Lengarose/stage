import iso3166 from './iso3166-all.json';

/** ISO alpha-2 → regional indicator flag emoji (e.g. BE → 🇧🇪). */
export function countryCodeToFlag(code) {
  const normalized = String(code || '').toUpperCase();
  if (normalized.length !== 2) return '';
  const base = 0x1f1e6;
  return [...normalized]
    .map((char) => String.fromCodePoint(base + char.charCodeAt(0) - 65))
    .join('');
}

/** All ISO 3166-1 alpha-2 countries/territories, sorted by name. */
export const ALL_COUNTRIES = iso3166
  .map((row) => {
    const code = String(row['alpha-2'] || '').toUpperCase();
    return {
      code,
      name: String(row.name || row['alpha-2'] || '').trim(),
      flag: countryCodeToFlag(code),
      region: row.region || null,
      subRegion: row['sub-region'] || null,
    };
  })
  .filter((c) => c.code.length === 2)
  .sort((a, b) => a.name.localeCompare(b.name));

const byCode = new Map(ALL_COUNTRIES.map((c) => [c.code, c]));

export function getCountryName(code) {
  return byCode.get(String(code || '').toUpperCase())?.name || code;
}

export function getCountryFlag(code) {
  const entry = byCode.get(String(code || '').toUpperCase());
  return entry ? entry.flag : countryCodeToFlag(code);
}

/** Parse "BE,FR,CD" or "BE, FR, CD" → ['BE','FR','CD'] */
export function parseCountryCodesString(value) {
  return String(value || '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter((code) => code.length === 2);
}

/** ['BE','FR','CD'] → "BE,FR,CD" */
export function joinCountryCodes(codes) {
  const unique = [...new Set(codes.map((c) => String(c).trim().toUpperCase()).filter((c) => c.length === 2))];
  unique.sort((a, b) => {
    const nameA = getCountryName(a);
    const nameB = getCountryName(b);
    return nameA.localeCompare(nameB);
  });
  return unique.join(',');
}

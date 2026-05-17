import { ALL_COUNTRIES, joinCountryCodes, parseCountryCodesString } from './allCountries';

/** Dependent territories / areas — not offered for World Cup-style picks. */
const FIFA_TERRITORY_EXCLUSIONS = new Set([
  'AX', 'AS', 'AI', 'AQ', 'AW', 'BM', 'BV', 'CC', 'CK', 'CX', 'FK', 'FO', 'GF', 'GG', 'GI',
  'GL', 'GP', 'GU', 'HK', 'HM', 'IO', 'JE', 'KY', 'MF', 'MO', 'MP', 'MQ', 'MS', 'NC', 'NF',
  'NU', 'PF', 'PM', 'PN', 'PR', 'RE', 'SH', 'SJ', 'TC', 'TF', 'TK', 'TV', 'UM', 'VG', 'VI',
  'WF', 'YT', 'PN', 'GS', 'BL', 'SX', 'CW', 'BQ', 'XK', // XK optional - Kosovo is FIFA member, include XK
]);

// Kosovo is FIFA — remove XK from exclusions
FIFA_TERRITORY_EXCLUSIONS.delete('XK');

export const INTERNATIONAL_TOURNAMENT_TYPES = [
  { value: 'world_cup', label: 'World Cup' },
  { value: 'euro', label: 'Euro' },
  { value: 'afcon', label: 'AFCON' },
  { value: 'copa_america', label: 'Copa America' },
  { value: 'asian_cup', label: 'Asian Cup' },
  { value: 'custom', label: 'Custom' },
];

/** Default maximum national teams (participants) per competition type. */
export const MAX_TEAMS_BY_TOURNAMENT_TYPE = {
  world_cup: 48,
  euro: 24,
  afcon: 24,
  copa_america: 16,
  asian_cup: 24,
  custom: 16,
};

const MAIN_REGIONS = new Set(['Africa', 'Americas', 'Asia', 'Europe', 'Oceania']);

function isWorldCupEligible(country) {
  if (!country.region || !MAIN_REGIONS.has(country.region)) return false;
  if (FIFA_TERRITORY_EXCLUSIONS.has(country.code)) return false;
  return true;
}

function isEuroEligible(country) {
  if (country.region !== 'Europe') return false;
  if (FIFA_TERRITORY_EXCLUSIONS.has(country.code)) return false;
  return true;
}

function isAfconEligible(country) {
  return country.region === 'Africa' && !FIFA_TERRITORY_EXCLUSIONS.has(country.code);
}

function isCopaAmericaEligible(country) {
  return country.subRegion === 'South America' && !FIFA_TERRITORY_EXCLUSIONS.has(country.code);
}

function isAsianCupEligible(country) {
  return country.region === 'Asia' && !FIFA_TERRITORY_EXCLUSIONS.has(country.code);
}

const FILTER_BY_TYPE = {
  world_cup: isWorldCupEligible,
  euro: isEuroEligible,
  afcon: isAfconEligible,
  copa_america: isCopaAmericaEligible,
  asian_cup: isAsianCupEligible,
};

/** @returns {Set<string>|null} null = no filter (custom) */
export function getAllowedCountryCodeSet(tournamentType) {
  if (!tournamentType || tournamentType === 'custom') return null;
  const predicate = FILTER_BY_TYPE[tournamentType];
  if (!predicate) return null;
  const codes = ALL_COUNTRIES.filter(predicate).map((c) => c.code);
  return new Set(codes);
}

export function getCountriesForTournamentType(tournamentType) {
  const allowed = getAllowedCountryCodeSet(tournamentType);
  if (!allowed) return ALL_COUNTRIES;
  return ALL_COUNTRIES.filter((c) => allowed.has(c.code));
}

export function getDefaultMaxTeams(tournamentType) {
  return MAX_TEAMS_BY_TOURNAMENT_TYPE[tournamentType] ?? 16;
}

export function getCountryFilterHint(tournamentType) {
  switch (tournamentType) {
    case 'world_cup':
      return 'FIFA-style nations (all confederations). Territories excluded.';
    case 'euro':
      return 'Europe only.';
    case 'afcon':
      return 'Africa only.';
    case 'copa_america':
      return 'South America only.';
    case 'asian_cup':
      return 'Asia only.';
    case 'custom':
      return 'No country filter — all countries available.';
    default:
      return '';
  }
}

/** Keep only codes valid for the selected tournament type. */
export function pruneCountryCodesString(value, tournamentType) {
  const allowed = getAllowedCountryCodeSet(tournamentType);
  const codes = parseCountryCodesString(value);
  if (!allowed) return joinCountryCodes(codes);
  return joinCountryCodes(codes.filter((code) => allowed.has(code)));
}

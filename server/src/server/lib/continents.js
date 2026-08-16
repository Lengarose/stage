const CONTINENTS = [
  { id: "europe", name: "Europe", kicker: "UEFA desk" },
  { id: "africa", name: "Africa", kicker: "CAF desk" },
  { id: "asia", name: "Asia", kicker: "AFC desk" },
  { id: "north_america", name: "North America", kicker: "CONCACAF desk" },
  { id: "south_america", name: "South America", kicker: "CONMEBOL desk" },
  { id: "oceania", name: "Oceania", kicker: "OFC desk" },
  { id: "middle_east", name: "Middle East", kicker: "West Asia desk" },
];

const REGION_TO_ID = {
  europe: "europe",
  africa: "africa",
  asia: "asia",
  "north america": "north_america",
  "south america": "south_america",
  oceania: "oceania",
  "middle east": "middle_east",
  uefa: "europe",
  caf: "africa",
  afc: "asia",
  concacaf: "north_america",
  conmebol: "south_america",
  ofc: "oceania",
  "west asia": "middle_east",
  "western asia": "middle_east",
};

const COUNTRY_TO_CONTINENT = {};

function addCodes(continentId, codes) {
  for (const code of codes) COUNTRY_TO_CONTINENT[code] = continentId;
}

addCodes("asia", ["AF", "AM", "AZ", "BD", "BT", "BN", "KH", "CN", "TW", "CY", "GE", "HK", "IN", "ID", "JP", "KZ", "KG", "LA", "MO", "MY", "MV", "MN", "MM", "NP", "KP", "PK", "PH", "SG", "KR", "LK", "TJ", "TH", "TL", "TM", "UZ", "VN"]);
addCodes("europe", ["AL", "AD", "AT", "BY", "BE", "BA", "BG", "HR", "CZ", "DK", "ENG", "EE", "FO", "FI", "FR", "DE", "GI", "GR", "HU", "IS", "IE", "IT", "XK", "KOS", "LV", "LI", "LT", "LU", "MT", "MD", "ME", "NL", "MK", "NIR", "NO", "PL", "PT", "RO", "RU", "SM", "SCO", "RS", "SK", "SI", "ES", "SE", "CH", "UA", "WAL", "GB", "UK"]);
addCodes("africa", ["DZ", "AO", "BJ", "BW", "BF", "BI", "CV", "CM", "CF", "TD", "KM", "CG", "CI", "DJ", "CD", "EG", "GQ", "ER", "SZ", "ET", "GA", "GM", "GH", "GN", "GW", "KE", "LS", "LR", "LY", "MG", "MW", "ML", "MR", "MU", "MA", "MZ", "NA", "NE", "NG", "RW", "ST", "SN", "SC", "SL", "SO", "ZA", "SS", "SD", "TZ", "TG", "TN", "UG", "ZM", "ZW"]);
addCodes("oceania", ["AS", "AU", "CK", "FJ", "GU", "NC", "NZ", "PG", "WS", "SB", "PF", "TO", "VU"]);
addCodes("north_america", ["AI", "AG", "AW", "BS", "BB", "BZ", "BM", "CA", "KY", "CR", "CU", "CW", "DM", "DO", "SV", "GD", "GT", "GY", "HT", "HN", "JM", "MX", "MS", "NI", "PA", "PR", "KN", "LC", "VC", "SR", "TT", "TC", "US", "VG", "VI"]);
addCodes("south_america", ["AR", "BO", "BR", "CL", "CO", "EC", "PY", "PE", "UY", "VE"]);
addCodes("middle_east", ["BH", "IR", "IQ", "IL", "JO", "KW", "LB", "OM", "PS", "QA", "SA", "SY", "TR", "AE", "YE"]);

const COUNTRY_NAMES = {
  AD: "Andorra", AE: "United Arab Emirates", AF: "Afghanistan", AG: "Antigua and Barbuda", AI: "Anguilla",
  AL: "Albania", AM: "Armenia", AO: "Angola", AR: "Argentina", AS: "American Samoa", AT: "Austria",
  AU: "Australia", AW: "Aruba", AZ: "Azerbaijan", BA: "Bosnia and Herzegovina", BB: "Barbados", BD: "Bangladesh",
  BE: "Belgium", BF: "Burkina Faso", BG: "Bulgaria", BH: "Bahrain", BI: "Burundi", BJ: "Benin", BM: "Bermuda",
  BN: "Brunei", BO: "Bolivia", BR: "Brazil", BS: "Bahamas", BT: "Bhutan", BW: "Botswana", BY: "Belarus",
  BZ: "Belize", CA: "Canada", CD: "DR Congo", CF: "Central African Republic", CG: "Congo", CH: "Switzerland",
  CI: "Ivory Coast", CK: "Cook Islands", CL: "Chile", CM: "Cameroon", CN: "China", CO: "Colombia", CR: "Costa Rica",
  CU: "Cuba", CV: "Cape Verde", CW: "Curaçao", CY: "Cyprus", CZ: "Czechia", DE: "Germany", DJ: "Djibouti",
  DK: "Denmark", DM: "Dominica", DO: "Dominican Republic", DZ: "Algeria", EC: "Ecuador", EE: "Estonia",
  EG: "Egypt", ENG: "England", ER: "Eritrea", ES: "Spain", ET: "Ethiopia", FI: "Finland", FJ: "Fiji",
  FO: "Faroe Islands", FR: "France", GA: "Gabon", GB: "United Kingdom", GD: "Grenada", GE: "Georgia",
  GH: "Ghana", GI: "Gibraltar", GM: "Gambia", GN: "Guinea", GQ: "Equatorial Guinea", GR: "Greece",
  GT: "Guatemala", GU: "Guam", GW: "Guinea-Bissau", GY: "Guyana", HK: "Hong Kong", HN: "Honduras",
  HR: "Croatia", HT: "Haiti", HU: "Hungary", ID: "Indonesia", IE: "Ireland", IL: "Israel", IN: "India",
  IQ: "Iraq", IR: "Iran", IS: "Iceland", IT: "Italy", JM: "Jamaica", JO: "Jordan", JP: "Japan",
  KE: "Kenya", KG: "Kyrgyzstan", KH: "Cambodia", KM: "Comoros", KN: "Saint Kitts and Nevis",
  KP: "North Korea", KR: "South Korea", KW: "Kuwait", KY: "Cayman Islands", KZ: "Kazakhstan",
  LA: "Laos", LB: "Lebanon", LC: "Saint Lucia", LI: "Liechtenstein", LK: "Sri Lanka", LR: "Liberia",
  LS: "Lesotho", LT: "Lithuania", LU: "Luxembourg", LV: "Latvia", LY: "Libya", MA: "Morocco",
  MC: "Monaco", MD: "Moldova", ME: "Montenegro", MG: "Madagascar", MK: "North Macedonia", ML: "Mali",
  MM: "Myanmar", MN: "Mongolia", MO: "Macao", MR: "Mauritania", MS: "Montserrat", MT: "Malta",
  MU: "Mauritius", MV: "Maldives", MW: "Malawi", MX: "Mexico", MY: "Malaysia", MZ: "Mozambique",
  NA: "Namibia", NC: "New Caledonia", NE: "Niger", NG: "Nigeria", NI: "Nicaragua", NIR: "Northern Ireland",
  NL: "Netherlands", NO: "Norway", NP: "Nepal", NZ: "New Zealand", OM: "Oman", PA: "Panama",
  PE: "Peru", PF: "French Polynesia", PG: "Papua New Guinea", PH: "Philippines", PK: "Pakistan",
  PL: "Poland", PR: "Puerto Rico", PS: "Palestine", PT: "Portugal", PY: "Paraguay", QA: "Qatar",
  RO: "Romania", RS: "Serbia", RU: "Russia", RW: "Rwanda", SA: "Saudi Arabia", SB: "Solomon Islands",
  SC: "Seychelles", SCO: "Scotland", SD: "Sudan", SE: "Sweden", SG: "Singapore", SI: "Slovenia",
  SK: "Slovakia", SL: "Sierra Leone", SM: "San Marino", SN: "Senegal", SO: "Somalia", SR: "Suriname",
  SS: "South Sudan", ST: "Sao Tome and Principe", SV: "El Salvador", SY: "Syria", SZ: "Eswatini",
  TC: "Turks and Caicos", TD: "Chad", TG: "Togo", TH: "Thailand", TJ: "Tajikistan", TL: "Timor-Leste",
  TM: "Turkmenistan", TN: "Tunisia", TO: "Tonga", TR: "Turkey", TT: "Trinidad and Tobago",
  TW: "Taiwan", TZ: "Tanzania", UA: "Ukraine", UG: "Uganda", UK: "United Kingdom", US: "United States",
  UY: "Uruguay", UZ: "Uzbekistan", VC: "Saint Vincent", VE: "Venezuela", VG: "British Virgin Islands",
  VI: "U.S. Virgin Islands", VN: "Vietnam", VU: "Vanuatu", WAL: "Wales", WS: "Samoa", XK: "Kosovo",
  KOS: "Kosovo", YE: "Yemen", ZA: "South Africa", ZM: "Zambia", ZW: "Zimbabwe",
};

const NAME_ALIASES = {
  england: "ENG",
  scotland: "SCO",
  wales: "WAL",
  "northern ireland": "NIR",
  uk: "GB",
  "u.k.": "GB",
  "united kingdom": "GB",
  britain: "GB",
  "great britain": "GB",
  usa: "US",
  "u.s.": "US",
  "u.s.a.": "US",
  "united states": "US",
  "united states of america": "US",
  holland: "NL",
  "the netherlands": "NL",
  "ivory coast": "CI",
  "cote d'ivoire": "CI",
  "côte d'ivoire": "CI",
  "south korea": "KR",
  "korea republic": "KR",
  "north korea": "KP",
  russia: "RU",
  "russian federation": "RU",
  turkey: "TR",
  türkiye: "TR",
  "czech republic": "CZ",
  czechia: "CZ",
  "democratic republic of the congo": "CD",
  "dr congo": "CD",
  "drc": "CD",
  "republic of the congo": "CG",
  "south africa": "ZA",
  "saudi arabia": "SA",
  "united arab emirates": "AE",
  uae: "AE",
  "bosnia": "BA",
  "bosnia and herzegovina": "BA",
  kosovo: "XK",
};

const FIFA_TO_CODE = {
  GER: "DE", FRA: "FR", ESP: "ES", ITA: "IT", NED: "NL", POR: "PT", BEL: "BE",
  BRA: "BR", ARG: "AR", URU: "UY", CHI: "CL", PAR: "PY", COL: "CO", PER: "PE",
  ECU: "EC", VEN: "VE", MEX: "MX", USA: "US", CAN: "CA", JPN: "JP", KOR: "KR",
  CHN: "CN", AUS: "AU", NZL: "NZ", RSA: "ZA", EGY: "EG", MAR: "MA", NGA: "NG",
  GHA: "GH", SEN: "SN", CIV: "CI", CMR: "CM", ALG: "DZ", TUN: "TN", KSA: "SA",
  UAE: "AE", QAT: "QA", IRN: "IR", IRQ: "IQ", ISR: "IL", TUR: "TR", RUS: "RU",
  UKR: "UA", POL: "PL", SWE: "SE", NOR: "NO", DEN: "DK", FIN: "FI", SUI: "CH",
  AUT: "AT", CZE: "CZ", CRO: "HR", SRB: "RS", GRE: "GR", ROU: "RO", HUN: "HU",
  IRL: "IE", SCO: "SCO", WAL: "WAL", NIR: "NIR", ENG: "ENG", GBR: "GB",
};

const NAME_TO_CODE = { ...NAME_ALIASES };
for (const [code, name] of Object.entries(COUNTRY_NAMES)) {
  NAME_TO_CODE[name.toLowerCase()] = code;
}

function flagToCode(value) {
  const chars = [...String(value || "")];
  const ris = chars.filter((char) => {
    const cp = char.codePointAt(0);
    return cp >= 0x1F1E6 && cp <= 0x1F1FF;
  });
  if (ris.length < 2) return "";
  return String.fromCharCode(ris[0].codePointAt(0) - 0x1F1E6 + 65)
    + String.fromCharCode(ris[1].codePointAt(0) - 0x1F1E6 + 65);
}

function normalizeKey(value) {
  return String(value || "")
    .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, " ")
    .replace(/[_./,|()]+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeCountryCode(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const fromFlag = flagToCode(raw);
  if (fromFlag && COUNTRY_TO_CONTINENT[fromFlag]) return fromFlag;
  const upper = raw.toUpperCase();
  if (COUNTRY_TO_CONTINENT[upper]) return upper;
  if (FIFA_TO_CODE[upper]) return FIFA_TO_CODE[upper];
  const fromName = NAME_TO_CODE[normalizeKey(raw)];
  if (fromName) return fromName;
  const token = upper.match(/\b([A-Z]{2,3})\b/);
  if (token) {
    if (COUNTRY_TO_CONTINENT[token[1]]) return token[1];
    if (FIFA_TO_CODE[token[1]]) return FIFA_TO_CODE[token[1]];
  }
  return "";
}

function countryDisplayName(code) {
  const normalized = normalizeCountryCode(code) || String(code || "").trim().toUpperCase();
  return COUNTRY_NAMES[normalized] || normalized;
}

function continentIdFromRegion(region) {
  return REGION_TO_ID[String(region || "").trim().toLowerCase()] || null;
}

function continentIdFromCountry(code) {
  const normalized = normalizeCountryCode(code);
  return COUNTRY_TO_CONTINENT[normalized] || COUNTRY_TO_CONTINENT[String(code || "").trim().toUpperCase()] || null;
}

function resolveContinent({ region, country_code } = {}) {
  return continentIdFromCountry(country_code) || continentIdFromRegion(region) || null;
}

function continentMeta(id) {
  return CONTINENTS.find((row) => row.id === id) || null;
}

function indexClubs(clubs = []) {
  const byId = Object.create(null);
  const byName = Object.create(null);
  const byTag = Object.create(null);
  for (const club of clubs) {
    if (!club) continue;
    if (club.id != null) byId[String(club.id)] = club;
    const name = String(club.name || "").trim().toLowerCase();
    if (name) byName[name] = club;
    const tag = String(club.tag || "").trim().toLowerCase();
    if (tag) byTag[tag] = club;
  }
  return { byId, byName, byTag };
}

function clubForStory(story, catalog, player) {
  if (!catalog) return null;
  return catalog.byId[String(story?.club_id || "")]
    || catalog.byName[String(story?.club_name || "").trim().toLowerCase()]
    || catalog.byTag[String(story?.club_name || "").trim().toLowerCase()]
    || catalog.byId[String(player?.club_id || "")]
    || null;
}

function decorateStoryLocation(story, { catalog, playersById = {}, tournamentsById = {} } = {}) {
  const player = playersById[String(story?.player_id || "")] || null;
  const tournament = tournamentsById[String(story?.tournament_id || "")] || null;
  const club = clubForStory(story, catalog, player);
  const country_code = normalizeCountryCode(
    club?.country_code
    || club?.country
    || player?.country_code
    || player?.country
    || tournament?.country_code
    || story?.country_code,
  ) || null;
  const region = club?.region || tournament?.region || player?.region || story?.region || null;
  return {
    ...story,
    continent: resolveContinent({ region, country_code }) || story?.continent || null,
    country_code,
    region,
  };
}

module.exports = {
  CONTINENTS,
  clubForStory,
  continentIdFromCountry,
  continentIdFromRegion,
  continentMeta,
  countryDisplayName,
  decorateStoryLocation,
  indexClubs,
  normalizeCountryCode,
  resolveContinent,
};

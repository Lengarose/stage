import { ALL_COUNTRIES } from "@/lib/allCountries";
import { COUNTRIES } from "@/lib/countries";

const COUNTRY_CODE_ALIASES = {
  BEL: "BE",
  CAN: "CA",
  COD: "CD",
  COG: "CG",
  DEU: "DE",
  DRC: "CD",
  ENG: "ENG",
  ESP: "ES",
  FRA: "FR",
  GBR: "GB",
  GER: "DE",
  ITA: "IT",
  NED: "NL",
  NLD: "NL",
  NIR: "NIR",
  POR: "PT",
  SCO: "SCO",
  USA: "US",
  WAL: "WAL",
};

const DISPLAY_NAME_OVERRIDES = {
  CD: "DR Congo",
  CG: "Congo",
  CZ: "Czechia",
  GB: "United Kingdom",
  NL: "Netherlands",
  KR: "South Korea",
  KP: "North Korea",
  US: "United States",
  VE: "Venezuela",
  BO: "Bolivia",
  IR: "Iran",
  SY: "Syria",
  LA: "Laos",
  TZ: "Tanzania",
  VN: "Vietnam",
  MD: "Moldova",
  BN: "Brunei",
  RU: "Russia",
  ENG: "England",
  SCO: "Scotland",
  WAL: "Wales",
  NIR: "Northern Ireland",
};

const NAME_TO_CODE_HINTS = [
  [/belg/i, "BE"],
  [/brazil/i, "BR"],
  [/canada/i, "CA"],
  [/democratic republic of (the )?congo|dr congo|drc|congo kinshasa/i, "CD"],
  [/republic of congo|congo brazzaville/i, "CG"],
  [/england/i, "ENG"],
  [/france|french/i, "FR"],
  [/german/i, "DE"],
  [/great britain|united kingdom|uk/i, "GB"],
  [/holland|netherlands|dutch|kingdom of the netherlands/i, "NL"],
  [/ital/i, "IT"],
  [/portugal|portugu/i, "PT"],
  [/scotland/i, "SCO"],
  [/spain|spanish/i, "ES"],
  [/united states|usa|america/i, "US"],
  [/wales/i, "WAL"],
];

const fifaCountryNames = new Map(
  COUNTRIES.map((country) => [
    String(country.code || "").toUpperCase(),
    String(country.name || "").replace(/^\p{Regional_Indicator}{2}\s*/u, "").trim(),
  ]),
);
const isoCountryNames = new Map(ALL_COUNTRIES.map((country) => [country.code, country.name]));

export function normalizeCountryCode(code, country) {
  const raw = String(code || "").trim().toUpperCase();
  if (raw && (raw.length <= 3 || COUNTRY_CODE_ALIASES[raw])) return COUNTRY_CODE_ALIASES[raw] || raw;
  const name = String(country || code || "").trim();
  if (!name) return "";
  const withoutEmoji = name.replace(/^\p{Regional_Indicator}{2}\s*/u, "").trim();
  const listed = COUNTRIES.find((entry) => (
    String(entry.name || "").replace(/^\p{Regional_Indicator}{2}\s*/u, "").trim().toLowerCase() === withoutEmoji.toLowerCase()
  ));
  if (listed?.code) return listed.code;
  const iso = ALL_COUNTRIES.find((entry) => entry.name.toLowerCase() === withoutEmoji.toLowerCase());
  if (iso?.code) return iso.code;
  const hint = NAME_TO_CODE_HINTS.find(([pattern]) => pattern.test(withoutEmoji));
  return hint?.[1] || "";
}

export function getCountryDisplayName(code, country) {
  const normalized = normalizeCountryCode(code, country);
  if (DISPLAY_NAME_OVERRIDES[normalized]) return DISPLAY_NAME_OVERRIDES[normalized];
  const fromFifa = fifaCountryNames.get(normalized);
  if (fromFifa) return fromFifa;
  const fromIso = isoCountryNames.get(normalized);
  if (fromIso) return fromIso;
  const raw = String(country || code || "").replace(/^\p{Regional_Indicator}{2}\s*/u, "").trim();
  return raw || "Unknown";
}

export function getPlayerNationality(player) {
  const code = normalizeCountryCode(player?.country_code, player?.country);
  return {
    code,
    label: getCountryDisplayName(code || player?.country_code, player?.country),
  };
}


// Countries restricted to active STAGE regions only.
// To expand, add entries here and update STAGE_REGIONS in qualificationConfig.js.

export const STAGE_REGIONS = [
  { slug: "uk-ireland",    name: "UK & Ireland",  codes: ["GB", "IE"] },
  { slug: "france",        name: "France",         codes: ["FR"] },
  { slug: "germany",       name: "Germany",        codes: ["DE"] },
  { slug: "benelux",       name: "Benelux",        codes: ["BE", "NL", "LU"] },
  { slug: "spain",         name: "Spain",          codes: ["ES"] },
  { slug: "north-america", name: "North America",  codes: ["US", "CA", "MX"] },
];

export const COUNTRIES = [
  // UK & Ireland
  { code: "GB", name: "🇬🇧 United Kingdom" },
  { code: "IE", name: "🇮🇪 Ireland" },
  // France
  { code: "FR", name: "🇫🇷 France" },
  // Germany
  { code: "DE", name: "🇩🇪 Germany" },
  // Benelux
  { code: "BE", name: "🇧🇪 Belgium" },
  { code: "NL", name: "🇳🇱 Netherlands" },
  { code: "LU", name: "🇱🇺 Luxembourg" },
  // Spain
  { code: "ES", name: "🇪🇸 Spain" },
  // North America
  { code: "US", name: "🇺🇸 United States" },
  { code: "CA", name: "🇨🇦 Canada" },
  { code: "MX", name: "🇲🇽 Mexico" },
];

export const COUNTRY_REGIONS = {
  "Europe":        ["GB", "IE", "FR", "DE", "BE", "NL", "LU", "ES"],
  "North America": ["US", "CA", "MX"],
};

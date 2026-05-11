// Qualification configuration for regional leagues → STAGE competitions.
// Adjust the arrays here when promotion spots change as the platform grows.

export const REGIONS = [
  { slug: "uk-ireland",    name: "UK & Ireland",   countryCode: "GB", region: "Europe"        },
  { slug: "france",        name: "France",          countryCode: "FR", region: "Europe"        },
  { slug: "germany",       name: "Germany",         countryCode: "DE", region: "Europe"        },
  { slug: "benelux",       name: "Benelux",         countryCode: "BE", region: "Europe"        },
  { slug: "spain",         name: "Spain",           countryCode: "ES", region: "Europe"        },
  { slug: "north-america", name: "North America",   countryCode: "US", region: "North America" },
];

// Canonical league definitions — one entry per division per region.
// Add a new object here to introduce a new region or division; the seeder in
// Admin.jsx and the engine both derive their behaviour from this list.
export const LEAGUE_DEFINITIONS = [
  // UK & Ireland
  {
    name: "STAGE Premier Division",        slug: "uk-ireland-div-1",     region_slug: "uk-ireland",
    division: 1, region: "Europe",        country_code: "GB",
    linked_league_slug: "uk-ireland-div-2",
  },
  {
    name: "STAGE Championship",            slug: "uk-ireland-div-2",     region_slug: "uk-ireland",
    division: 2, region: "Europe",        country_code: "GB",
    linked_league_slug: "uk-ireland-div-1",
  },
  // France
  {
    name: "STAGE Division 1",              slug: "france-div-1",         region_slug: "france",
    division: 1, region: "Europe",        country_code: "FR",
    linked_league_slug: "france-div-2",
  },
  {
    name: "STAGE Division 2",              slug: "france-div-2",         region_slug: "france",
    division: 2, region: "Europe",        country_code: "FR",
    linked_league_slug: "france-div-1",
  },
  // Germany
  {
    name: "STAGE Deutsche Liga",           slug: "germany-div-1",        region_slug: "germany",
    division: 1, region: "Europe",        country_code: "DE",
    linked_league_slug: "germany-div-2",
  },
  {
    name: "STAGE Deutsche Liga 2",         slug: "germany-div-2",        region_slug: "germany",
    division: 2, region: "Europe",        country_code: "DE",
    linked_league_slug: "germany-div-1",
  },
  // Benelux
  {
    name: "STAGE Benelux Pro League",      slug: "benelux-div-1",        region_slug: "benelux",
    division: 1, region: "Europe",        country_code: "BE",
    linked_league_slug: "benelux-div-2",
  },
  {
    name: "STAGE Benelux Division 2",      slug: "benelux-div-2",        region_slug: "benelux",
    division: 2, region: "Europe",        country_code: "BE",
    linked_league_slug: "benelux-div-1",
  },
  // Spain
  {
    name: "STAGE La Liga de España",       slug: "spain-div-1",          region_slug: "spain",
    division: 1, region: "Europe",        country_code: "ES",
    linked_league_slug: "spain-div-2",
  },
  {
    name: "STAGE La Liga 2",               slug: "spain-div-2",          region_slug: "spain",
    division: 2, region: "Europe",        country_code: "ES",
    linked_league_slug: "spain-div-1",
  },
  // North America
  {
    name: "STAGE North American League",   slug: "north-america-div-1",  region_slug: "north-america",
    division: 1, region: "North America", country_code: "US",
    linked_league_slug: "north-america-div-2",
  },
  {
    name: "STAGE North American Division 2", slug: "north-america-div-2", region_slug: "north-america",
    division: 2, region: "North America", country_code: "US",
    linked_league_slug: "north-america-div-1",
  },
];

// Division 1 final standings → STAGE competition qualification.
// positions are 1-indexed. Add/remove entries here to change the spot count.
export const STAGE_QUALIFICATION_RULES = [
  { positions: [1, 2],    competitionSlug: "supreme",    competitionName: "STAGE Supreme League"    },
  { positions: [3, 4],    competitionSlug: "elite",      competitionName: "STAGE Elite League"      },
  { positions: [5, 6],    competitionSlug: "challenger", competitionName: "STAGE Challenger League" },
];

// How many clubs at the bottom of Div 1 get relegated to Div 2
export const RELEGATION_SPOTS = 2;

// How many clubs at the top of Div 2 get promoted to Div 1
export const PROMOTION_SPOTS = 2;

// Cross-competition qualification: winner of tier N season qualifies for tier N-1 next season.
// positions are 1-indexed final standings within the competition season.
export const CROSS_COMPETITION_QUALIFICATION_RULES = [
  { fromSlug: "elite",      toSlug: "supreme",    toName: "STAGE Supreme League",    positions: [1] },
  { fromSlug: "challenger", toSlug: "elite",      toName: "STAGE Elite League",      positions: [1] },
];

// Qualification configuration for regional leagues → STAGE competitions.
// Adjust the arrays here when promotion spots change as the platform grows.

export const REGIONS = [
  { slug: "uk-ireland",    name: "UK & Ireland",   countryCode: "GB", region: "Europe"        },
  { slug: "france",        name: "France",          countryCode: "FR", region: "Europe"        },
  { slug: "germany",       name: "Germany",         countryCode: "DE", region: "Europe"        },
  { slug: "benelux",       name: "Benelux",         countryCode: "BE", region: "Europe"        },
  { slug: "north-america", name: "North America",   countryCode: "US", region: "North America" },
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

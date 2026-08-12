export const PLAYER_PROFILE_TAB_IDS = [
  "posts",
  "showcase",
  "stats",
  "career",
  "matches",
  "trophies",
  "lifestyle",
];

const TAB_CONTRACTS = [
  {
    id: "posts",
    labelKey: "commonPages.ppTab_posts",
    domain: "social_feed",
    meaning: "Social feed posts created by or attached to this Player identity.",
    tournamentVisible: true,
  },
  {
    id: "showcase",
    labelKey: "commonPages.ppTab_showcase",
    domain: "profile_presentation",
    meaning: "Public presentation of player identity, bio, preferred positions, current club, and management status.",
    tournamentVisible: true,
  },
  {
    id: "stats",
    labelKey: "commonPages.ppTab_stats",
    domain: "verified_performance",
    meaning: "Comparable scouting and performance numbers derived from one shared profile stats adapter.",
    tournamentVisible: true,
  },
  {
    id: "career",
    labelKey: "commonPages.ppTab_career",
    domain: "stageleagues_cv",
    meaning: "StageLeagues career CV: active contracts, club history, memberships, president/founder status, and achievements summary.",
    tournamentVisible: true,
  },
  {
    id: "matches",
    labelKey: "commonPages.ppTab_matches",
    domain: "completed_match_history",
    meaning: "Completed match history only. Future fixtures belong in schedule or career overview surfaces.",
    tournamentVisible: true,
  },
  {
    id: "trophies",
    labelKey: "commonPages.ppTab_trophies",
    domain: "achievement_cabinet",
    meaning: "Trophy cabinet and awarded achievements for this Player identity.",
    tournamentVisible: true,
  },
  {
    id: "lifestyle",
    labelKey: "commonPages.ppTab_lifestyle",
    domain: "personality_surface",
    meaning: "Cosmetic and personality presentation attached to the Player identity.",
    tournamentVisible: false,
  },
];

export function getPlayerProfileTabContract(tabId) {
  return TAB_CONTRACTS.find((tab) => tab.id === tabId) || null;
}

export function getPlayerProfileTabs({ tournamentLimited = false, t = (key) => key } = {}) {
  return TAB_CONTRACTS
    .filter((tab) => !tournamentLimited || tab.tournamentVisible)
    .map((tab) => ({
      id: tab.id,
      label: t(tab.labelKey),
      domain: tab.domain,
      meaning: tab.meaning,
    }));
}

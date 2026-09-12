export const PLAYER_PROFILE_TAB_IDS = [
  "overview",
  "showcase",
  "career",
  "trophies",
  "lifestyle",
];

const TAB_CONTRACTS = [
  {
    id: "overview",
    labelKey: "commonPages.ppTab_overview",
    domain: "profile_summary",
    meaning: "Player command overview: identity, club, current contract, form and next match.",
    tournamentVisible: true,
  },
  {
    id: "showcase",
    labelKey: "commonPages.ppTab_showcase",
    domain: "profile_presentation",
    meaning: "Player-owned gameplay clips and preferred showcase position. Clubs and scouts can watch; they cannot add footage.",
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
      label: t(tab.labelKey) === tab.labelKey && tab.id === "overview" ? "Overview" : t(tab.labelKey),
      domain: tab.domain,
      meaning: tab.meaning,
    }));
}

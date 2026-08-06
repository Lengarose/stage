/** @typedef {'player' | 'president' | 'both'} TutorialIntent */

/**
 * @param {unknown} intent
 * @returns {TutorialIntent}
 */
export function normalizeTutorialIntent(intent) {
  if (intent === "president" || intent === "both") return intent;
  return "player";
}

const PLAYER_STEPS = [
  {
    title: "Get Signed on Contract",
    icon: "📝",
    description:
      "On STAGE, players join squads through contracts — not open club join buttons. Presidents send offers; you accept, negotiate, or decline in your Inbox.",
    tips: [
      "Watch Inbox for contract and trial offers",
      "Check salary, length, and role before you sign",
      "Once signed, you appear in that club’s squad",
    ],
  },
  {
    title: "Play Match Days",
    icon: "⚽",
    description:
      "When your club has fixtures, show up for Game Day. Play, confirm results, and keep your availability clear for your president.",
    tips: [
      "Follow Schedule and Game Day for upcoming matches",
      "Coordinate times through match chat when needed",
      "Submit or confirm results on time",
    ],
  },
  {
    title: "Build Your Reputation",
    icon: "📊",
    description:
      "Improve your player rating and reputation through matches. Better form leads to stronger contract offers.",
    tips: [
      "Earn a higher rating through wins and performance",
      "Build your personal stats and match history",
      "Attract better contracts with your achievements",
    ],
  },
  {
    title: "Earn STC & Grow Your Wealth",
    icon: "💰",
    description:
      "Earn STC from your contract salary, match wins, and prizes. Invest in lifestyle assets and build passive income.",
    tips: [
      "Collect weekly salary from your active contract",
      "Win matches and tournaments for prize money",
      "Purchase real estate and vehicles for passive income",
    ],
  },
];

const PRESIDENT_STEPS = [
  {
    title: "Found Your Club",
    icon: "🛡️",
    description:
      "Create your club identity and president profile. You run the club — fixtures, squad, and competition entries.",
    tips: [
      "Set your club name, logo, and identity",
      "Complete your president profile",
      "Your club is the unit that enters competitions",
    ],
  },
  {
    title: "Sign & Manage Players",
    icon: "📝",
    description:
      "Build a competitive squad. Offer contracts, handle trials, and keep your roster ready for match days.",
    tips: [
      "Send contract offers from the club office",
      "Review trial requests in your inbox",
      "Keep key positions filled before fixtures",
    ],
  },
  {
    title: "Enter Competitions",
    icon: "🏆",
    description:
      "Register your club in leagues and cups. Schedule fixtures, submit results, and climb the standings.",
    tips: [
      "Enter leagues and tournament brackets",
      "Coordinate Game Days with opponents",
      "Submit and confirm match results on time",
    ],
  },
  {
    title: "Grow Club Wealth",
    icon: "💰",
    description:
      "Manage club STC through salaries, prizes, and club economy tools. Strong finances keep your squad competitive.",
    tips: [
      "Budget salaries against prize income",
      "Use club tools like stadium and shirt sales",
      "Invest winnings back into the squad",
    ],
  },
];

const BOTH_STEPS = [
  {
    title: "Play Both Roles",
    icon: "⚡",
    description:
      "You have a player profile and a club as president. Compete personally while you run the club side of STAGE.",
    tips: [
      "Use your player profile for contracts and matches",
      "Use your club for squad management and entries",
      "Switch focus as fixtures and inbox demand",
    ],
  },
  {
    title: "Compete on Both Fronts",
    icon: "🏆",
    description:
      "Play matches as a player and enter competitions with your club. Rankings and results track both paths.",
    tips: [
      "Stay under contract as a player when you want pitch time",
      "Enter leagues and cups with your club",
      "Keep Game Day schedules clear for both roles",
    ],
  },
  {
    title: "Build Dual Reputation",
    icon: "📊",
    description:
      "Grow your personal rating as a player and your club’s standing as president. Strong results help both careers.",
    tips: [
      "Improve player rating through performance",
      "Build club prestige with wins and trophies",
      "Attract better players to your club over time",
    ],
  },
  {
    title: "Earn Across Both Paths",
    icon: "💰",
    description:
      "Collect player salary and match prizes while managing club finances. Balance personal wealth and club budget.",
    tips: [
      "Player path: salary, prizes, lifestyle income",
      "President path: club prizes and economy tools",
      "Don’t overspend club STC on contracts",
    ],
  },
];

/**
 * Tutorial slides for the role chosen during onboarding.
 * @param {unknown} intent
 */
export function getTutorialSteps(intent) {
  const role = normalizeTutorialIntent(intent);
  if (role === "president") return PRESIDENT_STEPS;
  if (role === "both") return BOTH_STEPS;
  return PLAYER_STEPS;
}

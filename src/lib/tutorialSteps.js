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
    where: "Inbox · Transfer Market",
    description:
      "On STAGE, players join squads through contracts — not open club join buttons. Presidents send offers; you accept, negotiate, or decline in your Inbox.",
    detail:
      "A live contract is what makes you a signed player. Until you accept one, you stay a free agent on the transfer market. Founder Player is a special club-creation contract, not a recruitment type other clubs can offer you.",
    tips: [
      "Watch Inbox for contract and trial offers",
      "Check salary, length, and role before you sign",
      "Once signed, you appear in that club’s squad",
    ],
    points: [
      "Open Inbox to accept, counter, or decline an offer.",
      "Read weekly wage, bonus, length, and any targets before you sign.",
      "After you accept, you leave the free-agent list and join that squad.",
      "To leave later, use Leave Club — that ends the live contracts and puts you back on the market.",
    ],
  },
  {
    title: "Play Match Days",
    icon: "⚽",
    where: "Schedule · Game Day",
    description:
      "When your club has fixtures, show up for Game Day. Play, confirm results, and keep your availability clear for your president.",
    detail:
      "Matches are scheduled by the club, then played on Game Day. You are expected to be available, join the match chat if the time moves, and confirm the score so the competition table updates.",
    tips: [
      "Follow Schedule and Game Day for upcoming matches",
      "Coordinate times through match chat when needed",
      "Submit or confirm results on time",
    ],
    points: [
      "Check Schedule for the next fixture and kickoff window.",
      "Set availability so your president knows when you can play.",
      "Use match chat if you need a new time.",
      "Confirm the result after the game so standings stay correct.",
    ],
  },
  {
    title: "Build Your Reputation",
    icon: "📊",
    where: "Profile · Stats",
    description:
      "Improve your player rating and reputation through matches. Better form leads to stronger contract offers.",
    detail:
      "Your profile is what presidents scout. Rating, record, clips, and identity verification all sit on that page. A verified handle and a filled showcase make offers more likely.",
    tips: [
      "Earn a higher rating through wins and performance",
      "Build your personal stats and match history",
      "Attract better contracts with your achievements",
    ],
    points: [
      "Play official matches so your rating and record move.",
      "Keep your profile, position, and OVR up to date.",
      "Add showcase clips so clubs can see how you play.",
      "Claim your platform identity so presidents trust the account.",
    ],
  },
  {
    title: "Earn STC & Grow Your Wealth",
    icon: "💰",
    where: "Wallet · Lifestyle",
    description:
      "Earn STC from your contract salary, match wins, and prizes. Invest in lifestyle assets and build passive income.",
    detail:
      "STC is the in-game currency. An active contract with a weekly wage pays you. Wins and competitions add prizes. Lifestyle assets can add a slower income on top.",
    tips: [
      "Collect weekly salary from your active contract",
      "Win matches and tournaments for prize money",
      "Purchase real estate and vehicles for passive income",
    ],
    points: [
      "Salary only pays while a player contract is active.",
      "Match and cup prizes land in your wallet after results confirm.",
      "Lifestyle purchases are optional — they do not replace a wage.",
      "Credits and STAGE Plus are separate from club STC.",
    ],
  },
];

const PRESIDENT_STEPS = [
  {
    title: "Found Your Club",
    icon: "🛡️",
    where: "Club · President profile",
    description:
      "Create your club identity and president profile. You run the club — fixtures, squad, and competition entries.",
    detail:
      "Player + President onboarding creates two documents: a Founder Player contract for you on the pitch, and an ownership contract that makes you president. The club is the unit that enters leagues, not your personal profile.",
    tips: [
      "Set your club name, logo, and identity",
      "Complete your president profile",
      "Your club is the unit that enters competitions",
    ],
    points: [
      "The club page is your public shop window.",
      "The president profile is the face clubs and players see.",
      "Ownership is not a wage deal — it is the creator seat.",
      "Leaving the club as a founder ends both contracts and orphans the club.",
    ],
  },
  {
    title: "Sign & Manage Players",
    icon: "📝",
    where: "Club Office · Contracts",
    description:
      "Build a competitive squad. Offer contracts, handle trials, and keep your roster ready for match days.",
    detail:
      "Recruitment happens with contract offers: trial, academy, squad, important, or star. Founder Player is not something you offer to other people. Inbox is where talks and replies land.",
    tips: [
      "Send contract offers from the club office",
      "Review trial requests in your inbox",
      "Keep key positions filled before fixtures",
    ],
    points: [
      "Scout free agents on the transfer market.",
      "Send an offer with wage, length, and type from Club Office.",
      "Negotiate in Inbox — do not expect a public join button.",
      "Fill GK and spine positions before you enter a league.",
    ],
  },
  {
    title: "Enter Competitions",
    icon: "🏆",
    where: "Competitions · Game Day",
    description:
      "Register your club in leagues and cups. Schedule fixtures, submit results, and climb the standings.",
    detail:
      "The club enters the competition, then you schedule Game Days against the opponent. Results must be submitted and confirmed or the table will stall.",
    tips: [
      "Enter leagues and tournament brackets",
      "Coordinate Game Days with opponents",
      "Submit and confirm match results on time",
    ],
    points: [
      "Register the club, not a single player, into a league or cup.",
      "Pick a Game Day window both sides can play.",
      "Use match chat if the window has to move.",
      "Submit the score promptly so the bracket advances.",
    ],
  },
  {
    title: "Grow Club Wealth",
    icon: "💰",
    where: "Finance · Stadium · Shirts",
    description:
      "Manage club STC through salaries, prizes, and club economy tools. Strong finances keep your squad competitive.",
    detail:
      "Club STC pays wages. Prize money and tools like stadium upgrades or shirt sales refill the budget. Over-signing on star wages can empty the club even if you win.",
    tips: [
      "Budget salaries against prize income",
      "Use club tools like stadium and shirt sales",
      "Invest winnings back into the squad",
    ],
    points: [
      "Check Finance before you offer a big weekly wage.",
      "Competition prizes go to the club wallet, not only to you.",
      "Stadium and shirts are optional income tools.",
      "A cheap, full squad is often stronger than one expensive star.",
    ],
  },
];

const BOTH_STEPS = [
  {
    title: "Play Both Roles",
    icon: "⚡",
    where: "Profile rail · Player / President / Club",
    description:
      "You have a player profile and a club as president. Compete personally while you run the club side of STAGE.",
    detail:
      "The app keeps three surfaces: Player, President, and Club. Switch with the identity rail. Your founder player contract is how you play; ownership is how you run the office. They are not the same document.",
    tips: [
      "Use your player profile for contracts and matches",
      "Use your club for squad management and entries",
      "Switch focus as fixtures and inbox demand",
    ],
    points: [
      "Player surface: inbox offers, availability, showcase, stats.",
      "President surface: your public leader identity.",
      "Club surface: squad, office, finance, competitions.",
      "You can play for your own club and still manage it.",
    ],
  },
  {
    title: "Compete on Both Fronts",
    icon: "🏆",
    where: "Schedule · Competitions",
    description:
      "Play matches as a player and enter competitions with your club. Rankings and results track both paths.",
    detail:
      "Your personal matches move your player rating. Club entries move the club table. Keep one calendar so you do not double-book Game Day as both the president who scheduled it and the player who must show up.",
    tips: [
      "Stay under contract as a player when you want pitch time",
      "Enter leagues and cups with your club",
      "Keep Game Day schedules clear for both roles",
    ],
    points: [
      "Enter leagues from the club, not from your player profile.",
      "Put yourself in the lineup if you intend to play.",
      "Confirm results for the club fixture.",
      "Your player rating still needs those matches to grow.",
    ],
  },
  {
    title: "Build Dual Reputation",
    icon: "📊",
    where: "Player profile · Club page",
    description:
      "Grow your personal rating as a player and your club’s standing as president. Strong results help both careers.",
    detail:
      "Presidents scout your player page. Players scout your club page. Identity verification, a filled squad, and a clean record help both sides look serious.",
    tips: [
      "Improve player rating through performance",
      "Build club prestige with wins and trophies",
      "Attract better players to your club over time",
    ],
    points: [
      "Keep the player profile verified and complete.",
      "Keep the club logo, bio, and squad visible.",
      "Trophies and league place sit on the club, not only on you.",
      "A strong personal rating makes it easier to recruit.",
    ],
  },
  {
    title: "Earn Across Both Paths",
    icon: "💰",
    where: "Wallet · Club Finance",
    description:
      "Collect player salary and match prizes while managing club finances. Balance personal wealth and club budget.",
    detail:
      "Your founder player wage is personal STC. Club prize money and the wage budget are club STC. Paying yourself too much star money drains the club you also have to run.",
    tips: [
      "Player path: salary, prizes, lifestyle income",
      "President path: club prizes and economy tools",
      "Don’t overspend club STC on contracts",
    ],
    points: [
      "Personal wallet ≠ club finance. Check both.",
      "Your founder wage comes from the club budget.",
      "Club tools (stadium, shirts) refill the club, not you.",
      "Leave Club ends both contracts and stops that wage.",
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

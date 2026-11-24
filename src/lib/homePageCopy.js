// Current product copy. Only exact, known old defaults are upgraded; custom Admin copy stays intact.
export const HOME_COPY = {
  "hero_description": "Your football story starts here. Play for a club, run the touchline as Manager, and turn match nights into a season to remember.",
  "section1_title": "What is STAGE?",
  "section1_text": "Your game. Your club. Your story. STAGE brings structure to your virtual football world: club squads, proper contracts, scheduled matches, league tables and trophies you can put on display. Play on your console or PC, then bring the result back to STAGE. This is where match night becomes a career.",
  "section2_title": "How do I get in the game?",
  "section2_text": "Build your Player profile, join a club or create one as Manager. Your Club Board handles your own agreements; Managers offer contracts to their squad. Enter a tournament or register for a published regional season, accept the rules and schedule, then head to GameDay. Pick your match squad, play, submit the score and confirm the result with your opponent.",
  "section3_title": "What am I playing for?",
  "section3_text": "Chase league titles, Regional Cups and tournament silverware. Confirmed official Regional League, Regional Cup and GOST appearances earn Card XP for the players who actually played. Follow your stats, collect awarded trophies and build your cabinet. GOST opens when participation and qualification are announced—regional results do not bank a future place.",
  "footer_tagline": "Your game. Your club. Your next chapter."
};
export const HOME_FAQ = [
  {
    "question": "How do I join STAGE?",
    "answer": "Create your account and Player profile. Join a club through a contract, or create a club and become its Manager. You can play and manage with one login. Browse the published competitions and pick your next challenge."
  },
  {
    "question": "What game does STAGE support?",
    "answer": "STAGE is built for EA SPORTS FC players and Clubs. You play the actual matches in the game; STAGE handles the squads, scheduling, results and competition story. Check each event’s platform and cross-play rules before joining."
  },
  {
    "question": "How do leagues and competitions work?",
    "answer": "Regional seasons bring scheduled league matches, promotion battles and a Regional Cup. Tournaments use their published format and rules. Read and accept the schedule before entry; your Manager registers the club. GOST remains closed until its opening and qualification rules are announced."
  },
  {
    "question": "What are STC and credits?",
    "answer": "STC is your in-app currency for things such as club wages, competition rewards and Lifestyle purchases. Credits are separate and are used for eligible entries and other published costs. Neither is the same as Card XP, and buying credits does not raise your Card Level."
  },
  {
    "question": "Is STAGE free to use?",
    "answer": "You can create an account and explore STAGE for free. Personal STAGE Plus access is required for official Regional League, Regional Cup and GOST participation: a Manager’s plan does not cover the whole squad. Tournament creation and other premium features also require Plus. See Store for the current plans, credit allowances and entry costs."
  }
];
const LEGACY_COPY = {
  "What are STC points?": "What are STC and credits?",
  "Create your club, compete in structured leagues and tournaments, and build your legacy in the ultimate competitive football gaming community.": "Your football story starts here. Play for a club, run the touchline as Manager, and turn match nights into a season to remember.",
  "What is STAGE?": "What is STAGE?",
  "STAGE is the premier structured competitive platform for EA FC players. We provide the infrastructure for real clubs, real leagues, and real trophies — all within a professional community built around the game.": "Your game. Your club. Your story. STAGE brings structure to your virtual football world: club squads, proper contracts, scheduled matches, league tables and trophies you can put on display. Play on your console or PC, then bring the result back to STAGE. This is where match night becomes a career.",
  "How It Works": "How do I get in the game?",
  "Register your club, sign players to contracts, and enter league seasons or knockout tournaments. Every match is tracked, every goal counts, and every season crowns a champion.": "Build your Player profile, join a club or create one as Manager. Your Club Board handles your own agreements; Managers offer contracts to their squad. Enter a tournament or register for a published regional season, accept the rules and schedule, then head to GameDay. Pick your match squad, play, submit the score and confirm the result with your opponent.",
  "Built for Competitors": "What am I playing for?",
  "From transfer markets and player contracts to STC rewards and custom trophies — STAGE gives serious players the structure and recognition their game deserves.": "Chase league titles, Regional Cups and tournament silverware. Confirmed official Regional League, Regional Cup and GOST appearances earn Card XP for the players who actually played. Follow your stats, collect awarded trophies and build your cabinet. GOST opens when participation and qualification are announced—regional results do not bank a future place.",
  "The premier competitive football gaming platform.": "Your game. Your club. Your next chapter.",
  "Create your account, complete your player profile, and either create a club or join an existing one. From there you can register for leagues and competitions.": "Create your account and Player profile. Join a club through a contract, or create a club and become its Manager. You can play and manage with one login. Browse the published competitions and pick your next challenge.",
  "STAGE is built around EA FC (formerly FIFA). We support all major platforms including PlayStation and Xbox.": "STAGE is built for EA SPORTS FC players and Clubs. You play the actual matches in the game; STAGE handles the squads, scheduling, results and competition story. Check each event’s platform and cross-play rules before joining.",
  "Leagues are seasonal competitions where clubs compete over multiple rounds. Competitions include knockout-style cups. Results are tracked and standings update in real time.": "Regional seasons bring scheduled league matches, promotion battles and a Regional Cup. Tournaments use their published format and rules. Read and accept the schedule before entry; your Manager registers the club. GOST remains closed until its opening and qualification rules are announced.",
  "STC (STAGE Coins) are the platform currency. Earn them through match rewards, seasonal prizes, and achievements. Use them in the Lifestyle store or on premium features.": "STC is your in-app currency for things such as club wages, competition rewards and Lifestyle purchases. Credits are separate and are used for eligible entries and other published costs. Neither is the same as Card XP, and buying credits does not raise your Card Level.",
  "Yes — STAGE is free to join. Some premium features and store items require STC, which can be earned through gameplay.": "You can create an account and explore STAGE for free. Personal STAGE Plus access is required for official Regional League, Regional Cup and GOST participation: a Manager’s plan does not cover the whole squad. Tournament creation and other premium features also require Plus. See Store for the current plans, credit allowances and entry costs."
};
export function refreshHomeCopy(record) {
  return Object.fromEntries(Object.entries(record).map(([key,value])=>[key, typeof value === 'string' && Object.hasOwn(LEGACY_COPY,value) ? LEGACY_COPY[value] : value]));
}

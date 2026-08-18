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
    where: "Inbox · Transfer Market · Free Agents",
    description:
      "On STAGE, players join squads through contracts — not open club join buttons. Presidents send offers; you accept, negotiate, or decline in Inbox.",
    detail:
      "A live contract is what makes you a signed player. Until you accept one, you stay a free agent. Founder Player is only for creating a club, not a deal other clubs can offer you.",
    tips: [
      "Watch Inbox for contract and trial offers",
      "Check salary, length, and role before you sign",
      "Once signed, you appear in that club’s squad",
    ],
    points: [
      "Stay visible: complete Profile (position, platform, country, avatar, showcase clips).",
      "Free Agents and Transfer Market are where presidents find you.",
      "When an offer arrives, open Apps → Inbox — do not wait for a Join button on the club page.",
      "Read weekly wage, bonus, length, type (trial / academy / squad / important / star), and any targets.",
      "Accept, counter, or decline on that message. Counter talks stay in Inbox.",
      "After you accept you leave Free Agents and appear on that club’s Squad tab.",
      "THE STAGE TIMES → Mercato may report the signing. That story is news, not the contract itself.",
      "To leave later, use Leave Club on your profile. That ends the live deal and puts you back on the market.",
    ],
  },
  {
    title: "Find Clubs And The Market",
    icon: "🔍",
    where: "Search · Find Clubs · THE STAGE TIMES",
    description:
      "Learn a club before you sign. The newspaper and directories show who is buying, who is winning, and who needs your position.",
    detail:
      "A club page is a shop window. Rankings and Mercato tell you who is active. You still only join through a contract in Inbox.",
    tips: [
      "Search a club name or tag",
      "Read squad and competitions on the club page",
      "Watch Mercato for clubs that are recruiting",
    ],
    points: [
      "Search if you know the name. Find Clubs / Rankings if you are browsing.",
      "Open a club: Squad, Feed, and (if you are president) Office.",
      "Tap a player on a squad to see if they are first choice in your position.",
      "THE STAGE TIMES → Club News and Mercato show shirts, stadium, and deals.",
      "Open a president from the Presidents directory if you want the person who signs deals.",
      "Follow a club from its page if you want Feed updates. That is not a contract.",
      "If you are already signed and another club wants you, they send a loan request — you will see it in Inbox.",
      "When you like a club, stay ready on Free Agents until their offer lands.",
    ],
  },
  {
    title: "Play Match Days",
    icon: "⚽",
    where: "Schedule · Game Day · Availability",
    description:
      "Fixtures are planned on Schedule and played on Game Day. You show up, sit in the dressing room, play, and confirm the score.",
    detail:
      "The table only moves when a result is submitted and confirmed. Availability is how your president knows you can play.",
    tips: [
      "Follow Schedule and Game Day",
      "Set availability on your profile",
      "Confirm results on time",
    ],
    points: [
      "Set Availability on Profile → More so your president can pick a window.",
      "Open Schedule (Apps) for the calendar. Tap a row for opponent and kickoff.",
      "If the time is wrong, propose a new one on the match or accept it in Inbox.",
      "When the window is set, open Game Day (Matches tab).",
      "Take a dressing-room seat. Kickoff stays blocked until both sides seat someone.",
      "Use match chat only for that fixture. Discord is not the official clock.",
      "After the game, submit or confirm the score. Keep a screenshot if it might be disputed.",
      "Disputes live under Apps → Disputes. Next fixture returns on Schedule.",
    ],
  },
  {
    title: "Use Inbox For Every Decision",
    icon: "📥",
    where: "Inbox · Notifications",
    description:
      "Contracts, loans, match times, and club messages all wait in Inbox. Unread usually means you owe an action.",
    detail:
      "Deleting a message that still needs a response means the other side never hears back. Finish the action, then leave.",
    tips: [
      "Open unread items first",
      "Loans need parent then player",
      "Do not delete pending decisions",
    ],
    points: [
      "Open Apps → Inbox, or tap the notification.",
      "Contract: Accept / Counter / Decline after you read the wage and length.",
      "Loan proposal: the parent club accepts first, then you accept, then you play for the borrower.",
      "Loan return or buy-out: Accept or Reject on that same card.",
      "Match invite or time change: Accept, Decline, or send a new date.",
      "After a contract accept, go to Profile — your club crest should be there.",
      "After a loan accept, you play for the borrowing club until recall, return, or buy.",
      "When Inbox is clear, go to Schedule or Game Day for the next job.",
    ],
  },
  {
    title: "Build Your Reputation",
    icon: "📊",
    where: "Profile · Showcase · Rankings",
    description:
      "Presidents scout your profile. Rating, record, clips, and a verified handle are what get better offers.",
    detail:
      "Official matches move your rating. Empty profiles look like throwaway accounts. Showcase is the tape they actually watch.",
    tips: [
      "Play official matches",
      "Keep position and OVR current",
      "Add showcase clips",
    ],
    points: [
      "Play Game Day fixtures so the record on your profile moves.",
      "Edit Profile: position, secondary position, platform, country, bio.",
      "Add Showcase clips under the Showcase tab.",
      "Claim your platform identity so presidents trust the account.",
      "Open Rankings to see where you sit against other players.",
      "THE STAGE TIMES → Player News can carry MOTM and ranking stories.",
      "Follow Back and Feed are optional network tools — they do not replace a contract.",
      "Better form leads to better Inbox offers. Keep the page complete.",
    ],
  },
  {
    title: "Read THE STAGE TIMES",
    icon: "📰",
    where: "News · Mercato · World News",
    description:
      "The newspaper tells you what happened. It does not sign you, loan you, or play the match.",
    detail:
      "Use a story’s club and player links to jump into the real path: profile, club page, Inbox, or Game Day.",
    tips: [
      "All is the front page",
      "Mercato is the market tape",
      "World News uses continent then country",
    ],
    points: [
      "Open Apps → News. Tabs: All, Mercato, Club, Player, Tournaments, Competitions, Daily, World.",
      "All is the mixed front. Tap a story for the full file.",
      "Mercato = transfers and contracts. Club = stadium, shirts, trophies. Player = lifestyle, rankings, MOTM.",
      "Daily is today only. Tournaments / Competitions follow brackets and tables.",
      "World News: tap a continent, then a country chip. GB / UK / ENG / SCO / WAL / NIR count as one desk.",
      "Club file and player links on a story open the live pages.",
      "A rumour is not a contract. Finish deals in Inbox.",
      "Come back here after Game Day if you want to see the write-up.",
    ],
  },
  {
    title: "Earn STC & Grow Your Wealth",
    icon: "💰",
    where: "Wallet · Lifestyle · Store",
    description:
      "Personal STC comes from an active wage, match prizes, and optional lifestyle. Club money is a different pot.",
    detail:
      "Salary only pays while a player contract is live. Lifestyle does not replace a wage. STAGE Plus is not club STC.",
    tips: [
      "Collect salary in Wallet",
      "Prizes land after results confirm",
      "Lifestyle is optional",
    ],
    points: [
      "Open Apps → Wallet for your personal balance and history.",
      "Collect weekly salary while the contract is active.",
      "Match and cup prizes appear after Game Day confirms the score.",
      "Lifestyle (Apps) is optional assets. Read price and upkeep first.",
      "Store is STAGE Plus and unlocks — not club wages.",
      "A live loan may split your wage with the parent club. Read the Inbox card.",
      "Presidents have a second pot: Club → Office → Finance. Do not mix them.",
      "Leave Club stops the wage. Check Wallet after you leave.",
    ],
  },
  {
    title: "Move, Loan, Or Leave",
    icon: "🚪",
    where: "Profile · Inbox · Leave Club",
    description:
      "You are not stuck. Leave Club returns you to the market. A loan lets you play elsewhere without changing the parent contract.",
    detail:
      "Loans move playing rights only. Purchase options still need you to accept in Inbox before the club changes.",
    tips: [
      "Leave Club ends the live deal",
      "Loans arrive in Inbox",
      "Buy-out still needs your accept",
    ],
    points: [
      "Leave Club sits on your player profile. Confirm it — the contract ends.",
      "You reappear on Free Agents after you leave.",
      "If another club wants you while you are signed, they send Request Loan.",
      "You will see the loan in Inbox after the parent club accepts.",
      "While on loan you play for the borrower. Recall or early return can send you home.",
      "Option to buy: you get a purchase message. Accept to move permanently, or reject and stay on loan.",
      "Founder Player + ownership (if you also run a club) is a different leave path — both seats can end.",
      "When you are free again, go back to step one: stay visible and watch Inbox.",
    ],
  },
];

const PRESIDENT_STEPS = [
  {
    title: "Found Your Club",
    icon: "🛡️",
    where: "Club · President profile",
    description:
      "Create the club identity and your president profile. The club — not your personal page — is what enters leagues.",
    detail:
      "Player + President onboarding creates two documents: a Founder Player contract for you on the pitch, and an ownership contract that makes you president.",
    tips: [
      "Set name, logo, and country",
      "Complete the president profile",
      "The club enters competitions",
    ],
    points: [
      "Club page = public shop window. President profile = the face other clubs see.",
      "Ownership is the creator seat, not a weekly wage deal.",
      "You also get a Founder Player contract if you play for your own club.",
      "Those two documents are not the same. Office vs Profile are different surfaces.",
      "Fill crest, banner, bio, country, and platform so recruits take you seriously.",
      "Switch Player / President / Club on the Profile hub.",
      "Leaving as a founder can end both contracts and leave the club without a president.",
      "Settings → How STAGE works replays this tutorial anytime.",
    ],
  },
  {
    title: "Learn The Club Page",
    icon: "🏟️",
    where: "Club · Squad · Office",
    description:
      "Squad, Feed, Operations, and Office are different jobs. Office is president-only.",
    detail:
      "Tap a player on Squad for profile, contract, release, role, and loan actions. Finance and stadium live under Office.",
    tips: [
      "Squad is the roster",
      "Office is president-only",
      "Operations is staff work",
    ],
    points: [
      "Open your club from Profile → Club or from Find Clubs.",
      "Squad: tap a gamecard — View profile, View contract, Release, Remove role.",
      "LOAN / OUT badges show who is borrowed or sent out.",
      "Feed is club posts. Operations is applicants, staff, and lineups.",
      "Office (president only): Contracts, Stadium, Finance, Shirts, Trophies, History, Chat.",
      "Players cannot open Office. Do not expect them to sign themselves.",
      "Release ends a contract. Remove role only clears captain / staff, not the deal.",
      "Keep GK and the spine filled before you Register for a league.",
    ],
  },
  {
    title: "Sign & Manage Players",
    icon: "📝",
    where: "Transfer Market · Free Agents · Scouting · Inbox",
    description:
      "Recruit with contract offers. Talks live in Inbox. There is no public Join button.",
    detail:
      "Offer trial, academy, squad, important, or star. Founder Player is not something you offer to other people. Signed players at other clubs are loan targets.",
    tips: [
      "Scout Free Agents first",
      "Send offers from the profile or Office",
      "Finish talks in Inbox",
    ],
    points: [
      "Free Agents = no club. Open the player → send a contract offer.",
      "Transfer Market = signed players. Use Request Loan, not a second contract.",
      "Scouting: file a report with clips. A squad vote is advisory. You decide.",
      "Set wage, length, and type in Club Office → Contracts or on the profile.",
      "The player answers in Inbox. Until they accept they are not on your squad.",
      "Loan path: you request → parent accepts → player accepts → they play for you.",
      "From Squad you can recall, request return, or exercise an option to buy.",
      "Fill the roster before Competitions → Register. Empty clubs stall Game Day.",
    ],
  },
  {
    title: "Enter Competitions",
    icon: "🏆",
    where: "Register · Competitions · Tournaments · International",
    description:
      "The club enters the competition. Then you schedule Game Days and submit results.",
    detail:
      "Leagues live under Competitions. Cups live under Tournaments. Country events live under International.",
    tips: [
      "Register the club, not a player",
      "Watch the deadline",
      "Fixtures then appear on Schedule",
    ],
    points: [
      "Open Apps → Competitions to pick a league or cup and read the rules.",
      "When a window is open, go to Register and submit the club before the deadline.",
      "Tournaments is for brackets and one-off events. Open the event for Clubs / Players / Schedule.",
      "International is country-based. Eligibility usually follows club country.",
      "After entry, fixtures land on Schedule. Play them on Game Day.",
      "Put yourself in the lineup if you also play as Founder Player.",
      "THE STAGE TIMES → Competitions / Tournaments reports tables and champions.",
      "If registration fails, the page will say why — roster size, region, or a closed window.",
    ],
  },
  {
    title: "Run Game Day As President",
    icon: "⚽",
    where: "Schedule · Game Day · Inbox",
    description:
      "You pick the window, seat the squad, and own the result. The table waits on you.",
    detail:
      "Availability comes from players. Times are agreed on the fixture or in Inbox. Results must be submitted.",
    tips: [
      "Check player availability",
      "Agree the window",
      "Submit the score",
    ],
    points: [
      "Read Availability on the club / player tools before you propose a time.",
      "Arrange the window from Schedule or the match card. The opponent accepts in Inbox.",
      "On Game Day, make sure someone from your club takes a seat.",
      "Use match chat for that fixture only.",
      "Submit the score promptly. Chase the opponent confirm if it stalls.",
      "Disputes need evidence. Open Apps → Disputes rather than only arguing in chat.",
      "Lineups can sit under Operations if you saved one.",
      "Next matchday appears on Schedule after the result sticks.",
    ],
  },
  {
    title: "Grow Club Wealth",
    icon: "💰",
    where: "Finance · Stadium · Shirts",
    description:
      "Club STC pays wages. Prizes and optional tools refill it. Over-signing stars can empty a winning club.",
    detail:
      "Your founder wage also comes from this pot. Personal Wallet is a different balance.",
    tips: [
      "Check Finance before a big wage",
      "Prizes go to the club",
      "Stadium and shirts are optional",
    ],
    points: [
      "Office → Finance: balance, transfer budget, wage cap, ledger.",
      "Read this before you offer a star weekly wage.",
      "Competition prizes go to the club wallet after results confirm.",
      "Stadium sets capacity and ticket take. Shirts track fan sales after matches.",
      "A cheap, full squad is often stronger than one expensive name.",
      "Your Founder Player wage is paid by this club pot into your personal Wallet.",
      "Store / Lifestyle spend personal STC, not this ledger.",
      "If the pot is empty, stop offering contracts until prizes land.",
    ],
  },
  {
    title: "Watch The Paper And The Market",
    icon: "📰",
    where: "THE STAGE TIMES · Rankings · Scouting",
    description:
      "News and rankings tell you who is free, who is in form, and which clubs are active.",
    detail:
      "Mercato stories link to player and club files. You still finish every deal in Inbox.",
    tips: [
      "Mercato for deals",
      "Rankings for form",
      "World News for country desks",
    ],
    points: [
      "THE STAGE TIMES → Mercato is the market tape (rumours, official, loans, free agents).",
      "Club News covers stadium, shirts, and trophies — useful before you spend.",
      "Rankings is a scout list. Open a player, then Scouting or an offer.",
      "World News: continent, then country. Home nations share one UK desk.",
      "A story link is a shortcut to the live profile, not a signed deal.",
      "Keep your own club page complete so you look serious on their screen.",
      "Feed and Discord help coordination. Inbox remains the legal desk.",
      "After a signing, check Squad and Finance before the next Register window.",
    ],
  },
  {
    title: "Loans, Release, And Leaving",
    icon: "🚪",
    where: "Squad · Inbox · Leave Club",
    description:
      "Loans move playing rights. Release ends a deal. Leaving as founder is a different, heavier path.",
    detail:
      "Recall, early return, and option-to-buy all start on the squad gamecard and finish in Inbox.",
    tips: [
      "Loan from Transfer Market",
      "Release from the gamecard",
      "Founder leave ends both seats",
    ],
    points: [
      "Request Loan on a signed player at another club (Transfer Market or their profile).",
      "You accept as parent if someone asks for your player. They then accept.",
      "On Squad: Recall (if allowed), Request return, Accept/Reject return, Exercise option.",
      "Exercise option sends a permanent offer. The player must still accept.",
      "Release player ends their contract and removes them from the roster.",
      "Remove role only clears captain / staff.",
      "Leave Club as a founder can end Founder Player and ownership together.",
      "Replay this tutorial from Settings whenever a path goes stale.",
    ],
  },
];

const BOTH_STEPS = [
  {
    title: "Play Both Roles",
    icon: "⚡",
    where: "Profile rail · Player / President / Club",
    description:
      "You have a player profile and a club as president. Three surfaces, two contracts, one login.",
    detail:
      "Founder Player is how you play. Ownership is how you run the office. Switch with the identity rail on Profile.",
    tips: [
      "Player = inbox, availability, showcase",
      "President = public leader card",
      "Club = squad, office, competitions",
    ],
    points: [
      "Open Profile. Switch Player / President / Club — do not hunt for a second account.",
      "Player surface: offers, availability, showcase, stats, Leave Club.",
      "President surface: the public leader other clubs message.",
      "Club surface: Squad, Office, Finance, Register, competitions.",
      "You can play for your own club and still run it.",
      "Home / Apps is shared. The rail only changes which identity you are holding.",
      "Settings → How STAGE works replays the full map.",
      "If a button is missing (Office, Request Loan), you are on the wrong surface.",
    ],
  },
  {
    title: "Player Path",
    icon: "📝",
    where: "Inbox · Game Day · Wallet",
    description:
      "As a player you get signed, you show up, you get paid. Same rules as a player-only account.",
    detail:
      "Your founder wage is still a player contract paid by the club pot into your personal Wallet.",
    tips: [
      "Inbox for offers and loans",
      "Game Day to play",
      "Wallet for personal STC",
    ],
    points: [
      "Watch Inbox for contracts, loans, and time changes — including ones you sent as president.",
      "Set Availability so you do not double-book the fixture you also scheduled.",
      "Play on Game Day: seat, kickoff, submit/confirm.",
      "Personal Wallet collects the founder wage and match prizes.",
      "Showcase and Rankings still matter if you ever move clubs.",
      "Leave Club on the player surface ends the founder player deal.",
      "A loan to another club means you play there while you still run your own office.",
      "Read THE STAGE TIMES Player / Mercato desks for your own market noise.",
    ],
  },
  {
    title: "President Path",
    icon: "🛡️",
    where: "Club Office · Register · Finance",
    description:
      "As president you recruit, enter competitions, and keep the pot alive.",
    detail:
      "Office is president-only. Register the club, not the player profile. Finance is not your Wallet.",
    tips: [
      "Office for contracts and money",
      "Register the club",
      "Squad gamecards for loans and release",
    ],
    points: [
      "Recruit from Free Agents (contract) or Transfer Market (loan).",
      "Finish every deal in Inbox. There is no Join button.",
      "Office → Contracts / Finance / Stadium / Shirts.",
      "Register / Competitions / Tournaments / International — always as the club.",
      "Schedule the window, then play it as a player on Game Day if you are in the lineup.",
      "Release and loan actions sit on Squad gamecards.",
      "Do not pay yourself a star wage that empties the club you also have to run.",
      "THE STAGE TIMES Club / Mercato desks are your public reputation.",
    ],
  },
  {
    title: "Compete On Both Fronts",
    icon: "🏆",
    where: "Schedule · Competitions · Tournaments",
    description:
      "Personal matches move your rating. Club entries move the table. One calendar.",
    detail:
      "Keep one Schedule so you do not book a Game Day you cannot play.",
    tips: [
      "Enter leagues from the club",
      "Put yourself in the lineup",
      "Confirm the club result",
    ],
    points: [
      "Enter leagues from the club, never from the player profile alone.",
      "Put yourself in the lineup if you intend to play.",
      "Use Schedule as the single calendar for both jobs.",
      "Inbox time proposals may be ones you sent as president and must accept as player — or the reverse.",
      "Submit the club result on Game Day even if you also care about your personal rating.",
      "Cups: Tournaments tab. Leagues: Competitions. Country: International.",
      "Disputes are club-level. Open them with evidence.",
      "After full time, check both Rankings (you) and the competition table (the club).",
    ],
  },
  {
    title: "Inbox Is Shared",
    icon: "📥",
    where: "Inbox",
    description:
      "One inbox for both seats. Read the card: are you the player, the parent club, or the president who sent the offer?",
    detail:
      "Loan cards especially change meaning depending on who must accept.",
    tips: [
      "Read who the message is for",
      "Do not delete pending items",
      "Act, then switch surface if needed",
    ],
    points: [
      "Open every unread item. The type label says Contract, Loan, Match, Schedule.",
      "A contract you sent as president is waiting on the player — not on you.",
      "A contract sent to you as a player is waiting on you.",
      "Loan: parent accept, then player accept. You might be both, in order.",
      "Match time changes need the opponent. You may be arranging as president and playing as player.",
      "After you act, switch to Club or Player to see the squad / profile update.",
      "Notifications open the same Inbox thread.",
      "Clear Inbox before you Register — missing accepts stall the season.",
    ],
  },
  {
    title: "Build Dual Reputation",
    icon: "📊",
    where: "Player profile · Club page · News",
    description:
      "Presidents scout your player page. Players scout your club page. Both need to look finished.",
    detail:
      "Trophies and league place sit on the club. Rating and clips sit on the player.",
    tips: [
      "Verify the player profile",
      "Keep crest and squad visible",
      "Let the paper report wins",
    ],
    points: [
      "Player: verified handle, clips, country, platform.",
      "Club: logo, bio, filled squad, competitions.",
      "Rankings has both lists — you can appear on each.",
      "THE STAGE TIMES will file your signings and results if they happen on STAGE.",
      "A strong personal rating makes it easier to recruit.",
      "A strong club page makes it easier to be taken seriously in Register.",
      "Feed posts help, but Game Day results do the real work.",
      "Presidents directory is how others find your leader card.",
    ],
  },
  {
    title: "Earn Across Both Paths",
    icon: "💰",
    where: "Wallet · Club Finance",
    description:
      "Personal Wallet ≠ Club Finance. Check both before you spend or offer a wage.",
    detail:
      "Your founder wage is paid by the club to you. Prize money for the club stays in Finance.",
    tips: [
      "Wallet = you",
      "Finance = the club",
      "Do not drain the pot",
    ],
    points: [
      "Wallet: salary, personal prizes, Lifestyle, Store.",
      "Office → Finance: wages you pay, club prizes, stadium, shirts.",
      "Your founder wage is a transfer from Finance to Wallet.",
      "Lifestyle and Store never take from Finance.",
      "Paying yourself too much star money starves the squad you also manage.",
      "Loans can split a wage — read the Inbox card.",
      "Leave Club on the player side stops that wage. Founder leave can stop both seats.",
      "If a number looks wrong, keep the ledger row before you contact an admin.",
    ],
  },
  {
    title: "When Paths Cross",
    icon: "🧭",
    where: "Guide chip · Settings",
    description:
      "Every screen has a Guide. The onboarding tutorial lives in Settings. Use both when you are stuck.",
    detail:
      "The Guide lists the path for that page. This tutorial is the map of the whole app.",
    tips: [
      "Tap Guide on the page you are on",
      "Replay the tutorial in Settings",
      "News links jump to live files",
    ],
    points: [
      "Lost on a page? Tap Guide (Help) — it lists the path for that screen.",
      "Lost in the app? Settings → How STAGE works opens this tutorial again.",
      "Home / Apps is the jump grid: Inbox, Market, News, Wallet, Register, and the rest.",
      "Search if you know a name. Directories if you do not.",
      "THE STAGE TIMES story links are shortcuts into club and player files.",
      "If a control is missing, switch Player / President / Club.",
      "Contracts and loans always finish in Inbox. Matches always finish on Game Day.",
      "When in doubt: Inbox first, then Schedule, then Game Day.",
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

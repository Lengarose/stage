/** @typedef {'player' | 'president' | 'both'} TutorialIntent */
/** Internal president intent remains compatible with saved accounts. */
export function normalizeTutorialIntent(intent) {
  if (intent === "president" || intent === "both" || intent === "manager") return intent === "manager" ? "president" : intent;
  return "player";
}

/** Compact onboarding map; detailed rules belong to the relevant competition. */
export function getTutorialSteps(intent) {
  const manages = normalizeTutorialIntent(intent) !== "player";
  return [
    {
      title: manages ? "Your Club And Your Roles" : "Your Player Journey",
      icon: "🛡️", where: "Profile · My Club",
      description: manages ? "One account can manage a club and play for it. Ownership, paid management and player agreements are separate." : "Complete your player profile, find a club and review offers in Inbox.",
      points: manages ? ["Creating a club establishes ownership and management access.", "The Club Board sends separate paid management and player offers.", "Declining a paid offer does not remove ownership."] : ["Keep your position, platform and identity accurate.", "Clubs recruit through contract offers, not an open Join button.", "You can create a club and become a Manager later."],
    },
    {
      title: "Review Your Contracts", icon: "📝", where: "Inbox · Club Office → Contracts",
      description: "Read the salary, duration and bonus before accepting. A pending proposal does not change accepted terms.",
      points: manages ? ["The Club Board controls compensation paid to you personally.", "You negotiate other players’ offers within Card Level limits and the club budget.", "Management agreements last 12 weeks. Official results and affordability inform future offers."] : ["Accept, decline or counter an offer addressed to you.", "Squad importance is separate from salary and duration.", "Only permanent transfers are supported; official transfer windows still apply."],
    },
    {
      title: "Play And Progress", icon: "⚽", where: "Schedule · GameDay · Player Profile",
      description: "Your STAGE Card starts at Level 1 with 0 XP. Card Level, match rating and management performance are different.",
      points: ["The Manager confirms eligible starters and reserves before kickoff. No separate availability response is required.", "Confirmed Regional League, Regional Cup and GOST participation earns 100 XP per match actually played. Unused substitutes and AI earn none.", "Record the actual participants, human or AI goals and assists accurately. The opponent reviews the result."],
    },
    {
      title: "Enter Official Competitions", icon: "🏆", where: "Regional Leagues · Club Participation",
      description: "Read the entry rules and published calendar before committing your club.",
      points: ["Regional entry has an application window followed by a shared confirmation week. Sporting placement determines the group.", "Official regional matches require three eligible human starters. A goalkeeper is optional and ANY is allowed; participating players need their own applicable Plus access.", "Club tournaments publish their own minimum, goalkeeper and ANY rules. GOST remains closed until its opening requirements are met."],
    },
    {
      title: "Money And Honours", icon: "💰", where: "Wallet · Club Office → Finance · Trophies",
      description: "Your personal Wallet and club funds are separate. Paid agreements use club money.",
      points: ["Weekly pay accrues after each completed seven-day period. Insufficient funds remain recorded as arrears.", "Card Level sets player salary limits; levelling up does not automatically change an accepted salary.", "Earned trophy copies appear in the collection. Use cabinet Edit to display an unlocked copy."],
    },
    {
      title: "Explore At Your Pace", icon: "🧭", where: "Home · Market · Discover · Settings",
      description: "Inbox holds decisions, Schedule shows kickoff times, and GameDay handles the match.",
      points: ["Showcase and the transfer market help clubs and players find each other.", "Lifestyle offers optional purchases and rentals. Check price and upkeep before buying.", "Use a page’s Guide for help, or replay How STAGE works from Settings."],
    },
  ];
}

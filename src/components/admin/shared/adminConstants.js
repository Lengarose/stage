/**
 * Shared constants used by the admin pages.
 */

// URL aliases — accepts a few non-canonical section names from old links.
export const ADMIN_SECTION_ALIASES = {
  players: "players",
  clubs: "clubs",
  lifestyles: "lifestyles",
  transfers: "transfers",
  "press-conferences": "press-conferences",
  pressconferences: "press-conferences",
  matches: "disputes",
  notifications: "news",
  inbox: "forfeits",
  disputes: "disputes",
  forfeits: "forfeits",
  tournaments: "tournaments",
  leagues: "leagues",
  news: "news",
  trophies: "trophies",
  rewards: "rewards",
  rankings: "rankings",
  landing: "landing",
  home: "home",
};

// Economy test suite — names + descriptions used by AdminEconomyTestPanel.
export const SIM_TEST_META = [
  { name: "wallet_creation",        description: "New player gets 50,000 STC + initial_grant tx; no duplicates" },
  { name: "club_default_finances",  description: "New club has positive stc and non-negative budgets" },
  { name: "salary_payment",         description: "Weekly salary: player ↑ salary, club ↓ salary, both have tx records" },
  { name: "lifestyle_purchase",     description: "Purchase deducts player balance; tx with correct amount and balance_after" },
  { name: "lifestyle_rental",       description: "Rental deducts player balance and creates lifestyle_rental tx" },
  { name: "lifestyle_investment",   description: "Investment deducts balance; return credits back; net profit correct" },
  { name: "wager_block",            description: "Wager stake reduces both player balances; blocked funds confirmed" },
  { name: "wager_payout",           description: "Winner receives full pot; loser gets no refund; payout tx recorded" },
  { name: "wager_refund",           description: "Both players refunded to pre-wager balance; refund txs recorded" },
  { name: "ticket_revenue",         description: "Home match revenue: attendance formula, club credited, 15% transfer budget, idempotency guard, match fields updated" },
  { name: "shirt_sales_revenue",    description: "Shirt sales: club receives revenue, shirt_revenue tx recorded" },
  { name: "competition_reward",     description: "Competition reward: correct STC credited, competition_reward tx created" },
  { name: "transfer_budget_change", description: "Transfer fee deducted from both STC balance and transfer budget atomically" },
  { name: "wage_budget_change",     description: "Wage budget tracks contracted salaries: increases on sign, decreases on expiry" },
];

export const VERIFY_TEST_META = [
  { name: "no_negative_balances",        description: "No player or club has a negative STC balance" },
  { name: "no_duplicate_initial_grants", description: "No player has multiple initial_grant wallet transactions" },
  { name: "balance_accuracy",            description: "Spot-check 10 random players: sum(txs) matches stored balance" },
  { name: "no_duplicate_payments",       description: "No duplicate same-amount same-category same-minute transactions" },
  { name: "wager_integrity",             description: "Active wagers have both locks; settled solo wagers have payout records" },
  { name: "transaction_completeness",    description: "Completed matches have ticket revenue; active contracts have salary records" },
  { name: "club_profile_accuracy",       description: "Spot-check 5 clubs: sum(txs) ≈ stored balance" },
];

// Transaction categories used by AdminEconomyPanel dropdowns.
export const TX_CATEGORIES = [
  "admin_correction", "initial_grant", "wage_payment", "signing_bonus", "transfer_fee",
  "ticket_revenue", "stadium_upgrade", "shirt_revenue", "wager_stake", "wager_payout",
  "wager_refund", "wager_loss", "competition_reward", "lifestyle_purchase", "lifestyle_passive",
];

// Season status display labels (used by SeasonCard and elsewhere).
export const SEASON_STATUS_LABEL = {
  draft: "Draft",
  registration: "Registration",
  league_phase: "League Phase",
  playoff_round: "Playoff Round",
  knockout_r16: "Round of 16",
  knockout_qf: "Quarter-Finals",
  knockout_sf: "Semi-Finals",
  knockout_final: "Final",
  completed: "Completed",
  archived: "Archived",
};

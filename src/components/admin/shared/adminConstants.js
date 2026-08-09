/**
 * Shared constants used by the admin pages.
 */

// URL aliases — accepts a few non-canonical section names from old links.
export const ADMIN_SECTION_ALIASES = {
  players: "players",
  "identity-claims": "players",
  identity: "players",
  verification: "players",
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
  "international-tournaments": "international-tournaments",
  international: "international-tournaments",
  leagues: "leagues",
  news: "news",
  trophies: "trophies",
  rewards: "rewards",
  rankings: "rankings",
  store: "store",
  landing: "landing",
  home: "home",
  analytics: "analytics",
  guide: "analytics",
};

// Economy test suite — names only; descriptions via getSimTestDescription / getVerifyTestDescription.
export const SIM_TEST_META = [
  { name: "wallet_creation" },
  { name: "club_default_finances" },
  { name: "salary_payment" },
  { name: "lifestyle_purchase" },
  { name: "lifestyle_rental" },
  { name: "lifestyle_investment" },
  { name: "wager_block" },
  { name: "wager_payout" },
  { name: "wager_refund" },
  { name: "ticket_revenue" },
  { name: "shirt_sales_revenue" },
  { name: "competition_reward" },
  { name: "transfer_budget_change" },
  { name: "wage_budget_change" },
];

export const VERIFY_TEST_META = [
  { name: "no_negative_balances" },
  { name: "no_duplicate_initial_grants" },
  { name: "balance_accuracy" },
  { name: "no_duplicate_payments" },
  { name: "wager_integrity" },
  { name: "transaction_completeness" },
  { name: "club_profile_accuracy" },
];

// Transaction categories used by AdminEconomyPanel dropdowns.
export const TX_CATEGORIES = [
  "admin_correction", "initial_grant", "wage_payment", "signing_bonus", "transfer_fee",
  "ticket_revenue", "stadium_upgrade", "shirt_revenue", "wager_stake", "wager_payout",
  "wager_refund", "wager_loss", "competition_reward", "lifestyle_purchase", "lifestyle_passive",
];

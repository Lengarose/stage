// Subscription tier utility — single source of truth for access control

export const SUBSCRIPTION_TIERS = {
  rookie: "rookie",   // Free
  pro: "pro",         // STAGE Pro €3.99/mo
  elite: "elite",     // STAGE Elite €9.99/mo
};

/**
 * Get user's current subscription tier from purchases array
 */
export function getSubscriptionTier(purchases = []) {
  if (purchases.some(p => p.item_id === "sub_elite")) return SUBSCRIPTION_TIERS.elite;
  if (purchases.some(p => p.item_id === "sub_pro")) return SUBSCRIPTION_TIERS.pro;
  return SUBSCRIPTION_TIERS.rookie;
}

/**
 * Access rules per feature
 */
export function canPlayRankedPvP(tier) {
  return tier === SUBSCRIPTION_TIERS.pro || tier === SUBSCRIPTION_TIERS.elite;
}

export function canPlayRankedClub(tier) {
  return tier === SUBSCRIPTION_TIERS.elite;
}

export function getTournamentEntryCost(tier) {
  if (tier === SUBSCRIPTION_TIERS.elite) return 30;
  if (tier === SUBSCRIPTION_TIERS.pro) return 40;
  return 50;
}

export function getMonthlyCredits(tier) {
  if (tier === SUBSCRIPTION_TIERS.elite) return 300;
  if (tier === SUBSCRIPTION_TIERS.pro) return 100;
  return 0;
}

export const TIER_LABELS = {
  rookie: "YOUTH",
  pro: "PRO",
  elite: "ELITE",
};

export const TIER_COLORS = {
  rookie: "text-green-400",
  pro: "text-yellow-400",
  elite: "text-blue-400",
};
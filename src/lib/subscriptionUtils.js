// Subscription tier utility — single source of truth for access control.

export const SUBSCRIPTION_TIERS = {
  free: "free",
  stage_plus: "stage_plus",
};

export const STAGE_PLUS_PRICE = {
  monthly: 5.99,
  yearly: 59.99,
};

export const STAGE_PLUS_MONTHLY_CREDITS = 300;
export const TOURNAMENT_ENTRY_CREDITS = 50;
export const COMMUNITY_TOURNAMENT_LIMIT = 5;

export function normalizeSubscriptionTier(tier) {
  const normalized = String(tier || "").toLowerCase();
  if (["stage_plus", "plus", "pro", "elite"].includes(normalized)) {
    return SUBSCRIPTION_TIERS.stage_plus;
  }
  return SUBSCRIPTION_TIERS.free;
}

/**
 * Get user's current subscription tier from purchases array.
 * Legacy Pro/Elite purchases count as STAGE Plus so existing paid users keep access.
 */
export function getSubscriptionTier(purchases = []) {
  if (purchases.some(p => ["sub_stage_plus", "sub_pro", "sub_elite"].includes(p.item_id))) {
    return SUBSCRIPTION_TIERS.stage_plus;
  }
  return SUBSCRIPTION_TIERS.free;
}

export function hasStagePlus(tier) {
  return normalizeSubscriptionTier(tier) === SUBSCRIPTION_TIERS.stage_plus;
}

export function canPlayRankedPvP(tier) {
  return hasStagePlus(tier);
}

export function canPlayRankedClub(tier) {
  return hasStagePlus(tier);
}

export function getTournamentEntryCost() {
  return TOURNAMENT_ENTRY_CREDITS;
}

export function getMonthlyCredits(tier) {
  return hasStagePlus(tier) ? STAGE_PLUS_MONTHLY_CREDITS : 0;
}

export const TIER_LABELS = {
  free: "FREE",
  rookie: "FREE",
  stage_plus: "STAGE PLUS",
  plus: "STAGE PLUS",
  pro: "STAGE PLUS",
  elite: "STAGE PLUS",
};

export const TIER_COLORS = {
  free: "text-slate-300",
  rookie: "text-slate-300",
  stage_plus: "text-cyan-300",
  plus: "text-cyan-300",
  pro: "text-cyan-300",
  elite: "text-cyan-300",
};

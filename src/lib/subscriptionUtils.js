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

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Compute the renewal countdown for an active STAGE Plus subscription.
 * Returns null when the player has no active subscription / no expiry date.
 *
 * The billing period length is derived from `billing` (monthly ≈ 30 days,
 * yearly = 365/366 days). `daysLeft` counts down to the next renewal; `percent`
 * is how much of the current period has elapsed (0 = just renewed, 100 = due).
 */
export function getSubscriptionCountdown(player, now = new Date()) {
  if (!player || !hasStagePlus(player.subscription)) return null;
  if (!player.subscription_expires_at) return null;

  const expires = new Date(player.subscription_expires_at);
  if (Number.isNaN(expires.getTime())) return null;

  const billing = String(player.subscription_billing || "monthly").toLowerCase() === "yearly" ? "yearly" : "monthly";

  // Reconstruct the period start by stepping back one billing interval from the
  // expiry, so the progress bar reflects the real period length (handles leap
  // years and 28–31 day months exactly).
  const start = new Date(expires);
  if (billing === "yearly") start.setFullYear(start.getFullYear() - 1);
  else start.setMonth(start.getMonth() - 1);

  const totalDays = Math.max(1, Math.round((expires - start) / MS_PER_DAY));
  const daysLeft = Math.max(0, Math.ceil((expires - now) / MS_PER_DAY));
  const daysElapsed = Math.max(0, Math.min(totalDays, totalDays - daysLeft));
  const percent = Math.max(0, Math.min(100, Math.round((daysElapsed / totalDays) * 100)));

  // For yearly plans, also express elapsed/remaining time in whole months.
  const monthsElapsed = Math.floor(daysElapsed / 30.4375);
  const monthsLeft = Math.max(0, Math.round(daysLeft / 30.4375));

  return {
    billing,
    expiresAt: expires,
    totalDays,
    daysLeft,
    daysElapsed,
    percent,
    monthsElapsed,
    monthsLeft,
    isExpired: daysLeft <= 0,
  };
}

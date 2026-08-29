// Subscription tier utility — single source of truth for access control.

export const SUBSCRIPTION_TIERS = {
  free: "free",
  stage_plus: "stage_plus",
};

export const STAGE_PLUS_PRICE = {
  monthly: 4.99,
  yearly: 49.99,
};

export const STAGE_PLUS_MONTHLY_CREDITS = 150;
export const TOURNAMENT_ENTRY_CREDITS = 50;
// 0 = unlimited. STAGE Plus does not cap community tournament creation.
export const COMMUNITY_TOURNAMENT_LIMIT = 0;

// Credit packs — casual top-ups for extra tournament entries. Framed as
// extras next to STAGE Plus, which is the best-value option for active
// users (150 credits/month for €4.99, vs. buying packs one at a time).
// Keep in sync with server/src/server/utils/storeSettings.js CREDIT_PACKS.
export const CREDIT_PACKS = [
  { id: "credits_entry", credits: 50, price_eur: 1.99, label: "Entry Pack", purpose: "1 tournament entry" },
  { id: "credits_starter", credits: 100, price_eur: 2.99, label: "Starter Pack", purpose: "2 tournament entries", highlight: "primary", badge: "Popular" },
  { id: "credits_competitor", credits: 250, price_eur: 5.99, label: "Competitor Pack", purpose: "5 tournament entries", highlight: "success", badge: "Best Value" },
  { id: "credits_club", credits: 600, price_eur: 10.99, label: "Club Pack", purpose: "12 tournament entries" },
];

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

/**
 * STAGE Plus access. Paid tiers without an expiry stay active (legacy).
 * A parseable expires_at at or before now is not Plus.
 */
export function hasStagePlus(tierOrEntity, expiresAt, now = new Date()) {
  let tier = tierOrEntity;
  let expiry = expiresAt;
  if (tierOrEntity && typeof tierOrEntity === "object" && !Array.isArray(tierOrEntity)) {
    expiry = expiresAt ?? tierOrEntity.subscription_expires_at ?? tierOrEntity.expires_at ?? null;
    tier = tierOrEntity.subscription ?? tierOrEntity.tier ?? null;
  }
  if (normalizeSubscriptionTier(tier) !== SUBSCRIPTION_TIERS.stage_plus) return false;
  if (expiry == null || expiry === "") return true;
  const expires = new Date(expiry);
  if (Number.isNaN(expires.getTime())) return true;
  return expires.getTime() > new Date(now).getTime();
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
  if (!player || !hasStagePlus(player)) return null;
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

/**
 * Lifestyle Upgrade & Maintenance System
 * High-end economy — all costs are designed for the STC millions scale.
 */

// ─── UPGRADE COST FORMULA ──────────────────────────────────────────────────
// Cost = basePrice * slotMultiplier * 3^currentLevel
// This ensures exponential scaling: level 0 → 1x, level 1 → 3x, level 2 → 9x, etc.
// Rounded to nearest 50K for clean numbers.
export function calcUpgradeCost(basePrice, slotMultiplier, currentLevel) {
  const raw = basePrice * slotMultiplier * Math.pow(3, currentLevel);
  return Math.max(50_000, Math.round(raw / 50_000) * 50_000);
}

// Total asset value including all upgrades
export function calcAssetValue(basePrice, upgradeSlots, basePricePerSlot) {
  return upgradeSlots.reduce((total, slot) => total + (slot.cost_paid || 0), basePrice);
}

// ─── PROPERTY UPGRADES ─────────────────────────────────────────────────────
export const PROPERTY_UPGRADES = [
  { id: "interior",   label: "Interior Quality",   emoji: "🛋️",  description: "Premium furnishings, marble & bespoke finishes.",  base_cost_multiplier: 0.10 },
  { id: "rooms",      label: "Extra Rooms",         emoji: "🏠",  description: "Add bedrooms, a study or a guest wing.",           base_cost_multiplier: 0.15 },
  { id: "luxury",     label: "Luxury Level",        emoji: "💎",  description: "Gold fixtures, crystal chandeliers, art collection.", base_cost_multiplier: 0.20 },
  { id: "smart_home", label: "Smart Home System",   emoji: "📱",  description: "Full automation — lights, climate, security.",     base_cost_multiplier: 0.08 },
  { id: "security",   label: "Security Upgrade",    emoji: "🔒",  description: "24/7 armed guards, biometrics, CCTV.",             base_cost_multiplier: 0.07 },
  { id: "pool",       label: "Private Pool",        emoji: "🏊",  description: "Heated infinity pool with jacuzzi.",               base_cost_multiplier: 0.12 },
  { id: "gym",        label: "Private Gym",         emoji: "💪",  description: "Full professional-grade training facility.",       base_cost_multiplier: 0.09 },
  { id: "cinema",     label: "Home Cinema",         emoji: "🎬",  description: "Private screening room with Dolby Atmos.",         base_cost_multiplier: 0.10 },
];

// ─── VEHICLE UPGRADES ──────────────────────────────────────────────────────
export const VEHICLE_UPGRADES = [
  { id: "engine",     label: "Engine Upgrade",      emoji: "⚡",  description: "Boosted horsepower — 0-60 in record time.",        base_cost_multiplier: 0.25 },
  { id: "exhaust",    label: "Exhaust System",      emoji: "💨",  description: "Ti-alloy performance exhaust.",                    base_cost_multiplier: 0.10 },
  { id: "suspension", label: "Suspension Kit",      emoji: "🔧",  description: "Track-tuned coilovers & aerodynamic stance.",      base_cost_multiplier: 0.12 },
  { id: "wrap",       label: "Custom Wrap",         emoji: "🎨",  description: "Full bespoke livery — any colour, any pattern.",   base_cost_multiplier: 0.08 },
  { id: "wheels",     label: "Forged Wheels",       emoji: "⭕",  description: "One-piece forged alloys with locking nuts.",       base_cost_multiplier: 0.09 },
  { id: "interior_v", label: "Cabin Upgrade",       emoji: "🏎️", description: "Racing bucket seats, carbon fibre & HUD.",        base_cost_multiplier: 0.11 },
  { id: "nitro",      label: "Launch System",       emoji: "🚀",  description: "Launch control, NOS & boost mapping.",             base_cost_multiplier: 0.22 },
  { id: "rarity",     label: "Rarity Tier",         emoji: "🌟",  description: "Unique edition status — 1-of-1 collector item.",   base_cost_multiplier: 0.40 },
];

// ─── MAINTENANCE BREAKDOWN BY TIER ─────────────────────────────────────────
// Each line item has: id, label, emoji, weeklyFraction (of asset base price)
// Total weekly cost = sum of all applicable line items * basePrice
export const PROPERTY_MAINTENANCE_LINES = [
  { id: "upkeep",    label: "General Upkeep",   emoji: "🔨", weeklyFraction: 0.0008 },
  { id: "tax",       label: "Property Tax",     emoji: "🏛️", weeklyFraction: 0.0012 },
  { id: "staff",     label: "Staff Salaries",   emoji: "👔", weeklyFraction: 0.0015, minTier: "premium" },
  { id: "insurance", label: "Insurance",        emoji: "📋", weeklyFraction: 0.0006 },
  { id: "security",  label: "Security",         emoji: "🔒", weeklyFraction: 0.0010, minTier: "luxury" },
];

export const VEHICLE_MAINTENANCE_LINES = [
  { id: "service",   label: "Service & MOT",   emoji: "🔧", weeklyFraction: 0.0015 },
  { id: "insurance", label: "Insurance",       emoji: "📋", weeklyFraction: 0.0010 },
  { id: "fuel",      label: "Fuel & Running",  emoji: "⛽", weeklyFraction: 0.0005 },
  { id: "storage",   label: "Garage Storage",  emoji: "🏠", weeklyFraction: 0.0008, minTier: "premium" },
];

const TIER_ORDER = ["starter", "mid", "premium", "luxury", "elite"];
function tierIndex(tier) { return TIER_ORDER.indexOf(tier || "starter"); }

// Get applicable maintenance lines for a given tier
function getLinesForTier(lines, tier) {
  const ti = tierIndex(tier);
  return lines.filter(l => !l.minTier || ti >= tierIndex(l.minTier));
}

// Calculate weekly maintenance cost from base price and tier
export function calcWeeklyMaintenance(basePrice, category, tier) {
  const lines = category === "vehicle" ? VEHICLE_MAINTENANCE_LINES : PROPERTY_MAINTENANCE_LINES;
  const applicable = getLinesForTier(lines, tier);
  const raw = applicable.reduce((s, l) => s + basePrice * l.weeklyFraction, 0);
  return Math.max(5_000, Math.round(raw / 5_000) * 5_000);
}

// Get itemised maintenance breakdown (for UI display)
export function getMaintenanceBreakdown(basePrice, category, tier) {
  const lines = category === "vehicle" ? VEHICLE_MAINTENANCE_LINES : PROPERTY_MAINTENANCE_LINES;
  const applicable = getLinesForTier(lines, tier);
  return applicable.map(l => ({
    ...l,
    weekly_cost: Math.max(1_000, Math.round(basePrice * l.weeklyFraction / 1_000) * 1_000),
  }));
}

// ─── CITIES ────────────────────────────────────────────────────────────────
export const PROPERTY_CITIES = [
  { id: "dubai",       city: "Dubai",       country: "UAE",       emoji: "🇦🇪", multiplier: 1.6 },
  { id: "monaco",      city: "Monaco",      country: "Monaco",    emoji: "🇲🇨", multiplier: 2.0 },
  { id: "london",      city: "London",      country: "UK",        emoji: "🇬🇧", multiplier: 1.5 },
  { id: "paris",       city: "Paris",       country: "France",    emoji: "🇫🇷", multiplier: 1.4 },
  { id: "new_york",    city: "New York",    country: "USA",       emoji: "🇺🇸", multiplier: 1.5 },
  { id: "los_angeles", city: "Los Angeles", country: "USA",       emoji: "🇺🇸", multiplier: 1.3 },
  { id: "milan",       city: "Milan",       country: "Italy",     emoji: "🇮🇹", multiplier: 1.2 },
  { id: "barcelona",   city: "Barcelona",   country: "Spain",     emoji: "🇪🇸", multiplier: 1.1 },
  { id: "madrid",      city: "Madrid",      country: "Spain",     emoji: "🇪🇸", multiplier: 1.1 },
  { id: "riyadh",      city: "Riyadh",      country: "KSA",       emoji: "🇸🇦", multiplier: 1.3 },
  { id: "singapore",   city: "Singapore",   country: "Singapore", emoji: "🇸🇬", multiplier: 1.4 },
  { id: "miami",       city: "Miami",       country: "USA",       emoji: "🇺🇸", multiplier: 1.3 },
];

// ─── HELPERS ───────────────────────────────────────────────────────────────
export function getUpgradesForCategory(category) {
  if (category === "vehicle") return VEHICLE_UPGRADES;
  if (category === "real_estate") return PROPERTY_UPGRADES;
  return [];
}

export function getMaintenanceLabel(weeklyCost) {
  if (!weeklyCost) return null;
  if (weeklyCost >= 1_000_000) return `${(weeklyCost / 1_000_000).toFixed(1)}M STC/wk`;
  if (weeklyCost >= 1_000) return `${(weeklyCost / 1_000).toFixed(0)}K STC/wk`;
  return `${weeklyCost.toLocaleString()} STC/wk`;
}
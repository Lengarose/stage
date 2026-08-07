/**
 * Stadium system — 4 levels with ticket revenue model.
 * Level 0 = Local Ground    (5 000 cap, 250K wage cap, 1M transfer cap)
 * Level 1 = Pro Stadium     (20 000 cap, 800K wage cap, 5M transfer cap)
 * Level 2 = Elite Ground    (45 000 cap, 1.8M wage cap, 12M transfer cap)
 * Level 3 = Iconic Arena    (80 000 cap, 4M wage cap, 30M transfer cap)
 *
 * Revenue = Capacity × Ticket Price per Home Game
 */

export const STADIUM_LEVELS = [
  {
    level: 0,
    name: "Local Ground",
    capacity: 5_000,
    ticket_price_stc: 15,
    upgrade_cost_stc: 0,
    max_wage_budget_stc: 250_000,
    max_transfer_budget_stc: 1_000_000,
    monthly_maintenance_stc: 50_000,
    description: "A humble but passionate home ground. Every great club starts somewhere.",
    emoji: "⚽",
    color: "text-slate-400",
    bg: "bg-slate-500/10 border-slate-500/20",
  },
  {
    level: 1,
    name: "Pro Stadium",
    capacity: 20_000,
    ticket_price_stc: 50,
    upgrade_cost_stc: 50_000_000,
    max_wage_budget_stc: 800_000,
    max_transfer_budget_stc: 5_000_000,
    monthly_maintenance_stc: 200_000,
    description: "Professional-grade facilities. The home ground for serious clubs.",
    emoji: "🏟️",
    color: "text-primary",
    bg: "bg-primary/10 border-primary/20",
  },
  {
    level: 2,
    name: "Elite Ground",
    capacity: 45_000,
    ticket_price_stc: 130,
    upgrade_cost_stc: 120_000_000,
    max_wage_budget_stc: 1_800_000,
    max_transfer_budget_stc: 12_000_000,
    monthly_maintenance_stc: 600_000,
    description: "State-of-the-art stadium. Champions League ready.",
    emoji: "🏆",
    color: "text-purple-400",
    bg: "bg-purple-500/10 border-purple-500/20",
  },
  {
    level: 3,
    name: "Iconic Arena",
    capacity: 80_000,
    ticket_price_stc: 180,
    upgrade_cost_stc: 250_000_000,
    max_wage_budget_stc: 4_000_000,
    max_transfer_budget_stc: 30_000_000,
    monthly_maintenance_stc: 1_500_000,
    description: "A legendary venue. The world's eyes are on you.",
    emoji: "👑",
    color: "text-yellow-400",
    bg: "bg-yellow-500/10 border-yellow-500/20",
  },
];

export function getStadiumLevel(level) {
  return STADIUM_LEVELS[Math.min(Math.max(level || 0, 0), STADIUM_LEVELS.length - 1)];
}

export function getNextStadiumLevel(level) {
  const next = (level || 0) + 1;
  return STADIUM_LEVELS[next] || null;
}

/**
 * Calculate ticket revenue for a home match.
 * Revenue = Capacity × Ticket Price
 * @param {number} stadiumLevel - Club's current stadium level (0–3)
 * @returns {number} STC revenue per home match
 */
export function calcTicketRevenue(stadiumLevel) {
  const lvl = getStadiumLevel(stadiumLevel);
  return lvl.capacity * lvl.ticket_price_stc;
}

/**
 * Shirt economy — pricing logic for virtual shirt sales.
 * Price reflects OVR, in-game performance, and avg match rating.
 */
export function calculateShirtPrice(player) {
  const ovr = player.overall_rating || 70;
  const goals = player.goals || 0;
  const assists = player.assists || 0;
  const avgRating = player.avg_match_rating || 6.0;
  const motm = player.man_of_the_match || 0;

  // Exponential OVR base: 70 OVR → ~5 000 STC, 99 OVR → ~47 000 STC
  const base = Math.round(5000 * Math.pow(1.065, ovr - 70));
  const goalBonus    = goals   * 500;
  const assistBonus  = assists * 300;
  const ratingBonus  = Math.max(0, Math.round((avgRating - 6.0) * 3000));
  const motmBonus    = motm    * 1000;

  const total = base + goalBonus + assistBonus + ratingBonus + motmBonus;
  // Round to nearest 500 STC, floor at 2 500 STC
  return Math.max(2500, Math.round(total / 500) * 500);
}

export function formatShirtPrice(stc) {
  if (stc >= 1_000_000) return `${(stc / 1_000_000).toFixed(1)}M STC`;
  if (stc >= 1_000)     return `${(stc / 1_000).toFixed(0)}K STC`;
  return `${stc} STC`;
}

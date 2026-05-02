/**
 * Player Market Value — pure PERFORMANCE-BASED system.
 * NO dependency on overall_rating.
 *
 * Value is earned through:
 *   - matches played (experience)
 *   - goals & assists (output)
 *   - average match rating (quality)
 *   - MOTM awards (excellence)
 *   - clean sheets (defenders/GKs)
 *   - wins (team success)
 */

export function calculatePlayerValue(player) {
  if (!player) return 0;

  const matches   = player.matches_played || 0;
  const goals     = player.goals || 0;
  const assists   = player.assists || 0;
  const avgRating = player.avg_match_rating || 6.0;
  const motm      = player.man_of_the_match || 0;
  const cleanSheets = player.clean_sheets || 0;
  const wins      = player.wins_count || 0;

  // New players with 0 stats → very low value
  if (matches === 0) return 100_000;

  // ── Base value from experience (matches played) ──────────────────────────
  // 1 match → low, 100 matches → veteran
  const experienceBase = Math.min(matches * 50_000, 5_000_000);

  // ── Performance output bonus ─────────────────────────────────────────────
  const goalBonus   = goals   * 200_000;
  const assistBonus = assists * 120_000;

  // ── Quality multiplier from avg match rating ─────────────────────────────
  // 6.0 = neutral (×1.0), 7.0 = good (×1.2), 8.0 = excellent (×1.5), 9+ = elite (×2.0)
  const ratingMult = Math.max(0.5, Math.min(2.0, 0.6 + (avgRating - 5) * 0.2));

  // ── Achievement bonuses ──────────────────────────────────────────────────
  const motmBonus       = motm        * 300_000;
  const cleanSheetBonus = cleanSheets * 150_000;
  const winBonus        = wins        * 30_000;

  // ── Consistency factor ───────────────────────────────────────────────────
  // Players with many matches and high output get a scale bonus
  const goalsPerMatch = matches > 0 ? goals / matches : 0;
  const consistencyBonus = goalsPerMatch > 0.5 ? 1_000_000 : goalsPerMatch > 0.3 ? 500_000 : 0;

  const rawValue = Math.round(
    (experienceBase + goalBonus + assistBonus + motmBonus + cleanSheetBonus + winBonus + consistencyBonus)
    * ratingMult
  );

  // Round to nearest 50K, minimum 100K
  return Math.max(100_000, Math.round(rawValue / 50_000) * 50_000);
}

export function formatSTC(value) {
  if (value === null || value === undefined) return '—';
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B STC`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 1 : 2)}M STC`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 100_000 ? 0 : 1)}K STC`;
  return `${value.toLocaleString()} STC`;
}

export function getValueTier(value) {
  if (value >= 50_000_000) return { label: 'World Class', color: 'text-warning' };
  if (value >= 20_000_000) return { label: 'Elite',       color: 'text-purple-400' };
  if (value >= 5_000_000)  return { label: 'Pro',         color: 'text-primary' };
  if (value >= 1_000_000)  return { label: 'Rising',      color: 'text-success' };
  return                          { label: 'Prospect',    color: 'text-muted-foreground' };
}

/**
 * Suggest weekly salary range (STC) based on contract type and player stats.
 * Uses matches_played as a proxy for experience instead of OVR.
 */
export function suggestSalaryRange(contractType, overallRating = 70) {
  // Keep overallRating param for backward compatibility but don't rely on it heavily
  const ranges = {
    trial:     { min: 0,       max: 5_000,   label: "Trial" },
    academy:   { min: 5_000,   max: 30_000,  label: "Academy" },
    squad:     { min: 40_000,  max: 80_000,  label: "Squad" },
    important: { min: 100_000, max: 250_000, label: "Important" },
    star:      { min: 250_000, max: 500_000, label: "Star" },
  };
  return ranges[contractType] || ranges.squad;
}
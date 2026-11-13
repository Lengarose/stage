/**
 * Player Market Value — multi-factor performance-based system.
 *
 * Prefers the server-stored `market_value_stc` (recalculated after every match).
 * Falls back to client-side estimation when server value unavailable (new profiles).
 *
 * Factors: avg match rating, goals/game, assists/game, clean sheets/game,
 * consistency, recent form, MOTM count, wins, matches played.
 * Overall rating has minor influence only (~8%).
 */


const DEFAULT_WEIGHTS = {
  base_per_match:           60_000,
  max_base:              8_000_000,
  goal_rate_bonus:       2_000_000,
  assist_rate_bonus:     1_000_000,
  clean_sheet_rate_bonus:2_500_000,
  motm_bonus:              300_000,
  consistency_boost:          0.15,
  form_boost:                 0.20,
  form_penalty:               0.12,
  win_rate_boost:             0.10,
  ovr_weight:                 0.08,
};

export function calculatePlayerValue(player, W = DEFAULT_WEIGHTS) {
  if (!player) return 250_000;

  // Prefer stored server value
  if (player.market_value_stc && Number(player.market_value_stc) > 0) {
    return Number(player.market_value_stc);
  }

  // Client-side fallback estimation
  const matches     = Number(player.matches_played  || 0);
  const goals       = Number(player.goals           || 0);
  const assists     = Number(player.assists         || 0);
  const avgRating   = Number(player.avg_match_rating || 0);
  const motm        = Number(player.man_of_the_match || 0);
  const cleanSheets = Number(player.clean_sheets    || 0);
  const wins        = Number(player.wins_count      || 0);

  if (matches === 0) return 250_000;

  const base = Math.min(matches * W.base_per_match, W.max_base);

  const ratingMult = avgRating >= 5
    ? Math.max(0.3, Math.min(2.5, 0.3 + ((avgRating - 4.5) / 5.0) * 2.2))
    : 0.3;

  const goalRateBonus = Math.min((goals / matches) * W.goal_rate_bonus, 6_000_000);
  const asstRateBonus = Math.min((assists / matches) * W.assist_rate_bonus, 3_000_000);
  const csRateBonus   = Math.min((cleanSheets / matches) * W.clean_sheet_rate_bonus, 5_000_000);
  const outputBonus   = goalRateBonus + asstRateBonus + csRateBonus;

  const achieveBonus  = Math.min(motm * W.motm_bonus, 5_000_000);
  const ovrBonus      = 0; // Self-reported EA OVR does not influence economic value.

  const winRate = wins / matches;
  const winMult = winRate > 0.7 ? 1 + W.win_rate_boost
                : winRate > 0.5 ? 1 + W.win_rate_boost * 0.5
                : 1.0;

  const raw = Math.round((base + outputBonus + achieveBonus + ovrBonus) * ratingMult * winMult);

  return Math.max(250_000, Math.round(raw / 100_000) * 100_000);
}

export function getValueTier(value) {
  const v = Number(value || 0);
  if (v >= 200_000_000) return { label: 'World Class', color: 'text-warning',         bg: 'bg-warning/10',       border: 'border-warning/30' };
  if (v >= 50_000_000)  return { label: 'Elite',       color: 'text-purple-400',       bg: 'bg-purple-400/10',    border: 'border-purple-400/30' };
  if (v >= 10_000_000)  return { label: 'Pro',         color: 'text-primary',          bg: 'bg-primary/10',       border: 'border-primary/30' };
  if (v >= 2_000_000)   return { label: 'Rising',      color: 'text-success',          bg: 'bg-success/10',       border: 'border-success/30' };
  return                       { label: 'Prospect',    color: 'text-muted-foreground', bg: 'bg-secondary',        border: 'border-border' };
}

export function formatSTC(value) {
  if (value === null || value === undefined) return '—';
  const v = Number(value);
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(2)}B STC`;
  if (v >= 1_000_000)     return `${(v / 1_000_000).toFixed(v >= 10_000_000 ? 1 : 2)}M STC`;
  if (v >= 1_000)         return `${(v / 1_000).toFixed(v >= 100_000 ? 0 : 1)}K STC`;
  return `${v.toLocaleString()} STC`;
}

/**
 * Suggest weekly salary range based on contract type and player market value.
 * ~6-18% of market value per week depending on contract tier.
 */
export function suggestSalaryRange(contractType, _overallRating = 70, _marketValue = 0, cardLevel = 1) {
  const level=Math.max(1,Math.min(100,Number(cardLevel)||1));
  const bands=[[5,5000,15000],[10,10000,25000],[25,15000,40000],[50,25000,70000],[75,40000,100000],[100,60000,150000]];
  const [,min,max]=bands.find(([to])=>level<=to);
  return {min,max,label:'STAGE Card Level '+level,based_on_value:false};
}

export function suggestWeeklySalary(contractType, player) {
  const range = suggestSalaryRange(
    contractType,
    player?.overall_rating,
    player?.market_value_stc || player?.market_value,
    player?.card_level || 1,
  );
  const mid = (Number(range.min) + Number(range.max)) / 2;
  return Math.max(0, Math.round(mid / 1000) * 1000);
}

export function suggestSigningBonus(contractType, weeklySalary) {
  const weeks = { trial: 4, academy: 4, squad: 4, important: 4, star: 4 };
  const weekly = Math.max(0, Number(weeklySalary) || 0);
  const type = String(contractType || "").toLowerCase();
  return Math.round((weekly * (weeks[type] || 4)) / 1000) * 1000;
}

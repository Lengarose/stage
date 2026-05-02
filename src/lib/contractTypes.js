/**
 * CONTRACT TYPES & RULES
 * A contract expires when EITHER condition is met first:
 *   - games_played >= max_games
 *   - days since start_date >= max_days
 */

export const CONTRACT_TYPES = {
  trial: {
    label: "Trial",
    max_games: 5,
    max_days: 14,
    color: "text-muted-foreground",
    bg: "bg-muted/30",
    border: "border-muted-foreground/20",
    badge: "bg-muted/50 text-muted-foreground",
    description: "5 games or 14 days",
  },
  academy: {
    label: "Academy",
    max_games: 20,
    max_days: 30,
    color: "text-success",
    bg: "bg-success/10",
    border: "border-success/20",
    badge: "bg-success/20 text-success",
    description: "20 games or 30 days",
  },
  squad: {
    label: "Squad Player",
    max_games: 100,
    max_days: 90,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    badge: "bg-blue-500/20 text-blue-400",
    description: "100 games or 90 days",
  },
  important: {
    label: "Important Player",
    max_games: 250,
    max_days: 120,
    color: "text-destructive",
    bg: "bg-destructive/10",
    border: "border-destructive/20",
    badge: "bg-destructive/20 text-destructive",
    description: "250 games or 120 days",
  },
  star: {
    label: "Star Player",
    max_games: 400,
    max_days: 180,
    color: "text-warning",
    bg: "bg-warning/10",
    border: "border-warning/20",
    badge: "bg-warning/20 text-warning",
    description: "400 games or 180 days",
  },
  ownership: {
    label: "🏢 Club Ownership",
    max_games: 999,
    max_days: 3650,
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/20",
    badge: "bg-primary/20 text-primary",
    description: "Club ownership contract (10 years)",
  },
};

export const CONTRACT_TYPE_OPTIONS = Object.entries(CONTRACT_TYPES).map(([value, meta]) => ({
  value,
  ...meta,
}));

/**
 * Returns true if a contract should be expired based on games or days.
 */
export function isContractExpired(contract) {
  if (!contract.start_date) return false;
  const meta = CONTRACT_TYPES[contract.contract_type];
  if (!meta) return false;

  const daysSinceStart = Math.floor(
    (Date.now() - new Date(contract.start_date).getTime()) / (1000 * 60 * 60 * 24)
  );
  const gamesPlayed = contract.games_played || 0;

  return gamesPlayed >= meta.max_games || daysSinceStart >= meta.max_days;
}

/**
 * Returns a human-readable progress string.
 */
export function getContractProgress(contract) {
  const meta = CONTRACT_TYPES[contract.contract_type];
  if (!meta || !contract.start_date) return null;

  const daysSinceStart = Math.floor(
    (Date.now() - new Date(contract.start_date).getTime()) / (1000 * 60 * 60 * 24)
  );
  const gamesPlayed = contract.games_played || 0;
  const daysLeft = Math.max(0, meta.max_days - daysSinceStart);
  const gamesLeft = Math.max(0, meta.max_games - gamesPlayed);

  const gamesPercent = Math.min(100, Math.round((gamesPlayed / meta.max_games) * 100));
  const daysPercent = Math.min(100, Math.round((daysSinceStart / meta.max_days) * 100));

  return { gamesPlayed, gamesLeft, gamesPercent, daysSinceStart, daysLeft, daysPercent, maxGames: meta.max_games, maxDays: meta.max_days };
}
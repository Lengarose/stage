const CLOSED_STATUSES = new Set(["completed", "forfeit", "cancelled", "canceled", "deleted"]);
const DRAW_ONLY_STATUSES = new Set(["unscheduled"]);

/** Cup fixtures finish on Game Day (`matchKickoff`), not a tournament-page score form. */
export function canOpenTournamentGameDay(match) {
  if (!match?.id) return false;
  const status = String(match.status || "").toLowerCase();
  if (CLOSED_STATUSES.has(status)) return false;
  if (DRAW_ONLY_STATUSES.has(status)) return false;
  return true;
}

export function tournamentGameDayWebPath(matchId) {
  return `/game-day?match=${encodeURIComponent(String(matchId))}`;
}

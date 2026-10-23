export function emailsMatch(left, right) {
  const a = String(left || "").trim().toLowerCase();
  const b = String(right || "").trim().toLowerCase();
  return Boolean(a && b && a === b);
}

export function isGostOfficialTournament(tournament) {
  if (String(tournament?.creator_gamertag || "").trim()) return false;
  if (String(tournament?.creator_id || "").trim()) return false;
  return /^by stage\b/i.test(String(tournament?.name || "").trim());
}

export function isTournamentOwner(tournament, user, player) {
  if (!tournament || !user) return false;
  if (emailsMatch(user.email, tournament.creator_email)) return true;
  if (emailsMatch(user.email, tournament.organizer_email)) return true;

  const creatorId = String(tournament.creator_id || "").trim();
  if (creatorId) {
    if (String(player?.id || "") === creatorId) return true;
    if (String(user.player_id || "") === creatorId) return true;
    if (String(user.id || "") === creatorId) return true;
  }

  return false;
}

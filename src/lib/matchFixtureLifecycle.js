const OFFICIAL_SOURCES = new Set([
  "regional_league",
  "regional_league_fixture",
  "competition",
  "competition_engine",
  "competition_fixture",
  "knockout",
]);

const PLAYER_MANAGED_SOURCES = new Set([
  "",
  "game_day",
  "gameday",
  "arranged_game",
  "ranked",
  "friendly",
]);

function norm(value) {
  return String(value || "").trim().toLowerCase();
}

function emailsEqual(a, b) {
  const left = norm(a);
  const right = norm(b);
  return Boolean(left && right && left === right);
}

function idsEqual(a, b) {
  return Boolean(a && b && String(a) === String(b));
}

export function isPlayerManagedMatch(match = {}) {
  if (!match?.id) return false;
  const tournamentId = norm(match.tournament_id);
  if (tournamentId && tournamentId !== "ranked") return false;
  const source = norm(match.source_fixture_type);
  if (OFFICIAL_SOURCES.has(source)) return false;
  if (source && !PLAYER_MANAGED_SOURCES.has(source)) return false;
  return true;
}

export function actorFromProfile({ user, player, club } = {}) {
  return {
    email: user?.email || player?.email || null,
    playerId: player?.id || user?.player_id || null,
    clubId: club?.id || player?.club_id || null,
    name: player?.gamertag || user?.email || "Player",
  };
}

function actorIsParticipant(match = {}, actor = {}) {
  if (idsEqual(actor.playerId, match.home_player_id) || idsEqual(actor.playerId, match.away_player_id)) return true;
  if (idsEqual(actor.clubId, match.home_club_id) || idsEqual(actor.clubId, match.away_club_id)) return true;
  if (emailsEqual(actor.email, match.home_player_email) || emailsEqual(actor.email, match.away_player_email)) return true;
  if (emailsEqual(actor.email, match.home_owner_email) || emailsEqual(actor.email, match.away_owner_email)) return true;
  return false;
}

function actorRequestedCancel(match = {}, actor = {}) {
  const requestedBy = norm(match.cancel_requested_by);
  if (!requestedBy) return false;
  return emailsEqual(requestedBy, actor.email)
    || idsEqual(requestedBy, actor.playerId)
    || idsEqual(requestedBy, actor.clubId);
}

function isCancellableMatchStatus(status) {
  const value = norm(status);
  return value === "scheduled" || value === "pending";
}

export function canRequestMatchCancel(match = {}, actor = {}) {
  if (!isPlayerManagedMatch(match)) return false;
  if (!isCancellableMatchStatus(match.status)) return false;
  if (!actorIsParticipant(match, actor)) return false;
  if (norm(match.cancel_status) === "pending") return false;
  return true;
}

export function canConfirmMatchCancel(match = {}, actor = {}) {
  if (!isPlayerManagedMatch(match)) return false;
  if (!isCancellableMatchStatus(match.status)) return false;
  if (!actorIsParticipant(match, actor)) return false;
  if (norm(match.cancel_status) !== "pending") return false;
  if (actorRequestedCancel(match, actor)) return false;
  return true;
}

export function canRequestMatchReschedule(match = {}, actor = {}) {
  return canRequestMatchCancel(match, actor);
}

export function isCancelPendingForActor(match = {}, actor = {}) {
  return norm(match.cancel_status) === "pending" && actorRequestedCancel(match, actor);
}

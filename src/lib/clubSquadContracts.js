import { getContractTargetPlayerId } from "./playerContractFields.js";

function normalizeRoles(rawRoles) {
  if (Array.isArray(rawRoles)) return rawRoles.filter(Boolean);
  if (typeof rawRoles !== "string" || !rawRoles.trim()) return [];
  try {
    const parsed = JSON.parse(rawRoles);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function getContractRole(contract, player) {
  if (contract?.contract_type === "ownership") return "president";
  if (Number(contract?.captaincy_offered || 0) === 1) return "captain";
  const role = String(player?.role || "").trim();
  return role && role !== "free_agent" ? role : "member";
}

export function mergeActiveContractPlayersIntoSquad(
  squadPlayers = [],
  contractRows = [],
  contractedPlayers = [],
  clubId,
) {
  const mergedById = new Map();
  for (const player of squadPlayers || []) {
    if (player?.id) mergedById.set(player.id, player);
  }

  const playersById = new Map();
  for (const player of contractedPlayers || []) {
    if (player?.id) playersById.set(player.id, player);
  }

  for (const contract of contractRows || []) {
    if (contract?.status !== "active") continue;
    if (String(contract?.team_id || "") !== String(clubId || "")) continue;
    const playerId = getContractTargetPlayerId(contract);
    if (!playerId || mergedById.has(playerId)) continue;

    const player = playersById.get(playerId);
    if (!player) continue;

    const primaryRole = getContractRole(contract, player);
    const existingRoles = normalizeRoles(player.club_roles).filter((role) => role !== "free_agent");
    const nextRoles = existingRoles.includes(primaryRole)
      ? existingRoles
      : [primaryRole, ...existingRoles];

    // Some legacy accept flows created the active contract but left players.club_id stale.
    // The active contract is still enough for the club squad to show the signed player.
    mergedById.set(playerId, {
      ...player,
      club_id: player.club_id || clubId,
      role: primaryRole,
      club_roles: nextRoles.length ? nextRoles : ["member"],
      status: player.status === "free_agent" ? "active" : (player.status || "active"),
    });
  }

  return [...mergedById.values()];
}

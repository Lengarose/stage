function isPlayerLike(value) {
  return Boolean(value && typeof value === "object" && value.id);
}

function normalizeExpiringEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  const player = isPlayerLike(entry.player) ? entry.player : isPlayerLike(entry) ? entry : null;
  if (!player) return null;
  return {
    player,
    contract: entry.contract || null,
    days_left: Number(entry.days_left ?? entry.daysLeft ?? 0),
  };
}

export function normalizeTransferMarketPlayers(payload = {}) {
  const freeAgents = Array.isArray(payload.free_agents)
    ? payload.free_agents.filter(isPlayerLike)
    : [];
  const expiringPlayers = Array.isArray(payload.expiring_players)
    ? payload.expiring_players.map(normalizeExpiringEntry).filter(Boolean)
    : [];
  return { freeAgents, expiringPlayers };
}

export function buildTransferMarketEntries(freeAgents = [], expiringPlayers = []) {
  const free = freeAgents
    .filter(isPlayerLike)
    .map((player) => ({ player, badgeType: "free_agent", contract: null, days_left: null }));
  const expiring = expiringPlayers
    .map(normalizeExpiringEntry)
    .filter(Boolean)
    .map(({ player, contract, days_left }) => ({
      player,
      badgeType: days_left <= 3 ? "expiring_soon" : "expiring",
      contract,
      days_left,
    }));
  return [...free, ...expiring];
}

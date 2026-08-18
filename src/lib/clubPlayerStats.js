function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalized(value) {
  return String(value || "").trim().toLowerCase();
}

function statBelongsToClub(stat, clubId) {
  if (!clubId) return true;
  return String(stat?.club_id || "") === String(clubId);
}

function makeEmptyStats() {
  return {
    matches: 0,
    goals: 0,
    assists: 0,
    avgRating: null,
  };
}

export function buildClubPlayerStatMap(players = [], statRows = [], clubId = null) {
  const statsByPlayerId = new Map();
  const playerIdByEmail = new Map();

  for (const player of players || []) {
    if (!player?.id) continue;
    statsByPlayerId.set(String(player.id), {
      ...makeEmptyStats(),
      _matchIds: new Set(),
      _rowCount: 0,
      _ratingSum: 0,
      _ratingCount: 0,
    });
    if (player.email) playerIdByEmail.set(normalized(player.email), String(player.id));
  }

  for (const stat of statRows || []) {
    if (!statBelongsToClub(stat, clubId)) continue;
    const playerId = stat?.player_id
      ? String(stat.player_id)
      : playerIdByEmail.get(normalized(stat?.player_email));
    if (!playerId || !statsByPlayerId.has(playerId)) continue;

    const playerStats = statsByPlayerId.get(playerId);
    if (stat.match_id) playerStats._matchIds.add(String(stat.match_id));
    else playerStats._rowCount += 1;
    playerStats.goals += number(stat.goals);
    playerStats.assists += number(stat.assists);

    const rating = number(stat.rating, 0);
    if (rating > 0) {
      playerStats._ratingSum += rating;
      playerStats._ratingCount += 1;
    }
  }

  for (const [playerId, playerStats] of statsByPlayerId.entries()) {
    const matches = playerStats._matchIds.size || playerStats._rowCount;
    statsByPlayerId.set(playerId, {
      matches,
      goals: playerStats.goals,
      assists: playerStats.assists,
      avgRating: playerStats._ratingCount > 0
        ? playerStats._ratingSum / playerStats._ratingCount
        : null,
    });
  }

  return statsByPlayerId;
}

export function getClubPlayerStats(statsByPlayerId, player) {
  if (!player?.id) return makeEmptyStats();
  return statsByPlayerId?.get(String(player.id)) || makeEmptyStats();
}

export function getClubStatValue(player, stat, statsByPlayerId) {
  const clubStats = getClubPlayerStats(statsByPlayerId, player);
  if (stat === "goals") return clubStats.goals;
  if (stat === "assists") return clubStats.assists;
  if (stat === "matches") return clubStats.matches;
  if (stat === "rating") return clubStats.avgRating || 0;
  return 0;
}

export function formatClubRating(value) {
  const rating = Number(value);
  if (!Number.isFinite(rating) || rating <= 0) return "--";
  return rating.toFixed(1);
}

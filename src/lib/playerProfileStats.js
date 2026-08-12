import { calculatePlayerValue, getValueTier } from "./playerValue.js";
import { parseJsonArray } from "./safeData.js";

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function positiveNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function pickStat(storedValue, derivedValue, fallback = 0) {
  return positiveNumber(storedValue) ?? positiveNumber(derivedValue) ?? fallback;
}

function buildPvpRecord(matches, playerId) {
  const record = { wins: 0, draws: 0, losses: 0 };
  if (!Array.isArray(matches) || !playerId) return record;

  for (const match of matches) {
    const homeScore = number(match?.home_score);
    const awayScore = number(match?.away_score);
    if (homeScore === awayScore) {
      record.draws += 1;
      continue;
    }
    const isHome = String(match?.home_player_id || "") === String(playerId);
    const won = isHome ? homeScore > awayScore : awayScore > homeScore;
    if (won) record.wins += 1;
    else record.losses += 1;
  }

  return record;
}

export function buildPlayerProfileStats({ player = {}, clubStats = null, pvpMatches = [], playerId = player?.id } = {}) {
  const playerFields = {
    ...player,
    matches_played: pickStat(player?.matches_played, clubStats?.matches),
    goals: pickStat(player?.goals, clubStats?.goals),
    assists: pickStat(player?.assists, clubStats?.assists),
    avg_match_rating: pickStat(player?.avg_match_rating, clubStats?.avgRating, 6),
    wins_count: number(player?.wins_count),
    losses_count: number(player?.losses_count),
    clean_sheets: number(player?.clean_sheets),
    man_of_the_match: number(player?.man_of_the_match),
  };
  const marketValue = calculatePlayerValue(playerFields);

  return {
    playerFields,
    marketValue,
    valueTier: getValueTier(marketValue),
    recentForm: parseJsonArray(player?.form_last10 || "[]")
      .map((rating) => Number(rating))
      .filter((rating) => Number.isFinite(rating)),
    pvpRecord: buildPvpRecord(pvpMatches, playerId),
  };
}

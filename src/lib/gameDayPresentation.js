import { isClubGameDayMatch } from "./gameDayResultFlow.js";

const HIDDEN_GAME_DAY_STATUSES = new Set(["forfeit", "cancelled", "canceled", "deleted"]);
const GAME_DAY_COMPLETED_MS = 24 * 60 * 60 * 1000;
const LIVE_GAME_DAY_STATUSES = new Set(["in_progress", "awaiting_confirmation", "disputed", "completed"]);

function isTournamentMatchWaitingForSchedule(match) {
  const tournamentId = String(match?.tournament_id || "").toLowerCase();
  if (!tournamentId || tournamentId === "ranked") return false;

  const status = String(match.status || "").toLowerCase();
  if (LIVE_GAME_DAY_STATUSES.has(status)) return false;

  const schedulingStatus = String(match.scheduling_status || "").toLowerCase();
  const hasConfirmedDate = Boolean(match.confirmed_date || match.scheduled_date);
  if (status === "scheduled" && !schedulingStatus && hasConfirmedDate) return false;

  return status !== "scheduled" || schedulingStatus !== "confirmed" || !hasConfirmedDate;
}

export function isActiveGameDayMatch(match, now = Date.now()) {
  if (!match?.id) return false;
  const status = String(match.status || "").toLowerCase();
  if (HIDDEN_GAME_DAY_STATUSES.has(status)) return false;
  if (isTournamentMatchWaitingForSchedule(match)) return false;
  if (status === "completed") {
    const updatedAt = match.updated_date ? new Date(match.updated_date) : null;
    if (!updatedAt || Number.isNaN(updatedAt.getTime())) return false;
    return now - updatedAt.getTime() < GAME_DAY_COMPLETED_MS;
  }
  return true;
}

export function getMatchSideNames(game, fallback = "TBD") {
  const isClub = isClubGameDayMatch(game);
  return {
    isClub,
    home: (isClub ? game?.home_club_name : game?.home_player_name) || fallback,
    away: (isClub ? game?.away_club_name : game?.away_player_name) || fallback,
  };
}

export function clubInitials(name, fallback = "?") {
  const trimmed = String(name || "").trim();
  if (!trimmed) return fallback;
  const parts = trimmed.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  const compact = trimmed.replace(/[^A-Za-z0-9]/g, "");
  return (compact.slice(0, 3) || fallback).toUpperCase();
}

export function pad2(value) {
  return String(Math.max(0, Number(value) || 0)).padStart(2, "0");
}

export function getKickoffCountdownParts(scheduledDate, now = new Date()) {
  if (!scheduledDate) return null;
  const date = scheduledDate instanceof Date ? scheduledDate : new Date(scheduledDate);
  if (Number.isNaN(date.getTime())) return null;
  const ms = date.getTime() - now.getTime();
  if (ms <= 0) {
    return { hours: 0, minutes: 0, seconds: 0, totalMs: ms, started: true };
  }
  const totalSeconds = Math.floor(ms / 1000);
  return {
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    totalMs: ms,
    started: false,
  };
}

export function formatBroadcastUnit(value) {
  if (value >= 100) return String(value);
  return pad2(value);
}

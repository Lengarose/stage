import { stageClient, resolveMyPlayerAndClub } from "@/api/stageClient";
import { getClubDashboard } from "@/lib/eafcClient";
import { loadActiveTournamentsWithProgress } from "@/lib/tournamentProgress";

import { getContractProgress, CONTRACT_TYPES } from "@/lib/contractTypes";
import { getContractType, normalizePlayerContracts } from "@/lib/playerContractFields";

const ACTIVE_MATCH_STATUSES = new Set(["scheduled", "live", "pending"]);
const COMPLETED_MATCH_STATUSES = new Set(["completed", "finished", "final"]);
const MS_DAY = 86400000;

function parseJsonList(val) {
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function dedupeById(rows) {
  const map = new Map();
  (rows || []).forEach((row) => {
    if (row?.id) map.set(row.id, row);
  });
  return Array.from(map.values());
}

export async function loadMyUpcomingMatches(player, club, limit = 6) {
  const filters = [];
  if (club?.id) {
    filters.push(
      stageClient.entities.Match.filter({ home_club_id: club.id }, "-scheduled_date", 50),
      stageClient.entities.Match.filter({ away_club_id: club.id }, "-scheduled_date", 50),
    );
  }
  if (player?.id) {
    filters.push(
      stageClient.entities.Match.filter({ home_player_id: player.id }, "-scheduled_date", 30),
      stageClient.entities.Match.filter({ away_player_id: player.id }, "-scheduled_date", 30),
    );
  }
  if (!filters.length) return [];

  const batches = await Promise.all(filters.map((p) => Promise.resolve(p).catch(() => [])));
  return dedupeById(batches.flat())
    .filter((m) => ACTIVE_MATCH_STATUSES.has(String(m.status || "").toLowerCase()))
    .sort((a, b) => new Date(a.scheduled_date || 0) - new Date(b.scheduled_date || 0))
    .slice(0, limit);
}

export function getMatchOpponent(match, player, club) {
  if (!match) return { home: "TBD", away: "TBD", isHome: true, opponent: "TBD" };
  const home = match.home_club_name || match.home_player_name || "TBD";
  const away = match.away_club_name || match.away_player_name || "TBD";

  const isHomeClub = club?.id && match.home_club_id === club.id;
  const isAwayClub = club?.id && match.away_club_id === club.id;
  const isHomePlayer = player?.id && match.home_player_id === player.id;
  const isAwayPlayer = player?.id && match.away_player_id === player.id;

  const isHome = isHomeClub || isHomePlayer;
  const opponent = isHome ? away : home;
  return { home, away, isHome, opponent };
}

export function findRankedEntry(rows, id) {
  if (!id || !rows?.length) return { rank: null, row: null };
  const idx = rows.findIndex((r) => r.id === id);
  return idx >= 0 ? { rank: idx + 1, row: rows[idx] } : { rank: null, row: null };
}

export async function loadActiveTournaments(player, club) {
  const tournaments = await stageClient.entities.Tournament.list("-created_date", 100).catch(() => []);
  const inactive = new Set(["completed", "cancelled", "deleted"]);

  return tournaments.filter((t) => {
    if (inactive.has(String(t.status || "").toLowerCase())) return false;
    const regPlayers = parseJsonList(t.registered_players);
    const regClubs = parseJsonList(t.registered_clubs);
    if (player?.id && regPlayers.includes(player.id)) return true;
    if (club?.id && regClubs.includes(club.id)) return true;
    return false;
  });
}

export async function loadClubLeagueStandings(club) {
  if (!club?.id) return [];

  const [standings, seasons] = await Promise.all([
    stageClient.entities.CompetitionStanding.filter({ club_id: club.id }, null, 50).catch(() => []),
    stageClient.entities.CompetitionSeason.list("-season_number", 30).catch(() => []),
  ]);

  const seasonMap = new Map(seasons.map((s) => [s.id, s]));
  const activeSeasonIds = new Set(
    seasons.filter((s) => String(s.status || "").toLowerCase() !== "completed").map((s) => s.id)
  );

  return standings
    .filter((s) => activeSeasonIds.has(s.season_id))
    .map((s) => {
      const season = seasonMap.get(s.season_id);
      return {
        ...s,
        season,
        label: season?.competition_name || season?.name || "League",
        position: s.position ?? s.rank ?? null,
      };
    })
    .sort((a, b) => (a.position || 999) - (b.position || 999));
}

export function daysSince(dateStr) {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / MS_DAY);
}

export function buildMatchTimeline(stats, limit = 12) {
  return [...(stats || [])]
    .sort((a, b) => new Date(a.created_date || 0) - new Date(b.created_date || 0))
    .slice(-limit)
    .map((s, i) => ({
      label: `M${i + 1}`,
      rating: parseFloat(Number(s.rating || 6).toFixed(1)),
      goals: Number(s.goals || 0),
      assists: Number(s.assists || 0),
      date: s.created_date,
    }));
}

export function buildWeeklyBuckets(stats, weeksBack = 8) {
  const buckets = [];
  const now = new Date();
  now.setHours(23, 59, 59, 999);

  for (let i = weeksBack - 1; i >= 0; i--) {
    const end = new Date(now);
    end.setDate(end.getDate() - i * 7);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    buckets.push({
      label: start.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
      start,
      end,
      matches: 0,
      goals: 0,
    });
  }

  (stats || []).forEach((s) => {
    const d = new Date(s.created_date || 0);
    const bucket = buckets.find((b) => d >= b.start && d <= b.end);
    if (bucket) {
      bucket.matches += 1;
      bucket.goals += Number(s.goals || 0);
    }
  });

  return buckets.map(({ label, matches, goals }) => ({ label, matches, goals }));
}

export function countMatchesInWindow(stats, days) {
  const cutoff = Date.now() - days * MS_DAY;
  return (stats || []).filter((s) => new Date(s.created_date || 0).getTime() >= cutoff).length;
}

export async function loadPlayerMatchStats(player) {
  if (!player?.email && !player?.id) return [];

  const filters = [];
  if (player.email) {
    filters.push(stageClient.entities.MatchPlayerStat.filter({ player_email: player.email }, "-created_date", 120));
  }
  if (player.id) {
    filters.push(stageClient.entities.MatchPlayerStat.filter({ player_id: player.id }, "-created_date", 120));
  }

  const batches = await Promise.all(filters.map((p) => Promise.resolve(p).catch(() => [])));
  const map = new Map();
  batches.flat().forEach((row) => {
    const key = row.id || `${row.match_id}-${row.player_email}`;
    map.set(key, row);
  });
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0)
  );
}

export async function loadActiveContract(player, club) {
  if (!player?.id) return null;

  const contracts = await stageClient.entities.PlayerContract.filter({ user_id: player.id }, "-created_date", 30).catch(() => []);
  const active = normalizePlayerContracts(contracts).find((c) => c.status === "active");
  if (!active) return null;

  const atCurrentClub = !club?.id || active.team_id === club.id;
  return atCurrentClub ? active : null;
}

export function buildTenureSummary({ user, player, club, activeContract }) {
  const memberSince = player?.created_date || user?.created_date || null;
  const contractProgress = activeContract ? getContractProgress(activeContract) : null;
  const contractMeta = activeContract ? CONTRACT_TYPES[getContractType(activeContract)] : null;
  const clubSince = activeContract?.start_date || (player?.club_id && club ? player.updated_date : null);

  return {
    memberSince,
    daysOnPlatform: daysSince(memberSince),
    clubSince: activeContract?.start_date || clubSince,
    daysAtClub: daysSince(activeContract?.start_date || clubSince),
    activeContract,
    contractProgress,
    contractLabel: contractMeta?.label || activeContract?.contract_type || null,
  };
}

function normalizeGamertag(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findEafcMember(members, gamertag) {
  const target = normalizeGamertag(gamertag);
  if (!target) return null;
  return (members || []).find((m) => {
    const name = normalizeGamertag(m.name || m.playername || m.playerName);
    return name && (name === target || name.includes(target) || target.includes(name));
  }) || null;
}

export function matchOutcomeForPlayer(match, player, club) {
  if (!match) return null;
  const homeScore = Number(match.home_score);
  const awayScore = Number(match.away_score);
  if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) return null;

  const isHomeClub = club?.id && match.home_club_id === club.id;
  const isAwayClub = club?.id && match.away_club_id === club.id;
  const isHomePlayer = player?.id && match.home_player_id === player.id;
  const isAwayPlayer = player?.id && match.away_player_id === player.id;
  const isHome = isHomeClub || isHomePlayer;

  const myScore = isHome ? homeScore : awayScore;
  const theirScore = isHome ? awayScore : homeScore;
  if (myScore > theirScore) return "win";
  if (myScore < theirScore) return "loss";
  return "draw";
}

export async function loadRecentCompletedMatches(player, club, limit = 10) {
  const filters = [];
  if (club?.id) {
    filters.push(
      stageClient.entities.Match.filter({ home_club_id: club.id }, "-scheduled_date", 40),
      stageClient.entities.Match.filter({ away_club_id: club.id }, "-scheduled_date", 40),
    );
  }
  if (player?.id) {
    filters.push(
      stageClient.entities.Match.filter({ home_player_id: player.id }, "-scheduled_date", 30),
      stageClient.entities.Match.filter({ away_player_id: player.id }, "-scheduled_date", 30),
    );
  }
  if (!filters.length) return [];

  const batches = await Promise.all(filters.map((p) => Promise.resolve(p).catch(() => [])));
  return dedupeById(batches.flat())
    .filter((m) => COMPLETED_MATCH_STATUSES.has(String(m.status || "").toLowerCase()))
    .sort((a, b) => new Date(b.scheduled_date || b.updated_date || 0) - new Date(a.scheduled_date || a.updated_date || 0))
    .slice(0, limit);
}

export function buildStageFormStrip(matches, player, club, limit = 10) {
  return [...(matches || [])]
    .slice(0, limit)
    .reverse()
    .map((m) => matchOutcomeForPlayer(m, player, club))
    .filter(Boolean);
}

export function buildRatingFormStrip(stats, limit = 10) {
  return [...(stats || [])]
    .sort((a, b) => new Date(a.created_date || 0) - new Date(b.created_date || 0))
    .slice(-limit)
    .map((s) => parseFloat(Number(s.rating || 6).toFixed(1)));
}

export async function loadDashboardGlance(player, user) {
  const email = player?.email || user?.email;
  if (!email) {
    return {
      stc: Number(player?.stc || 0),
      credits: Number(player?.credits || 0),
      unreadInbox: 0,
      unreadNotifications: 0,
      recentInbox: [],
    };
  }

  const [inbox, notifications] = await Promise.all([
    stageClient.entities.InboxMessage.filter({ recipient_email: email }, "-created_date", 50).catch(() => []),
    stageClient.entities.Notification.filter({ recipient_email: email }, "-created_date", 30).catch(() => []),
  ]);

  const unreadInbox = inbox.filter((m) => !m.is_read);
  const unreadNotifications = notifications.filter((n) => !(n.read || n.is_read));

  return {
    stc: Number(player?.stc || 0),
    credits: Number(player?.credits || 0),
    unreadInbox: unreadInbox.length,
    unreadNotifications: unreadNotifications.length,
    recentInbox: unreadInbox.slice(0, 3),
  };
}

export async function loadEafcSummary(player) {
  if (!player?.eafc_club_id) return null;
  try {
    const dash = await getClubDashboard(player.eafc_club_id, player.platform);
    const season = dash.club?.seasons?.[0] || dash.stats || {};
    const member = findEafcMember(dash.members, player.gamertag);
    return {
      clubId: player.eafc_club_id,
      clubName: player.eafc_club_name || dash.club?.name || "Pro Club",
      wins: Number(season.wins ?? season.win ?? 0),
      draws: Number(season.ties ?? season.draws ?? 0),
      losses: Number(season.losses ?? season.loss ?? 0),
      members: dash.members?.length ?? 0,
      recentMatches: (dash.matches || []).slice(0, 3),
      memberStats: member
        ? {
            name: member.name || member.playername || player.gamertag,
            gamesPlayed: Number(member.gamesPlayed ?? member.gamesplayed ?? 0),
            goals: Number(member.goals ?? 0),
            assists: Number(member.assists ?? 0),
            rating: Number(member.rating ?? member.avgrating ?? 0),
          }
        : null,
    };
  } catch {
    return {
      clubId: player.eafc_club_id,
      clubName: player.eafc_club_name || "Pro Club",
      error: true,
    };
  }
}

export async function loadPlayerDashboard() {
  const rankingsPromise = stageClient.http.get("/rankings/summary").catch(() => ({ players: [], clubs: [] }));

  const { user, player, club } = await resolveMyPlayerAndClub().catch(() => ({
    user: null,
    player: null,
    club: null,
  }));

  const [rankings, upcomingMatches, activeTournaments, leagueStandings, matchStats, activeContract, recentCompleted, glance] = await Promise.all([
    rankingsPromise,
    loadMyUpcomingMatches(player, club, 6),
    loadActiveTournamentsWithProgress(player, club),
    loadClubLeagueStandings(club),
    loadPlayerMatchStats(player),
    loadActiveContract(player, club),
    loadRecentCompletedMatches(player, club, 10),
    loadDashboardGlance(player, user),
  ]);

  const playerRank = findRankedEntry(rankings.players, player?.id);
  const clubRank = findRankedEntry(rankings.clubs, club?.id);

  const activity = {
    stats: matchStats,
    timeline: buildMatchTimeline(matchStats, 12),
    weekly: buildWeeklyBuckets(matchStats, 8),
    matchesThisWeek: countMatchesInWindow(matchStats, 7),
    matchesThisMonth: countMatchesInWindow(matchStats, 30),
    totalRecorded: matchStats.length,
  };

  const tenure = buildTenureSummary({ user, player, club, activeContract });
  const stageForm = buildStageFormStrip(recentCompleted, player, club, 10);
  const ratingForm = buildRatingFormStrip(matchStats, 10);

  return {
    user,
    player,
    club,
    rankings,
    playerRank,
    clubRank,
    upcomingMatches,
    nextMatch: upcomingMatches[0] || null,
    activeTournaments,
    leagueStandings,
    activity,
    tenure,
    glance,
    form: {
      stage: stageForm,
      rating: ratingForm,
    },
  };
}

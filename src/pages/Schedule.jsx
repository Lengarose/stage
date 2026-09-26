import { useState, useEffect } from "react";
import { stageClient, resolveMyPlayerAndClub } from "@/api/stageClient";
import { cn } from "@/lib/utils";
import ScheduleList from "../components/schedule/ScheduleList";
import MatchDetail from "../components/schedule/MatchDetail";
import { CalendarDays, X, List } from "lucide-react";
import ScheduleCalendar from "../components/schedule/ScheduleCalendar";
import { CHANNELS, setSocketListeners, offSocketListeners } from "@/lib/SocketContext";
import { getContractTargetPlayerId } from "@/lib/playerContractFields";
import { useTranslation } from "@/hooks/useTranslation";

export default function Schedule({ tournamentId: scopedTournamentId } = {}) {
  const { t } = useTranslation();
  const [user, setUser] = useState(null);
  const [myPlayer, setMyPlayer] = useState(null);
  const [myClub, setMyClub] = useState(null);
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("calendar"); // "fixtures" | "calendar"
  const [allPlayers, setAllPlayers] = useState([]);

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    let reloadTimer = null;
    const onMatchUpdate = () => {
      if (reloadTimer) window.clearTimeout(reloadTimer);
      reloadTimer = window.setTimeout(() => {
        load();
      }, 120);
    };
    setSocketListeners(CHANNELS.MATCH, onMatchUpdate);
    return () => {
      if (reloadTimer) window.clearTimeout(reloadTimer);
      offSocketListeners(CHANNELS.MATCH, onMatchUpdate);
    };
  }, []);

  async function load() {
    setLoading(true);
    const { user: u, player, club } = await resolveMyPlayerAndClub();
    setUser(u || null);
    setMyPlayer(player || null);
    if (club) setMyClub(club);
    else setMyClub(null);

    const [tournaments, contracts, gostFixtures, regionalFixtures] = await Promise.all([
      stageClient.entities.Tournament.list("-created_date", 100).catch(() => []),
      u ? stageClient.entities.PlayerContract.list("-created_date", 50).catch(() => []) : Promise.resolve([]),
      stageClient.entities.CompetitionFixture
        ? stageClient.entities.CompetitionFixture.list("-created_date", 500).catch(() => [])
        : Promise.resolve([]),
      stageClient.entities.RegionalLeagueFixture
        ? stageClient.entities.RegionalLeagueFixture.list("-created_date", 300).catch(() => [])
        : Promise.resolve([]),
    ]);

    let clubPlayers = [];
    if (club) {
      clubPlayers = await stageClient.entities.Player.filter({ club_id: club.id }).catch(() => []);
    }
    setAllPlayers(clubPlayers);

    // Gather all matches relevant to user (club or player)
    const matchFilters = [];
    if (club?.id) {
      matchFilters.push(
        stageClient.entities.Match.filter({ home_club_id: club.id }, "-scheduled_date", 50),
        stageClient.entities.Match.filter({ away_club_id: club.id }, "-scheduled_date", 50),
      );
    }
    if (player?.id) {
      matchFilters.push(
        stageClient.entities.Match.filter({ home_player_id: player.id }, "-scheduled_date", 30),
        stageClient.entities.Match.filter({ away_player_id: player.id }, "-scheduled_date", 30),
      );
    }

    const matchArrays = matchFilters.length
      ? await Promise.all(matchFilters.map((p) => Promise.resolve(p).catch(() => [])))
      : [];
    const allMatches = matchArrays.flat();

    // Deduplicate by id
    const matchMap = new Map();
    allMatches.forEach(m => matchMap.set(m.id, m));
    const matches = Array.from(matchMap.values());

    // Build tournament lookup
    const tournamentMap = new Map((tournaments || []).map(t => [t.id, t]));

    // Build match player stat lookup for ratings
    const matchIds = matches.map(m => m.id);

    // Fetch stats for all matches (batch)
    let allStats = [];
    if (player?.email && matchIds.length > 0) {
      allStats = await stageClient.entities.MatchPlayerStat.filter({ player_email: player.email }, "-created_date", 200).catch(() => []);
    }
    const statsByMatch = new Map(allStats.map(s => [s.match_id, s]));

    // Collect unique player IDs from solo matches so we can fetch avatars
    const soloPlayerIds = new Set();
    matches.forEach(m => {
      if (!m.mode || m.mode === "solo") {
        if (m.home_player_id) soloPlayerIds.add(m.home_player_id);
        if (m.away_player_id) soloPlayerIds.add(m.away_player_id);
      }
    });
    // Collect unique club IDs for logo lookup
    const clubIds = new Set();
    matches.forEach(m => {
      if (m.home_club_id) clubIds.add(m.home_club_id);
      if (m.away_club_id) clubIds.add(m.away_club_id);
    });

    // Fetch player avatars and club logos in parallel
    const [soloPlayersData, clubsData] = await Promise.all([
      soloPlayerIds.size > 0
        ? Promise.all([...soloPlayerIds].map(pid => stageClient.entities.Player.get(pid).catch(() => null))).then(r => r.filter(Boolean))
        : Promise.resolve([]),
      clubIds.size > 0
        ? Promise.all([...clubIds].map(cid => stageClient.entities.Club.filter({ id: cid }).catch(() => []))).then(r => r.flat())
        : Promise.resolve([]),
    ]);
    const playerAvatarMap = new Map(soloPlayersData.map(p => [p.id, p.avatar_url]));
    const clubLogoMap = new Map(clubsData.map(c => [c.id, c.logo_url]));

    // Build schedule events from matches
    const matchEvents = matches.map(m => {
      const tournament = tournamentMap.get(m.tournament_id);
      const competition = deriveCompetition(m, tournament, t);
      // Determine home/away and opposition — handle both club matches and solo (PvP) matches
      const isSoloMatch = m.mode === "solo" || (!m.home_club_id && !m.away_club_id);
      const isHome = isSoloMatch
        ? m.home_player_id === player?.id
        : club
          ? m.home_club_id === club.id
          : m.home_player_id === player?.id;
      const opposition = isSoloMatch
        ? (isHome ? (m.away_player_name || t("matchFlow.unknown")) : (m.home_player_name || t("matchFlow.unknown")))
        : club
          ? (isHome ? (m.away_club_name || m.away_player_name) : (m.home_club_name || m.home_player_name))
          : (isHome ? (m.away_player_name || m.away_club_name) : (m.home_player_name || m.home_club_name));
      const venue = isHome ? t("matchFlow.home") : t("matchFlow.away");
      const result = getResult(m, club, player);
      const stats = statsByMatch.get(m.id) || null;

      // Avatar/logo for home and away
      const homeAvatarUrl = m.home_club_id
        ? clubLogoMap.get(m.home_club_id)
        : playerAvatarMap.get(m.home_player_id);
      const awayAvatarUrl = m.away_club_id
        ? clubLogoMap.get(m.away_club_id)
        : playerAvatarMap.get(m.away_player_id);

      return {
        id: m.id,
        type: "match",
        source: "match",
        date: m.scheduled_date || m.created_date,
        opposition,
        venue,
        venueKey: isHome ? "home" : "away",
        result,
        competition,
        competitionSlug: resolveCompetitionSlug(m, tournament, competition),
        homeName: m.home_club_name || m.home_player_name || "TBD",
        awayName: m.away_club_name || m.away_player_name || "TBD",
        status: m.status,
        matchData: m,
        tournament,
        playerStats: stats,
        isHome,
        homeAvatarUrl,
        awayAvatarUrl,
      };
    });

    // GOST fixtures — only confrontations involving the user's club
    const myClubId = club?.id != null ? String(club.id) : null;
    const gostEvents = (gostFixtures || [])
      .filter((f) => {
        if (!myClubId) return false;
        return String(f.home_club_id) === myClubId || String(f.away_club_id) === myClubId;
      })
      .map((f) => {
      const slug = String(f.competition_slug || "").toLowerCase();
      const competitionName = f.competition_name
        || (slug === "supreme" ? "STAGE Supreme League"
          : slug === "elite" ? "STAGE Elite League"
            : slug === "challenger" ? "STAGE Challenger League"
              : "GOST");
      const played = String(f.status || "").toLowerCase() === "played"
        || (f.home_score != null && f.away_score != null);
      const isHome = String(f.home_club_id) === myClubId;
      return {
        id: `gost-${f.id}`,
        type: "match",
        source: "gost",
        date: f.confirmed_date || f.scheduled_date || f.window_start || f.home_proposed_date || f.away_proposed_date || null,
        opposition: isHome ? (f.away_club_name || "TBD") : (f.home_club_name || "TBD"),
        venue: isHome ? "Home" : "Away",
        venueKey: isHome ? "home" : "away",
        result: played ? { display: `${f.home_score}–${f.away_score}`, outcome: null } : null,
        competition: competitionName,
        competitionSlug: slug || resolveCompetitionSlug(f, null, competitionName),
        homeName: f.home_club_name || "TBD",
        awayName: f.away_club_name || "TBD",
        homeScore: f.home_score,
        awayScore: f.away_score,
        matchday: f.matchday,
        status: f.status || f.scheduling_status || "scheduled",
        matchData: null,
        fixtureData: f,
        isHome,
      };
    });

    // Regional league fixtures — only leagues / confrontations involving the user's club
    const regionalEvents = (regionalFixtures || [])
      .filter((f) => {
        if (!myClubId) return false;
        return String(f.home_club_id) === myClubId || String(f.away_club_id) === myClubId;
      })
      .map((f) => {
      const played = String(f.status || "").toLowerCase() === "played"
        || (f.home_score != null && f.away_score != null);
      const isHome = String(f.home_club_id) === myClubId;
      return {
        id: `rl-${f.id}`,
        type: "match",
        source: "regional",
        date: f.confirmed_date || f.scheduled_date || f.window_start || null,
        opposition: isHome ? (f.away_club_name || "TBD") : (f.home_club_name || "TBD"),
        venue: isHome ? "Home" : "Away",
        venueKey: isHome ? "home" : "away",
        result: played ? { display: `${f.home_score}–${f.away_score}`, outcome: null } : null,
        competition: f.league_name || f.competition_name || "Regional League",
        competitionSlug: null,
        homeName: f.home_club_name || "TBD",
        awayName: f.away_club_name || "TBD",
        homeScore: f.home_score,
        awayScore: f.away_score,
        matchday: f.matchday,
        status: f.status || f.scheduling_status || "scheduled",
        matchData: null,
        fixtureData: f,
        isHome,
      };
    });
    // Contract reminder events
    const contractEvents = [];
    const today = new Date();
    const myContracts = (contracts || []).filter(c =>
      (getContractTargetPlayerId(c) === player?.id || c.team_id === club?.id) && c.status === "active"
    );
    myContracts.forEach(c => {
      const gamesLeft = c.max_games - (c.games_played || 0);
      const endDate = c.end_date ? new Date(c.end_date) : null;
      const daysLeft = endDate ? Math.ceil((endDate - today) / (1000 * 60 * 60 * 24)) : null;

      const isExpiring = (gamesLeft !== null && gamesLeft <= 10) || (daysLeft !== null && daysLeft <= 14);

      if (endDate) {
        contractEvents.push({
          id: `contract-end-${c.id}`,
          type: "contract_end",
          date: c.end_date,
          competition: t("matchFlow.contract"),
          opposition: "",
          venue: "",
          result: null,
          status: "contract",
          contractData: c,
        });
      }
      if (isExpiring) {
        contractEvents.push({
          id: `contract-reminder-${c.id}`,
          type: "contract_reminder",
          date: today.toISOString(),
          competition: t("matchFlow.contract"),
          opposition: "",
          venue: "",
          result: null,
          status: "reminder",
          contractData: c,
          gamesLeft,
          daysLeft,
        });
      }
    });

    // Tournament calendar events — only for tournaments the user's club is registered in
    const tournamentEvents = [];
    if (club?.id) {
      (tournaments || []).forEach(tr => {
        if (tr.start_date && (tr.registered_clubs || []).includes(club.id)) {
          tournamentEvents.push({
            id: `tournament-start-${tr.id}`,
            type: "tournament_start",
            date: tr.start_date,
            competition: tr.name,
            opposition: "",
            venue: "",
            result: null,
            status: "tournament",
            tournamentData: tr,
          });
        }
      });
    }

    // When scoped to a specific tournament, only show matches for that tournament
    // and the tournament's own calendar event; drop unrelated contracts/events.
    const scopedMatchEvents = scopedTournamentId
      ? matchEvents.filter(e => e.matchData?.tournament_id === scopedTournamentId)
      : matchEvents;
    const scopedGostEvents = scopedTournamentId ? [] : gostEvents;
    const scopedRegionalEvents = scopedTournamentId ? [] : regionalEvents;
    const scopedContractEvents = scopedTournamentId ? [] : contractEvents;
    const scopedTournamentEvents = scopedTournamentId
      ? tournamentEvents.filter(e => e.tournamentData?.id === scopedTournamentId)
      : tournamentEvents;

    // Prefer GOST fixture rows when the same confrontation also exists as a Match
    const gostKeys = new Set(
      scopedGostEvents.map((e) => `${e.homeName}|${e.awayName}|${String(e.date || "").slice(0, 10)}`)
    );
    const dedupedMatches = scopedMatchEvents.filter((e) => {
      if (e.competitionSlug && ["supreme", "elite", "challenger"].includes(e.competitionSlug)) {
        const key = `${e.homeName}|${e.awayName}|${String(e.date || "").slice(0, 10)}`;
        if (gostKeys.has(key)) return false;
      }
      return true;
    });

    // Merge and sort all events by date descending (most recent first)
    const all = [
      ...dedupedMatches,
      ...scopedGostEvents,
      ...scopedRegionalEvents,
      ...scopedContractEvents,
      ...scopedTournamentEvents,
    ].sort((a, b) => {
      const da = a.date ? new Date(a.date) : new Date(0);
      const db = b.date ? new Date(b.date) : new Date(0);
      return db - da;
    });

    setEvents(all);
    setLoading(false);
  }

  return (
    <div className={cn(
      view === "calendar"
        ? "flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background p-0"
        : "min-h-screen overflow-y-auto bg-background p-4 lg:p-8"
    )}>
      {view === "calendar" ? (
        <div className="flex h-full min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-background px-3 py-2 sm:px-4">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              <h1 className="font-heading text-xl font-black uppercase tracking-wide text-foreground sm:text-2xl">
                {t("matchFlow.scheduleTitle")}
              </h1>
            </div>
            <div className="flex items-center rounded-lg border border-border bg-secondary p-0.5">
              <button
                type="button"
                onClick={() => setView("fixtures")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all",
                  "text-muted-foreground hover:text-foreground"
                )}
              >
                <List className="w-3.5 h-3.5" />
                {t("matchFlow.fixtures")}
              </button>
              <button
                type="button"
                onClick={() => setView("calendar")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all",
                  "bg-primary text-primary-foreground shadow"
                )}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                {t("matchFlow.calendar")}
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
            </div>
          ) : (
            <div className="min-h-0 flex-1">
              <ScheduleCalendar
                events={events}
                myPlayer={myPlayer}
                myClub={myClub}
                players={allPlayers}
                fullScreen
              />
            </div>
          )}
        </div>
      ) : (
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <CalendarDays className="w-6 h-6 text-primary" />
            <div>
              <h1
                className="font-heading font-black text-5xl md:text-6xl text-foreground uppercase"
                style={{ transform: "skewX(-8deg)", letterSpacing: "-0.02em", transformOrigin: "left center" }}
              >
                {t("matchFlow.scheduleTitle")}
              </h1>
              <p className="text-xs text-muted-foreground mt-2">
                {scopedTournamentId ? t("matchFlow.scheduleSubtitleTournament") : t("matchFlow.scheduleSubtitleAll")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            {/* View toggle */}
            <div className="flex items-center bg-secondary border border-border rounded-lg p-0.5">
              <button
                onClick={() => setView("fixtures")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                  view === "fixtures"
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <List className="w-3.5 h-3.5" />
                {t("matchFlow.fixtures")}
              </button>
              <button
                onClick={() => setView("calendar")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                  view === "calendar"
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                {t("matchFlow.calendar")}
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-32">
            <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Desktop: dual-column layout */}
            <div className="hidden lg:grid lg:grid-cols-[1fr_380px] gap-4">
              <ScheduleList
                events={events.filter(e => e.type !== "tournament_start")}
                selectedId={selectedEvent?.id}
                onSelect={setSelectedEvent}
              />
              <div className="lg:sticky lg:top-6 lg:self-start">
                <MatchDetail event={selectedEvent} myPlayer={myPlayer} myClub={myClub} />
              </div>
            </div>

            {/* Mobile/Tablet: list only, detail as slide-up panel */}
            <div className="lg:hidden">
              <ScheduleList
                events={events.filter(e => e.type !== "tournament_start")}
                selectedId={selectedEvent?.id}
                onSelect={setSelectedEvent}
              />
            </div>

            {/* Mobile slide-up detail panel */}
            {selectedEvent && (
              <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
                {/* Backdrop */}
                <div
                  className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                  onClick={() => setSelectedEvent(null)}
                />
                {/* Panel */}
                <div className="relative bg-background rounded-t-2xl shadow-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
                  {/* Drag handle + close */}
                  <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-border shrink-0">
                    <div className="w-10 h-1 rounded-full bg-border mx-auto absolute left-1/2 -translate-x-1/2 top-2" />
                    <span className="text-sm font-semibold text-foreground">{t("matchFlow.matchDetails")}</span>
                    <button
                      onClick={() => setSelectedEvent(null)}
                      className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {/* Scrollable detail content */}
                  <div className="overflow-y-auto flex-1 p-4">
                    <MatchDetail event={selectedEvent} myPlayer={myPlayer} myClub={myClub} />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      )}
    </div>
  );
}

function deriveCompetition(match, tournament, t) {
  // Arranged games have no real tournament. Keep "ranked" support for legacy rows.
  if (!tournament || match.tournament_id === "ranked") {
    return t("matchFlow.rankedMatch");
  }
  if (tournament.type === "knockout") return `${tournament.name} · ${t("matchFlow.knockout")}`;
  if (tournament.type === "league") return `${tournament.name} · ${t("matchFlow.leagueFormat")}`;
  if (tournament.type === "group_stage") return `${tournament.name} · ${t("matchFlow.groupStage")}`;
  if (tournament.type === "swiss" || tournament.type === "swiss_ucl") return `${tournament.name} · ${t("matchFlow.swiss")}`;
  if (tournament.type === "double_elimination") return `${tournament.name} · ${t("matchFlow.doubleElim")}`;
  return tournament.name || t("matchFlow.tournament");
}

function resolveCompetitionSlug(row = {}, tournament = null, competitionLabel = "") {
  const raw = String(row.competition_slug || row.slug || tournament?.competition_slug || "").toLowerCase().trim();
  if (["supreme", "elite", "challenger"].includes(raw)) return raw;
  const name = String(competitionLabel || row.competition_name || tournament?.name || "").toLowerCase();
  if (name.includes("supreme")) return "supreme";
  if (name.includes("elite")) return "elite";
  if (name.includes("challenger")) return "challenger";
  return null;
}

function getResult(match, club, player) {
  if (match.status !== "completed" && match.status !== "awaiting_confirmation") return null;
  const homeScore = match.home_score ?? 0;
  const awayScore = match.away_score ?? 0;
  const isSolo = match.mode === "solo" || (!match.home_club_id && !match.away_club_id);
  const isHome = isSolo
    ? match.home_player_id === player?.id
    : club
      ? match.home_club_id === club?.id
      : match.home_player_id === player?.id;
  const myScore = isHome ? homeScore : awayScore;
  const theirScore = isHome ? awayScore : homeScore;
  const outcome = myScore > theirScore ? "W" : myScore < theirScore ? "L" : "D";
  return { outcome, myScore, theirScore, display: `${myScore}–${theirScore}` };
}

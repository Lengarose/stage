import { useState, useEffect } from "react";
import { stageClient, resolveMyPlayerAndClub } from "@/api/stageClient";
import { cn } from "@/lib/utils";
import ScheduleList from "../components/schedule/ScheduleList";
import MatchDetail from "../components/schedule/MatchDetail";
import { CalendarDays, List } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ScheduleCalendar from "../components/schedule/ScheduleCalendar";
import { CHANNELS, setSocketListeners, offSocketListeners } from "@/lib/SocketContext";
import { getContractTargetPlayerId } from "@/lib/playerContractFields";
import { useTranslation } from "@/hooks/useTranslation";
import { scheduleResult as getResult } from '@/lib/scheduleResult';

export default function Schedule({ tournamentId: scopedTournamentId } = {}) {
  const { t } = useTranslation();
  const [myPlayer, setMyPlayer] = useState(null);
  const [myClub, setMyClub] = useState(null);
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia("(max-width: 1023px)").matches);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 1023px)");
    const update = () => setIsMobile(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const [view, setView] = useState("calendar"); // "fixtures" | "calendar"

  useEffect(() => {
    if (view === 'fixtures') load();
  }, [view, scopedTournamentId]);

  useEffect(() => {
    let reloadTimer = null;
    const onMatchUpdate = () => {
      if (view !== 'fixtures') return;
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
  }, [view, scopedTournamentId]);

  async function load() {
    setLoading(true);
    const { user: u, player, club } = await resolveMyPlayerAndClub();
    setMyPlayer(player || null);
    if (club) setMyClub(club);
    else setMyClub(null);

    const [tournaments, contracts, gostFixtures, regionalFixtures, cupCatalogue] = await Promise.all([
      stageClient.entities.Tournament.list("-created_date", 100).catch(() => []),
      u ? stageClient.entities.PlayerContract.list("-created_date", 50).catch(() => []) : Promise.resolve([]),
      stageClient.entities.CompetitionFixture
        ? stageClient.entities.CompetitionFixture.list("-created_date", 500).catch(() => [])
        : Promise.resolve([]),
      stageClient.entities.RegionalLeagueFixture
        ? stageClient.entities.RegionalLeagueFixture.list("-created_date", 300).catch(() => [])
        : Promise.resolve([]),
      stageClient.http.get('/regional-leagues/cups/public').catch(() => ({ cups: [] })),
    ]);

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
    [...matches, ...(gostFixtures || []), ...(regionalFixtures || [])].forEach(m => {
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
    const clubPhotoMap = new Map(clubsData.map(c => [c.id, { position: c.logo_position, zoom: c.logo_zoom, isClub: true }]));
    const playerPhotoMap = new Map(soloPlayersData.map(p => [p.id, { position: p.avatar_position, zoom: p.avatar_zoom }]));

    // Build schedule events from matches
    const cupByMatch = new Map((cupCatalogue.cups || []).flatMap(cup => cup.rounds.flatMap(round => round.matches.map(match => [match.id, cup]))));
    const matchEvents = matches.map(m => {
      const cup = cupByMatch.get(m.id);
      const tournament = tournamentMap.get(m.tournament_id);
      const competition = cup?.name || deriveCompetition(m, tournament, t);
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
        competitionSlug: cup ? 'regional_cup' : resolveCompetitionSlug(m, tournament, competition),
        competitionHref: cup ? `/leagues?view=cups&edition=${encodeURIComponent(cup.id)}` : null,
        homeName: m.home_club_name || m.home_player_name || "TBD",
        awayName: m.away_club_name || m.away_player_name || "TBD",
        status: m.status,
        matchData: m,
        tournament,
        playerStats: stats,
        isHome,
        homeAvatarUrl,
        awayAvatarUrl,
        homePhoto: m.home_club_id ? clubPhotoMap.get(m.home_club_id) : playerPhotoMap.get(m.home_player_id),
        awayPhoto: m.away_club_id ? clubPhotoMap.get(m.away_club_id) : playerPhotoMap.get(m.away_player_id),
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
      const result = getResult(f,club,player);
      const isHome = String(f.home_club_id) === myClubId;
      return {
        id: `gost-${f.id}`,
        type: "match",
        source: "gost",
        date: f.confirmed_date || f.scheduled_date || f.window_start || f.home_proposed_date || f.away_proposed_date || null,
        opposition: isHome ? (f.away_club_name || "TBD") : (f.home_club_name || "TBD"),
        venue: isHome ? "Home" : "Away",
        venueKey: isHome ? "home" : "away",
        result,
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
        homeAvatarUrl: clubLogoMap.get(f.home_club_id),
        awayAvatarUrl: clubLogoMap.get(f.away_club_id),
        homePhoto: clubPhotoMap.get(f.home_club_id),
        awayPhoto: clubPhotoMap.get(f.away_club_id),
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
      const result = getResult(f,club,player);
      const isHome = String(f.home_club_id) === myClubId;
      return {
        id: `rl-${f.id}`,
        type: "match",
        source: "regional",
        date: f.confirmed_date || f.scheduled_date || f.window_start || null,
        opposition: isHome ? (f.away_club_name || "TBD") : (f.home_club_name || "TBD"),
        venue: isHome ? "Home" : "Away",
        venueKey: isHome ? "home" : "away",
        result,
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
        homeAvatarUrl: clubLogoMap.get(f.home_club_id),
        awayAvatarUrl: clubLogoMap.get(f.away_club_id),
        homePhoto: clubPhotoMap.get(f.home_club_id),
        awayPhoto: clubPhotoMap.get(f.away_club_id),
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
    <div className="h-full min-h-0 min-w-0 flex-1 overflow-y-auto bg-background p-4 lg:p-8">
      <div className="mx-auto w-full min-w-0 max-w-[1600px]">
        <div className="flex flex-wrap items-center justify-between gap-5 border-b border-border pb-5">
          <div>
            <h1 className="font-heading text-4xl font-black uppercase tracking-normal text-foreground sm:text-5xl">{t("matchFlow.scheduleTitle")}</h1>
            <p className="mt-2 text-xs text-muted-foreground">{scopedTournamentId ? t("matchFlow.scheduleSubtitleTournament") : t("matchFlow.scheduleSubtitleAll")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-5" aria-label="Schedule view">
            {[{ key: "fixtures", Icon: List, label: t("matchFlow.fixtures") }, { key: "calendar", Icon: CalendarDays, label: t("matchFlow.calendar") }].map(({key, Icon, label}) => (
              <button type="button" key={key} onClick={() => setView(key)} aria-pressed={view === key}
                className={cn("flex min-h-11 items-center gap-2 rounded-none border border-transparent bg-transparent px-2 text-sm font-semibold uppercase tracking-wider transition-all hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary", view === key ? "text-foreground [text-shadow:0_0_16px_rgba(110,200,255,0.7)]" : "text-muted-foreground")}
              ><Icon className="h-4 w-4" />{label}</button>
            ))}
          </div>
        </div>
        {view === "calendar" ? <ScheduleCalendar tournamentId={scopedTournamentId} /> : loading ? (
          <div className="flex justify-center py-32"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/20 border-t-primary" /></div>
        ) : (
          <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px]">
            <ScheduleList events={events.filter(e => e.type !== "tournament_start")} selectedId={selectedEvent?.id} onSelect={setSelectedEvent} />
            <aside className="hidden min-w-0 self-start lg:sticky lg:top-6 lg:block">
              <MatchDetail event={selectedEvent} myPlayer={myPlayer} myClub={myClub} />
            </aside>
          </div>
        )}
        {view === "fixtures" && <Dialog open={Boolean(selectedEvent) && isMobile} onOpenChange={open => { if (!open) setSelectedEvent(null); }}>
          <DialogContent className="max-h-[85dvh] w-[calc(100vw-32px)] overflow-y-auto rounded-none border-border bg-background p-4 sm:rounded-none lg:hidden">
            <DialogHeader><DialogTitle>{t("matchFlow.matchDetails")}</DialogTitle></DialogHeader>
            <MatchDetail event={selectedEvent} myPlayer={myPlayer} myClub={myClub} />
          </DialogContent>
        </Dialog>}
      </div>
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

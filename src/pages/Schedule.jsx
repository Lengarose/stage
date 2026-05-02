import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { cn } from "@/lib/utils";
import ScheduleList from "../components/schedule/ScheduleList";
import MatchDetail from "../components/schedule/MatchDetail";
import ArrangeGameDialog from "../components/schedule/ArrangeGameDialog";
import { CalendarDays, Plus, X, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import ScheduleCalendar from "../components/schedule/ScheduleCalendar";

export default function Schedule() {
  const [user, setUser] = useState(null);
  const [myPlayer, setMyPlayer] = useState(null);
  const [myClub, setMyClub] = useState(null);
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [arrangeOpen, setArrangeOpen] = useState(false);
  const [view, setView] = useState("fixtures"); // "fixtures" | "calendar"
  const [allPlayers, setAllPlayers] = useState([]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const u = await base44.auth.me().catch(() => null);
    if (!u) { setLoading(false); return; }
    setUser(u);

    const [players, tournaments, contracts] = await Promise.all([
      base44.entities.Player.filter({ email: u.email }),
      base44.entities.Tournament.list("-created_date", 100),
      base44.entities.PlayerContract.list("-created_date", 50),
    ]);

    const player = players?.[0] || null;
    setMyPlayer(player);

    let club = null;
    let clubPlayers = [];
    if (player?.club_id) {
      const [clubs, cPlayers] = await Promise.all([
        base44.entities.Club.filter({ id: player.club_id }),
        base44.entities.Player.filter({ club_id: player.club_id }),
      ]);
      club = clubs?.[0] || null;
      clubPlayers = cPlayers || [];
      setMyClub(club);
    }
    setAllPlayers(clubPlayers);

    // Gather all matches relevant to user (club or player)
    const matchFilters = [];
    if (club?.id) {
      matchFilters.push(
        base44.entities.Match.filter({ home_club_id: club.id }, "-scheduled_date", 50),
        base44.entities.Match.filter({ away_club_id: club.id }, "-scheduled_date", 50),
      );
    }
    if (player?.id) {
      matchFilters.push(
        base44.entities.Match.filter({ home_player_id: player.id }, "-scheduled_date", 30),
        base44.entities.Match.filter({ away_player_id: player.id }, "-scheduled_date", 30),
      );
    }

    const matchArrays = await Promise.all(matchFilters);
    const allMatches = matchArrays.flat();

    // Deduplicate by id
    const matchMap = new Map();
    allMatches.forEach(m => matchMap.set(m.id, m));
    const matches = Array.from(matchMap.values());

    // Build tournament lookup
    const tournamentMap = new Map(tournaments.map(t => [t.id, t]));

    // Build match player stat lookup for ratings
    const matchIds = matches.map(m => m.id);

    // Fetch stats for all matches (batch)
    let allStats = [];
    if (player?.email && matchIds.length > 0) {
      allStats = await base44.entities.MatchPlayerStat.filter({ player_email: player.email }, "-created_date", 200).catch(() => []);
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
        ? Promise.all([...soloPlayerIds].map(pid => base44.entities.Player.filter({ id: pid }).catch(() => []))).then(r => r.flat())
        : Promise.resolve([]),
      clubIds.size > 0
        ? Promise.all([...clubIds].map(cid => base44.entities.Club.filter({ id: cid }).catch(() => []))).then(r => r.flat())
        : Promise.resolve([]),
    ]);
    const playerAvatarMap = new Map(soloPlayersData.map(p => [p.id, p.avatar_url]));
    const clubLogoMap = new Map(clubsData.map(c => [c.id, c.logo_url]));

    // Build schedule events from matches
    const matchEvents = matches.map(m => {
      const tournament = tournamentMap.get(m.tournament_id);
      const competition = deriveCompetition(m, tournament);
      // Determine home/away and opposition — handle both club matches and solo (PvP) matches
      const isSoloMatch = m.mode === "solo" || (!m.home_club_id && !m.away_club_id);
      const isHome = isSoloMatch
        ? m.home_player_id === player?.id
        : club
          ? m.home_club_id === club.id
          : m.home_player_id === player?.id;
      const opposition = isSoloMatch
        ? (isHome ? (m.away_player_name || "Unknown") : (m.home_player_name || "Unknown"))
        : club
          ? (isHome ? (m.away_club_name || m.away_player_name) : (m.home_club_name || m.home_player_name))
          : (isHome ? (m.away_player_name || m.away_club_name) : (m.home_player_name || m.home_club_name));
      const venue = isHome ? "Home" : "Away";
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
        date: m.scheduled_date || m.created_date,
        opposition,
        venue,
        result,
        competition,
        status: m.status,
        matchData: m,
        tournament,
        playerStats: stats,
        isHome,
        homeAvatarUrl,
        awayAvatarUrl,
      };
    });

    // Contract reminder events
    const contractEvents = [];
    const today = new Date();
    const myContracts = contracts.filter(c =>
      (c.user_id === player?.id || c.team_id === club?.id) && c.status === "active"
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
          competition: "Contract",
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
          competition: "Contract",
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
      tournaments.forEach(t => {
        if (t.start_date && (t.registered_clubs || []).includes(club.id)) {
          tournamentEvents.push({
            id: `tournament-start-${t.id}`,
            type: "tournament_start",
            date: t.start_date,
            competition: t.name,
            opposition: "",
            venue: "",
            result: null,
            status: "tournament",
            tournamentData: t,
          });
        }
      });
    }

    // Merge and sort all events by date descending (most recent first)
    const all = [...matchEvents, ...contractEvents, ...tournamentEvents].sort((a, b) => {
      const da = a.date ? new Date(a.date) : new Date(0);
      const db = b.date ? new Date(b.date) : new Date(0);
      return db - da;
    });

    setEvents(all);
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-background p-4 lg:p-8">
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
                SCHEDULE
              </h1>
              <p className="text-xs text-muted-foreground mt-2">All matches, tournaments & contract reminders</p>
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
                Fixtures
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
                Calendar
              </button>
            </div>
            <Button
              onClick={() => setArrangeOpen(true)}
              className="bg-primary text-primary-foreground gap-2 text-sm"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Arrange Game</span>
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-32">
            <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : view === "calendar" ? (
          <ScheduleCalendar events={events} myPlayer={myPlayer} myClub={myClub} players={allPlayers} />
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
                    <span className="text-sm font-semibold text-foreground">Match Details</span>
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

      <ArrangeGameDialog
        open={arrangeOpen}
        onClose={() => setArrangeOpen(false)}
        myPlayer={myPlayer}
        myClub={myClub}
        onSent={() => { setArrangeOpen(false); load(); }}
      />
    </div>
  );
}

function deriveCompetition(match, tournament) {
  // Arranged games (no real tournament) — tournament_id is "ranked" sentinel
  if (!tournament || match.tournament_id === "ranked") {
    return "Ranked Match";
  }
  const t = tournament;
  if (t.type === "knockout") return `${t.name} · Knockout`;
  if (t.type === "league") return `${t.name} · League`;
  if (t.type === "group_stage") return `${t.name} · Group Stage`;
  if (t.type === "swiss" || t.type === "swiss_ucl") return `${t.name} · Swiss`;
  if (t.type === "double_elimination") return `${t.name} · Double Elim.`;
  return t.name || "Tournament";
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
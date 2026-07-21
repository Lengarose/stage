import { useState, useEffect, useMemo } from "react";
import { stageClient, resolveMyPlayerAndClub } from "@/api/stageClient";
import { useSearchParams } from "react-router-dom";
import { RefreshCw, Zap, X } from "lucide-react";
import GameDayCard from "@/components/gameday/GameDayCard";
import GameDayDetail from "@/components/gameday/GameDayDetail";
import { createMatchFromFixture } from "@/lib/gameDayIntegration";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "@/hooks/useTranslation";

// Derive the "league group" a game belongs to for the filter dropdown.
// We strip the trailing "· Matchday N" so every matchday of the same
// league/division collapses into one group entry. Falls back to the
// tournament name for non-league competitions and "Ranked Match" for
// unstructured games.
function groupKeyForGame(game, tournamentMap, t) {
  const ctx = String(game?.competition_context || "").trim();
  if (ctx) {
    return ctx.replace(/\s*·\s*Matchday\s+\d+\s*$/i, "").trim() || ctx;
  }
  if (!game?.tournament_id || game.tournament_id === "ranked") return t("matchFlow.rankedMatch");
  const tournament = tournamentMap?.[game.tournament_id];
  return tournament?.name || t("matchFlow.tournament");
}

export default function GameDay({ tournamentId: scopedTournamentId } = {}) {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [myPlayer, setMyPlayer] = useState(null);
  const [myClub, setMyClub] = useState(null);
  const [selectedGame, setSelectedGame] = useState(null);
  const [tournamentMap, setTournamentMap] = useState({});
  // "all" or a group key (see groupKeyForGame). Stable across re-renders.
  const [leagueFilter, setLeagueFilter] = useState("all");

  // Keep `selectedGame` in sync with the live `games` list. Without this the
  // detail panel keeps a stale snapshot — e.g. the away player wouldn't see
  // the "Submit Result" form unlock when the home side submits.
  useEffect(() => {
    if (!selectedGame?.id) return;
    const fresh = games.find((g) => g.id === selectedGame.id);
    if (fresh && fresh !== selectedGame) setSelectedGame(fresh);
  }, [games, selectedGame]);

  // Build the [{key, label, count}] list of league/competition groups used to
  // populate the filter dropdown. Sorted by descending count so the most
  // active league surfaces first.
  const leagueGroups = useMemo(() => {
    const counts = new Map();
    for (const g of games) {
      const key = groupKeyForGame(g, tournamentMap, t);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([key, count]) => ({ key, label: key, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [games, tournamentMap, t]);

  // If the currently selected league disappears (all its games rolled off),
  // gracefully fall back to "all" so the user isn't stuck with an empty list.
  useEffect(() => {
    if (leagueFilter === "all") return;
    if (!leagueGroups.some(g => g.key === leagueFilter)) setLeagueFilter("all");
  }, [leagueGroups, leagueFilter]);

  const visibleGames = useMemo(() => {
    if (leagueFilter === "all") return games;
    return games.filter(g => groupKeyForGame(g, tournamentMap, t) === leagueFilter);
  }, [games, tournamentMap, leagueFilter, t]);

  useEffect(() => {
    let userEmail = null;

    async function load() {
      try {
        const isAuthed = await stageClient.auth.isAuthenticated();
        if (!isAuthed) {
          return;
        }

        const { user: u, player, club } = await resolveMyPlayerAndClub();
        if (!u) return;
        setUser(u);
        userEmail = u.email;

        if (player) setMyPlayer(player);
        if (club) setMyClub(club);

        const followData = await stageClient.entities.Follow.filter({ follower_email: u.email }).catch(() => []);
        await loadGames(player?.id, club?.id || player?.club_id, followData);
      } finally {
        setLoading(false);
      }
    }

    load();

    // Real-time subscription — keep live/active matches in the list
    const unsubMatch = stageClient.entities.Match.subscribe((event) => {
      if (!userEmail) return;
      setGames(prev => {
        if (event.type === "delete") {
          return prev.filter(m => m.id !== event.id);
        }
        const data = event.data;
        if (!data) return prev;

        // When scoped to a tournament, ignore matches from other tournaments
        if (scopedTournamentId && data.tournament_id !== scopedTournamentId) return prev;

        // Drop forfeited matches entirely
        if (data.status === "forfeit") return prev.filter(m => m.id !== data.id);

        // Drop completed matches older than 24h
        if (data.status === "completed") {
          const updatedAt = data.updated_date ? new Date(data.updated_date) : null;
          const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
          if (!updatedAt || updatedAt < oneDayAgo) {
            return prev.filter(m => m.id !== data.id);
          }
        }

        // Update existing or add new (for in_progress matches that just became live)
        const exists = prev.some(m => m.id === data.id);
        if (exists) {
          return prev.map(m => m.id === data.id ? data : m);
        }
        return [data, ...prev];
      });
    });

    return () => unsubMatch();
  }, [searchParams, scopedTournamentId]);

  async function loadGames(playerId, clubId, followData) {
    const followedClubIds = followData
      .filter(f => f.target_type === "club")
      .map(f => f.target_id);
    const followedPlayerIds = followData
      .filter(f => f.target_type === "player")
      .map(f => f.target_id);

    // Fetch all scheduled/in_progress matches then filter in JS
    // Fetch from multiple angles to cover both club and player matches
    const fetchPromises = [];

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Fetch my own matches (home + away) without status filter, then filter in JS
    // This avoids N×status queries and stays within rate limits
    if (clubId) {
      fetchPromises.push(
        stageClient.entities.Match.filter({ home_club_id: clubId }, "-scheduled_date", 50),
        stageClient.entities.Match.filter({ away_club_id: clubId }, "-scheduled_date", 50),
      );
    }
    if (playerId) {
      fetchPromises.push(
        stageClient.entities.Match.filter({ home_player_id: playerId }, "-scheduled_date", 50),
        stageClient.entities.Match.filter({ away_player_id: playerId }, "-scheduled_date", 50),
      );
    }

    // Followed clubs/players — only scheduled + live (fewer queries)
    for (const fcId of followedClubIds.slice(0, 3)) {
      fetchPromises.push(
        stageClient.entities.Match.filter({ home_club_id: fcId, status: "scheduled" }, "-scheduled_date", 5),
        stageClient.entities.Match.filter({ away_club_id: fcId, status: "scheduled" }, "-scheduled_date", 5),
        stageClient.entities.Match.filter({ home_club_id: fcId, status: "in_progress" }, "-scheduled_date", 5),
        stageClient.entities.Match.filter({ away_club_id: fcId, status: "in_progress" }, "-scheduled_date", 5),
      );
    }
    for (const fpId of followedPlayerIds.slice(0, 3)) {
      fetchPromises.push(
        stageClient.entities.Match.filter({ home_player_id: fpId, status: "scheduled" }, "-scheduled_date", 5),
        stageClient.entities.Match.filter({ away_player_id: fpId, status: "scheduled" }, "-scheduled_date", 5),
        stageClient.entities.Match.filter({ home_player_id: fpId, status: "in_progress" }, "-scheduled_date", 5),
        stageClient.entities.Match.filter({ away_player_id: fpId, status: "in_progress" }, "-scheduled_date", 5),
      );
    }

    // Fixtures with `scheduling_status = confirmed` and `status = scheduled`
    // travel together (both set the moment a fixture is ready to play), so
    // filtering on just `scheduling_status` is enough — the post-filter below
    // still accepts either column. We only fetch fixtures involving the
    // user's club; no global "scan all leagues" fallback (it pulled ~1000
    // rows per page load just to throw 99% away).
    const fixturePromises = [];
    if (clubId && stageClient.entities.CompetitionFixture) {
      fixturePromises.push(
        { type: "competition", promise: stageClient.entities.CompetitionFixture.filter({ home_club_id: clubId, scheduling_status: "confirmed" }, "-confirmed_date", 50).catch(() => []) },
        { type: "competition", promise: stageClient.entities.CompetitionFixture.filter({ away_club_id: clubId, scheduling_status: "confirmed" }, "-confirmed_date", 50).catch(() => []) },
      );
    }
    if (clubId && stageClient.entities.RegionalLeagueFixture) {
      fixturePromises.push(
        { type: "regional_league", promise: stageClient.entities.RegionalLeagueFixture.filter({ home_club_id: clubId, scheduling_status: "confirmed" }, "-confirmed_date", 50).catch(() => []) },
        { type: "regional_league", promise: stageClient.entities.RegionalLeagueFixture.filter({ away_club_id: clubId, scheduling_status: "confirmed" }, "-confirmed_date", 50).catch(() => []) },
      );
    }

    const [arrays, fixtureResults] = await Promise.all([
      Promise.all(fetchPromises.map(p => p.catch(() => []))),
      Promise.all(fixturePromises.map(item => item.promise.then(rows => ({ type: item.type, rows })))),
    ]);
    const matchMap = new Map();
    arrays.flat().forEach(m => matchMap.set(m.id, m));

    const confirmedFixtures = fixtureResults
      .flatMap(result => (result.rows || []).map(fixture => ({ fixture, type: result.type })))
      .filter(({ fixture }) =>
        fixture?.id &&
        (fixture.scheduling_status === "confirmed" || fixture.status === "scheduled") &&
        (fixture.home_club_id === clubId || fixture.away_club_id === clubId)
      );
    for (const { fixture, type } of confirmedFixtures) {
      const match = await createMatchFromFixture(fixture, type).catch(() => null);
      if (match?.id) matchMap.set(match.id, match);
    }

    const requestedMatchId = searchParams.get("match");
    if (requestedMatchId) {
      const requested = matchMap.get(requestedMatchId)
        || await stageClient.entities.Match.get(requestedMatchId).catch(() => null);
      if (requested?.id) {
        matchMap.set(requested.id, requested);
        setSelectedGame(requested);
      }
    }

    // Keep active matches + completed ones updated within last 24h; drop forfeit
    let relevantGames = Array.from(matchMap.values()).filter(m => {
      if (m.status === "forfeit") return false;
      if (m.status === "completed") {
        const updatedAt = m.updated_date ? new Date(m.updated_date) : null;
        return updatedAt && updatedAt.toISOString() > oneDayAgo;
      }
      return true;
    });

    // When scoped to a specific tournament, only show matches for that tournament
    if (scopedTournamentId) {
      relevantGames = relevantGames.filter(m => m.tournament_id === scopedTournamentId);
    }

    setGames(relevantGames);

    // Build tournament lookup for competition labels — fetch all at once, not one per ID
    const tIds = [...new Set(
      relevantGames.map(m => m.tournament_id).filter(tid => tid && tid !== "ranked")
    )];
    if (tIds.length > 0) {
      const allTournaments = await stageClient.entities.Tournament.list("-created_date", 200);
      const tMap = {};
      allTournaments.forEach(t => { if (tIds.includes(t.id)) tMap[t.id] = t; });
      setTournamentMap(tMap);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-3 md:p-6">
      {/* Title */}
      <div className="mb-5 md:mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1
            className="text-4xl md:text-5xl lg:text-6xl font-heading font-black text-foreground mb-1"
            style={{ transform: "skewX(-8deg)", letterSpacing: "-0.02em" }}
          >
            {t("matchFlow.gameDayTitle")}
          </h1>
          <p className="text-muted-foreground text-xs md:text-sm">
            {leagueFilter === "all"
              ? t("matchFlow.activeScheduledCount", { count: games.length })
              : t("matchFlow.filteredCount", { visible: visibleGames.length, total: games.length })}
          </p>
        </div>

        {/* League filter — only render when the user has games across more than one league/competition. */}
        {leagueGroups.length > 1 && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              {t("matchFlow.league")}
            </span>
            <Select value={leagueFilter} onValueChange={setLeagueFilter}>
              <SelectTrigger className="h-9 w-full md:w-[280px] text-xs bg-card border-border">
                <SelectValue placeholder={t("matchFlow.allLeagues")} />
              </SelectTrigger>
              <SelectContent className="max-h-[60vh]">
                <SelectItem value="all" className="text-xs">
                  {t("matchFlow.all")} <span className="text-muted-foreground ml-1">({games.length})</span>
                </SelectItem>
                {leagueGroups.map(group => (
                  <SelectItem key={group.key} value={group.key} className="text-xs">
                    {group.label}
                    <span className="text-muted-foreground ml-1">({group.count})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* ── Desktop layout ── */}
      <div className="hidden lg:grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          {visibleGames.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-12 text-center">
              <Zap className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">
                {games.length === 0 ? t("matchFlow.noScheduledGames") : t("matchFlow.noMatchesInLeague")}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {games.length === 0
                  ? t("matchFlow.followToSeeMatches")
                  : t("matchFlow.switchToAll")}
              </p>
            </div>
          ) : (
            visibleGames.map(game => (
              <GameDayCard
                key={game.id}
                game={game}
                selected={selectedGame?.id === game.id}
                onClick={() => setSelectedGame(game)}
                myClub={myClub}
                myPlayer={myPlayer}
                tournament={tournamentMap[game.tournament_id]}
              />
            ))
          )}
        </div>
        <div className="lg:col-span-1">
          {selectedGame ? (
            <GameDayDetail
              game={selectedGame}
              myClub={myClub}
              myPlayer={myPlayer}
              user={user}
              onGameUpdate={(updated) => {
                setSelectedGame(updated);
                setGames(prev => prev.map(g => g.id === updated.id ? updated : g));
              }}
            />
          ) : (
            <div className="bg-card border border-border rounded-xl p-8 flex flex-col items-center justify-center text-center min-h-[300px]">
              <Zap className="w-10 h-10 text-muted-foreground/20 mb-3" />
              <p className="text-sm text-muted-foreground">{t("matchFlow.selectGameDetails")}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile / Tablet layout ── */}
      <div className="lg:hidden space-y-3">
        {visibleGames.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-10 text-center">
            <Zap className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">
              {games.length === 0 ? t("matchFlow.noScheduledGames") : t("matchFlow.noMatchesInLeague")}
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              {games.length === 0
                ? t("matchFlow.followToSeeMatches")
                : t("matchFlow.switchToAll")}
            </p>
          </div>
        ) : (
          visibleGames.map(game => (
            <GameDayCard
              key={game.id}
              game={game}
              selected={false}
              onClick={() => setSelectedGame(game)}
              myClub={myClub}
              myPlayer={myPlayer}
              tournament={tournamentMap[game.tournament_id]}
            />
          ))
        )}
      </div>

      {/* ── Mobile slide-up detail panel ── */}
      {/* z-[90] sits above the mobile bottom navigation (z-[80] in Layout.jsx)
          so the chat input at the bottom of the panel is never hidden behind it. */}
      {selectedGame && (
        <div className="lg:hidden fixed inset-0 z-[90] flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSelectedGame(null)}
          />
          {/* Panel */}
          <div className="relative bg-background rounded-t-2xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
            {/* Handle + header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border shrink-0">
              <div className="absolute left-1/2 -translate-x-1/2 top-2 w-10 h-1 rounded-full bg-border" />
              <p className="text-sm font-semibold text-foreground">{t("matchFlow.matchDetails")}</p>
              <button
              onClick={() => setSelectedGame(null)}
              className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              >
              <X className="w-4 h-4" />
              </button>
            </div>
            {/* Scrollable detail. pb accounts for iPhone home-indicator safe area
                so the chat input (last element) stays clear of it. */}
            <div
              className="overflow-y-auto flex-1 p-3"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
            >
              <GameDayDetail
                game={selectedGame}
                myClub={myClub}
                myPlayer={myPlayer}
                user={user}
                onGameUpdate={(updated) => {
                  setSelectedGame(updated);
                  setGames(prev => prev.map(g => g.id === updated.id ? updated : g));
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

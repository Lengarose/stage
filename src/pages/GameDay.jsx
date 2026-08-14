import { useState, useEffect, useMemo } from "react";
import { stageClient, resolveMyPlayerAndClub } from "@/api/stageClient";
import { useSearchParams } from "react-router-dom";
import { Plus, RefreshCw, Zap } from "lucide-react";
import GameDayCard from "@/components/gameday/GameDayCard";
import GameDayDetail from "@/components/gameday/GameDayDetail";
import ArrangeGameDialog from "@/components/schedule/ArrangeGameDialog";
import { createMatchFromFixture } from "@/lib/gameDayIntegration";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
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
  const [arrangeOpen, setArrangeOpen] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
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

  useEffect(() => {
    if (!selectedGame?.id) return;
    let stopped = false;

    const applyFreshMatch = (fresh) => {
      if (stopped || !fresh?.id || fresh.id !== selectedGame.id) return;
      if (scopedTournamentId && fresh.tournament_id !== scopedTournamentId) return;

      setSelectedGame(fresh);
      setGames(prev => {
        if (fresh.status === "forfeit") return prev.filter(g => g.id !== fresh.id);
        if (prev.some(g => g.id === fresh.id)) {
          return prev.map(g => g.id === fresh.id ? fresh : g);
        }
        return [fresh, ...prev];
      });
    };

    const unsubSelectedMatch = stageClient.entities.Match.subscribe((event) => {
      if (event?.type === "delete" && event.id === selectedGame.id) {
        setSelectedGame(null);
        setGames(prev => prev.filter(g => g.id !== selectedGame.id));
        return;
      }
      applyFreshMatch(event?.data);
    }, { id: selectedGame.id });

    async function refreshSelectedMatch() {
      const fresh = await stageClient.entities.Match.get(selectedGame.id).catch(() => null);
      applyFreshMatch(fresh);
    }

    refreshSelectedMatch();
    const intervalId = window.setInterval(refreshSelectedMatch, 10000);

    return () => {
      stopped = true;
      window.clearInterval(intervalId);
      unsubSelectedMatch?.();
    };
  }, [selectedGame?.id, scopedTournamentId]);

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

        await loadGames(player?.id, club?.id || player?.club_id);
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
  }, [searchParams, scopedTournamentId, refreshTick]);

  async function loadGames(playerId, clubId) {
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

    // Open the next playable match so Kickoff is visible without an extra click.
    if (!requestedMatchId) {
      const nextPlayable = relevantGames.find(m => m.status === "scheduled" || m.status === "in_progress")
        || relevantGames[0];
      if (nextPlayable) setSelectedGame(prev => prev || nextPlayable);
    }

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
      <div className="flex h-full min-h-[60vh] items-center justify-center bg-[#05080f]">
        <RefreshCw className="h-8 w-8 animate-spin text-[#f5c542]" />
      </div>
    );
  }

  const detail = selectedGame ? (
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
    <div className="flex min-h-[420px] flex-col items-center justify-center border border-white/10 bg-[#071018] px-6 py-16 text-center">
      <Zap className="mb-3 h-10 w-10 text-[#f5c542]/30" />
      <p className="font-heading text-sm font-black uppercase tracking-[0.22em] text-white/50">
        {t("matchFlow.selectGameDetails")}
      </p>
    </div>
  );

  return (
    <div className="min-h-full bg-[#05080f] text-white">
      <div className="border-b border-[#f5c542]/20 bg-gradient-to-r from-[#071018] via-[#0a1628] to-[#071018] px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[#00e5ff]">{t("matchFlow.kickoff")}</p>
            <h1
              className="font-heading text-4xl font-black uppercase leading-none text-white md:text-5xl"
              style={{ letterSpacing: "0.04em" }}
            >
              {t("matchFlow.gameDayTitle")}
            </h1>
            <p className="mt-1 text-xs text-white/45">
              {leagueFilter === "all"
                ? t("matchFlow.activeScheduledCount", { count: games.length })
                : t("matchFlow.filteredCount", { visible: visibleGames.length, total: games.length })}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {!scopedTournamentId && (
              <Button
                onClick={() => setArrangeOpen(true)}
                className="h-9 gap-2 rounded-sm bg-gradient-to-b from-[#ffe27a] to-[#c9a227] font-heading text-xs font-black uppercase tracking-[0.16em] text-black hover:from-[#fff0a8] hover:to-[#d4ad30]"
              >
                <Plus className="h-4 w-4" />
                {t("matchFlow.arrangeGame")}
              </Button>
            )}

            {leagueGroups.length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-white/45">
                  {t("matchFlow.league")}
                </span>
                <Select value={leagueFilter} onValueChange={setLeagueFilter}>
                  <SelectTrigger className="h-9 w-full border-white/15 bg-black/40 text-xs text-white md:w-[280px]">
                    <SelectValue placeholder={t("matchFlow.allLeagues")} />
                  </SelectTrigger>
                  <SelectContent className="max-h-[60vh]">
                    <SelectItem value="all" className="text-xs">
                      {t("matchFlow.all")} <span className="ml-1 text-muted-foreground">({games.length})</span>
                    </SelectItem>
                    {leagueGroups.map(group => (
                      <SelectItem key={group.key} value={group.key} className="text-xs">
                        {group.label}
                        <span className="ml-1 text-muted-foreground">({group.count})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border-b border-white/10 bg-black/30 px-4 py-3 sm:px-6">
        {visibleGames.length === 0 ? (
          <div className="rounded-sm border border-white/10 px-4 py-8 text-center">
            <Zap className="mx-auto mb-2 h-8 w-8 text-white/20" />
            <p className="text-sm text-white/55">
              {games.length === 0 ? t("matchFlow.noScheduledGames") : t("matchFlow.noMatchesInLeague")}
            </p>
            {games.length > 0 ? <p className="mt-1 text-xs text-white/35">{t("matchFlow.switchToAll")}</p> : null}
          </div>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {visibleGames.map(game => (
              <GameDayCard
                key={game.id}
                game={game}
                selected={selectedGame?.id === game.id}
                onClick={() => setSelectedGame(game)}
                myClub={myClub}
                myPlayer={myPlayer}
                tournament={tournamentMap[game.tournament_id]}
              />
            ))}
          </div>
        )}
      </div>

      <div className="px-0 pb-8 sm:px-0">
        {detail}
      </div>

      <ArrangeGameDialog
        open={arrangeOpen}
        onClose={() => setArrangeOpen(false)}
        myPlayer={myPlayer}
        myClub={myClub}
        onSent={() => {
          setArrangeOpen(false);
          setRefreshTick(value => value + 1);
        }}
      />
    </div>
  );
}

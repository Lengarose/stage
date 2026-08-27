import { useState, useEffect, useMemo } from "react";
import { stageClient, resolveMyPlayerAndClub } from "@/api/stageClient";
import { useSearchParams } from "react-router-dom";
import { MessageSquare, MoreHorizontal, Plus, Radio, RefreshCw, Zap } from "lucide-react";
import { useChatNotifications } from "@/lib/ChatNotificationsContext";
import GameDayCard from "@/components/gameday/GameDayCard";
import GameDayDetail from "@/components/gameday/GameDayDetail";
import GameDayTileBackgroundDialog, {
  getGameDayTileBackgroundConfig,
  getGameDayTileBackgroundStyle,
} from "@/components/gameday/GameDayTileBackgroundDialog";
import ArrangeGameDialog from "@/components/schedule/ArrangeGameDialog";
import { createMatchFromFixture } from "@/lib/gameDayIntegration";
import { isActiveGameDayMatch } from "@/lib/gameDayPresentation";
import { isGameDayMatchSocketPayload, sameRecordId } from "@/lib/gameDayRealtime";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import { hasStagePlus } from "@/lib/subscriptionUtils";

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

function confirmedFixtureSourceKey(fixture, type) {
  if (!fixture?.id) return null;
  const sourceType = type === "regional_league" || type === "regional_league_fixture"
    ? "regional_league"
    : "competition";
  return `${sourceType}:${fixture.id}`;
}

function matchSourceKey(match) {
  if (!match?.source_fixture_id || !match?.source_fixture_type) return null;
  const sourceType = String(match.source_fixture_type);
  if (!["regional_league", "competition"].includes(sourceType)) return null;
  return `${sourceType}:${match.source_fixture_id}`;
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
  const [opsOpen, setOpsOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [gameDayConfig, setGameDayConfig] = useState(null);
  const [tileBackgroundDialog, setTileBackgroundDialog] = useState(null);
  const { getUnreadCount } = useChatNotifications();
  const chatUnread = selectedGame?.id ? getUnreadCount(selectedGame.id) : 0;
  // "all" or a group key (see groupKeyForGame). Stable across re-renders.
  const [leagueFilter, setLeagueFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;
    stageClient.entities.GameDayConfig
      ?.filter({ key: "main" }, "-updated_date", 1)
      .then(rows => {
        if (!cancelled) setGameDayConfig(rows?.[0] || null);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Keep `selectedGame` in sync with the live `games` list. Without this the
  // detail panel keeps a stale snapshot — e.g. the away player wouldn't see
  // the "Submit Result" form unlock when the home side submits.
  useEffect(() => {
    if (!selectedGame?.id) return;
    const fresh = games.find((g) => sameRecordId(g.id, selectedGame.id));
    if (fresh && fresh !== selectedGame) setSelectedGame(fresh);
  }, [games, selectedGame]);

  useEffect(() => {
    setOpsOpen(false);
    setChatOpen(false);
  }, [selectedGame?.id]);

  useEffect(() => {
    if (!selectedGame?.id) return;
    let stopped = false;

    const applyFreshMatch = (fresh) => {
      if (stopped || !fresh?.id || !sameRecordId(fresh.id, selectedGame.id)) return;
      if (!isGameDayMatchSocketPayload(fresh) && !fresh.status) return;
      if (scopedTournamentId && fresh.tournament_id !== scopedTournamentId) return;

      if (!isActiveGameDayMatch(fresh)) {
        setSelectedGame(null);
        setGames(prev => prev.filter(g => !sameRecordId(g.id, fresh.id)));
        return;
      }

      setSelectedGame((prev) => (prev && sameRecordId(prev.id, fresh.id) ? { ...prev, ...fresh } : fresh));
      setGames(prev => {
        if (prev.some(g => sameRecordId(g.id, fresh.id))) {
          return prev.map(g => sameRecordId(g.id, fresh.id) ? { ...g, ...fresh } : g);
        }
        return [fresh, ...prev];
      });
    };

    const unsubSelectedMatch = stageClient.entities.Match.subscribe((event) => {
      if (event?.type === "delete" && sameRecordId(event.id, selectedGame.id)) {
        setSelectedGame(null);
        setGames(prev => prev.filter(g => !sameRecordId(g.id, selectedGame.id)));
        return;
      }
      if (isGameDayMatchSocketPayload(event?.data) || event?.data?.status) {
        applyFreshMatch(event.data);
      }
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
          return prev.filter(m => !sameRecordId(m.id, event.id));
        }
        const data = event.data;
        if (!isGameDayMatchSocketPayload(data)) return prev;

        // When scoped to a tournament, ignore matches from other tournaments
        if (scopedTournamentId && data.tournament_id !== scopedTournamentId) return prev;

        if (!isActiveGameDayMatch(data)) return prev.filter(m => !sameRecordId(m.id, data.id));

        // Update existing or add new (for in_progress matches that just became live)
        const exists = prev.some(m => sameRecordId(m.id, data.id));
        if (exists) {
          return prev.map(m => sameRecordId(m.id, data.id) ? { ...m, ...data } : m);
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
    const confirmedSourceKeys = new Set(
      confirmedFixtures
        .map(({ fixture, type }) => confirmedFixtureSourceKey(fixture, type))
        .filter(Boolean)
    );
    for (const { fixture, type } of confirmedFixtures) {
      const match = await createMatchFromFixture(fixture, type).catch(() => null);
      if (match?.id) matchMap.set(match.id, match);
    }

    const requestedMatchId = searchParams.get("match");
    if (requestedMatchId) {
      const requested = matchMap.get(requestedMatchId)
        || await stageClient.entities.Match.get(requestedMatchId).catch(() => null);
      if (requested?.id && isActiveGameDayMatch(requested)) {
        matchMap.set(requested.id, requested);
        setSelectedGame(requested);
      }
    }

    // Keep active matches + completed ones updated within last 24h; drop forfeit/cancelled
    let relevantGames = Array.from(matchMap.values()).filter((m) => {
      if (!isActiveGameDayMatch(m)) return false;
      const sourceKey = matchSourceKey(m);
      return !sourceKey || confirmedSourceKeys.has(sourceKey);
    });

    // When scoped to a specific tournament, only show matches for that tournament
    if (scopedTournamentId) {
      relevantGames = relevantGames.filter(m => m.tournament_id === scopedTournamentId);
    }

    setGames(relevantGames);
    if (requestedMatchId) {
      setSelectedGame(prev => (prev && relevantGames.some(g => sameRecordId(g.id, prev.id)) ? prev : null));
    }

    // Open the next playable match so Kickoff is visible without an extra click.
    if (!requestedMatchId) {
      const nextPlayable = relevantGames.find(m => m.status === "scheduled" || m.status === "in_progress")
        || relevantGames[0]
        || null;
      setSelectedGame(prev => (prev && relevantGames.some(g => g.id === prev.id) ? prev : nextPlayable));
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
      <div className="flex h-full min-h-[60vh] items-center justify-center bg-[#07070b]">
        <RefreshCw className="h-8 w-8 animate-spin text-[#eef3fb]" />
      </div>
    );
  }

  const canCustomizeGameDayTiles = hasStagePlus(myPlayer?.subscription);
  const matchScreensBackgroundConfig = getGameDayTileBackgroundConfig(myPlayer, "match_screens");
  const matchScreensBackgroundStyle = getGameDayTileBackgroundStyle(matchScreensBackgroundConfig);

  const detail = selectedGame ? (
    <GameDayDetail
      game={selectedGame}
      myClub={myClub}
      myPlayer={myPlayer}
      user={user}
      opsOpen={opsOpen}
      chatOpen={chatOpen}
      onOpsOpenChange={setOpsOpen}
      onChatOpenChange={setChatOpen}
      matchDetailsBackgroundConfig={getGameDayTileBackgroundConfig(myPlayer, "match_details")}
      dressingRoomBackgroundConfig={getGameDayTileBackgroundConfig(myPlayer, "dressing_room")}
      canCustomizeGameDayTiles={canCustomizeGameDayTiles}
      onOpenTileBackgroundDialog={setTileBackgroundDialog}
      onGameUpdate={(updated) => {
        if (!isActiveGameDayMatch(updated)) {
          setSelectedGame(prev => sameRecordId(prev?.id, updated.id) ? null : prev);
          setGames(prev => prev.filter(g => !sameRecordId(g.id, updated.id)));
          return;
        }
        setSelectedGame(updated);
        setGames(prev => prev.map(g => sameRecordId(g.id, updated.id) ? { ...g, ...updated } : g));
      }}
    />
  ) : (
    <div className="flex min-h-[360px] flex-col items-center justify-center border border-white/10 bg-[#111827] px-6 py-12 text-center shadow-[inset_0_0_80px_rgba(238,243,251,0.08)] [clip-path:polygon(18px_0,100%_0,calc(100%_-_18px)_100%,0_100%)]">
      <Zap className="mb-3 h-10 w-10 text-[#eef3fb]/35" />
      <p className="font-heading text-sm font-black uppercase tracking-[0.22em] text-white/50">
        {t("matchFlow.selectGameDetails")}
      </p>
    </div>
  );

  const bannerStyle = gameDayConfig?.banner_url
    ? {
      backgroundImage: `url(${gameDayConfig.banner_url})`,
      backgroundPosition: gameDayConfig.banner_position || "50% 50%",
      backgroundSize: gameDayConfig.banner_zoom ? `${Number(gameDayConfig.banner_zoom)}%` : "cover",
      backgroundRepeat: "no-repeat",
    }
    : {};

  const ActionTab = ({ children, onClick, disabled, tone = "cyan", className = "" }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group relative h-9 min-w-[112px] overflow-hidden px-3.5 font-heading text-[9px] font-black uppercase tracking-[0.16em] transition-all [clip-path:polygon(12px_0,100%_0,calc(100%_-_12px)_100%,0_100%)] sm:h-10 sm:min-w-[124px] sm:px-4 sm:text-[10px]",
        "border bg-black/20 text-white/75 backdrop-blur-md disabled:cursor-not-allowed disabled:opacity-35",
        tone === "silver"
          ? "border-[#eef3fb]/40 shadow-[0_0_24px_-18px_rgba(238,243,251,1)] hover:border-white/85"
          : "border-[#8eeeff]/35 shadow-[0_0_24px_-18px_rgba(142,238,255,1)] hover:border-[#8eeeff]/75",
        className
      )}
    >
      <span className={cn(
        "absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100",
        tone === "silver"
          ? "bg-gradient-to-r from-[#d8dee8]/30 via-white/10 to-[#d8dee8]/20"
          : "bg-gradient-to-r from-[#8eeeff]/22 via-white/10 to-[#8eeeff]/16"
      )} />
      <span className="absolute inset-x-4 top-0 h-px bg-current opacity-55" />
      <span className="absolute inset-x-4 bottom-0 h-px bg-current opacity-35" />
      <span className="relative flex items-center justify-center gap-2">{children}</span>
    </button>
  );

  return (
    <div className="min-h-full bg-[#07070b] text-white">
      <section className="relative overflow-hidden border-b border-[#d8dee8]/30 bg-[#07070b]">
        <div
          className="absolute inset-0 bg-[radial-gradient(circle_at_72%_22%,rgba(238,243,251,0.26),transparent_30%),radial-gradient(circle_at_20%_72%,rgba(255,255,255,0.18),transparent_28%),linear-gradient(110deg,#171c25_0%,#10141d_45%,#252b36_100%)]"
          style={bannerStyle}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/24 to-black/62" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_48%_118%,rgba(255,255,255,0.16),transparent_36%)]" />
        <div className="absolute bottom-0 left-[8%] h-px w-[74%] bg-gradient-to-r from-transparent via-[#eef3fb] to-transparent shadow-[0_0_24px_rgba(238,243,251,0.75)]" />
        <div className="relative mx-auto flex min-h-[230px] max-w-[1600px] items-end justify-end px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex w-full flex-wrap items-center justify-end gap-2.5">
            {!scopedTournamentId && (
              <ActionTab
                onClick={() => setArrangeOpen(true)}
                tone="silver"
              >
                <Plus className="h-3.5 w-3.5" />
                {t("matchFlow.arrangeGame")}
              </ActionTab>
            )}
            <ActionTab
              disabled={!selectedGame}
              onClick={() => setOpsOpen(true)}
            >
              <Radio className="h-3.5 w-3.5" />
              {t("matchFlow.liveStream")}
            </ActionTab>
            <ActionTab
              disabled={!selectedGame}
              onClick={() => setChatOpen(true)}
              tone="silver"
              className="relative"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              {t("matchFlow.chat")}
              {chatUnread > 0 ? (
                <span className="absolute -right-1 -top-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#8eeeff] px-1 text-[10px] font-semibold leading-none text-black">
                  {chatUnread > 99 ? "99+" : chatUnread}
                </span>
              ) : null}
            </ActionTab>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-[1600px] gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[380px_minmax(0,1fr)] lg:px-8">
        <aside className="relative overflow-hidden border border-[#eef3fb]/22 bg-gradient-to-b from-[#1b212c]/90 via-[#111827]/95 to-black/82 p-3 shadow-[0_0_42px_-24px_rgba(238,243,251,0.85)] lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)]">
          {matchScreensBackgroundStyle ? (
            <div aria-hidden className="absolute inset-0 bg-cover bg-center opacity-55" style={matchScreensBackgroundStyle} />
          ) : null}
          <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(255,255,255,0.16),transparent_22%),radial-gradient(circle_at_80%_4%,rgba(216,222,232,0.24),transparent_24%),linear-gradient(180deg,rgba(24,30,40,0.84),rgba(7,7,11,0.96))]" />
          <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#f8fbff] to-transparent" />
          <div className="relative z-[1]">
          <div className="mb-3 flex items-center justify-between gap-3 px-2 pt-2">
            <div>
              <p className="font-heading text-xs font-black uppercase tracking-[0.2em] text-[#f8fbff]">Match Screens</p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-white/35">
                {visibleGames.length}/{games.length} visible
              </p>
            </div>
            {myPlayer ? (
              <button
                type="button"
                aria-label="Change Match Screens background"
                onClick={() => setTileBackgroundDialog({ tileKey: "match_screens", title: "Match Screens" })}
                className="flex h-8 w-8 shrink-0 items-center justify-center border border-white/15 bg-black/35 text-white/65 transition hover:border-[#f8fbff]/60 hover:bg-[#d8dee8]/15 hover:text-white"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            ) : null}
            {leagueGroups.length > 1 && (
              <Select value={leagueFilter} onValueChange={setLeagueFilter}>
                <SelectTrigger className="h-9 w-[150px] border-[#f8fbff]/25 bg-black/50 text-[10px] text-white">
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
            )}
          </div>
          {visibleGames.length === 0 ? (
            <div className="mx-2 rounded-sm border border-white/10 px-4 py-8 text-center">
              <Zap className="mx-auto mb-2 h-8 w-8 text-white/20" />
              <p className="text-sm text-white/55">
                {games.length === 0 ? t("matchFlow.noScheduledGames") : t("matchFlow.noMatchesInLeague")}
              </p>
              {games.length > 0 ? <p className="mt-1 text-xs text-white/35">{t("matchFlow.switchToAll")}</p> : null}
            </div>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-1 lg:max-h-[520px] lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden lg:pr-1">
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
        </aside>

        <div className="min-w-0">
          {detail}
        </div>
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

      <GameDayTileBackgroundDialog
        open={Boolean(tileBackgroundDialog)}
        onOpenChange={(open) => {
          if (!open) setTileBackgroundDialog(null);
        }}
        player={myPlayer}
        tileKey={tileBackgroundDialog?.tileKey}
        tileTitle={tileBackgroundDialog?.title}
        canCustomize={canCustomizeGameDayTiles}
        onPlayerChanged={(updated) => setMyPlayer((prev) => ({ ...(prev || {}), ...updated }))}
      />
    </div>
  );
}

import { useState, useEffect } from "react";
import { stageClient } from "@/api/stageClient";
import { processMatchRevenue, processSoloMatchRevenue } from "@/lib/matchRevenue";
import { syncPlayerCareerStats } from "@/lib/gameDayIntegration";
import { format, parseISO, isValid, differenceInMinutes } from "@/lib/momentDate";
import { Shield, Trophy, Target, Zap, MessageSquare, Users, Mic, Play, Flag, Clock, CheckCircle2, Ticket, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import GameDayDressingRoom from "./GameDayDressingRoom";
import GameDayPressRoom from "./GameDayPressRoom";
import GameDayMatchChat from "./GameDayMatchChat";
import GameDayMatchResult from "./GameDayMatchResult";
import StreamLinkSection from "./StreamLinkSection";
import WagerPanel from "./WagerPanel";
import { cn } from "@/lib/utils";
import { useChatNotifications } from "@/lib/ChatNotificationsContext";
import { useTranslation } from "@/hooks/useTranslation";

function parseDate(d) {
  if (!d) return null;
  const p = typeof d === "string" ? parseISO(d) : new Date(d);
  return isValid(p) ? p : null;
}

/** MySQL JSON/TEXT goal columns may arrive as a JSON string — never call .map on raw value. */
function asJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null || value === "") return [];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

const STATUS_COLORS = {
  scheduled: "bg-primary/10 text-primary",
  in_progress: "bg-success/10 text-success",
  awaiting_confirmation: "bg-warning/10 text-warning",
  completed: "bg-secondary text-muted-foreground",
  forfeit: "bg-destructive/10 text-destructive",
};

const STATUS_LABEL_KEYS = {
  scheduled: "scheduled",
  in_progress: "live",
  awaiting_confirmation: "pending",
  completed: "fullTime",
  forfeit: "forfeit",
};

export default function GameDayDetail({ game: initialGame, myClub, myPlayer, user, onGameUpdate }) {
  const { t } = useTranslation();
  const [game, setGame] = useState(initialGame);
  const [tournament, setTournament] = useState(null);
  const [stats, setStats] = useState([]);
  const [isHomeClub, setIsHomeClub] = useState(false);
  const [kickoffLoading, setKickoffLoading] = useState(false);
  const [kickoffError, setKickoffError]     = useState("");
  const [showResultForm, setShowResultForm] = useState(false);
  // Live "seated player" counts for the home and away dressing rooms; used to
  // gate the Kickoff button so a match can't start with an empty roster.
  const [dressingCounts, setDressingCounts] = useState({ home: 0, away: 0 });

  // Update game when parent passes new data
  useEffect(() => { setGame(initialGame); }, [initialGame]);

  // Unread badge on the Chat tab trigger. Reads off the global chat
  // notifications provider; falls back to 0 when no provider is mounted.
  const { getUnreadCount } = useChatNotifications();
  const chatUnread = game?.id ? getUnreadCount(game.id) : 0;

  const isClubMatchEarly = game?.mode === "club";

  useEffect(() => {
    if (!game?.id) return;
    async function load() {
      if (game.tournament_id && game.tournament_id !== "ranked") {
        const tournaments = await stageClient.entities.Tournament.filter({ id: game.tournament_id });
        if (tournaments.length > 0) setTournament(tournaments[0]);
      }
      const matchStats = await stageClient.entities.MatchPlayerStat.filter({ match_id: game.id });
      setStats(matchStats || []);
      setIsHomeClub(
        isClubMatchEarly ? (myClub ? game.home_club_id === myClub.id : false) : false
      );
    }
    load();
  }, [game?.id, game?.tournament_id, myClub, isClubMatchEarly]);

  // Load both dressing rooms (home + away) and stay in sync over the socket
  // so the Kickoff button enables the moment the opposing club seats a
  // player. Only meaningful for club matches.
  useEffect(() => {
    if (!game?.id || !isClubMatchEarly) {
      setDressingCounts({ home: 0, away: 0 });
      return;
    }
    let cancelled = false;
    const homeId = game.home_club_id;
    const awayId = game.away_club_id;

    function countSeated(raw) {
      if (raw == null || raw === "") return 0;
      let val = raw;
      if (typeof val === "string") {
        try { val = JSON.parse(val); } catch { return 0; }
      }
      return Array.isArray(val) ? val.length : 0;
    }

    async function loadDressing() {
      const rows = await stageClient.entities.DressingRoom
        .filter({ match_id: game.id }, null, 10)
        .catch(() => []);
      if (cancelled) return;
      const next = { home: 0, away: 0 };
      for (const r of rows || []) {
        const c = countSeated(r.seated_players);
        if (String(r.club_id) === String(homeId)) next.home = c;
        else if (String(r.club_id) === String(awayId)) next.away = c;
      }
      setDressingCounts(next);
    }

    loadDressing();

    const unsub = stageClient.entities.DressingRoom.subscribe((event) => {
      if (event?.type === "delete") return;
      const d = event?.data;
      if (!d || d.match_id !== game.id) return;
      const c = countSeated(d.seated_players);
      setDressingCounts(prev => {
        if (String(d.club_id) === String(homeId)) return { ...prev, home: c };
        if (String(d.club_id) === String(awayId)) return { ...prev, away: c };
        return prev;
      });
    }, { match_id: game.id });

    return () => { cancelled = true; unsub?.(); };
  }, [game?.id, game?.home_club_id, game?.away_club_id, isClubMatchEarly]);

  if (!game?.id) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
        {t("matchFlow.matchNotFound")}
      </div>
    );
  }

  const date = parseDate(game.scheduled_date);
  const now = new Date();
  const minutesUntilMatch = date ? differenceInMinutes(date, now) : null;

  // Press room: open 2h before kickoff AND during the match (not after completed)
  const canAccessPressRoom =
    (game.status === "scheduled" && minutesUntilMatch !== null && minutesUntilMatch <= 120) ||
    game.status === "in_progress";

  // Can kickoff: match is scheduled AND time has passed (or within 15 min early)
  const canKickoff =
    game.status === "scheduled" &&
    (minutesUntilMatch !== null ? minutesUntilMatch <= 15 : true);

  const isLive = game.status === "in_progress";
  const isCompleted = game.status === "completed";
  const isDisputed = game.status === "disputed";
  const isClubMatch = game.mode === "club";
  const isSoloMatch = game.mode === "solo" || (!game.mode && game.home_player_id);

  // Am I a participant in this match?
  const isMyMatch = isClubMatch
    ? myClub && (game.home_club_id === myClub.id || game.away_club_id === myClub.id)
    : myPlayer && (game.home_player_id === myPlayer.id || game.away_player_id === myPlayer.id);

  // Only home team/player can Kickoff and Full Time
  const amIHomeTeam = isClubMatch
    ? myClub && game.home_club_id === myClub.id
    : myPlayer && game.home_player_id === myPlayer.id;

  const home = isClubMatch ? game.home_club_name : game.home_player_name;
  const away = isClubMatch ? game.away_club_name : game.away_player_name;

  // Dressing-room gate — both clubs need ≥1 seated player to allow kickoff.
  // Solo matches don't have dressing rooms, so they're always "ready".
  const homeSeatReady   = !isClubMatch || dressingCounts.home > 0;
  const awaySeatReady   = !isClubMatch || dressingCounts.away > 0;
  const bothClubsReady  = homeSeatReady && awaySeatReady;

  async function handleKickoff() {
    setKickoffError("");
    setKickoffLoading(true);
    try {
      const res = await stageClient.functions.invoke("matchKickoff", {
        match_id: game.id,
        action: "kickoff",
      });
      if (res?.data?.success) {
        const updated = { ...game, status: "in_progress" };
        setGame(updated);
        if (onGameUpdate) onGameUpdate(updated);
      }
    } catch (err) {
      const code = err?.data?.code || err?.code;
      if (code === "DRESSING_ROOM_NOT_READY" || err?.status === 409) {
        setKickoffError(err?.message || t("matchFlow.bothNeedSeat", { home, away }));
      } else {
        setKickoffError(err?.message || t("matchFlow.actionFailed"));
      }
    } finally {
      setKickoffLoading(false);
    }
  }

  async function handleResultSubmitted(status, homeScore, awayScore) {
    setShowResultForm(false);

    // Always reload from server — captures submission flags, goal events, scores
    const fresh = await stageClient.entities.Match.filter({ id: game.id }, null, 1).catch(() => null);
    let updated = fresh?.[0] ? { ...game, ...fresh[0] } : {
      ...game,
      status: status === "disputed" ? "disputed" : status === "completed" ? "completed" : game.status,
      ...(status === "completed" && homeScore != null ? { home_score: homeScore, away_score: awayScore } : {}),
    };

    setGame(updated);
    if (onGameUpdate) onGameUpdate(updated);

    if (status === "completed") {
      processMatchRevenue(updated);
      processSoloMatchRevenue(updated);
      stageClient.functions.invoke("shirtSales", { action: "generate_for_match", match_id: updated.id }).catch(() => {});
      syncPlayerCareerStats(updated.id).catch(() => {});
    }
  }

  const statusLabel = STATUS_LABEL_KEYS[game.status] ? t(`matchFlow.${STATUS_LABEL_KEYS[game.status]}`) : game.status;
  const statusCls = STATUS_COLORS[game.status] || "bg-secondary text-muted-foreground";

  const allGoalEvents = [
    ...asJsonArray(game.home_goal_events).map((ev) => ({ ...ev, teamName: home })),
    ...asJsonArray(game.away_goal_events).map((ev) => ({ ...ev, teamName: away })),
  ].sort((a, b) => (Number(a.minute) || 0) - (Number(b.minute) || 0));
  const hasGoalTimeline = allGoalEvents.length > 0;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-lg">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border bg-secondary/40">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              {t("matchFlow.matchDetails")}
            </span>
          </div>
          <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", statusCls)}>
            {statusLabel}
          </span>
        </div>
        <h2 className="text-lg font-bold text-foreground">{home} {t("matchFlow.versus")} {away}</h2>
        {date && (
          <p className="text-xs text-muted-foreground mt-1">
            {format(date, "EEEE d MMMM yyyy · HH:mm")}
            {minutesUntilMatch !== null && minutesUntilMatch > 0 && game.status === "scheduled" && (
              <span className="ml-2 text-primary font-medium">
                (in {minutesUntilMatch < 60
                  ? `${minutesUntilMatch}m`
                  : `${Math.floor(minutesUntilMatch / 60)}h ${minutesUntilMatch % 60}m`})
              </span>
            )}
          </p>
        )}
        {game.competition_context ? (
          <div className="flex items-center gap-1.5 mt-1.5">
            <Trophy className="w-3 h-3 text-accent" />
            <span className="text-xs text-muted-foreground">{game.competition_context}</span>
          </div>
        ) : tournament ? (
          <div className="flex items-center gap-1.5 mt-1.5">
            <Trophy className="w-3 h-3 text-accent" />
            <span className="text-xs text-muted-foreground">{tournament.name}</span>
          </div>
        ) : game.tournament_id === "ranked" ? (
          <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">{t("matchFlow.rankedMatch")}</p>
        ) : null}
      </div>

      {/* Score */}
      {(isLive || isCompleted) && (
        <div className="px-5 py-5 border-b border-border">
          <div className="flex items-center justify-center gap-6">
            <div className="text-center">
              <p className="text-3xl font-black text-foreground">{game.home_score ?? 0}</p>
              <p className="text-[10px] text-muted-foreground mt-1 truncate max-w-[80px]">{home}</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-muted-foreground">–</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-black text-foreground">{game.away_score ?? 0}</p>
              <p className="text-[10px] text-muted-foreground mt-1 truncate max-w-[80px]">{away}</p>
            </div>
          </div>
        </div>
      )}

      {/* Stream Links — visible to all, editable by participants before/during match */}
      <StreamLinkSection
        game={game}
        isMyMatch={isMyMatch}
        amIHomeTeam={amIHomeTeam}
        isCompleted={isCompleted}
        myPlayer={myPlayer}
        onGameUpdate={(updated) => {
          setGame(updated);
          if (onGameUpdate) onGameUpdate(updated);
        }}
      />

      {/* Ticket revenue / attendance card — home club only, after completion */}
      {isCompleted && isClubMatch && Number(game.home_ticket_revenue || 0) > 0 && (
        <div className="mx-5 mb-3 rounded-xl border border-success/25 bg-success/5 px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <Ticket className="w-4 h-4 text-success shrink-0" />
            <span className="text-sm font-bold text-foreground">{t("matchFlow.gateReceipts")}</span>
            <span className="ml-auto text-sm font-black text-success">
              +{Number(game.home_ticket_revenue).toLocaleString()} STC
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-black/15 rounded-lg px-2 py-1.5">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{t("matchFlow.attendance")}</p>
              <p className="text-xs font-bold text-foreground">{Number(game.home_ticket_attendance || 0).toLocaleString()}</p>
            </div>
            <div className="bg-black/15 rounded-lg px-2 py-1.5">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{t("matchFlow.capacity")}</p>
              <p className="text-xs font-bold text-foreground">{Number(game.home_ticket_capacity || 0).toLocaleString()}</p>
            </div>
            <div className="bg-black/15 rounded-lg px-2 py-1.5">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{t("matchFlow.full")}</p>
              <p className={cn("text-xs font-bold", Number(game.home_ticket_pct || 0) >= 80 ? "text-success" : Number(game.home_ticket_pct || 0) >= 50 ? "text-warning" : "text-muted-foreground")}>
                {game.home_ticket_pct || 0}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Wager panel */}
      {(game.wager_stc > 0) && (
        <WagerPanel
          game={game}
          myPlayer={myPlayer}
          myClub={myClub}
          isMyMatch={isMyMatch}
          amIHomeTeam={amIHomeTeam}
          onGameUpdate={(updated) => {
            setGame(updated);
            if (onGameUpdate) onGameUpdate(updated);
          }}
        />
      )}

      {/* Match flow actions — for participants (both club and solo) */}
      {isMyMatch && !isCompleted && !isDisputed && (
        <div className="px-5 py-4 border-b border-border space-y-3">
          {/* Solo: show home/away role label */}
          {isSoloMatch && (
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              {t("matchFlow.youArePlayer", { side: amIHomeTeam ? t("matchFlow.home") : t("matchFlow.away") })}
            </p>
          )}
          {/* Kickoff — home team only */}
          {canKickoff && !isLive && !showResultForm && amIHomeTeam && (
            <div className="space-y-2">
              {minutesUntilMatch !== null && minutesUntilMatch > 15 && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/40 rounded-lg px-3 py-2 border border-border">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  {t("matchFlow.kickoffAvailable")}
                </div>
              )}
              {isClubMatch && !bothClubsReady && (
                <div className="flex items-start gap-2 text-xs bg-warning/10 rounded-lg px-3 py-2 border border-warning/20 text-warning">
                  <UserCheck className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-semibold">{t("matchFlow.dressingRoomsNotReady")}</p>
                    <p className="text-[10px] opacity-90">
                      {!homeSeatReady && !awaySeatReady
                        ? t("matchFlow.bothNeedSeat", { home, away })
                        : !homeSeatReady
                          ? t("matchFlow.yourClubNeedsSeat")
                          : t("matchFlow.waitingAwaySeat", { away })}
                    </p>
                  </div>
                </div>
              )}
              <Button
                onClick={handleKickoff}
                disabled={
                  kickoffLoading ||
                  minutesUntilMatch > 15 ||
                  (isClubMatch && !bothClubsReady)
                }
                className="w-full bg-success gap-2 text-white font-bold"
              >
                {kickoffLoading
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <><Play className="w-4 h-4" /> {t("matchFlow.kickoff")}</>
                }
              </Button>
              {kickoffError && (
                <p className="text-[11px] text-destructive text-center">{kickoffError}</p>
              )}
            </div>
          )}
          {canKickoff && !isLive && !showResultForm && !amIHomeTeam && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/40 rounded-lg px-3 py-2 border border-border">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                {t("matchFlow.waitingHomeKickoff")}
              </div>
              {isClubMatch && !bothClubsReady && (
                <div className="flex items-start gap-2 text-xs bg-warning/10 rounded-lg px-3 py-2 border border-warning/20 text-warning">
                  <UserCheck className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-semibold">{t("matchFlow.kickoffBlocked")}</p>
                    <p className="text-[10px] opacity-90">
                      {!awaySeatReady && !homeSeatReady
                        ? t("matchFlow.takeSeatBoth", { home })
                        : !awaySeatReady
                          ? t("matchFlow.takeSeatYourClub")
                          : t("matchFlow.waitingHomeSeat", { home })}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Full Time — both teams submit independently once match is live */}
          {isLive && !showResultForm && amIHomeTeam && !game.result_home_submitted && (
            <Button
              onClick={() => setShowResultForm(true)}
              className="w-full bg-destructive gap-2 text-white font-bold"
            >
              <Flag className="w-4 h-4" /> {t("matchFlow.submitFullTime")}
            </Button>
          )}
          {isLive && !showResultForm && !amIHomeTeam && !game.result_away_submitted && (
            <Button
              onClick={() => setShowResultForm(true)}
              variant="outline"
              className="w-full gap-2 border-warning text-warning hover:text-warning font-bold"
            >
              <Flag className="w-4 h-4" /> {t("matchFlow.submitMyResult")}
            </Button>
          )}
          {isLive && !showResultForm && amIHomeTeam && game.result_home_submitted && (
            <div className="flex items-center gap-2 text-xs text-success bg-success/10 rounded-lg px-3 py-2 border border-success/30">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              {t("matchFlow.resultWaitingAway")}
            </div>
          )}
          {isLive && !showResultForm && !amIHomeTeam && game.result_away_submitted && (
            <div className="flex items-center gap-2 text-xs text-success bg-success/10 rounded-lg px-3 py-2 border border-success/30">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              {t("matchFlow.resultWaitingHome")}
            </div>
          )}

          {/* Result form */}
          {showResultForm && (
            <GameDayMatchResult
              game={game}
              myClub={myClub}
              myPlayer={myPlayer}
              isHomeTeam={amIHomeTeam}
              onSubmitted={handleResultSubmitted}
            />
          )}
        </div>
      )}

      {/* Disputed banner */}
      {isDisputed && isMyMatch && (
        <div className="px-5 py-3 border-b border-border bg-destructive/10">
          <p className="text-xs font-semibold text-destructive">{t("matchFlow.resultDisputed")}</p>
        </div>
      )}

      {/* Tabs — home and away participants; chat for club + solo, dressing/press club-only */}
      {isMyMatch && (
        <Tabs
          key={game.id}
          defaultValue={isClubMatch && myClub ? "dressing_room" : "chat"}
          className="border-0"
        >
          <TabsList className="w-full rounded-none border-b border-border bg-secondary/20 justify-start h-auto p-0 overflow-x-auto">
            {isClubMatch && myClub && (
              <TabsTrigger value="dressing_room" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary flex items-center gap-1.5 text-xs whitespace-nowrap">
                <Users className="w-3.5 h-3.5" /> {t("matchFlow.dressingRoom")}
              </TabsTrigger>
            )}
            {isClubMatch && myClub && canAccessPressRoom && (
              <TabsTrigger value="press_room" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary flex items-center gap-1.5 text-xs whitespace-nowrap">
                <Mic className="w-3.5 h-3.5" /> {t("matchFlow.pressRoom")}
              </TabsTrigger>
            )}
            <TabsTrigger value="chat" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary flex items-center gap-1.5 text-xs whitespace-nowrap">
              <MessageSquare className="w-3.5 h-3.5" /> {t("matchFlow.chat")}
              {chatUnread > 0 && (
                <span
                  aria-label={t("matchFlow.unreadChat", { count: chatUnread })}
                  className="ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold leading-none"
                >
                  {chatUnread > 99 ? "99+" : chatUnread}
                </span>
              )}
            </TabsTrigger>
            {isCompleted && (stats.length > 0 || hasGoalTimeline) && (
              <TabsTrigger value="stats" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary flex items-center gap-1.5 text-xs whitespace-nowrap">
                <Target className="w-3.5 h-3.5" /> {t("matchFlow.stats")}
              </TabsTrigger>
            )}
          </TabsList>

          {isClubMatch && myClub && (
            <TabsContent value="dressing_room" className="p-4">
              <GameDayDressingRoom game={game} myClub={myClub} myPlayer={myPlayer} user={user} />
            </TabsContent>
          )}

          {isClubMatch && myClub && canAccessPressRoom && (
            <TabsContent value="press_room" className="p-4">
              <GameDayPressRoom game={game} myClub={myClub} myPlayer={myPlayer} user={user} />
            </TabsContent>
          )}

          <TabsContent value="chat" className="p-4">
            <GameDayMatchChat game={game} myClub={myClub} myPlayer={myPlayer} user={user} />
          </TabsContent>

          {isCompleted && (stats.length > 0 || hasGoalTimeline) && (
            <TabsContent value="stats" className="p-4 space-y-4">
              {hasGoalTimeline && (
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">{t("matchFlow.goals")}</p>
                  <div className="space-y-0.5">
                    {allGoalEvents.map((ev, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs py-1.5 border-b border-border last:border-0">
                        <span className="text-muted-foreground w-8 shrink-0 text-right">
                          {ev.minute ? `${ev.minute}'` : "—"}
                        </span>
                        <Target className="w-3 h-3 text-success shrink-0" />
                        <span className="font-medium text-foreground">{ev.scorer_gamertag || "?"}</span>
                        {ev.assist_gamertag && (
                          <span className="text-muted-foreground flex items-center gap-0.5">
                            <Zap className="w-2.5 h-2.5" />{ev.assist_gamertag}
                          </span>
                        )}
                        {ev.is_penalty && (
                          <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-warning/10 text-warning">PEN</span>
                        )}
                        <span className="ml-auto text-[10px] text-muted-foreground">{ev.teamName}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {stats.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">{t("matchFlow.playerRatings")}</p>
                  {stats.map(stat => (
                    <div key={stat.id} className="text-xs border border-border rounded px-2 py-2 flex items-center justify-between">
                      <span className="text-foreground font-medium">{stat.player_gamertag}</span>
                      <div className="flex items-center gap-3 text-muted-foreground">
                        {stat.goals > 0 && <span className="flex items-center gap-1 text-success"><Target className="w-3 h-3" />{stat.goals}</span>}
                        {stat.assists > 0 && <span className="flex items-center gap-1 text-primary"><Zap className="w-3 h-3" />{stat.assists}</span>}
                        <span className="font-semibold text-foreground">{stat.rating}/10</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>
      )}

      {/* Non-participant view — only show if truly not a participant */}
      {!isMyMatch && (
        <div className="p-4">
          {isCompleted && stats.length > 0 ? (
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">{t("matchFlow.stats")}</p>
              <div className="space-y-1.5">
                {stats.map(stat => (
                  <div key={stat.id} className="text-xs border border-border rounded px-2 py-1.5 flex items-center justify-between">
                    <span className="font-medium">{stat.player_gamertag}</span>
                    <span className="text-muted-foreground">{stat.rating}/10</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {isLive ? t("matchFlow.matchInProgress") : t("matchFlow.noDetailsYet")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

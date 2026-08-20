import { useState, useEffect } from "react";
import { stageClient } from "@/api/stageClient";
import { processMatchRevenue, processSoloMatchRevenue } from "@/lib/matchRevenue";
import { syncPlayerCareerStats } from "@/lib/gameDayIntegration";
import { parseISO, isValid, differenceInMinutes } from "@/lib/momentDate";
import { Target, Zap, MessageSquare, Play, Flag, Clock, CheckCircle2, Ticket, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import GameDayDressingRoom from "./GameDayDressingRoom";
import GameDayMatchChat from "./GameDayMatchChat";
import GameDayMatchResult from "./GameDayMatchResult";
import GameDayKickoffArena from "./GameDayKickoffArena";
import StreamLinkSection from "./StreamLinkSection";
import WagerPanel from "./WagerPanel";
import GameDayFixtureActions from "./GameDayFixtureActions";
import { cn } from "@/lib/utils";
import { useChatNotifications } from "@/lib/ChatNotificationsContext";
import { useTranslation } from "@/hooks/useTranslation";
import { getResultSubmissionControls, getKickoffControls, isClubGameDayMatch } from "@/lib/gameDayResultFlow";
import { getMatchSideNames } from "@/lib/gameDayPresentation";
import { sameRecordId } from "@/lib/gameDayRealtime";
import { useGameDayMatchRealtime } from "@/lib/useGameDayMatchRealtime";

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

const STATUS_LABEL_KEYS = {
  scheduled: "scheduled",
  in_progress: "live",
  awaiting_confirmation: "pending",
  disputed: "disputed",
  completed: "fullTime",
  forfeit: "forfeit",
};

export default function GameDayDetail({
  game: initialGame,
  myClub,
  myPlayer,
  user,
  onGameUpdate,
  opsOpen = false,
  chatOpen = false,
  onOpsOpenChange,
  onChatOpenChange,
}) {
  const { t } = useTranslation();
  const [game, setGame] = useState(initialGame);
  const [tournament, setTournament] = useState(null);
  const [stats, setStats] = useState([]);
  const [kickoffLoading, setKickoffLoading] = useState(false);
  const [kickoffError, setKickoffError]     = useState("");
  const [showResultForm, setShowResultForm] = useState(false);
  // Live "seated player" counts for the home and away dressing rooms; used to
  // gate the Kickoff button so a match can't start with an empty roster.
  const [dressingCounts, setDressingCounts] = useState({ home: 0, away: 0 });
  const [crests, setCrests] = useState({ home: null, away: null });

  // Update game when parent passes new data
  useEffect(() => { setGame(initialGame); }, [initialGame]);

  // Unread badge on the Chat tab trigger. Reads off the global chat
  // notifications provider; falls back to 0 when no provider is mounted.
  const { getUnreadCount, registerChannel } = useChatNotifications();
  const chatUnread = game?.id ? getUnreadCount(game.id) : 0;

  useEffect(() => {
    if (game?.id) registerChannel(game.id);
  }, [game?.id, registerChannel]);

  const isClubMatchEarly = isClubGameDayMatch(game);

  useEffect(() => {
    if (!game?.id) return;
    async function load() {
      if (game.tournament_id && game.tournament_id !== "ranked") {
        const tournaments = await stageClient.entities.Tournament.filter({ id: game.tournament_id });
        if (tournaments.length > 0) setTournament(tournaments[0]);
      }
      const matchStats = await stageClient.entities.MatchPlayerStat.filter({ match_id: game.id });
      setStats(matchStats || []);
    }
    load();
  }, [game?.id, game?.tournament_id]);

  useEffect(() => {
    if (!game?.id) return undefined;
    let cancelled = false;

    async function loadCrests() {
      if (isClubMatchEarly) {
        const [homeClub, awayClub] = await Promise.all([
          game.home_club_id && stageClient.entities.Club?.get
            ? stageClient.entities.Club.get(game.home_club_id).catch(() => null)
            : Promise.resolve(null),
          game.away_club_id && stageClient.entities.Club?.get
            ? stageClient.entities.Club.get(game.away_club_id).catch(() => null)
            : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setCrests({
          home: homeClub?.logo_url || (myClub && String(myClub.id) === String(game.home_club_id) ? myClub.logo_url : null) || null,
          away: awayClub?.logo_url || (myClub && String(myClub.id) === String(game.away_club_id) ? myClub.logo_url : null) || null,
        });
        return;
      }

      const [homePlayer, awayPlayer] = await Promise.all([
        game.home_player_id && stageClient.entities.Player?.get
          ? stageClient.entities.Player.get(game.home_player_id).catch(() => null)
          : Promise.resolve(null),
        game.away_player_id && stageClient.entities.Player?.get
          ? stageClient.entities.Player.get(game.away_player_id).catch(() => null)
          : Promise.resolve(null),
      ]);
      if (cancelled) return;
      setCrests({
        home: homePlayer?.avatar_url || (myPlayer && String(myPlayer.id) === String(game.home_player_id) ? myPlayer.avatar_url : null) || null,
        away: awayPlayer?.avatar_url || (myPlayer && String(myPlayer.id) === String(game.away_player_id) ? myPlayer.avatar_url : null) || null,
      });
    }

    loadCrests();
    return () => { cancelled = true; };
  }, [
    game?.id,
    game?.home_club_id,
    game?.away_club_id,
    game?.home_player_id,
    game?.away_player_id,
    isClubMatchEarly,
    myClub,
    myPlayer,
  ]);

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
    return () => { cancelled = true; };
  }, [game?.id, game?.home_club_id, game?.away_club_id, isClubMatchEarly]);

  useGameDayMatchRealtime({
    matchId: game?.id,
    reloadMatch: async (id) => stageClient.entities.Match.get(id).catch(() => null),
    onMatch: (fresh) => {
      if (fresh?.deleted) return;
      setGame((prev) => (prev?.id && sameRecordId(prev.id, fresh.id) ? { ...prev, ...fresh } : fresh));
      onGameUpdate?.(fresh);
    },
    onDressing: (room) => {
      if (!room || !isClubMatchEarly) return;
      const raw = room.seated_players;
      let val = raw;
      if (typeof val === "string") {
        try { val = JSON.parse(val); } catch { val = []; }
      }
      const count = Array.isArray(val) ? val.length : 0;
      setDressingCounts((prev) => {
        if (sameRecordId(room.club_id, game.home_club_id)) return { ...prev, home: count };
        if (sameRecordId(room.club_id, game.away_club_id)) return { ...prev, away: count };
        return prev;
      });
    },
  });

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

  const isLive = game.status === "in_progress";
  const isCompleted = game.status === "completed";
  const isDisputed = game.status === "disputed";
  const isClubMatch = isClubGameDayMatch(game);
  const isSoloMatch = game.mode === "solo" || (!isClubMatch && Boolean(game.home_player_id));

  // Am I a participant in this match?
  const isMyMatch = isClubMatch
    ? myClub && (String(game.home_club_id) === String(myClub.id) || String(game.away_club_id) === String(myClub.id))
    : myPlayer && (String(game.home_player_id) === String(myPlayer.id) || String(game.away_player_id) === String(myPlayer.id));

  // Only home team/player can Kickoff and Full Time
  const amIHomeTeam = isClubMatch
    ? myClub && String(game.home_club_id) === String(myClub.id)
    : myPlayer && String(game.home_player_id) === String(myPlayer.id);
  const resultControls = getResultSubmissionControls({ game, isLive, showResultForm, amIHomeTeam });

  const { home, away } = getMatchSideNames(game, t("matchFlow.tbd"));

  // Dressing-room gate — both clubs need ≥1 seated player to allow kickoff.
  // Solo matches don't have dressing rooms, so they're always "ready".
  const homeSeatReady   = !isClubMatch || dressingCounts.home > 0;
  const awaySeatReady   = !isClubMatch || dressingCounts.away > 0;
  const bothClubsReady  = homeSeatReady && awaySeatReady;
  const kickoffControls = getKickoffControls({
    game,
    isMyMatch,
    amIHomeTeam,
    isLive,
    showResultForm,
    minutesUntilMatch,
    isClubMatch,
    bothClubsReady,
  });

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
  const competitionLabel = game.competition_context
    || tournament?.name
    || (game.tournament_id === "ranked" ? t("matchFlow.rankedMatch") : t("matchFlow.matchDetails"));
  const homeYou = isClubMatch
    ? Boolean(myClub && String(game.home_club_id) === String(myClub.id))
    : Boolean(myPlayer && String(game.home_player_id) === String(myPlayer.id));
  const awayYou = isClubMatch
    ? Boolean(myClub && String(game.away_club_id) === String(myClub.id))
    : Boolean(myPlayer && String(game.away_player_id) === String(myPlayer.id));

  const allGoalEvents = [
    ...asJsonArray(game.home_goal_events).map((ev) => ({ ...ev, teamName: home })),
    ...asJsonArray(game.away_goal_events).map((ev) => ({ ...ev, teamName: away })),
  ].sort((a, b) => (Number(a.minute) || 0) - (Number(b.minute) || 0));
  const hasGoalTimeline = allGoalEvents.length > 0;

  const showKickoffDock = isMyMatch && !isCompleted && !isDisputed
    && (kickoffControls.showHomeKickoff || kickoffControls.showAwayWaiting);
  const showResultDock = isMyMatch && !isCompleted && !isDisputed && (
    resultControls.showHomeSubmit
    || resultControls.showAwayWaitingForHome
    || resultControls.showAwaySubmit
    || resultControls.showHomeWaitingForAway
    || resultControls.showAwaySubmittedWaitingForHome
    || showResultForm
  );
  const showDressingRoomPanel = isClubMatch && isMyMatch && myClub && !isDisputed;
  const updateDressingCountForClub = ({ clubId, seatedPlayers }) => {
    const count = Array.isArray(seatedPlayers) ? seatedPlayers.length : 0;
    setDressingCounts((prev) => {
      if (sameRecordId(clubId, game.home_club_id)) return { ...prev, home: count };
      if (sameRecordId(clubId, game.away_club_id)) return { ...prev, away: count };
      return prev;
    });
  };

  return (
    <div className="overflow-hidden border border-[#f5c542]/20 bg-[#05080f] shadow-[0_0_80px_-24px_rgba(245,197,66,0.35)]">
      <GameDayKickoffArena
        homeName={home}
        awayName={away}
        homeLogo={crests.home}
        awayLogo={crests.away}
        homeYou={homeYou}
        awayYou={awayYou}
        homeLabel={t("matchFlow.home")}
        awayLabel={t("matchFlow.away")}
        date={date}
        status={game.status}
        statusLabel={statusLabel}
        competitionLabel={competitionLabel}
        homeScore={game.home_score}
        awayScore={game.away_score}
        wagerStc={game.wager_stc}
        wagerLocked={Boolean(game.wager_home_locked && game.wager_away_locked)}
      >
        {showKickoffDock ? (
          <div className="space-y-2">
            {isSoloMatch && (
              <p className="text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-white/55">
                {t("matchFlow.youArePlayer", { side: amIHomeTeam ? t("matchFlow.home") : t("matchFlow.away") })}
              </p>
            )}
            {kickoffControls.showHomeKickoff && (
              <div className="space-y-2">
                {kickoffControls.tooEarly && (
                  <div className="flex items-center gap-2 rounded-sm border border-white/10 bg-black/40 px-3 py-2 text-xs text-white/70">
                    <Clock className="h-3.5 w-3.5 shrink-0 text-[#f5c542]" />
                    {t("matchFlow.kickoffAvailable")}
                  </div>
                )}
                {kickoffControls.dressingBlocked && (
                  <div className="flex items-start gap-2 rounded-sm border border-[#f5c542]/30 bg-[#f5c542]/10 px-3 py-2 text-xs text-[#f5c542]">
                    <UserCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
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
                  disabled={kickoffLoading || !kickoffControls.canPressKickoff}
                  className="h-14 w-full gap-2 rounded-sm bg-gradient-to-b from-[#ffe27a] to-[#c9a227] font-heading text-xl font-black uppercase tracking-[0.28em] text-black shadow-[0_0_40px_rgba(245,197,66,0.4)] hover:from-[#fff0a8] hover:to-[#d4ad30] disabled:from-[#2a2410] disabled:to-[#1a1608] disabled:text-[#8a7a40] disabled:shadow-none"
                >
                  {kickoffLoading
                    ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-black/20 border-t-black" />
                    : <><Play className="h-5 w-5 fill-current" /> {t("matchFlow.kickoff")}</>
                  }
                </Button>
                {kickoffError && (
                  <p className="text-center text-[11px] text-destructive">{kickoffError}</p>
                )}
              </div>
            )}
            {kickoffControls.showAwayWaiting && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 rounded-sm border border-white/10 bg-black/40 px-3 py-2 text-xs text-white/70">
                  <Clock className="h-3.5 w-3.5 shrink-0 text-[#00e5ff]" />
                  {t("matchFlow.waitingHomeKickoff")}
                </div>
                {isClubMatch && !bothClubsReady && (
                  <div className="flex items-start gap-2 rounded-sm border border-[#f5c542]/30 bg-[#f5c542]/10 px-3 py-2 text-xs text-[#f5c542]">
                    <UserCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
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
          </div>
        ) : null}
      </GameDayKickoffArena>

      {showDressingRoomPanel && (
        <section className="border-t border-[#00e5ff]/15 bg-gradient-to-r from-[#06131e] via-black/35 to-[#071827] px-4 py-4 sm:px-6">
          <div className="mx-auto max-w-4xl border border-[#00e5ff]/25 bg-black/35 p-4 shadow-[0_0_32px_-18px_rgba(0,229,255,0.65)] [clip-path:polygon(18px_0,100%_0,calc(100%_-_18px)_100%,0_100%)] sm:p-5">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-heading text-[11px] font-black uppercase tracking-[0.2em] text-[#00e5ff]">
                  {t("matchFlow.dressingRoom")}
                </p>
                <p className="mt-1 text-xs text-white/55">
                  Available players take a seat here before kickoff so they can be featured in the game.
                </p>
              </div>
              <div className="flex gap-2 text-[10px] font-black uppercase tracking-[0.14em]">
                <span className="border border-[#f5c542]/35 bg-[#f5c542]/10 px-2.5 py-1 text-[#f5c542] [clip-path:polygon(7px_0,100%_0,calc(100%_-_7px)_100%,0_100%)]">
                  Home {dressingCounts.home}
                </span>
                <span className="border border-[#00e5ff]/35 bg-[#00e5ff]/10 px-2.5 py-1 text-[#00e5ff] [clip-path:polygon(7px_0,100%_0,calc(100%_-_7px)_100%,0_100%)]">
                  Away {dressingCounts.away}
                </span>
              </div>
            </div>
            <GameDayDressingRoom
              game={game}
              myClub={myClub}
              myPlayer={myPlayer}
              user={user}
              onSeatChange={updateDressingCountForClub}
            />
          </div>
        </section>
      )}

      {showResultDock && (
        <section className="border-t border-[#f5c542]/15 bg-black/45 px-4 py-4 sm:px-6">
          <div className="mx-auto max-w-3xl space-y-3 border border-[#f5c542]/25 bg-[#090b08]/80 p-4 [clip-path:polygon(18px_0,100%_0,calc(100%_-_18px)_100%,0_100%)] sm:p-5">
            {resultControls.showHomeSubmit && (
              <Button
                onClick={() => setShowResultForm(true)}
                className="h-12 w-full gap-2 rounded-sm bg-destructive font-heading text-sm font-black uppercase tracking-[0.18em] text-white"
              >
                <Flag className="h-4 w-4" /> {t("matchFlow.submitFullTime")}
              </Button>
            )}
            {resultControls.showAwayWaitingForHome && (
              <div className="flex items-center gap-2 rounded-sm border border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                {t("matchFlow.waitingHomeFullTime")}
              </div>
            )}
            {resultControls.showAwaySubmit && (
              <Button
                onClick={() => setShowResultForm(true)}
                variant="outline"
                className="h-12 w-full gap-2 rounded-sm border-warning font-heading text-sm font-black uppercase tracking-[0.18em] text-warning hover:text-warning"
              >
                <Flag className="h-4 w-4" /> {t("matchFlow.submitMyResult")}
              </Button>
            )}
            {resultControls.showHomeWaitingForAway && (
              <div className="flex items-center gap-2 rounded-sm border border-success/30 bg-success/10 px-3 py-2 text-xs text-success">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                {t("matchFlow.resultWaitingAway")}
              </div>
            )}
            {resultControls.showAwaySubmittedWaitingForHome && (
              <div className="flex items-center gap-2 rounded-sm border border-success/30 bg-success/10 px-3 py-2 text-xs text-success">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                {t("matchFlow.resultWaitingHome")}
              </div>
            )}
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
        </section>
      )}

      {isDisputed && isMyMatch && (
        <div className="border-b border-destructive/30 bg-destructive/10 px-5 py-3">
          <p className="text-xs font-semibold text-destructive">{t("matchFlow.resultDisputed")}</p>
        </div>
      )}

      <Dialog open={opsOpen} onOpenChange={onOpsOpenChange}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto border-[#f5c542]/20 bg-[#071018] p-0 text-white">
          <DialogHeader className="px-5 pt-5">
            <DialogTitle className="font-heading text-sm font-black uppercase tracking-[0.18em] text-[#00e5ff]">
              {t("matchFlow.liveStream")}
            </DialogTitle>
          </DialogHeader>
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

          {isCompleted && isClubMatch && Number(game.home_ticket_revenue || 0) > 0 && (
            <div className="mx-5 mb-3 rounded-sm border border-success/25 bg-success/5 px-4 py-3">
              <div className="mb-2 flex items-center gap-2">
                <Ticket className="h-4 w-4 shrink-0 text-success" />
                <span className="text-sm font-bold text-foreground">{t("matchFlow.gateReceipts")}</span>
                <span className="ml-auto text-sm font-black text-success">
                  +{Number(game.home_ticket_revenue).toLocaleString()} STC
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-sm bg-black/15 px-2 py-1.5">
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{t("matchFlow.attendance")}</p>
                  <p className="text-xs font-bold text-foreground">{Number(game.home_ticket_attendance || 0).toLocaleString()}</p>
                </div>
                <div className="rounded-sm bg-black/15 px-2 py-1.5">
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{t("matchFlow.capacity")}</p>
                  <p className="text-xs font-bold text-foreground">{Number(game.home_ticket_capacity || 0).toLocaleString()}</p>
                </div>
                <div className="rounded-sm bg-black/15 px-2 py-1.5">
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{t("matchFlow.full")}</p>
                  <p className={cn("text-xs font-bold", Number(game.home_ticket_pct || 0) >= 80 ? "text-success" : Number(game.home_ticket_pct || 0) >= 50 ? "text-warning" : "text-muted-foreground")}>
                    {game.home_ticket_pct || 0}%
                  </p>
                </div>
              </div>
            </div>
          )}

          {game.wager_stc > 0 && (
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

          <GameDayFixtureActions
            game={game}
            user={user}
            myPlayer={myPlayer}
            myClub={myClub}
            isMyMatch={isMyMatch}
            onGameUpdate={(updated) => {
              setGame(updated);
              if (onGameUpdate) onGameUpdate(updated);
            }}
          />

        </DialogContent>
      </Dialog>

      <Dialog open={chatOpen} onOpenChange={onChatOpenChange}>
        <DialogContent className="flex max-h-[85vh] max-w-lg flex-col overflow-hidden border-[#f5c542]/20 bg-[#071018] p-0 text-white">
          <DialogHeader className="px-5 pt-5">
            <DialogTitle className="font-heading text-sm font-black uppercase tracking-[0.18em] text-[#f5c542]">
              {t("matchFlow.chat")}
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {isMyMatch ? (
              <Tabs
                key={game.id}
                defaultValue="chat"
                className="border-0"
              >
                <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-none border-b border-white/10 bg-black/30 p-0">
                  <TabsTrigger value="chat" className="rounded-none font-heading text-[11px] uppercase tracking-[0.16em] data-[state=active]:border-b-2 data-[state=active]:border-[#f5c542] data-[state=active]:text-[#f5c542] flex items-center gap-1.5 whitespace-nowrap">
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
                    <TabsTrigger value="stats" className="rounded-none font-heading text-[11px] uppercase tracking-[0.16em] data-[state=active]:border-b-2 data-[state=active]:border-[#f5c542] data-[state=active]:text-[#f5c542] flex items-center gap-1.5 whitespace-nowrap">
                      <Target className="w-3.5 h-3.5" /> {t("matchFlow.stats")}
                    </TabsTrigger>
                  )}
                </TabsList>

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
            ) : (
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
        </DialogContent>
      </Dialog>
    </div>
  );
}

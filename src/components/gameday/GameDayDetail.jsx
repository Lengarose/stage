import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { processMatchRevenue } from "@/lib/matchRevenue";
import { generateMatchShirtSales } from "@/lib/virtualShirtSales";
import { format, parseISO, isValid, differenceInMinutes } from "date-fns";
import { Shield, Trophy, Target, Zap, MessageSquare, Users, Mic, Play, Flag, Clock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import GameDayDressingRoom from "./GameDayDressingRoom";
import GameDayPressRoom from "./GameDayPressRoom";
import GameDayMatchChat from "./GameDayMatchChat";
import GameDayMatchResult from "./GameDayMatchResult";
import StreamLinkSection from "./StreamLinkSection";
import WagerPanel from "./WagerPanel";
import { cn } from "@/lib/utils";

function parseDate(d) {
  if (!d) return null;
  const p = typeof d === "string" ? parseISO(d) : new Date(d);
  return isValid(p) ? p : null;
}

const STATUS_COLORS = {
  scheduled: "bg-primary/10 text-primary",
  in_progress: "bg-success/10 text-success",
  awaiting_confirmation: "bg-warning/10 text-warning",
  completed: "bg-secondary text-muted-foreground",
  forfeit: "bg-destructive/10 text-destructive",
};

const STATUS_LABELS = {
  scheduled: "Scheduled",
  in_progress: "● Live",
  awaiting_confirmation: "Pending",
  completed: "Full Time",
  forfeit: "Forfeit",
};

export default function GameDayDetail({ game: initialGame, myClub, myPlayer, user, onGameUpdate }) {
  const [game, setGame] = useState(initialGame);
  const [tournament, setTournament] = useState(null);
  const [stats, setStats] = useState([]);
  const [isHomeClub, setIsHomeClub] = useState(false);
  const [kickoffLoading, setKickoffLoading] = useState(false);
  const [showResultForm, setShowResultForm] = useState(false);

  // Update game when parent passes new data
  useEffect(() => { setGame(initialGame); }, [initialGame]);

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

  useEffect(() => {
    async function load() {
      if (game.tournament_id && game.tournament_id !== "ranked") {
        const tournaments = await base44.entities.Tournament.filter({ id: game.tournament_id });
        if (tournaments.length > 0) setTournament(tournaments[0]);
      }
      const matchStats = await base44.entities.MatchPlayerStat.filter({ match_id: game.id });
      setStats(matchStats || []);
      setIsHomeClub(isClubMatch ? (myClub ? game.home_club_id === myClub.id : false) : false);
    }
    load();
  }, [game.id, game.tournament_id, myClub]);

  async function handleKickoff() {
    setKickoffLoading(true);
    const res = await base44.functions.invoke("matchKickoff", {
      match_id: game.id,
      action: "kickoff",
    });
    // Optimistic update
    if (res?.data?.success) {
      const updated = { ...game, status: "in_progress" };
      setGame(updated);
      if (onGameUpdate) onGameUpdate(updated);
    }
    setKickoffLoading(false);
  }

  function handleResultSubmitted(status, homeScore, awayScore) {
    setShowResultForm(false);
    const newStatus = status === "disputed" ? "disputed" : status === "completed" ? "completed" : game.status;
    const updated = {
      ...game,
      status: newStatus,
      ...(newStatus === "completed" && homeScore != null ? { home_score: homeScore, away_score: awayScore } : {}),
    };
    setGame(updated);
    if (onGameUpdate) onGameUpdate(updated);

    // Fire-and-forget: ticket revenue + wager settlement + inbox messages + shirt sales
    if (newStatus === "completed") {
      processMatchRevenue(updated);
      generateMatchShirtSales(updated);
    }
  }

  const statusLabel = STATUS_LABELS[game.status] || game.status;
  const statusCls = STATUS_COLORS[game.status] || "bg-secondary text-muted-foreground";

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-lg">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border bg-secondary/40">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              Match Details
            </span>
          </div>
          <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", statusCls)}>
            {statusLabel}
          </span>
        </div>
        <h2 className="text-lg font-bold text-foreground">{home} vs {away}</h2>
        {date && (
          <p className="text-xs text-muted-foreground mt-1">
            {format(date, "EEEE d MMMM · HH:mm")}
            {minutesUntilMatch !== null && minutesUntilMatch > 0 && game.status === "scheduled" && (
              <span className="ml-2 text-primary font-medium">
                (in {minutesUntilMatch < 60
                  ? `${minutesUntilMatch}m`
                  : `${Math.floor(minutesUntilMatch / 60)}h ${minutesUntilMatch % 60}m`})
              </span>
            )}
          </p>
        )}
        {tournament && (
          <div className="flex items-center gap-1.5 mt-1.5">
            <Trophy className="w-3 h-3 text-accent" />
            <span className="text-xs text-muted-foreground">{tournament.name}</span>
          </div>
        )}
        {(!tournament && game.tournament_id === "ranked") && (
          <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">Ranked Match</p>
        )}
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
        onGameUpdate={(updated) => {
          setGame(updated);
          if (onGameUpdate) onGameUpdate(updated);
        }}
      />

      {/* Wager panel */}
      {(game.wager_stc > 0) && (
        <WagerPanel
          game={game}
          myPlayer={myPlayer}
          isMyMatch={isMyMatch}
          amIHomeTeam={amIHomeTeam}
          onGameUpdate={onGameUpdate}
        />
      )}

      {/* Match flow actions — for participants (both club and solo) */}
      {isMyMatch && !isCompleted && !isDisputed && (
        <div className="px-5 py-4 border-b border-border space-y-3">
          {/* Solo: show home/away role label */}
          {isSoloMatch && (
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              You are the {amIHomeTeam ? "Home" : "Away"} player
            </p>
          )}
          {/* Kickoff — home team only */}
          {canKickoff && !isLive && !showResultForm && amIHomeTeam && (
            <div className="space-y-2">
              {minutesUntilMatch !== null && minutesUntilMatch > 15 && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/40 rounded-lg px-3 py-2 border border-border">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  Kickoff available 15 minutes before match time.
                </div>
              )}
              <Button
                onClick={handleKickoff}
                disabled={kickoffLoading || minutesUntilMatch > 15}
                className="w-full bg-success gap-2 text-white font-bold"
              >
                {kickoffLoading
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <><Play className="w-4 h-4" /> Kickoff</>
                }
              </Button>
            </div>
          )}
          {canKickoff && !isLive && !showResultForm && !amIHomeTeam && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/40 rounded-lg px-3 py-2 border border-border">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              Waiting for home team to kick off.
            </div>
          )}

          {/* Full Time — home calls it; away can submit their result independently */}
          {isLive && !showResultForm && amIHomeTeam && !game.result_home_submitted && (
            <Button
              onClick={() => setShowResultForm(true)}
              className="w-full bg-destructive gap-2 text-white font-bold"
            >
              <Flag className="w-4 h-4" /> Full Time — Submit Result
            </Button>
          )}
          {isLive && !showResultForm && !amIHomeTeam && !game.result_away_submitted && game.result_home_submitted && (
            <Button
              onClick={() => setShowResultForm(true)}
              variant="outline"
              className="w-full gap-2 border-warning text-warning hover:text-warning font-bold"
            >
              <Flag className="w-4 h-4" /> Submit My Result
            </Button>
          )}
          {isLive && !showResultForm && !amIHomeTeam && !game.result_away_submitted && !game.result_home_submitted && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/40 rounded-lg px-3 py-2 border border-border">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              Waiting for home team to call Full Time before you can submit.
            </div>
          )}
          {isLive && !showResultForm && amIHomeTeam && game.result_home_submitted && (
            <div className="flex items-center gap-2 text-xs text-success bg-success/10 rounded-lg px-3 py-2 border border-success/30">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              Result submitted — waiting for away team.
            </div>
          )}
          {isLive && !showResultForm && !amIHomeTeam && game.result_away_submitted && (
            <div className="flex items-center gap-2 text-xs text-success bg-success/10 rounded-lg px-3 py-2 border border-success/30">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              Result submitted — waiting for home team.
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
          <p className="text-xs font-semibold text-destructive">⚠️ Result disputed — admin is reviewing. You will be notified when resolved.</p>
        </div>
      )}

      {/* Tabs */}
      {isClubMatch && myClub && isMyMatch && (
        <Tabs defaultValue="dressing_room" className="border-0">
          <TabsList className="w-full rounded-none border-b border-border bg-secondary/20 justify-start h-auto p-0 overflow-x-auto">
            <TabsTrigger value="dressing_room" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary flex items-center gap-1.5 text-xs whitespace-nowrap">
              <Users className="w-3.5 h-3.5" /> Dressing Room
            </TabsTrigger>
            {canAccessPressRoom && (
              <TabsTrigger value="press_room" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary flex items-center gap-1.5 text-xs whitespace-nowrap">
                <Mic className="w-3.5 h-3.5" /> Press Room
              </TabsTrigger>
            )}
            {isHomeClub && (
              <TabsTrigger value="chat" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary flex items-center gap-1.5 text-xs whitespace-nowrap">
                <MessageSquare className="w-3.5 h-3.5" /> Chat
              </TabsTrigger>
            )}
            {isCompleted && stats.length > 0 && (
              <TabsTrigger value="stats" className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary flex items-center gap-1.5 text-xs whitespace-nowrap">
                <Target className="w-3.5 h-3.5" /> Stats
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="dressing_room" className="p-4">
            <GameDayDressingRoom game={game} myClub={myClub} myPlayer={myPlayer} user={user} />
          </TabsContent>

          {canAccessPressRoom && (
            <TabsContent value="press_room" className="p-4">
              <GameDayPressRoom game={game} myClub={myClub} myPlayer={myPlayer} user={user} />
            </TabsContent>
          )}

          {isHomeClub && (
            <TabsContent value="chat" className="p-4">
              <GameDayMatchChat game={game} myClub={myClub} user={user} />
            </TabsContent>
          )}

          {isCompleted && stats.length > 0 && (
            <TabsContent value="stats" className="p-4 space-y-2">
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Player Stats</p>
              {stats.map(stat => (
                <div key={stat.id} className="text-xs border border-border rounded px-2 py-2 flex items-center justify-between">
                  <span className="text-foreground font-medium">{stat.player_gamertag}</span>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span className="flex items-center gap-1"><Target className="w-3 h-3" />{stat.goals}</span>
                    <span className="flex items-center gap-1"><Zap className="w-3 h-3" />{stat.assists}</span>
                    <span className="font-semibold text-foreground">{stat.rating}/10</span>
                  </div>
                </div>
              ))}
            </TabsContent>
          )}
        </Tabs>
      )}

      {/* Non-participant view — only show if truly not a participant */}
      {!isMyMatch && (
        <div className="p-4">
          {isCompleted && stats.length > 0 ? (
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Stats</p>
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
              {isLive ? "Match is in progress." : "No details available yet."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
import { useState, useEffect } from "react";
import { stageClient } from "@/api/stageClient";
import { Target, Zap, Star, CheckCircle2, Clock, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * GameDayMatchResult — both teams/players submit independently.
 * If scores match → completed. If not → disputed.
 * Solo mode: score only. Club mode: score + player stats.
 */
export default function GameDayMatchResult({ game, myClub, myPlayer, isHomeTeam, onSubmitted }) {
  const isClubMatch = game.mode === "club";
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [seatedPlayers, setSeatedPlayers] = useState([]);
  const [playerStats, setPlayerStats] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loadingPlayers, setLoadingPlayers] = useState(isClubMatch);

  // Dispute proof (shown after submit when dispute detected)
  const [proofFile, setProofFile] = useState(null);
  const [videoFile, setVideoFile] = useState(null);

  const alreadySubmitted = isHomeTeam ? game.result_home_submitted : game.result_away_submitted;

  useEffect(() => {
    if (!isClubMatch) { setLoadingPlayers(false); return; }

    async function loadSeated() {
      if (!myClub) { setLoadingPlayers(false); return; }

      const [dressing, allPlayers] = await Promise.all([
        stageClient.entities.DressingRoom.filter({ match_id: game.id, club_id: myClub.id }),
        stageClient.entities.Player.filter({ club_id: myClub.id }),
      ]);

      const seatedIds = dressing?.[0]?.seated_players || [];
      const seated = seatedIds.length > 0
        ? allPlayers.filter(p => seatedIds.includes(p.id))
        : allPlayers;

      setSeatedPlayers(seated);
      const initStats = {};
      seated.forEach(p => { initStats[p.id] = { goals: 0, assists: 0, rating: 6 }; });
      setPlayerStats(initStats);
      setLoadingPlayers(false);
    }
    loadSeated();
  }, [game.id, myClub, isClubMatch]);

  function updateStat(playerId, field, value) {
    setPlayerStats(prev => ({
      ...prev,
      [playerId]: { ...prev[playerId], [field]: value },
    }));
  }

  async function submit() {
    setSubmitting(true);

    let stats = [];
    if (isClubMatch) {
      stats = seatedPlayers.map(p => ({
        player_id: p.id,
        player_email: p.email,
        player_gamertag: p.gamertag,
        club_id: myClub?.id || null,
        goals: Number(playerStats[p.id]?.goals || 0),
        assists: Number(playerStats[p.id]?.assists || 0),
        rating: Number(playerStats[p.id]?.rating || 6),
      }));
    } else if (myPlayer) {
      // Solo: just the player themselves
      stats = [{
        player_id: myPlayer.id,
        player_email: myPlayer.email,
        player_gamertag: myPlayer.gamertag,
        club_id: null,
        goals: 0,
        assists: 0,
        rating: 6,
      }];
    }

    const res = await stageClient.functions.invoke("matchKickoff", {
      match_id: game.id,
      action: "submit_result",
      home_score: Number(homeScore),
      away_score: Number(awayScore),
      player_stats: stats,
    });

    setSubmitting(false);

    const status = res?.data?.status;
    if (status === "completed" || status === "disputed") {
      if (onSubmitted) onSubmitted(status, Number(homeScore), Number(awayScore));
    } else {
      setSubmitted(true);
    }
  }

  if (alreadySubmitted || submitted) {
    return (
      <div className="flex items-center gap-3 px-3 py-3 rounded-lg bg-success/10 border border-success/30">
        <Clock className="w-4 h-4 text-success shrink-0" />
        <div>
          <p className="text-xs font-semibold text-success">Result submitted!</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Waiting for the other {isClubMatch ? "team" : "player"} to submit their score.</p>
        </div>
      </div>
    );
  }

  if (loadingPlayers) {
    return <div className="text-xs text-muted-foreground p-2">Loading squad...</div>;
  }

  return (
    <div className="space-y-4 p-1">
      <p className="text-xs font-semibold text-foreground uppercase tracking-wider">
        Full Time — Submit Your Result ({isHomeTeam ? "Home" : "Away"})
      </p>

      {/* Score input */}
      <div className="flex items-center gap-3">
        <div className="flex-1 text-center">
          <p className="text-[10px] text-muted-foreground mb-1 truncate">
            {game.home_club_name || game.home_player_name || "Home"}
          </p>
          <Input
            type="number" min={0} max={99}
            value={homeScore}
            onChange={e => setHomeScore(e.target.value)}
            className="text-center text-lg font-bold bg-secondary border-border h-12"
          />
        </div>
        <span className="text-lg font-bold text-muted-foreground pb-4">–</span>
        <div className="flex-1 text-center">
          <p className="text-[10px] text-muted-foreground mb-1 truncate">
            {game.away_club_name || game.away_player_name || "Away"}
          </p>
          <Input
            type="number" min={0} max={99}
            value={awayScore}
            onChange={e => setAwayScore(e.target.value)}
            className="text-center text-lg font-bold bg-secondary border-border h-12"
          />
        </div>
      </div>

      {/* Player stats — club mode only */}
      {isClubMatch && seatedPlayers.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
            Your Players' Stats ({seatedPlayers.length} seated)
          </p>
          {seatedPlayers.map(p => {
            const stat = playerStats[p.id] || { goals: 0, assists: 0, rating: 6 };
            return (
              <div key={p.id} className="bg-secondary/40 border border-border rounded-lg p-3 space-y-2">
                <p className="text-xs font-bold text-foreground">
                  {p.gamertag} <span className="text-muted-foreground font-normal">· {p.position}</span>
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[9px] uppercase tracking-wider text-muted-foreground flex items-center gap-1 mb-1">
                      <Target className="w-3 h-3" /> Goals
                    </label>
                    <Input type="number" min={0} max={20} value={stat.goals}
                      onChange={e => updateStat(p.id, "goals", e.target.value)}
                      className="h-7 text-center text-xs bg-background border-border p-1" />
                  </div>
                  <div>
                    <label className="text-[9px] uppercase tracking-wider text-muted-foreground flex items-center gap-1 mb-1">
                      <Zap className="w-3 h-3" /> Assists
                    </label>
                    <Input type="number" min={0} max={20} value={stat.assists}
                      onChange={e => updateStat(p.id, "assists", e.target.value)}
                      className="h-7 text-center text-xs bg-background border-border p-1" />
                  </div>
                  <div>
                    <label className="text-[9px] uppercase tracking-wider text-muted-foreground flex items-center gap-1 mb-1">
                      <Star className="w-3 h-3" /> Rating
                    </label>
                    <Input type="number" min={1} max={10} step={0.1} value={stat.rating}
                      onChange={e => updateStat(p.id, "rating", e.target.value)}
                      className="h-7 text-center text-xs bg-background border-border p-1" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Button onClick={submit} disabled={submitting} className="w-full bg-success text-white gap-2">
        {submitting
          ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          : <><CheckCircle2 className="w-4 h-4" /> Submit Result</>
        }
      </Button>
      <p className="text-[10px] text-muted-foreground text-center">
        Both {isClubMatch ? "teams" : "players"} must submit. If scores match, the result is confirmed automatically.
      </p>
    </div>
  );
}
import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Target, Zap, Star, CheckCircle2, Clock, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * GameDayMatchResult — both teams submit independently.
 * If scores match → completed. If not → disputed.
 *
 * Extended with per-goal event tracking (scorer, optional assist, minute).
 * Goals/assists per player are derived from the goal events automatically.
 * Player ratings are still entered individually.
 */
export default function GameDayMatchResult({ game, myClub, myPlayer, isHomeTeam, onSubmitted }) {
  const isClubMatch   = game.mode === "club";
  const [homeScore,   setHomeScore]   = useState(0);
  const [awayScore,   setAwayScore]   = useState(0);
  const [seatedPlayers, setSeatedPlayers] = useState([]);
  const [ratings,     setRatings]     = useState({});  // { [playerId]: number }
  const [goalEvents,  setGoalEvents]  = useState([]);  // per-goal events for MY team
  const [submitting,  setSubmitting]  = useState(false);
  const [submitted,   setSubmitted]   = useState(false);
  const [loadingPlayers, setLoadingPlayers] = useState(isClubMatch);
  const [proofFile,   setProofFile]   = useState(null);
  const [proofUrl,    setProofUrl]    = useState(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const proofInputRef = useRef(null);

  const alreadySubmitted = isHomeTeam ? game.result_home_submitted : game.result_away_submitted;
  const myScore = isHomeTeam ? Number(homeScore) : Number(awayScore);

  // ── Load seated players ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isClubMatch) { setLoadingPlayers(false); return; }
    async function loadSeated() {
      if (!myClub) { setLoadingPlayers(false); return; }
      const [dressing, allPlayers] = await Promise.all([
        base44.entities.DressingRoom.filter({ match_id: game.id, club_id: myClub.id }),
        base44.entities.Player.filter({ club_id: myClub.id }),
      ]);
      const seatedIds = dressing?.[0]?.seated_players || [];
      const seated    = seatedIds.length > 0
        ? allPlayers.filter(p => seatedIds.includes(p.id))
        : allPlayers;
      setSeatedPlayers(seated);
      const initRatings = {};
      seated.forEach(p => { initRatings[p.id] = 6; });
      setRatings(initRatings);
      setLoadingPlayers(false);
    }
    loadSeated();
  }, [game.id, myClub, isClubMatch]);

  // ── Goal event helpers ─────────────────────────────────────────────────────

  function addGoalEvent() {
    setGoalEvents(prev => [
      ...prev,
      { minute: "", scorer_player_id: "", scorer_gamertag: "", assist_player_id: "", assist_gamertag: "", is_penalty: false },
    ]);
  }

  function removeGoalEvent(idx) {
    setGoalEvents(prev => prev.filter((_, i) => i !== idx));
  }

  function updateGoalEvent(idx, field, value) {
    setGoalEvents(prev => prev.map((ev, i) => {
      if (i !== idx) return ev;
      if (field === "scorer_player_id") {
        const p = seatedPlayers.find(pl => pl.id === value);
        return { ...ev, scorer_player_id: value, scorer_gamertag: p?.gamertag || "" };
      }
      if (field === "assist_player_id") {
        const p = value ? seatedPlayers.find(pl => pl.id === value) : null;
        return { ...ev, assist_player_id: value, assist_gamertag: p?.gamertag || "" };
      }
      return { ...ev, [field]: value };
    }));
  }

  // ── Proof upload ───────────────────────────────────────────────────────────

  async function handleProofChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setProofFile(file);
    setUploadingProof(true);
    try {
      const result = await base44.integrations.Core.UploadFile({ file });
      setProofUrl(result?.file_url || null);
    } catch {
      setProofUrl(null);
    } finally {
      setUploadingProof(false);
    }
  }

  // Derive goals/assists per player from the goal events
  function derivePlayerStats() {
    const statsMap = {};
    seatedPlayers.forEach(p => { statsMap[p.id] = { goals: 0, assists: 0 }; });
    goalEvents.forEach(ev => {
      if (ev.scorer_player_id && statsMap[ev.scorer_player_id] !== undefined) {
        statsMap[ev.scorer_player_id].goals += 1;
      }
      if (ev.assist_player_id && statsMap[ev.assist_player_id] !== undefined) {
        statsMap[ev.assist_player_id].assists += 1;
      }
    });
    return statsMap;
  }

  // ── Validation ─────────────────────────────────────────────────────────────

  const goalCount   = goalEvents.length;
  const needsEvents = isClubMatch && myScore > 0;
  // Warn if goal count != my score (soft validation — don't block submit)
  const goalsMismatch = needsEvents && goalCount !== myScore;

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function submit() {
    setSubmitting(true);
    try {
      let playerStatsArr = [];

      if (isClubMatch) {
        const derived = derivePlayerStats();
        playerStatsArr = seatedPlayers.map(p => ({
          player_id:       p.id,
          player_email:    p.email,
          player_gamertag: p.gamertag,
          club_id:         myClub?.id || null,
          goals:           derived[p.id]?.goals   || 0,
          assists:         derived[p.id]?.assists  || 0,
          rating:          Number(ratings[p.id]    || 6),
        }));
      } else if (myPlayer) {
        playerStatsArr = [{
          player_id:       myPlayer.id,
          player_email:    myPlayer.email,
          player_gamertag: myPlayer.gamertag,
          club_id:         null,
          goals:           0,
          assists:         0,
          rating:          6,
        }];
      }

      const eventsToStore = goalEvents.map(ev => ({
        minute:           Number(ev.minute) || null,
        scorer_player_id: ev.scorer_player_id || null,
        scorer_gamertag:  ev.scorer_gamertag  || null,
        assist_player_id: ev.assist_player_id || null,
        assist_gamertag:  ev.assist_gamertag  || null,
        is_penalty:       !!ev.is_penalty,
      }));

      const res = await base44.functions.invoke("matchKickoff", {
        match_id:     game.id,
        action:       "submit_result",
        is_home_team: isHomeTeam,
        home_score:   Number(homeScore),
        away_score:   Number(awayScore),
        player_stats: playerStatsArr,
        goal_events:  eventsToStore,
        proof_url:    proofUrl || null,
      });

      const status = res?.data?.status || 'waiting';
      if (onSubmitted) onSubmitted(status, Number(homeScore), Number(awayScore), goalEvents);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Already submitted state ────────────────────────────────────────────────

  if (alreadySubmitted) {
    return (
      <div className="flex items-center gap-3 px-3 py-3 rounded-lg bg-success/10 border border-success/30">
        <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
        <div>
          <p className="text-xs font-semibold text-success">Result submitted!</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Waiting for the other {isClubMatch ? "team" : "player"} to submit their score.
          </p>
        </div>
      </div>
    );
  }

  if (loadingPlayers) {
    return <div className="text-xs text-muted-foreground p-2">Loading squad…</div>;
  }

  return (
    <div className="space-y-4 p-1">
      <p className="text-xs font-semibold text-foreground uppercase tracking-wider">
        Full Time — Submit Your Result ({isHomeTeam ? "Home" : "Away"})
      </p>

      {/* ── Score ── */}
      <div className="flex items-center gap-3">
        <div className="flex-1 text-center">
          <p className="text-[10px] text-muted-foreground mb-1 truncate">
            {game.home_club_name || game.home_player_name || "Home"}
          </p>
          <Input type="number" min={0} max={99} value={homeScore}
            onChange={e => setHomeScore(e.target.value)}
            className="text-center text-lg font-bold bg-secondary border-border h-12" />
        </div>
        <span className="text-lg font-bold text-muted-foreground pb-4">–</span>
        <div className="flex-1 text-center">
          <p className="text-[10px] text-muted-foreground mb-1 truncate">
            {game.away_club_name || game.away_player_name || "Away"}
          </p>
          <Input type="number" min={0} max={99} value={awayScore}
            onChange={e => setAwayScore(e.target.value)}
            className="text-center text-lg font-bold bg-secondary border-border h-12" />
        </div>
      </div>

      {/* ── Goal Events — club mode, my team's goals ── */}
      {isClubMatch && myScore > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              {isHomeTeam ? "Home" : "Away"} Goals ({goalCount}/{myScore})
            </p>
            {goalsMismatch && (
              <span className="text-[9px] text-warning font-semibold">
                {goalCount < myScore ? `${myScore - goalCount} goal${myScore - goalCount !== 1 ? "s" : ""} missing` : `${goalCount - myScore} extra`}
              </span>
            )}
          </div>

          {goalEvents.map((ev, idx) => (
            <div key={idx} className="bg-secondary/40 border border-border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-foreground uppercase tracking-wider">Goal {idx + 1}</p>
                <button onClick={() => removeGoalEvent(idx)} className="p-1 text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {/* Minute */}
                <div>
                  <label className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1 block">Minute</label>
                  <Input type="number" min={1} max={120} placeholder="45"
                    value={ev.minute}
                    onChange={e => updateGoalEvent(idx, "minute", e.target.value)}
                    className="h-7 text-center text-xs bg-background border-border p-1" />
                </div>

                {/* Scorer */}
                <div className="col-span-2">
                  <label className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                    <Target className="w-3 h-3" /> Scorer
                  </label>
                  <Select value={ev.scorer_player_id} onValueChange={v => updateGoalEvent(idx, "scorer_player_id", v)}>
                    <SelectTrigger className="h-7 text-xs bg-background border-border">
                      <SelectValue placeholder="Select player" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border text-foreground">
                      {seatedPlayers.map(p => (
                        <SelectItem key={p.id} value={p.id} className="text-xs">{p.gamertag}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {/* Assist */}
                <div className="col-span-2">
                  <label className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                    <Zap className="w-3 h-3" /> Assist <span className="normal-case font-normal">(opt.)</span>
                  </label>
                  <Select value={ev.assist_player_id || "none"} onValueChange={v => updateGoalEvent(idx, "assist_player_id", v === "none" ? "" : v)}>
                    <SelectTrigger className="h-7 text-xs bg-background border-border">
                      <SelectValue placeholder="No assist" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border text-foreground">
                      <SelectItem value="none" className="text-xs text-muted-foreground">No assist</SelectItem>
                      {seatedPlayers
                        .filter(p => p.id !== ev.scorer_player_id)
                        .map(p => (
                          <SelectItem key={p.id} value={p.id} className="text-xs">{p.gamertag}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Penalty toggle */}
                <div className="flex flex-col">
                  <label className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1 block">Pen?</label>
                  <button
                    onClick={() => updateGoalEvent(idx, "is_penalty", !ev.is_penalty)}
                    className={cn(
                      "h-7 rounded border text-[10px] font-bold transition-colors",
                      ev.is_penalty ? "bg-warning/20 border-warning/40 text-warning" : "bg-background border-border text-muted-foreground"
                    )}
                  >
                    {ev.is_penalty ? "PEN" : "—"}
                  </button>
                </div>
              </div>
            </div>
          ))}

          <Button size="sm" variant="outline" onClick={addGoalEvent}
            disabled={goalCount >= myScore}
            className="w-full h-7 text-xs border-dashed border-border text-muted-foreground hover:text-foreground gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            Add Goal Event{goalCount >= myScore && " (score reached)"}
          </Button>
        </div>
      )}

      {/* ── Player Ratings — club mode ── */}
      {isClubMatch && seatedPlayers.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
            Player Ratings ({seatedPlayers.length} seated)
          </p>
          {seatedPlayers.map(p => {
            const derived  = derivePlayerStats();
            const pGoals   = derived[p.id]?.goals   || 0;
            const pAssists = derived[p.id]?.assists  || 0;
            return (
              <div key={p.id} className="bg-secondary/40 border border-border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-foreground">
                    {p.gamertag}
                    <span className="text-muted-foreground font-normal"> · {p.position}</span>
                  </p>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    {pGoals   > 0 && <span className="flex items-center gap-0.5 text-success"><Target className="w-3 h-3" />{pGoals}</span>}
                    {pAssists > 0 && <span className="flex items-center gap-0.5 text-primary"><Zap className="w-3 h-3" />{pAssists}</span>}
                  </div>
                </div>
                <div>
                  <label className="text-[9px] uppercase tracking-wider text-muted-foreground flex items-center gap-1 mb-1">
                    <Star className="w-3 h-3" /> Rating (1–10)
                  </label>
                  <Input type="number" min={1} max={10} step={0.5}
                    value={ratings[p.id] ?? 6}
                    onChange={e => setRatings(prev => ({ ...prev, [p.id]: e.target.value }))}
                    className="h-7 text-center text-xs bg-background border-border p-1" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Proof screenshot (optional) ── */}
      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">
          Proof Screenshot <span className="normal-case font-normal">(optional)</span>
        </p>
        <input ref={proofInputRef} type="file" accept="image/*" className="hidden" onChange={handleProofChange} />
        <button
          type="button"
          onClick={() => proofInputRef.current?.click()}
          disabled={uploadingProof}
          className={cn(
            "w-full flex items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs transition-colors",
            proofUrl
              ? "border-success/40 bg-success/10 text-success"
              : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
          )}
        >
          <Upload className="w-3.5 h-3.5" />
          {uploadingProof ? "Uploading…" : proofUrl ? "Screenshot uploaded ✓" : "Attach screenshot"}
        </button>
      </div>

      {/* ── Submit ── */}
      <Button onClick={submit} disabled={submitting || uploadingProof} className="w-full bg-success text-white gap-2">
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

import { useState, useEffect, useRef, useId } from "react";
import { stageClient } from "@/api/stageClient";
import { Target, Zap, Star, CheckCircle2, Plus, Trash2, Upload, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  evidenceRequired,
  fixtureScoreFromSubmission,
  formatSideClaim,
  isClubGameDayMatch,
  penaltiesAllowed,
  parseMatchSubmission,
} from "@/lib/gameDayResultFlow";

/**
 * GameDayMatchResult — both teams submit independently.
 * If scores match → completed. If not → disputed.
 *
 * Extended with per-goal event tracking (scorer, optional assist, minute).
 * Goals/assists per player are derived from the goal events automatically.
 * Player ratings are still entered individually.
 */
export default function GameDayMatchResult({ game, myClub, myPlayer, isHomeTeam, onSubmitted }) {
  const isClubMatch   = isClubGameDayMatch(game);
  const [homeScore,   setHomeScore]   = useState(0);
  const [awayScore,   setAwayScore]   = useState(0);
  const [seatedPlayers, setSeatedPlayers] = useState([]);
  const [ratings,     setRatings]     = useState({});  // { [playerId]: number }
  const [goalEvents,  setGoalEvents]  = useState([]);  // per-goal events for MY team
  const [submitting,  setSubmitting]  = useState(false);
  const [submitted,   setSubmitted]   = useState(false);
  const [loadingPlayers, setLoadingPlayers] = useState(isClubMatch);
  const [proofUrl,    setProofUrl]    = useState(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [playedIds, setPlayedIds] = useState(() => new Set());
  const [penaltyChoice, setPenaltyChoice] = useState("none");
  const [correcting, setCorrecting] = useState(false);
  const [explanation, setExplanation] = useState("");
  const proofInputRef = useRef(null);
  const proofInputId = useId();

  const alreadySubmitted = isHomeTeam ? game.result_home_submitted : game.result_away_submitted;

  // Submission ordering — the away side stays locked until the home side has
  // submitted their result. Server enforces the same rule (409 with
  // code=AWAITING_HOME_SUBMISSION); this UI just hides the form so a user
  // never gets to fill it in and click submit only to be rejected.
  const homeHasSubmitted    = Boolean(Number(game.result_home_submitted));
  const resultState = String(game.result_state || "");
  const submitSide = String(game.result_submit_side || "home").toLowerCase() === "away" ? "away" : "home";
  const awaitingConfirm = resultState === "AWAITING_AWAY_CONFIRMATION" || (!resultState && homeHasSubmitted);
  const awaitingReview = resultState === "AWAITING_HOME_REVIEW";
  const iAmSubmitter = submitSide === "home" ? isHomeTeam : !isHomeTeam;
  const confirmMode = awaitingConfirm && !iAmSubmitter && !correcting;
  const reviewMode = awaitingReview && iAmSubmitter;
  // Home (submit side) can reopen the form to change score/stats before Away confirms.
  const amendMode = Boolean(Number(alreadySubmitted)) && iAmSubmitter && awaitingConfirm && !correcting;
  const needsEvidence = evidenceRequired(game) && !confirmMode && !correcting;
  const allowPens = penaltiesAllowed(game);
  const homeSubmission = parseMatchSubmission(game.home_submission);
  const awaySubmission = parseMatchSubmission(game.away_submission);
  const submittedScore = submitSide === "away" ? awaySubmission : homeSubmission;
  const submittedFixture = fixtureScoreFromSubmission(submittedScore, submitSide);
  const submittedHomeScore = Number.isFinite(submittedFixture.home) ? submittedFixture.home : null;
  const submittedAwayScore = Number.isFinite(submittedFixture.away) ? submittedFixture.away : null;
  const awayLockedWaiting   = !isHomeTeam && !homeHasSubmitted && !alreadySubmitted && submitSide === "home";
  const myPriorSubmission = isHomeTeam ? homeSubmission : awaySubmission;

  // Prefill Home–Away boxes from the claim being confirmed/corrected/amended (was stuck at 0–0).
  useEffect(() => {
    if (!(confirmMode || correcting || reviewMode || amendMode)) return;
    if (!Number.isFinite(submittedFixture.home) || !Number.isFinite(submittedFixture.away)) return;
    setHomeScore(submittedFixture.home);
    setAwayScore(submittedFixture.away);
  }, [confirmMode, correcting, reviewMode, amendMode, submittedFixture.home, submittedFixture.away]);

  // Prefill proof + goal events + ratings from our prior submission when amending.
  useEffect(() => {
    if (!amendMode || !myPriorSubmission) return;
    if (myPriorSubmission.proof_url) setProofUrl(myPriorSubmission.proof_url);
    const priorEvents = Array.isArray(myPriorSubmission.goal_events) ? myPriorSubmission.goal_events : [];
    if (priorEvents.length) {
      setGoalEvents(priorEvents.map((ev) => ({
        minute: ev.minute ?? "",
        scorer_player_id: ev.scorer_player_id || "",
        scorer_gamertag: ev.scorer_gamertag || "",
        assist_player_id: ev.assist_player_id || "",
        assist_gamertag: ev.assist_gamertag || "",
        is_penalty: !!ev.is_penalty,
      })));
    }
    const priorStats = Array.isArray(myPriorSubmission.player_stats) ? myPriorSubmission.player_stats : [];
    if (priorStats.length) {
      const nextRatings = {};
      const nextPlayed = new Set();
      priorStats.forEach((stat) => {
        if (stat?.player_id) {
          nextPlayed.add(String(stat.player_id));
          if (stat.rating != null) nextRatings[stat.player_id] = Number(stat.rating);
        }
      });
      if (nextPlayed.size) setPlayedIds(nextPlayed);
      if (Object.keys(nextRatings).length) setRatings((prev) => ({ ...prev, ...nextRatings }));
    }
    if (Number(myPriorSubmission.decided_on_penalties) === 1) {
      setPenaltyChoice(myPriorSubmission.penalty_winner_side === "away" ? "away" : "home");
    }
  }, [amendMode, game.id]);

  // Fixture score used for goal-event quotas (confirm mode must use submitted 5–3, not local 0–0).
  const fixtureHomeScore = (confirmMode || reviewMode) && Number.isFinite(submittedFixture.home)
    ? submittedFixture.home
    : Number(homeScore) || 0;
  const fixtureAwayScore = (confirmMode || reviewMode) && Number.isFinite(submittedFixture.away)
    ? submittedFixture.away
    : Number(awayScore) || 0;
  const myScore = isHomeTeam ? fixtureHomeScore : fixtureAwayScore;

  useEffect(() => {
    if (!confirmMode) return;
    if (submittedHomeScore !== null) setHomeScore(submittedHomeScore);
    if (submittedAwayScore !== null) setAwayScore(submittedAwayScore);
  }, [confirmMode, submittedHomeScore, submittedAwayScore]);

  // ── Load the club squad ────────────────────────────────────────────────────
  // Phase 2 — the dressing room no longer decides who can be reported. The
  // squad is offered here; Phase 6 turns this into an explicit "who actually
  // played" selection. Sourcing from seats produced an empty list for every
  // arranged match, which made result submission impossible.
  useEffect(() => {
    if (!isClubMatch) { setLoadingPlayers(false); return; }
    let cancelled = false;
    async function loadSquad() {
      if (!myClub) { setLoadingPlayers(false); return; }
      const squad = await stageClient.entities.Player
        .filter({ club_id: myClub.id })
        .catch(() => []);
      if (cancelled) return;
      const roster = squad || [];
      setSeatedPlayers(roster);
      const initRatings = {};
      roster.forEach(p => { initRatings[p.id] = 6; });
      setRatings(initRatings);
      let suggested = [];
      if (game.source_fixture_id && myClub?.id) {
        const lineups = await stageClient.entities.ClubFixtureLineup
          .filter({ fixture_id: game.source_fixture_id, club_id: myClub.id })
          .catch(() => []);
        const raw = lineups?.[0]?.starting_players;
        try {
          const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
          suggested = Array.isArray(parsed) ? parsed.map((entry) => entry?.id || entry?.player_id || entry).filter(Boolean) : [];
        } catch {
          suggested = [];
        }
      }
      setPlayedIds(new Set(suggested.map(String)));
      setLoadingPlayers(false);
    }
    loadSquad();
    return () => { cancelled = true; };
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
        if (value) {
          setPlayedIds((prevIds) => {
            const next = new Set(prevIds);
            next.add(String(value));
            return next;
          });
        }
        return { ...ev, scorer_player_id: value, scorer_gamertag: p?.gamertag || "" };
      }
      if (field === "assist_player_id") {
        const p = value ? seatedPlayers.find(pl => pl.id === value) : null;
        if (value) {
          setPlayedIds((prevIds) => {
            const next = new Set(prevIds);
            next.add(String(value));
            return next;
          });
        }
        return { ...ev, assist_player_id: value, assist_gamertag: p?.gamertag || "" };
      }
      return { ...ev, [field]: value };
    }));
  }

  // Prefill one blank goal-event row per goal scored by this club.
  useEffect(() => {
    if (!isClubMatch || myScore <= 0) return;
    setGoalEvents((prev) => {
      if (prev.length >= myScore) return prev;
      const extras = Array.from({ length: myScore - prev.length }, () => ({
        minute: "",
        scorer_player_id: "",
        scorer_gamertag: "",
        assist_player_id: "",
        assist_gamertag: "",
        is_penalty: false,
      }));
      return [...prev, ...extras];
    });
  }, [isClubMatch, myScore]);

  // ── Proof upload ───────────────────────────────────────────────────────────

  async function handleProofChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubmitError("");
    setUploadingProof(true);
    try {
      const result = await stageClient.integrations.Core.UploadFile({ file });
      setProofUrl(result?.file_url || null);
    } catch {
      setProofUrl(null);
      setSubmitError("Could not upload screenshot proof. Please try again.");
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
  const goalsMismatch = needsEvents && goalCount !== myScore;
  const missingScorers = needsEvents && goalEvents.some((ev) => !ev.scorer_player_id);
  const goalsIncomplete = needsEvents && (goalsMismatch || missingScorers);
  const noPlayersSelected = isClubMatch && seatedPlayers.length > 0 && playedIds.size === 0;

  // ── Submit ─────────────────────────────────────────────────────────────────

  const [submitError, setSubmitError] = useState("");

  async function submit(actionOverride) {
    if (needsEvidence && !proofUrl) {
      setSubmitError("Upload screenshot proof before submitting.");
      return;
    }
    if (noPlayersSelected) {
      setSubmitError("Tick at least one player who played for your club.");
      return;
    }
    if (goalsIncomplete) {
      setSubmitError(
        goalsMismatch
          ? `Add exactly ${myScore} goal event${myScore === 1 ? "" : "s"} for your club (currently ${goalCount}).`
          : "Select a scorer for every goal event before submitting.",
      );
      return;
    }

    setSubmitting(true);
    setSubmitError("");
    try {
      let playerStatsArr = [];
      const participating = [...playedIds];

      if (isClubMatch) {
        const derived = derivePlayerStats();
        // Include anyone who scored/assisted even if the checkbox was missed.
        const ids = new Set([...playedIds].map(String));
        Object.entries(derived).forEach(([pid, row]) => {
          if ((row.goals || 0) > 0 || (row.assists || 0) > 0) ids.add(String(pid));
        });
        playerStatsArr = seatedPlayers
          .filter((p) => ids.has(String(p.id)))
          .map(p => ({
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
          goals:           Number(isHomeTeam ? homeScore : awayScore) || 0,
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
        side:             isHomeTeam ? "home" : "away",
      }));

      const action = actionOverride
        || (reviewMode ? "accept_correction" : confirmMode ? "confirm_result" : amendMode ? "amend_result" : "submit_result");
      const confirmHome = Number.isFinite(submittedFixture.home) ? submittedFixture.home : Number(homeScore);
      const confirmAway = Number.isFinite(submittedFixture.away) ? submittedFixture.away : Number(awayScore);
      const fixtureHome = confirmMode ? confirmHome : Number(homeScore);
      const fixtureAway = confirmMode ? confirmAway : Number(awayScore);
      const fixtureIsDraw = fixtureHome === fixtureAway;

      const res = await stageClient.functions.invoke("matchKickoff", {
        match_id:     game.id,
        action,
        is_home_team: isHomeTeam,
        home_score:   fixtureHome,
        away_score:   fixtureAway,
        own_score:    isHomeTeam ? fixtureHome : fixtureAway,
        opponent_score: isHomeTeam ? fixtureAway : fixtureHome,
        player_stats: playerStatsArr,
        participating_player_ids: participating,
        goal_events:  eventsToStore,
        proof_url:    proofUrl || null,
        decided_on_penalties: fixtureIsDraw && penaltyChoice !== "none",
        penalty_winner_side: penaltyChoice === "none" ? null : penaltyChoice,
        explanation: explanation || null,
      });

      const status = res?.data?.status || 'waiting';
      if (onSubmitted) onSubmitted(status, fixtureHome, fixtureAway, goalEvents);
    } catch (err) {
      // Server enforces the same lock with a 409 + code=AWAITING_HOME_SUBMISSION.
      // apiFetch surfaces the server payload as err.data, so look there first.
      const code = err?.data?.code || err?.code;
      if (code === "PROOF_REQUIRED" || err?.status === 400) {
        setSubmitError("Upload screenshot proof before submitting.");
      } else if (code === "AWAITING_CONFIRMATION" || code === "RESULT_ALREADY_SUBMITTED") {
        if (onSubmitted) onSubmitted("waiting", Number(homeScore), Number(awayScore), goalEvents);
      } else if (code === "AWAITING_HOME_SUBMISSION") {
        setSubmitError("The home team hasn't submitted their result yet. Please wait for them to submit first.");
      } else {
        setSubmitError(err?.message || "Could not submit result. Try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  // ── Already submitted state ────────────────────────────────────────────────

  if (alreadySubmitted && !reviewMode && !correcting && !amendMode) {
    return (
      <div className="flex items-center gap-3 px-3 py-3 rounded-lg bg-success/10 border border-success/30">
        <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
        <div>
          <p className="text-xs font-semibold text-success">Result submitted!</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Waiting for the other {isClubMatch ? "team" : "player"} to confirm the result.
          </p>
        </div>
      </div>
    );
  }

  if (awayLockedWaiting) {
    const homeLabel = game.home_club_name || game.home_player_name || "the home side";
    return (
      <div className="flex items-center gap-3 px-3 py-3 rounded-lg bg-secondary/40 border border-border">
        <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
        <div>
          <p className="text-xs font-semibold text-foreground">Waiting for {homeLabel} to submit</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            The {isClubMatch ? "home team" : "home player"} reports the result first.
            You'll be able to confirm the result once they've submitted.
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
        {reviewMode
          ? "Review proposed correction"
          : confirmMode
            ? "Confirm Result"
            : amendMode
              ? `Update Result (${isHomeTeam ? "Home" : "Away"})`
              : correcting
                ? "Proposed correction"
                : `Full Time — Submit Result (${isHomeTeam ? "Home" : "Away"})`}
      </p>

      {amendMode ? (
        <div className="rounded-lg border border-cyan-300/30 bg-cyan-300/10 px-3 py-2 text-xs text-cyan-100">
          You already submitted a result. Update the score or stats below — Away will confirm the new claim.
        </div>
      ) : null}

      {confirmMode && submittedScore && (
        <div className="rounded-lg border border-[#8eeeff]/30 bg-[#8eeeff]/10 px-3 py-2 text-xs text-[#8eeeff]">
          {(game.home_club_name || game.home_player_name || "Home")} submitted {formatSideClaim(submittedScore, submitSide)}. Is this result correct?
        </div>
      )}
      {reviewMode && awaySubmission && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          {(game.away_club_name || game.away_player_name || "Away")} has proposed a correction: {formatSideClaim(awaySubmission, "away")}.
        </div>
      )}

      {/* ── Score ── */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="flex-1 text-center">
            <p className="text-[10px] text-muted-foreground mb-0.5 truncate">
              {game.home_club_name || game.home_player_name || "Home"}
            </p>
            <p className="text-[9px] font-bold uppercase tracking-wider text-cyan-300/80 mb-1">Home goals</p>
            <Input type="number" min={0} max={99} value={homeScore}
              onChange={e => setHomeScore(e.target.value)}
              readOnly={confirmMode && !correcting}
              aria-label="Home goals"
              className={cn(
                "text-center text-lg font-bold bg-secondary border-border h-12",
                confirmMode && !correcting && "opacity-90 cursor-default",
              )} />
          </div>
          <span className="text-lg font-bold text-muted-foreground pb-4">–</span>
          <div className="flex-1 text-center">
            <p className="text-[10px] text-muted-foreground mb-0.5 truncate">
              {game.away_club_name || game.away_player_name || "Away"}
            </p>
            <p className="text-[9px] font-bold uppercase tracking-wider text-cyan-300/80 mb-1">Away goals</p>
            <Input type="number" min={0} max={99} value={awayScore}
              onChange={e => setAwayScore(e.target.value)}
              readOnly={confirmMode && !correcting}
              aria-label="Away goals"
              className={cn(
                "text-center text-lg font-bold bg-secondary border-border h-12",
                confirmMode && !correcting && "opacity-90 cursor-default",
              )} />
          </div>
        </div>
        {confirmMode ? (
          <p className="text-[10px] text-muted-foreground text-center">
            Score is locked while confirming. Use <span className="text-foreground font-semibold">Result Is Incorrect</span> to change it.
            Enter <span className="text-foreground font-semibold">{isHomeTeam ? "Home" : "Away"} Goals</span> scorer events below for your club.
          </p>
        ) : correcting ? (
          <p className="text-[10px] text-muted-foreground text-center">
            Edit <span className="text-foreground font-semibold">Home goals</span> and <span className="text-foreground font-semibold">Away goals</span>, then submit your correction.
          </p>
        ) : (
          <p className="text-[10px] text-muted-foreground text-center">
            Enter the full-time score: left = <span className="text-foreground font-semibold">Home goals</span>, right = <span className="text-foreground font-semibold">Away goals</span>.
          </p>
        )}
      </div>

      {allowPens && Number(homeScore) === Number(awayScore) && !confirmMode && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Penalties</p>
          {[["none", "No penalties"], ["home", "Home won on penalties"], ["away", "Away won on penalties"]].map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-xs">
              <input type="radio" name="penalty-outcome" checked={penaltyChoice === value} onChange={() => setPenaltyChoice(value)} />
              {label}
            </label>
          ))}
        </div>
      )}

      {isClubMatch && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
            Players Who Played
          </p>
          <p className="text-[10px] text-muted-foreground">
            Tick who actually played for your club ({isHomeTeam ? "Home" : "Away"}). Pre-match lineups are only a suggestion.
          </p>
          {seatedPlayers.length === 0 ? (
            <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-[11px] text-warning">
              No squad players found for your club. Open Club → Squad and make sure players are signed, then refresh Game Day.
            </p>
          ) : (
            seatedPlayers.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={playedIds.has(String(p.id))}
                  onChange={() => {
                    setPlayedIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(String(p.id))) next.delete(String(p.id));
                      else next.add(String(p.id));
                      return next;
                    });
                  }}
                />
                {p.gamertag}
                <span className="text-muted-foreground">· {p.position || "—"}</span>
              </label>
            ))
          )}
        </div>
      )}

      {/* ── Goal Events — club mode, my team's goals ── */}
      {isClubMatch && myScore > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              {isHomeTeam ? "Home" : "Away"} Goals — scorer events ({goalCount}/{myScore})
            </p>
            {goalsMismatch && (
              <span className="text-[9px] text-warning font-semibold">
                {goalCount < myScore ? `${myScore - goalCount} goal${myScore - goalCount !== 1 ? "s" : ""} missing` : `${goalCount - myScore} extra`}
              </span>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">
            Add one event per goal your club scored ({myScore}). This is where you assign scorers and assists — not the score boxes above.
          </p>

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
      {isClubMatch && seatedPlayers.filter((p) => playedIds.has(String(p.id))).length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
            Player Ratings ({playedIds.size})
          </p>
          {seatedPlayers.filter((p) => playedIds.has(String(p.id))).map(p => {
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

      {/* ── Proof screenshot ── */}
      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">
          Proof Screenshot {needsEvidence ? <span className="normal-case font-normal">(required)</span> : <span className="normal-case font-normal">(optional for Arrange Game)</span>}
        </p>
        <input id={proofInputId} ref={proofInputRef} type="file" accept="image/*" className="sr-only" disabled={uploadingProof} onChange={handleProofChange} />
        <label
          htmlFor={uploadingProof ? undefined : proofInputId}
          className={cn(
            "w-full flex items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs transition-colors cursor-pointer touch-manipulation",
            proofUrl
              ? "border-success/40 bg-success/10 text-success"
              : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
            uploadingProof && "opacity-60 pointer-events-none"
          )}
        >
          <Upload className="w-3.5 h-3.5" />
          {uploadingProof ? "Uploading…" : proofUrl ? "Screenshot uploaded ✓" : "Attach screenshot"}
        </label>
        {!proofUrl && needsEvidence && (
          <p className="mt-1.5 text-[10px] text-warning">Upload screenshot proof before submitting.</p>
        )}
      </div>

      {reviewMode && (
        <div className="grid gap-2 sm:grid-cols-2">
          <Button type="button" onClick={() => submit("accept_correction")} disabled={submitting} className="w-full bg-success text-white">
            Accept Correction
          </Button>
          <Button type="button" variant="outline" onClick={() => submit("dispute_result")} disabled={submitting || !proofUrl} className="w-full">
            Dispute Result
          </Button>
        </div>
      )}
      {confirmMode && (
        <div className="grid gap-2 sm:grid-cols-2">
          <Button type="button" onClick={() => submit("confirm_result")} disabled={submitting || goalsIncomplete || noPlayersSelected} className="w-full bg-success text-white gap-2">
            Confirm Result
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (submittedHomeScore !== null) setHomeScore(submittedHomeScore);
              if (submittedAwayScore !== null) setAwayScore(submittedAwayScore);
              setCorrecting(true);
            }}
            disabled={submitting}
            className="w-full"
          >
            Result Is Incorrect
          </Button>
        </div>
      )}
      {!reviewMode && !confirmMode && (
      <Button type="button" onClick={() => submit(correcting ? "propose_correction" : amendMode ? "amend_result" : "submit_result")} disabled={submitting || uploadingProof || (needsEvidence && !proofUrl) || goalsIncomplete || noPlayersSelected} className="w-full bg-success text-white gap-2 disabled:opacity-50">
        {submitting
          ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          : <><CheckCircle2 className="w-4 h-4" /> {amendMode ? "Update Result" : "Submit Result"}</>
        }
      </Button>
      )}
      {submitError && (
        <p className="text-[11px] text-destructive text-center">{submitError}</p>
      )}
      {!reviewMode && !confirmMode && (
      <p className="text-[10px] text-muted-foreground text-center">
        {correcting
          ? "Enter the score you believe is correct. No screenshot is required at this step."
          : amendMode
            ? "Saving updates the claim Away must confirm. Previous confirmation wait restarts."
            : isHomeTeam
              ? `As the home ${isClubMatch ? "team" : "player"}, you submit the result first.`
              : "Confirm the submitted score, or mark it incorrect and propose a correction."}
      </p>
      )}
    </div>
  );
}

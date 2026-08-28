export function isSubmittedFlag(value) {
  return Boolean(Number(value));
}

export function isArrangeGame(game) {
  const source = String(game?.source_fixture_type || "").toLowerCase();
  const type = String(game?.type || "").toLowerCase();
  const ctx = String(game?.competition_context || "").toLowerCase();
  return source === "arranged_game" || type === "ranked" || type === "friendly" || ctx.includes("arrange");
}

export function evidenceRequired(game) {
  return !isArrangeGame(game);
}

export function penaltiesAllowed(game) {
  if (Number(game?.allow_penalties) === 1) return true;
  const blob = `${game?.competition_context || ""} ${game?.source_fixture_type || ""} ${game?.type || ""}`.toLowerCase();
  if (/regional_league/.test(blob) && !/knockout_r16|knockout_qf|knockout_sf|knockout_final|\bknockout\b|\bplayoff\b/.test(blob)) {
    return false;
  }
  return /knockout_r16|knockout_qf|knockout_sf|knockout_final|\bknockout\b|\bplayoff\b/.test(blob);
}

export function parseMatchSubmission(raw) {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  try { return JSON.parse(raw); } catch { return null; }
}

export function getResultSubmissionControls({ game, isLive, showResultForm, amIHomeTeam }) {
  const homeResultSubmitted = isSubmittedFlag(game?.result_home_submitted);
  const awayResultSubmitted = isSubmittedFlag(game?.result_away_submitted);
  const canShowResultAction = Boolean(isLive && !showResultForm);
  const state = String(game?.result_state || "");
  const submitSide = String(game?.result_submit_side || "home").toLowerCase() === "away" ? "away" : "home";
  const awaitingResult = state === "AWAITING_RESULT" || (!state && !homeResultSubmitted && !awayResultSubmitted);
  const awaitingConfirm = state === "AWAITING_AWAY_CONFIRMATION"
    || (!state && homeResultSubmitted && !awayResultSubmitted);
  const awaitingReview = state === "AWAITING_HOME_REVIEW";
  const iAmSubmitter = submitSide === "home" ? Boolean(amIHomeTeam) : !amIHomeTeam;

  return {
    homeResultSubmitted,
    awayResultSubmitted,
    showHomeSubmit: canShowResultAction && awaitingResult && Boolean(amIHomeTeam) && submitSide === "home",
    showAwayWaitingForHome: canShowResultAction && awaitingResult && !amIHomeTeam && submitSide === "home",
    showAwaySubmit: canShowResultAction && (
      (awaitingConfirm && !amIHomeTeam && submitSide === "home")
      || (awaitingResult && !amIHomeTeam && submitSide === "away")
    ),
    showHomeWaitingForAway: canShowResultAction && awaitingConfirm && Boolean(amIHomeTeam) && submitSide === "home",
    showAwaySubmittedWaitingForHome: canShowResultAction && (
      (awaitingConfirm && !amIHomeTeam && submitSide === "away")
      || (awaitingReview && !iAmSubmitter)
    ),
    showHomeReview: canShowResultAction && awaitingReview && iAmSubmitter,
    showConfirmResult: canShowResultAction && awaitingConfirm && !iAmSubmitter,
    resultState: state,
    submitSide,
    awaitingReview,
  };
}

export function isValidAdminScore(value) {
  if (value === "" || value == null) return false;
  const score = Number(value);
  return Number.isFinite(score) && Number.isInteger(score) && score >= 0;
}

export function canResolveDisputeWithScore(selectedWinner, score) {
  return Boolean(selectedWinner) &&
    isValidAdminScore(score?.home_score) &&
    isValidAdminScore(score?.away_score);
}

export const KICKOFF_EARLY_WINDOW_MINUTES = 15;

export function isClubGameDayMatch(game) {
  if (game?.mode === "club") return true;
  if (game?.mode === "solo") return false;
  return Boolean(game?.home_club_id || game?.away_club_id);
}

// Phase 2 — seats no longer gate kickoff. A scheduled match the actor takes
// part in is startable once the early window has passed; participation is
// declared at result time instead. `isClubMatch` / `bothClubsReady` are still
// accepted so older callers keep working, but they no longer block anything.
export function getKickoffControls({
  game,
  isMyMatch,
  amIHomeTeam,
  isLive,
  showResultForm,
  minutesUntilMatch,
}) {
  const isScheduled = game?.status === "scheduled";
  const showKickoffSection = Boolean(isMyMatch && isScheduled && !isLive && !showResultForm);
  const tooEarly = minutesUntilMatch != null && minutesUntilMatch > KICKOFF_EARLY_WINDOW_MINUTES;

  return {
    showKickoffSection,
    showHomeKickoff: showKickoffSection && Boolean(amIHomeTeam),
    showAwayWaiting: showKickoffSection && !amIHomeTeam,
    tooEarly,
    dressingBlocked: false,
    canPressKickoff: showKickoffSection && Boolean(amIHomeTeam) && !tooEarly,
  };
}

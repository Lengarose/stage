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
  if (Number(game?.wager_stc || 0) > 0) return true;
  return !isArrangeGame(game);
}

export function penaltiesAllowed(game) {
  if (Number(game?.allow_penalties) === 1) return true;
  const blob = `${game?.competition_context || ""} ${game?.source_fixture_type || ""} ${game?.type || ""}`.toLowerCase();
  const knockout = /knockout_r16|knockout_qf|knockout_sf|knockout_final|\bknockout\b|\bplayoff\b|round of 16|quarter-finals?|semi-finals?|(?:^|[·\-–]\s*)final\b/;
  if (/regional_league/.test(blob) && !knockout.test(blob)) {
    return false;
  }
  return knockout.test(blob);
}

export function parseMatchSubmission(raw) {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  try { return JSON.parse(raw); } catch { return null; }
}

export function getResultSubmissionControls({ game, isLive, showResultForm, amIHomeTeam }) {
  const homeResultSubmitted = isSubmittedFlag(game?.result_home_submitted);
  const awayResultSubmitted = isSubmittedFlag(game?.result_away_submitted);
  const state = String(game?.result_state || "");
  const submitSide = String(game?.result_submit_side || "home").toLowerCase() === "away" ? "away" : "home";
  const awaitingResult = state === "AWAITING_RESULT" || (!state && !homeResultSubmitted && !awayResultSubmitted);
  const awaitingConfirm = state === "AWAITING_AWAY_CONFIRMATION"
    || (!state && homeResultSubmitted && !awayResultSubmitted);
  const awaitingReview = state === "AWAITING_HOME_REVIEW";
  const iAmSubmitter = submitSide === "home" ? Boolean(amIHomeTeam) : !amIHomeTeam;
  const negotiationOpen = awaitingResult || awaitingConfirm || awaitingReview
    || state === "RESULT_OVERDUE" || state === "ADMIN_REVIEW" || state === "DISPUTED";
  const canShowResultAction = Boolean((isLive || negotiationOpen) && !showResultForm);

  return {
    homeResultSubmitted,
    awayResultSubmitted,
    showHomeSubmit: canShowResultAction && awaitingResult && Boolean(amIHomeTeam) && submitSide === "home",
    showAwayWaitingForHome: canShowResultAction && awaitingResult && !amIHomeTeam && submitSide === "home",
    // Away confirms in AWAITING_AWAY_CONFIRMATION — they do not submit_result again.
    showAwaySubmit: canShowResultAction && awaitingResult && !amIHomeTeam && submitSide === "away",
    showHomeWaitingForAway: canShowResultAction && awaitingConfirm && Boolean(amIHomeTeam) && submitSide === "home",
    showAwaySubmittedWaitingForHome: canShowResultAction && (
      (awaitingConfirm && !amIHomeTeam && submitSide === "away")
      || (awaitingReview && !iAmSubmitter)
    ),
    showHomeReview: canShowResultAction && awaitingReview && iAmSubmitter,
    showConfirmResult: canShowResultAction && awaitingConfirm && !iAmSubmitter,
    canCounter: awaitingReview && iAmSubmitter && Number(game?.home_counter_count || 0) < 1,
    showOverdue: state === "RESULT_OVERDUE",
    showAdminReview: state === "ADMIN_REVIEW" || state === "DISPUTED",
    showFinal: state === "CONFIRMED" || state === "AUTO_CONFIRMED_TIMEOUT" || state === "VOIDED",
    resultState: state,
    submitSide,
    awaitingReview,
    iAmSubmitter,
  };
}

export function resultDeadlineAt(game) {
  const state = String(game?.result_state || "");
  if (state === "AWAITING_AWAY_CONFIRMATION") return game?.confirmation_due_at || null;
  if (state === "AWAITING_HOME_REVIEW") return game?.review_due_at || null;
  if (state === "AWAITING_RESULT" || !state) return game?.result_due_at || null;
  return null;
}

export function formatDeadlineCountdown(dueAt, now = new Date()) {
  if (!dueAt) return null;
  const due = new Date(dueAt).getTime();
  if (!Number.isFinite(due)) return null;
  const remaining = due - now.getTime();
  if (remaining <= 0) return "Deadline reached — refresh";
  const hours = Math.floor(remaining / 3600000);
  const mins = Math.floor((remaining % 3600000) / 60000);
  if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h left`;
  if (hours >= 1) return `${hours}h ${mins}m left`;
  return `${Math.max(mins, 1)}m left`;
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

function hasOwnOpponentScores(submission) {
  return submission?.own_score != null && submission?.own_score !== ""
    && submission?.opponent_score != null && submission?.opponent_score !== "";
}

/** Map a side's own/opponent claim (or fixture home/away) into fixture Home–Away. */
export function fixtureScoreFromSubmission(submission, side) {
  if (!submission) return { home: NaN, away: NaN };
  if (hasOwnOpponentScores(submission)) {
    const own = Number(submission.own_score);
    const opponent = Number(submission.opponent_score);
    if (side === "away") return { home: opponent, away: own };
    return { home: own, away: opponent };
  }
  return {
    home: Number(submission?.home_score),
    away: Number(submission?.away_score),
  };
}

export function formatSideClaim(submission, side) {
  if (!submission) return "?";
  const fixture = fixtureScoreFromSubmission(submission, side);
  if (Number.isFinite(fixture.home) && Number.isFinite(fixture.away)) {
    return `Home ${fixture.home}–Away ${fixture.away}`;
  }
  return "?";
}

export function declaredScoresAgree(homeSubmission, awaySubmission) {
  if (!homeSubmission || !awaySubmission) return false;
  const home = fixtureScoreFromSubmission(homeSubmission, "home");
  const away = fixtureScoreFromSubmission(awaySubmission, "away");
  return Number.isFinite(home.home)
    && Number.isFinite(home.away)
    && home.home === away.home
    && home.away === away.away;
}

export const KICKOFF_EARLY_WINDOW_MINUTES = 15;

export function isClubGameDayMatch(game) {
  if (game?.mode === "club") return true;
  if (game?.mode === "solo") return false;
  return Boolean(game?.home_club_id || game?.away_club_id);
}

export function uniqueIdentityClubs(...clubs) {
  const map = new Map();
  clubs.flat().forEach((club) => {
    if (club?.id) map.set(String(club.id), club);
  });
  return Array.from(map.values());
}

/**
 * Club that is actually in this fixture. No "first club I have" fallback —
 * spectators get null so kickoff/result stay hidden.
 */
export function pickMyClubForMatch(game, clubs) {
  const list = uniqueIdentityClubs(clubs);
  return list.find((club) => (
    String(game?.home_club_id) === String(club.id)
    || String(game?.away_club_id) === String(club.id)
  )) || null;
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

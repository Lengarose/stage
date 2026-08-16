export function isSubmittedFlag(value) {
  return Boolean(Number(value));
}

export function getResultSubmissionControls({ game, isLive, showResultForm, amIHomeTeam }) {
  const homeResultSubmitted = isSubmittedFlag(game?.result_home_submitted);
  const awayResultSubmitted = isSubmittedFlag(game?.result_away_submitted);
  const canShowResultAction = Boolean(isLive && !showResultForm);

  return {
    homeResultSubmitted,
    awayResultSubmitted,
    showHomeSubmit: canShowResultAction && Boolean(amIHomeTeam) && !homeResultSubmitted,
    showAwayWaitingForHome: canShowResultAction && !amIHomeTeam && !homeResultSubmitted && !awayResultSubmitted,
    showAwaySubmit: canShowResultAction && !amIHomeTeam && homeResultSubmitted && !awayResultSubmitted,
    showHomeWaitingForAway: canShowResultAction && Boolean(amIHomeTeam) && homeResultSubmitted,
    showAwaySubmittedWaitingForHome: canShowResultAction && !amIHomeTeam && awayResultSubmitted,
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

export function getKickoffControls({
  game,
  isMyMatch,
  amIHomeTeam,
  isLive,
  showResultForm,
  minutesUntilMatch,
  isClubMatch,
  bothClubsReady,
}) {
  const isScheduled = game?.status === "scheduled";
  const showKickoffSection = Boolean(isMyMatch && isScheduled && !isLive && !showResultForm);
  const tooEarly = minutesUntilMatch != null && minutesUntilMatch > KICKOFF_EARLY_WINDOW_MINUTES;
  const dressingBlocked = Boolean(isClubMatch && !bothClubsReady);

  return {
    showKickoffSection,
    showHomeKickoff: showKickoffSection && Boolean(amIHomeTeam),
    showAwayWaiting: showKickoffSection && !amIHomeTeam,
    tooEarly,
    dressingBlocked,
    canPressKickoff: showKickoffSection && Boolean(amIHomeTeam) && !tooEarly && !dressingBlocked,
  };
}

import {isStageResult} from './tournamentStages.js';
import {sideHasResultClaim} from './gameDayResultFlow.js';

export function gameDayStatus(game) {
  const state = String(game?.result_state || '').toUpperCase();
  if (state === 'RESULT_OVERDUE') return 'Result overdue';
  if (state === 'ADMIN_REVIEW') return 'Admin review';
  if (state === 'DISPUTED' || game?.status === 'disputed') return 'Disputed result';
  if (['completed', 'forfeit'].includes(game?.status)) return isStageResult(game) ? 'Confirmed result' : 'Result under review';
  if (game?.status === 'awaiting_confirmation' || ['AWAITING_AWAY_CONFIRMATION', 'AWAITING_HOME_REVIEW'].includes(state)
    || sideHasResultClaim(game, 'home') || sideHasResultClaim(game, 'away')) return 'Awaiting confirmation';
  if (game?.status === 'in_progress') return 'Live';
  if (game?.scheduling_status && game.scheduling_status !== 'confirmed') return 'Schedule review';
  return 'Scheduled';
}

export function gameDayNextStep({game, result = {}, preparation, clubMatch, home}) {
  const status = gameDayStatus(game);
  if (status === 'Confirmed result') return {text: 'The result is confirmed. Your match report is available below.', target: 'report', label: 'View match report'};
  if (['Admin review', 'Disputed result', 'Result under review', 'Result overdue'].includes(status)) return {text: 'This result needs review. Follow the result conditions below; no new result is approved automatically.'};
  if (result.showConfirmResult || result.showHomeReview) return {text: 'Your opponent has submitted a result. Review the score and evidence before responding.', target: 'result', label: 'Review result'};
  if (status === 'Awaiting confirmation') return {text: 'Your result is submitted. Waiting for your opponent to respond.'};
  if (status === 'Schedule review') return {text: 'Review and agree the proposed playing time before kickoff.'};
  if (status === 'Live') return {text: 'The match is live. Report the result after the final whistle.', ...((result.showHomeSubmit || result.showAwaySubmit) ? {target: 'result', label: 'Report after full time'} : {})};
  if (preparation?.unavailable) return {text: 'Readiness could not be loaded. Refresh the match before continuing.'};
  if (clubMatch && preparation?.official && preparation.ready_at && !preparation.opponent_ready) return {text: 'Your squad is ready. Waiting for your opponent.'};
  if (clubMatch && (!preparation?.official || !preparation.ready_at || !preparation.opponent_ready)) return {text: 'Confirm your match squad and complete the ready check before kickoff.', target: 'squad', label: 'Review squad & readiness'};
  return {text: home ? 'Your match is scheduled. Kickoff becomes available at the permitted time.' : 'Your match is scheduled. The home side starts kickoff when both sides are ready.', target: 'kickoff', label: 'View kickoff controls'};
}

export function gameDayCompetitionHref(game) {
  if (game.competition_href) return game.competition_href;
  if (game.tournament_id && game.tournament_id !== 'ranked') return `/tournaments/${encodeURIComponent(game.tournament_id)}`;
  if (['supreme', 'elite', 'challenger'].includes(game.category)) return `/competitions/${game.category}`;
  const key = String(game.competition_key || '');
  if (key.startsWith('regional:')) {
    const edition = encodeURIComponent(key.slice('regional:'.length));
    return edition ? `/leagues/${edition}?season=${edition}` : null;
  }
  if (key.startsWith('regional_cup:')) {
    const edition = encodeURIComponent(key.slice('regional_cup:'.length));
    return edition ? `/regional-cups?edition=${edition}` : null;
  }
  return null;
}

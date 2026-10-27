import { isOfficialDisplayResult } from './penaltyOutcome.js';

export function scheduleResult(match, club, player) {
  if (!isOfficialDisplayResult(match) || match.home_score == null || match.away_score == null) return null;
  const homeScore = Number(match.home_score), awayScore = Number(match.away_score);
  const solo = match.mode === 'solo' || (!match.home_club_id && !match.away_club_id);
  const isHome = solo ? String(match.home_player_id) === String(player?.id)
    : club ? String(match.home_club_id) === String(club.id) : String(match.home_player_id) === String(player?.id);
  const myScore = isHome ? homeScore : awayScore, theirScore = isHome ? awayScore : homeScore;
  const penaltySide = Number(match.decided_on_penalties) === 1 && ['home', 'away'].includes(match.penalty_winner_side) ? match.penalty_winner_side : null;
  const outcome = penaltySide ? (penaltySide === (isHome ? 'home' : 'away') ? 'W' : 'L')
    : myScore > theirScore ? 'W' : myScore < theirScore ? 'L' : 'D';
  return { outcome, myScore, theirScore, display: `${myScore}–${theirScore}` };
}

import { isStageResult } from './tournamentStages.js';

export function isOfficialDisplayResult(match) {
  return Boolean(match) && isStageResult({ ...match, status: match.status === 'played' ? 'completed' : match.status });
}

export function penaltyOutcome(match, aggregate) {
  const side = match?.penalty_winner_side || match?.penalties?.winner_side;
  if (!['home', 'away'].includes(side) || !(Number(match?.decided_on_penalties) === 1 || match?.penalties)) return '';
  const name = match[`${side}_club_name`] || match[`${side}_player_name`] || match?.[side]?.name || match[`${side}Name`] || side;
  const total = aggregate || match.aggregate || (match.aggregate_home_score != null ? { home: match.aggregate_home_score, away: match.aggregate_away_score } : null);
  const values = Array.isArray(total) ? total : total && [total.home, total.away];
  const prefix = values?.length === 2 && values.every(value => value != null) ? `${values[0]} - ${values[1]} aggregate · ` : '';
  return `${isOfficialDisplayResult(match) ? '' : 'Proposed: '}${prefix}${name} won on penalties.`;
}

import { isOfficialDisplayResult } from './penaltyOutcome.js';

export const detailTabs = ['overview', 'clubs', 'stages', 'table', 'stats', 'rewards', 'history'];
export function directoryRows(participants, search = '', league = '', order = 'asc') {
  const query = search.trim().toLocaleLowerCase();
  return participants.filter(c => (!query || c.name.toLocaleLowerCase().includes(query)) && (!league || c.regional_league_id === league))
    .sort((a, b) => (order === 'desc' ? -1 : 1) * (a.name.localeCompare(b.name) || a.id.localeCompare(b.id)));
}
export function editionSelection(editions, requested) {
  return requested ? editions.find(s => s.id === requested) || null : editions.find(s => s.is_current) || editions.find(s => !['completed', 'archived', 'cancelled','abandoned','reset','superseded'].includes(s.status)) || editions.find(s=>!['reset','superseded'].includes(s.status)) || null;
}
export function editionProgress(season, participants, matches) {
  const played = matches.filter(m => m.status !== 'bye' && isOfficialDisplayResult(m))
    .sort((a, b) => String(a.scheduled_date || a.confirmed_date || '').localeCompare(String(b.scheduled_date || b.confirmed_date || '')) || a.id.localeCompare(b.id));
  const required = matches.filter(m => !['bye', 'cancelled', 'voided', 'void'].includes(m.status));
  const upcoming = required.filter(m => ['scheduled', 'unscheduled'].includes(m.status) && m.scheduling_status === 'confirmed' && (m.scheduled_date || m.confirmed_date))
    .map(m => ({ ...m, scheduled_date: m.scheduled_date || m.confirmed_date }))
    .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date) || a.id.localeCompare(b.id));
  const final = played.find(m => ['final', 'knockout_final', 'ucl_final'].includes(m.type));
  const finished = ['completed', 'archived'].includes(season.status);
  const started = played.length > 0 || ['league_phase', 'playoff_round', 'playoffs', 'knockout', 'knockout_r16', 'knockout_qf', 'knockout_sf', 'knockout_final', 'in_progress'].includes(season.status) || matches.some(m => m.status === 'in_progress');
  const pending = !participants.length && !required.length && ['draft', 'qualification', 'registration'].includes(season.status);
  return { played, required, upcoming, final, finished, title: finished ? season.status === 'archived' ? 'Archived edition' : 'Season completed' : pending ? 'Awaiting regional qualification' : started ? 'Competition in progress' : required.length ? 'Fixtures ready' : participants.length ? 'Qualified clubs confirmed' : 'Season preparation' };
}

export function seasonLocation(previous, seasonId, overview = false) {
  const next = new URLSearchParams(previous);
  next.set('season', seasonId);
  if (overview) next.set('tab', 'overview');
  return next;
}

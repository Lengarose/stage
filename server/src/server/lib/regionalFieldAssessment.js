'use strict';

const { VERSION, phase, windowRevision } = require('./regionalRegistrationPolicy');
const { structure } = require('./regionalStructure');

// Read-only capacity assessment. It never selects a subset, draws clubs or
// promises a sporting route merely because the capacity is supported.
function assessField(window, registrations, now = new Date(), { sourceComplete = true } = {}) {
  const apps = registrations.filter(r => r.registration_window_id === window.id);
  const confirmed = apps.filter(r => r.status === 'approved' && r.participation_status === 'confirmed');
  const claimed = apps.filter(r => r.status === 'approved' || r.participation_status === 'confirmed');
  const clubIds = new Set(confirmed.map(r => r.club_id).filter(id => typeof id === 'string' && id.trim()));
  const result = { status: 'awaiting_deadline', registrations: apps.length, confirmed_registrations: confirmed.length, confirmed_clubs: clubIds.size, unconfirmed_registrations: apps.length - confirmed.length, structure: null, blockers: [] };
  const block = (code, message) => { if (!result.blockers.some(b => b.code === code)) result.blockers.push({ code, message }); };
  const times = [window.opens_at, window.registration_closes_at, window.confirmation_closes_at].map(Date.parse);
  if (window.policy_version !== VERSION) block('unknown_policy', 'Published participation conditions need review.');
  if (times.some(t => !Number.isFinite(t)) || !(times[0] < times[1] && times[1] < times[2])) block('invalid_deadline', 'Published registration dates need review.');
  if (!sourceComplete) block('unreadable_registration', 'Registration source data is incomplete; the field cannot be assessed safely.');
  if (result.blockers.length) return { ...result, status: 'needs_review' };
  if (phase(window, now) !== 'closed') return result;

  const revision = windowRevision(window);
  const applicationsPerClub = new Map();
  for (const r of apps) applicationsPerClub.set(r.club_id, (applicationsPerClub.get(r.club_id) || 0) + 1);
  for (const r of claimed) {
    if (r.status !== 'approved' || r.participation_status !== 'confirmed') block('inconsistent_confirmation', 'A registration has conflicting approval and participation states.');
    if (typeof r.club_id !== 'string' || !r.club_id.trim()) block('missing_club', 'A confirmed registration has no valid club identity.');
    if (applicationsPerClub.get(r.club_id) !== 1) block('duplicate_club', 'Multiple applications refer to the same confirmed club.');
    if (r.registration_policy_version !== VERSION || r.accepted_rules_revision !== revision) block('changed_conditions', 'A confirmation does not match the published participation conditions.');
    if (r.region_slug !== window.region_slug || r.platform !== window.platform || Number(r.season_number) !== Number(window.season_number) || Number(r.reset_series || 0) !== Number(window.reset_series || 0)) block('scope_mismatch', 'A confirmation belongs to a different regional edition.');
    const at = Date.parse(r.confirmed_at);
    if (!Number.isFinite(at) || !require('./regionalReservePolicy').validConfirmation(window,r)) block('confirmation_time', 'A confirmation has no valid timestamp inside its published confirmation or reserve window.');
    const players = r.confirmed_player_ids;
    if (!Array.isArray(players) || players.length < 3 || players.some(id => typeof id !== 'string' || !id.trim()) || new Set(players).size !== players.length) block('confirmation_roster', 'A confirmation has no valid captured selection of at least three players.');
  }
  // Capacity uses the whole confirmed field, including suspect records. Invalid
  // evidence blocks assessment rather than silently shrinking the field.
  if (result.blockers.length) return { ...result, status: 'needs_review' };
  try {
    const plan = structure(clubIds.size);
    result.structure = { clubs_per_group: 20, total_groups: plan.groups.length, d1_groups: plan.groups.filter(g => g.division === 1).length, d2_groups: plan.groups.filter(g => g.division === 2).length };
    result.status = 'structure_supported';
  } catch (error) {
    if (error.code !== 'REGIONAL_STRUCTURE_REVIEW') throw error;
    block('unsupported_count', 'The complete confirmed field has no approved structure. Review waiting-list or growth policy; no club has been dropped.');
    result.status = 'needs_review';
  }
  return result;
}

module.exports = { assessField };

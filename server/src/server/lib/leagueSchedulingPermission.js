'use strict';
const same = (a,b) => Boolean(a && b && String(a) === String(b));
function manages(club,user) {
  return Boolean(club && user && (same(club.president_user_id,user.id) || same(club.user_id,user.id) || (user.email && String(club.owner_email || '').toLowerCase() === user.email.toLowerCase())));
}
function validateSchedulePatch(current,patch,user,clubs) {
  const fail = message => {const e = new Error(message); e.status=403; throw e;};
  if (!current.home_club_id || !current.away_club_id) fail('Cannot schedule unknown participants');
  if (['completed','played','forfeit','cancelled','voided'].includes(current.status)) fail('This fixture is closed');
  const home = manages(clubs.find(c=>same(c.id,current.home_club_id)),user);
  const away = manages(clubs.find(c=>same(c.id,current.away_club_id)),user);
  const allowed = ['scheduling_status','last_proposed_by','proposal_count','home_proposed_date','away_proposed_date','confirmed_date','scheduled_date','status'];
  if (Object.keys(patch).some(k=>!allowed.includes(k))) fail('Use the authorised fixture action for non-scheduling changes');
  if (patch.scheduling_status === 'home_proposed') {
    if (!home || current.scheduling_status === 'confirmed' || !patch.home_proposed_date || patch.away_proposed_date || patch.last_proposed_by !== 'home') fail('Only the home president or owner may propose a match time');
    if (!Number.isFinite(Date.parse(patch.home_proposed_date))) fail('Invalid proposed date');
    if (current.window_end && Date.parse(patch.home_proposed_date) > Date.parse(current.window_end)) fail('Proposed time is beyond the scheduling deadline');
    if (patch.confirmed_date || patch.scheduled_date || patch.status) fail('A proposal cannot confirm its own schedule');
  } else if (patch.scheduling_status === 'confirmed') {
    const proposal = current.scheduling_status === 'home_proposed' && away ? current.home_proposed_date : current.scheduling_status === 'away_proposed' && home ? current.away_proposed_date : null;
    if (!proposal || Date.parse(patch.confirmed_date) !== Date.parse(proposal) || Date.parse(patch.scheduled_date) !== Date.parse(proposal) || patch.status !== 'scheduled') fail('Only the opposing president or owner may accept the actual pending proposal');
  } else if (patch.scheduling_status === 'open') {
    if (!away || current.scheduling_status !== 'home_proposed' || patch.home_proposed_date != null || patch.away_proposed_date != null || patch.confirmed_date || patch.scheduled_date || patch.status) fail('Only the away president or owner may decline the pending proposal');
  } else fail('Use the existing scheduling workflow');
}
module.exports = { manages, validateSchedulePatch };

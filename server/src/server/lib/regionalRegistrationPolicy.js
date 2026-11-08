'use strict';
const { STAGE_PLUS_TIERS } = require('../utils/subscriptionAccess');
const { fail } = require('./regionalEditionIdentity');
const VERSION='regional_registration_v1';
const DAY=86400000;
// Preserve key order: accepted_rules_revision hashes this exact public shape.
const publicWindow=window=>({...Object.fromEntries(['id','region_slug','platform','season_number','reset_series','opens_at','registration_closes_at','confirmation_closes_at','policy_version','cup_policy_version','result_policy_version','confirmation_notice_policy_version','rules_text','withdrawal_policy_version'].map(key=>[key,window[key]])),...(window.season_orchestration_policy_version?{season_orchestration_policy_version:window.season_orchestration_policy_version}:{}),...(window.reschedule_policy_version?{reschedule_policy_version:window.reschedule_policy_version}:{}),...(window.recurring_schedule_policy_version?{recurring_schedule_policy_version:window.recurring_schedule_policy_version}:{}),...(window.league_start_monday?{league_start_monday:window.league_start_monday}:{})});
const legacyPublicWindow=publicWindow;
const participationWindow=window=>({...legacyPublicWindow(window),...(window.reserve_policy_version?{reserve_policy_version:window.reserve_policy_version}:{}),...(window.cup_tied_policy_version?{cup_tied_policy_version:window.cup_tied_policy_version}:{}),...(window.player_transfer_policy_version?{player_transfer_policy_version:window.player_transfer_policy_version}:{})});
const windowRevision=window=>require('node:crypto').createHash('sha256').update(JSON.stringify(participationWindow(window))).digest('hex');
function schedule(opensAt) {
  if(typeof opensAt!=='string' || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(opensAt) || !Number.isFinite(Date.parse(opensAt)))fail('Provide an opening timestamp with an explicit UTC offset',400);
  const start=Date.parse(opensAt);
  return {opens_at:new Date(start).toISOString(),registration_closes_at:new Date(start+28*DAY).toISOString(),confirmation_closes_at:new Date(start+35*DAY).toISOString()};
}
function phase(window,now=new Date()) {
  const time=new Date(now).getTime();
  if(window.status!=='published')return 'unpublished';
  if(time<Date.parse(window.opens_at))return 'upcoming';
  if(time<Date.parse(window.registration_closes_at))return 'registration';
  if(time<Date.parse(window.confirmation_closes_at))return 'confirmation';
  return 'closed';
}
function plusStatus(player,now=new Date()) {
  if(!player || !STAGE_PLUS_TIERS.has(String(player.subscription || '').toLowerCase()))return 'plus_required';
  const expiry=player.subscription_expires_at;
  if(expiry!=null && expiry!=='') {
    if(!Number.isFinite(new Date(expiry).getTime()))return 'subscription_review';
    if(new Date(expiry).getTime()<=new Date(now).getTime())return 'plus_expired';
  }
  return 'eligible';
}
function rosterReport(players,clubId,now=new Date()) {
  if(new Set(players.map(p=>p.id)).size!==players.length)fail('Multiple active playing registrations require Admin review');
  const roster=players.map(player=>({id:player.id,gamertag:player.gamertag || 'Player',
    status:String(player.playing_club_id || player.club_id)!==String(clubId)?'registered_elsewhere':plusStatus(player,now)}));
  return {minimum_players:3,eligible_count:roster.filter(p=>p.status==='eligible').length,players:roster};
}
module.exports={VERSION,schedule,phase,plusStatus,rosterReport,publicWindow:participationWindow,windowRevision};

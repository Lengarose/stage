'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {assessField}=require('../regionalFieldAssessment');
const {windowRevision}=require('../regionalRegistrationPolicy');
const now=new Date('2026-11-03T19:00:00Z');
const window={id:'w',status:'published',region_slug:'uk-ireland',platform:'cross-platform',season_number:1,reset_series:0,policy_version:'regional_registration_v1',opens_at:'2026-09-29T19:00:00Z',registration_closes_at:'2026-10-27T19:00:00Z',confirmation_closes_at:now.toISOString(),rules_text:'Published terms'};
function applications(count) {return Array.from({length:count},(_,i)=>({id:`r${i}`,club_id:`club${i}`,registration_window_id:window.id,registration_policy_version:window.policy_version,accepted_rules_revision:windowRevision(window),status:'approved',participation_status:'confirmed',region_slug:window.region_slug,platform:window.platform,season_number:1,reset_series:0,confirmed_at:'2026-10-28T19:00:00Z',confirmed_player_ids:[`private${i}a`,`private${i}b`,`private${i}c`]}));}

test('closed fields use every confirmed club and the approved capacity table without generating a draw',()=>{
  for(const [n,d1,d2] of [[20,1,0],[40,1,1],[60,1,2],[80,2,2],[100,2,3],[120,2,4],[180,3,6],[240,4,8]]) {
    const apps=applications(n),before=JSON.stringify(apps),result=assessField(window,apps,now);
    assert.equal(result.status,'structure_supported');assert.equal(result.confirmed_clubs,n);
    assert.deepEqual(result.structure,{clubs_per_group:20,total_groups:d1+d2,d1_groups:d1,d2_groups:d2});
    assert.equal(JSON.stringify(apps),before);assert.doesNotMatch(JSON.stringify(result),/private|club0|accepted_rules_revision|draw_seed/);
  }
});
test('13, 30, 50, 130 and zero clubs require review rather than rounding down, extending a deadline or creating partial groups',()=>{
  for(const n of [0,13,30,50,130]) {
    const result=assessField(window,applications(n),now);
    assert.equal(result.status,'needs_review');assert.equal(result.confirmed_clubs,n);assert.equal(result.structure,null);
    assert.equal(result.blockers[0].code,'unsupported_count');
  }
});
test('the complete shared deadline is required; unconfirmed applications are reported without deleting or confirming them',()=>{
  const apps=[...applications(20),{id:'pending',club_id:'pendingClub',registration_window_id:'w',status:'pending',participation_status:'registered'}];
  assert.equal(assessField(window,apps,new Date(now.getTime()-1)).status,'awaiting_deadline');
  const result=assessField(window,apps,now);assert.equal(result.status,'structure_supported');assert.equal(result.unconfirmed_registrations,1);assert.equal(result.registrations,21);
  assert.equal(apps.at(-1).status,'pending');
});
test('duplicate clubs or inconsistent confirmation states block the whole field without selecting a subset',()=>{
  const apps=applications(20);apps.push({...apps[0],id:'duplicate'});
  const duplicate=assessField(window,apps,now);assert.equal(duplicate.confirmed_registrations,21);assert.equal(duplicate.confirmed_clubs,20);assert.equal(duplicate.structure,null);assert.equal(duplicate.blockers[0].code,'duplicate_club');
  const inconsistent=applications(20);inconsistent[0].status='pending';
  assert.ok(assessField(window,inconsistent,now).blockers.some(b=>b.code==='inconsistent_confirmation'));
});
test('changed conditions, scope, confirmation timestamp, roster or unreadable sources require review',()=>{
  for(const [patch,code] of [[{accepted_rules_revision:'old'},'changed_conditions'],[{platform:'PS5'},'scope_mismatch'],[{season_number:2},'scope_mismatch'],[{confirmed_at:window.confirmation_closes_at},'confirmation_time'],[{confirmed_at:'invalid'},'confirmation_time'],[{confirmed_player_ids:['one','one','two']},'confirmation_roster'],[{confirmed_player_ids:['one','two']},'confirmation_roster'],[{club_id:''},'missing_club']]) {
    const apps=applications(20);Object.assign(apps[0],patch);
    const result=assessField(window,apps,now);assert.equal(result.status,'needs_review');assert.equal(result.structure,null);assert.ok(result.blockers.some(b=>b.code===code));
  }
  assert.equal(assessField(window,applications(20),now,{sourceComplete:false}).blockers[0].code,'unreadable_registration');
  assert.equal(assessField({...window,policy_version:'unknown'},applications(20),now).blockers[0].code,'unknown_policy');
});
test('public window refactor preserves previously accepted JSON hashes, including windows without result/Cup terms',()=>{
  const crypto=require('node:crypto');
  for(const extra of [{},{cup_policy_version:'regional_cup_v1',result_policy_version:'regional_result_review_v2'}]) {
    const w={...window,...extra};
    const prior=Object.fromEntries(['id','region_slug','platform','season_number','reset_series','opens_at','registration_closes_at','confirmation_closes_at','policy_version','cup_policy_version','result_policy_version','rules_text'].map(k=>[k,w[k]]));
    assert.equal(windowRevision(w),crypto.createHash('sha256').update(JSON.stringify(prior)).digest('hex'));
  }
});

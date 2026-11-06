'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createService}=require('../regionalConfirmedCycleService');
const {windowRevision}=require('../../lib/regionalRegistrationPolicy');
function fixture(count=40) {
  const window={id:'w',permanent_league_id:'d1',status:'published',region_slug:'uk-ireland',platform:'cross-platform',season_number:1,reset_series:0,policy_version:'regional_registration_v1',opens_at:'2026-09-29T19:00:00Z',registration_closes_at:'2026-10-27T19:00:00Z',confirmation_closes_at:'2026-11-03T19:00:00Z',rules_text:'Published rules'};
  const groups=[1,2].map(division=>({id:`d${division}`,region_slug:'uk-ireland',platform:'cross-platform',season_number:1,reset_series:0,division,group_code:'A',slug:`uk-ireland-div-${division}`,status:'registration',registered_club_ids:[]}));
  const registrations=Array.from({length:count},(_,i)=>({id:`r${i}`,club_id:`club${i}`,registration_window_id:'w',registration_policy_version:window.policy_version,accepted_rules_revision:windowRevision(window),status:'approved',participation_status:'confirmed',region_slug:window.region_slug,platform:window.platform,season_number:1,reset_series:0,confirmed_at:'2026-10-28T19:00:00Z',confirmed_player_ids:['p1','p2','p3']}));
  const cycles=[];let reads=0;
  const service=createService({transaction:fn=>fn(),admin:async actor=>{if(actor?.id!=='admin')throw Object.assign(Error('Admin required'),{status:403});},windows:{selectOne:async()=>{reads++;return structuredClone(window);},confirmedField:async()=>structuredClone(registrations)},editionModel:{selectAll:async()=>structuredClone(groups)},cycles:{selectAll:async()=>structuredClone(cycles)},clock:()=>new Date('2026-11-03T19:00:00Z')});
  return {service,window,groups,registrations,cycles,get reads(){return reads;}};
}
test('an empty launch derives all confirmed entrants and a single D1 anchor without creating or omitting clubs',async()=>{
  const f=fixture(),before=JSON.stringify([f.groups,f.registrations]);
  const input=await f.service.inputForWindow('w',{id:'admin'});
  assert.equal(input.mode,'placement');assert.deepEqual(input.source_edition_ids,['d1']);assert.equal(input.registration_ids.length,40);assert.equal(input.target_count,40);
  assert.equal(JSON.stringify([f.groups,f.registrations]),before);
});
test('seeded launch clubs stay in their source rosters and are never added twice as newcomers',async()=>{
  const f=fixture(60);f.groups[0].registered_club_ids=f.registrations.slice(0,20).map(r=>r.club_id);f.groups[1].registered_club_ids=f.registrations.slice(20,40).map(r=>r.club_id);
  const input=await f.service.inputForWindow('w',{id:'admin'});
  assert.deepEqual(input.source_edition_ids,['d1','d2']);assert.equal(input.registration_ids.length,20);assert.equal(input.target_count,60);
});
test('next-season confirmations derive a transition, preserving source rights rather than replacing returning clubs',async()=>{
  const f=fixture(60);f.window.season_number=2;
  for(const r of f.registrations){r.season_number=2;r.accepted_rules_revision=windowRevision(f.window);}
  for(const [i,g] of f.groups.entries()){g.status='completed';g.registered_club_ids=f.registrations.slice(i*20,i*20+20).map(r=>r.club_id);}
  const input=await f.service.inputForWindow('w',{id:'admin'});
  assert.equal(input.mode,'transition');assert.equal(input.registration_ids.length,20);assert.equal(input.target_count,60);
  f.groups[0].registered_club_ids[0]='missing-returning-club';
  await assert.rejects(f.service.inputForWindow('w',{id:'admin'}),/sporting rights has not confirmed/);
});
test('closed-field derivation rejects an open deadline, unsupported count, duplicate evidence and existing captured cycle',async()=>{
  const open=fixture();open.window.confirmation_closes_at='2026-11-04T19:00:00Z';await assert.rejects(open.service.inputForWindow('w',{id:'admin'}),/not ready/);
  const unsupported=fixture(50);await assert.rejects(unsupported.service.inputForWindow('w',{id:'admin'}),/not ready/);
  const duplicate=fixture();duplicate.registrations.push({...duplicate.registrations[0],id:'duplicate'});await assert.rejects(duplicate.service.inputForWindow('w',{id:'admin'}),/not ready/);
  const captured=fixture();captured.cycles.push({id:'c',status:'running',participation_window_snapshot:{id:'w'}});await assert.rejects(captured.service.inputForWindow('w',{id:'admin'}),/already has a saved/);
});
test('reset, retired, malformed, duplicate-roster and mixed-season sources require review; authorization precedes private reads',async()=>{
  const denied=fixture();await assert.rejects(denied.service.inputForWindow('w',{id:'ordinary',role_id:0}),error=>error.status===403);assert.equal(denied.reads,0);
  for(const mutate of [f=>{f.groups[0].reset_series=1;},f=>{f.groups[0].retired=true;},f=>{f.groups[0].registered_club_ids='broken';},f=>{f.groups[0].registered_club_ids=['club0'];f.groups[1].registered_club_ids=['club0'];},f=>{f.groups[0].registered_club_ids=['club0'];f.groups[1].registered_club_ids=['club1'];f.groups[1].season_number=2;f.groups[1].slug='uk-ireland-div-2-s2';}]) {
    const f=fixture();mutate(f);await assert.rejects(f.service.inputForWindow('w',{id:'admin'}));
  }
});

test('trusted automatic field selection requires the captured version and preserves the exact field',async()=>{
 const f=fixture(20);
 await assert.rejects(f.service.automaticInputForWindow('w'),/captured automatic/);
 Object.assign(f.window,{season_orchestration_policy_version:'regional_season_orchestration_v1',result_policy_version:'regional_result_review_v2'});
 for(const r of f.registrations)r.accepted_rules_revision=windowRevision(f.window);
 const input=await f.service.automaticInputForWindow('w');assert.equal(input.target_count,20);assert.equal(input.registration_ids.length,20);
 f.window.confirmation_closes_at='2026-11-04T19:00:00Z';await assert.rejects(f.service.automaticInputForWindow('w'),/not ready/);
});
test('automatic retries resolve the exact captured cycle and reject changed conditions or scope',async()=>{
 const f=fixture(20);Object.assign(f.window,{season_orchestration_policy_version:'regional_season_orchestration_v1',result_policy_version:'regional_result_review_v2'});
 f.cycles.push({id:'cycle',status:'allocated',region_slug:f.window.region_slug,platform:f.window.platform,season_number:1,reset_series:0,participation_window_snapshot:structuredClone(f.window)});
 assert.deepEqual(await f.service.automaticInputForWindow('w'),{existing_cycle_id:'cycle'});
 f.cycles[0].participation_window_snapshot.rules_text='changed';await assert.rejects(f.service.automaticInputForWindow('w'),/disagree/);
});

'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const policy=require('../../lib/regionalRegistrationPolicy');
const {createService}=require('../regionalRegistrationService');
function fixture() {
  let time=new Date('2026-11-02T12:00:00Z');
  let state={windows:[],registrations:[],audits:[],notifications:[],noticeSettings:null,definitions:[{id:'d1',permanent_league_id:'d1',region_slug:'uk-ireland',platform:'cross-platform',division:1,group_code:'A',season_number:1,reset_series:0,status:'registration',slug:'uk-ireland-div-1'}],
    users:[{id:'owner',email:'owner@test.local',role_id:1},{id:'other',email:'other@test.local',role_id:1},{id:'admin',email:'admin@test.local',role_id:2}],
    clubs:[{id:'club',name:'Club',president_user_id:'owner',owner_email:'owner@test.local',platform:'PS5'}],
    registrar:{id:'president-player',subscription:'stage_plus',subscription_expires_at:null},
    players:[1,2,3,4].map(i=>({id:`p${i}`,gamertag:`Player ${i}`,club_id:'club',playing_club_id:'club',subscription:i===4?'free':'stage_plus',subscription_expires_at:null}))};
  let injected=false;
  const copy=structuredClone;
  const model={
    selectAll:async()=>copy(state.windows),selectOne:async id=>copy(state.windows.find(w=>w.id===id)),
    create:async record=>{if(injected)throw Error('Injected failure');state.windows.push(copy(record));},
    actor:async id=>copy(state.users.find(u=>u.id===id)),club:async id=>copy(state.clubs.find(c=>c.id===id)),
    actorPlayer:async()=>copy(state.registrar),players:async()=>copy(state.players),
    registrations:async club=>copy(state.registrations.filter(r=>r.club_id===club)),registration:async id=>copy(state.registrations.find(r=>r.id===id)),
    confirmedField:async id=>copy(state.registrations.filter(r=>r.registration_window_id===id)),
    notificationSettings:async()=>copy(state.noticeSettings),saveReserveNotice:async notice=>{state.notifications.push(copy(notice));},saveConfirmationNotice:async notice=>{state.notifications.push(copy(notice));},
    saveRegistration:async(record,_,create)=>{if(injected)throw Error('Injected failure');if(create)state.registrations.push(copy(record));else state.registrations[state.registrations.findIndex(r=>r.id===record.id)]=copy(record);},
  };
  const query=async(sql,values)=>{if(sql.startsWith('INSERT INTO club_operation_audit_logs'))return {};if(sql.startsWith('INSERT INTO admin_audit_log')){state.audits.push(values);return {};}if(sql.startsWith('SELECT c.*'))return state.clubs.filter(c=>c.id===values[0]).map(c=>({...copy(c),president_user_email:state.users.find(u=>u.id===c.president_user_id)?.email}));throw Error(`Unexpected SQL ${sql}`);};
  let queue=Promise.resolve();
  const transaction=fn=>{
    const run=queue.then(async()=>{const before=copy(state);try{return await fn(query);}catch(err){state=before;throw err;}});queue=run.catch(()=>{});return run;
  };
  const editionService={admin:async actor=>{const user=state.users.find(u=>u.id===actor?.id&&u.role_id===2);if(!user)throw Object.assign(Error('Admin access required'),{status:403});return user;},model:{lock:async()=>{},selectAll:async()=>copy(state.definitions)}};
  const service=createService({model,transaction,query,clock:()=>new Date(time),editionService});
  const input={permanent_league_id:'d1',season_number:1,reset_series:0,opens_at:'2026-11-09T12:00:00Z',rules_text:'Published regional rules',reason:'Approved local test'};
  async function publish(){const preview=await service.publish(input,{id:'admin'});return service.publish({...input,apply:true,expected_revision:preview.revision},{id:'admin'});}
  const apply=window=>service.apply(window.id,{club_id:'club',policy_version:policy.VERSION},{id:'owner'});
  return {service,input,publish,apply,model,query,get state(){return state;},at(value){time=new Date(value);},fail(value){injected=value;}};
}
test('published periods use four registration weeks and one common confirmation week with exact boundaries',()=>{
  const timing=policy.schedule('2026-11-09T12:00:00Z'),window={...timing,status:'published'};
  assert.equal(timing.registration_closes_at,'2026-12-07T12:00:00.000Z');assert.equal(timing.confirmation_closes_at,'2026-12-14T12:00:00.000Z');
  for(const [date,phase] of [['2026-11-09T11:59:59Z','upcoming'],['2026-11-09T12:00:00Z','registration'],['2026-12-07T11:59:59Z','registration'],['2026-12-07T12:00:00Z','confirmation'],['2026-12-14T11:59:59Z','confirmation'],['2026-12-14T12:00:00Z','closed']])assert.equal(policy.phase(window,date),phase);
  assert.throws(()=>policy.schedule('2026-11-09T12:00'),/offset/);
});

test('new periods publish the response-review policy before consent and preserve it in the public window', async () => {
  const f=fixture();
  const published=await f.publish();
  assert.equal(published.window.result_policy_version,'regional_result_review_v2');
  assert.match(published.window.rules_text,/24 hours/);
  assert.match(published.window.rules_text,/silence does not confirm/);
  assert.equal(f.state.windows[0].result_policy_version,'regional_result_review_v2');
  assert.equal(published.window.confirmation_notice_policy_version,'regional_confirmation_notice_v1');
  assert.match(published.window.rules_text,/away club may submit immediately/);
});

async function registeredForReminder() {
  const f=fixture(),{window}=await f.publish();f.at(window.opens_at);const {registration}=await f.apply(window);
  return {f,window,registration};
}
test('confirmation opening creates one native notice and receipt without confirming entry or changing the shared deadline',async()=>{
  const {f,window,registration}=await registeredForReminder();
  f.at(new Date(Date.parse(window.registration_closes_at)-1).toISOString());assert.equal((await f.service.remindConfirmation(registration.id)).status,'not_needed');assert.equal(f.state.notifications.length,0);
  f.at(window.registration_closes_at);
  const results=await Promise.all([f.service.remindConfirmation(registration.id),f.service.remindConfirmation(registration.id)]);
  assert.deepEqual(results.map(r=>r.status),['stored','already_checked']);assert.equal(f.state.notifications.length,1);
  const notice=f.state.notifications[0];assert.equal(notice.email,'owner@test.local');assert.match(notice.body,/at least three/);assert.ok(notice.body.includes(window.confirmation_closes_at));assert.match(notice.link,/register-league\?club=club&region=uk-ireland/);
  assert.equal(f.state.registrations[0].status,'pending');assert.equal(f.state.registrations[0].participation_status,'registered');assert.equal(f.state.registrations[0].accepted_rules_revision,registration.accepted_rules_revision);assert.equal(f.state.windows[0].confirmation_closes_at,window.confirmation_closes_at);
});
test('muted reminders are checkpointed once and the current confirmation still works with captured conditions',async()=>{
  const {f,window,registration}=await registeredForReminder();f.at(window.registration_closes_at);f.state.noticeSettings={club_updates:false};
  assert.equal((await f.service.remindConfirmation(registration.id)).status,'muted');assert.equal(f.state.notifications.length,0);
  assert.equal((await f.service.remindConfirmation(registration.id)).status,'already_checked');
  await f.service.confirm(registration.id,{policy_version:policy.VERSION,player_ids:['p1','p2','p3']},{id:'owner'});
  assert.equal((await f.service.remindConfirmation(registration.id)).status,'not_needed');assert.equal(f.state.registrations[0].participation_status,'confirmed');
});
test('receipt write failure rolls back its notification, and a retry is safe; no reminder is stored after the closing boundary',async()=>{
  const {f,window,registration}=await registeredForReminder();f.at(window.registration_closes_at);const before=JSON.stringify(f.state);
  f.fail(true);await assert.rejects(f.service.remindConfirmation(registration.id),/Injected failure/);assert.equal(JSON.stringify(f.state),before);
  f.fail(false);assert.equal((await f.service.remindConfirmation(registration.id)).status,'stored');assert.equal(f.state.notifications.length,1);
  const late=await registeredForReminder();late.f.at(late.window.registration_closes_at);late.f.model.notificationSettings=async()=>{late.f.at(late.window.confirmation_closes_at);return null;};
  assert.equal((await late.f.service.remindConfirmation(late.registration.id)).status,'not_needed');assert.equal(late.f.state.notifications.length,0);assert.equal(late.f.state.registrations[0].confirmation_notice,undefined);
});
test('legacy, withdrawn, confirmed, closed or invalidated entries never receive a new opening notice',async()=>{
  for(const change of [({f})=>{delete f.state.windows[0].confirmation_notice_policy_version;},({f})=>{f.state.registrations[0].status='withdrawn';},({f})=>{f.state.registrations[0].status='approved';f.state.registrations[0].participation_status='confirmed';},({f,window})=>f.at(window.confirmation_closes_at),({f})=>{f.state.windows[0].edition_invalidated=true;}]) {
    const env=await registeredForReminder();env.f.at(env.window.registration_closes_at);change(env);
    assert.equal((await env.f.service.remindConfirmation(env.registration.id)).status,'not_needed');assert.equal(env.f.state.notifications.length,0);
  }
});
test('changed conditions, missing president contact and reset sources fail rather than sending a guessed reminder',async()=>{
  for(const change of [f=>{f.state.registrations[0].accepted_rules_revision='old';},f=>{f.state.users[0].email='';f.state.clubs[0].owner_email='';},f=>{f.state.definitions[0].reset_series=1;}]) {
    const {f,window,registration}=await registeredForReminder();f.at(window.registration_closes_at);change(f);
    await assert.rejects(f.service.remindConfirmation(registration.id));assert.equal(f.state.notifications.length,0);assert.equal(f.state.registrations[0].confirmation_notice,undefined);
  }
});
test('a restarted reminder worker reuses the persistent receipt and current published-window eligibility',async()=>{
  const {f,window}=await registeredForReminder();f.at(window.registration_closes_at);
  const {createService:createWorker}=require('../regionalConfirmationReminderService');
  const options={...require('./helpers/confirmationProgress').fixture(),windows:f.service.windows,remind:f.service.remindConfirmation,model:{reminderCandidates:async(_cursor,_now,_q,ids)=>f.state.registrations.filter(r=>ids.includes(r.registration_window_id)&&!r.confirmation_notice).map(r=>({id:r.id}))}};
  assert.deepEqual(await createWorker(options).tick(),{stored:1,muted:0});assert.deepEqual(await createWorker(options).tick(),{stored:0,muted:0});assert.equal(f.state.notifications.length,1);
  const old=await registeredForReminder();delete old.f.state.windows[0].confirmation_notice_policy_version;
  const before=JSON.stringify(old.f.state.windows);await assert.rejects(old.f.service.publish(old.f.input,{id:'admin'}),/immutable/);assert.equal(JSON.stringify(old.f.state.windows),before);
});
test('Plus access distinguishes expiry, free members, malformed expiry and loaned-out players without billing data',()=>{
  const now='2026-11-02T12:00:00Z';
  assert.equal(policy.plusStatus({subscription:'plus',subscription_expires_at:now},now),'plus_expired');
  assert.equal(policy.plusStatus({subscription:'stage_plus',subscription_expires_at:'invalid'},now),'subscription_review');
  assert.equal(policy.plusStatus({subscription:'free'},now),'plus_required');
  assert.equal(policy.plusStatus({subscription:'stage_plus'},now),'eligible');
  const report=policy.rosterReport([{id:'a',gamertag:'A',club_id:'club',playing_club_id:'other',subscription:'stage_plus',stripe_customer_id:'secret'}],'club',now);
  assert.equal(report.players[0].status,'registered_elsewhere');assert.equal(report.players[0].stripe_customer_id,undefined);
});
test('publishing is audited, immutable, retry-safe and never silently applies new rules to started editions',async()=>{
  const env=fixture(),before=structuredClone(env.state);
  const preview=await env.service.publish(env.input,{id:'admin'});assert.deepEqual(env.state,before);
  await assert.rejects(env.service.publish(env.input,{id:'owner'}),/Admin/);
  await assert.rejects(env.service.publish({...env.input,apply:true,expected_revision:'stale'},{id:'admin'}),/changed/);
  const first=await env.publish();assert.equal(env.state.windows.length,1);assert.equal(env.state.audits.length,1);
  env.at('2026-11-10T12:00:00Z');assert.equal((await env.service.publish({...env.input,apply:true},{id:'admin'})).already_applied,true);
  await assert.rejects(env.service.publish({...env.input,opens_at:'2026-11-16T12:00:00Z',apply:true},{id:'admin'}),/immutable/);
  const started=fixture();started.state.definitions[0].status='in_progress';await assert.rejects(started.publish(),/Started|started/);
  assert.equal(first.window.published_by,undefined);
});
test('last-day applicants share the same week; confirmation uses three actual Plus players and no division selection',async()=>{
  const env=fixture(),{window}=await env.publish();env.at('2026-12-07T11:59:59Z');
  const applied=await env.apply(window);assert.equal(applied.registration.status,'pending');assert.equal(applied.registration.division,undefined);assert.equal(applied.registration.assigned_league_id,undefined);
  const id=applied.registration.id,body={policy_version:policy.VERSION,player_ids:['p1','p2','p3']};
  await assert.rejects(env.service.confirm(id,body,{id:'owner'}),/confirmation week/);
  env.at('2026-12-07T12:00:00Z');
  await assert.rejects(env.service.confirm(id,{...body,player_ids:['p1','p2']},{id:'owner'}),/three/);
  await assert.rejects(env.service.confirm(id,{...body,player_ids:['p1','p2','p4']},{id:'owner'}),/active Plus/);
  await assert.rejects(env.service.confirm(id,{...body,player_ids:['p1','p1','p2']},{id:'owner'}),/different/);
  const result=await env.service.confirm(id,body,{id:'owner'});assert.equal(result.registration.status,'approved');assert.equal(result.registration.participation_status,'confirmed');
  assert.equal(env.state.players[3].subscription,'free','nonparticipating members stay');
  env.at('2026-12-20T00:00:00Z');env.state.definitions[0].status='in_progress';
  assert.equal((await env.service.confirm(id,body,{id:'owner'})).already_applied,true);assert.equal((await env.apply(window)).already_applied,true);
});
test('ownership, personal Plus, current roster and exact deadline are enforced server-side',async()=>{
  const env=fixture(),{window}=await env.publish();env.at(window.opens_at);
  await assert.rejects(env.service.readiness('club',{id:'other'}),/president/);
  await assert.rejects(env.service.apply(window.id,{club_id:'club',policy_version:policy.VERSION},{id:'other'}),/president/);
  env.state.registrar.subscription='free';await assert.rejects(env.apply(window),/personal/);env.state.registrar.subscription='stage_plus';
  const {registration}=await env.apply(window);env.at(window.registration_closes_at);
  env.state.players[2].playing_club_id='other';await assert.rejects(env.service.confirm(registration.id,{policy_version:policy.VERSION,player_ids:['p1','p2','p3']},{id:'owner'}),/another playing club/);
  env.state.players[2].playing_club_id='club';env.at(window.confirmation_closes_at);
  await assert.rejects(env.service.confirm(registration.id,{policy_version:policy.VERSION,player_ids:['p1','p2','p3']},{id:'owner'}),/confirmation week/);
});
test('simultaneous retries create one registration; rollback preserves all state after a write failure',async()=>{
  const env=fixture(),{window}=await env.publish();env.at(window.opens_at);
  const before=structuredClone(env.state);env.fail(true);await assert.rejects(env.apply(window),/Injected/);assert.deepEqual(env.state,before);env.fail(false);
  const [a,b]=await Promise.all([env.apply(window),env.apply(window)]);assert.equal(a.registration.id,b.registration.id);assert.equal(env.state.registrations.length,1);
});
test('a regional field waits for the common deadline and a confirmation; existing editions without a window remain compatible',async()=>{
  const env=fixture();assert.equal(await env.service.confirmedField('old-region','cross-platform',1,0,['club']),null);
  const {window}=await env.publish();env.at(window.opens_at);const {registration}=await env.apply(window);
  await assert.rejects(env.service.confirmedField('uk-ireland','cross-platform',1,0,['club']),/deadline/);
  env.at(window.confirmation_closes_at);await assert.rejects(env.service.confirmedField('uk-ireland','cross-platform',1,0,['club']),/valid confirmation/);
  env.at(window.registration_closes_at);await env.service.confirm(registration.id,{policy_version:policy.VERSION,player_ids:['p1','p2','p3']},{id:'owner'});
  env.at(require('../../lib/regionalReservePolicy').deadline(window));const proof=await env.service.confirmedField('uk-ireland','cross-platform',1,0,['club']);assert.equal(proof.registrations.length,1);
  env.state.registrations.push({...env.state.registrations[0],id:'other-confirmed',club_id:'another-club'});
  await assert.rejects(env.service.confirmedField('uk-ireland','cross-platform',1,0,['club']),/omits confirmed clubs/);
});
test('retired or reset registration periods close publicly and publication cannot change a pending cycle',async()=>{
  const env=fixture(),{window}=await env.publish();env.at(window.opens_at);env.state.definitions[0].retired=true;
  assert.equal((await env.service.windows()).windows[0].phase,'closed');await assert.rejects(env.apply(window),/no longer current/);
  const pending=fixture();pending.state.definitions[0].pending_regional_cycle_id='recorded-cycle';
  await assert.rejects(pending.publish(),/captured regional cycle/);
});
test('readiness returns only eligibility information, including free nonparticipating members',async()=>{
  const env=fixture(),report=await env.service.readiness('club',{id:'owner'});
  assert.equal(report.eligible_count,3);assert.equal(report.players.length,4);assert.equal(report.registrar_status,'eligible');assert.equal(report.players[0].subscription,undefined);assert.equal(report.players[0].subscription_expires_at,undefined);
  const admin=await env.service.readiness('club',{id:'admin'});assert.equal(admin.can_manage_registration,false);assert.equal(admin.eligible_count,3);
  env.state.users.find(u=>u.id==='other').role_id=null;await assert.rejects(env.service.readiness('club',{id:'other'}),/president/);
});
test('the confirmation deadline is checked again after roster loading, before any confirmation is saved',async()=>{
  const env=fixture(),{window}=await env.publish();env.at(window.opens_at);const {registration}=await env.apply(window);
  env.at(window.registration_closes_at);
  env.model.players=async()=>{env.at(window.confirmation_closes_at);return structuredClone(env.state.players);};
  await assert.rejects(env.service.confirm(registration.id,{policy_version:policy.VERSION,player_ids:['p1','p2','p3']},{id:'owner'}),/deadline passed/);
  assert.equal(env.state.registrations[0].participation_status,'registered');
});
test('published registration, readiness, application and confirmation actions are exercised over local HTTP',async()=>{
  const express=require('express'),env=fixture();
  const modulePath=require.resolve('../regionalRegistrationService'),saved=require.cache[modulePath].exports;
  require.cache[modulePath].exports={...saved,...env.service};
  const app=express();app.use(express.json());app.use((req,_res,next)=>{req.user={id:req.headers['x-test-actor'] || 'owner'};next();});
  const makeRouter=require('../../controllers/leagueEntityController').makeRouter;
  app.use('/api/stage/regional-leagues',makeRouter('regional_league'));
  app.use('/api/stage/season-registrations',makeRouter('season_registration'));
  const server=await new Promise(resolve=>{const http=app.listen(0,'127.0.0.1',()=>resolve(http));});
  async function request(path,body,actor='owner') {
    const response=await fetch(`http://127.0.0.1:${server.address().port}/api/stage/${path}`,{method:body?'POST':'GET',headers:{'content-type':'application/json','x-test-actor':actor},...(body?{body:JSON.stringify(body)}:{})});
    return {status:response.status,data:await response.json()};
  }
  try {
    const preview=await request('regional-leagues/registration-windows',env.input,'admin');assert.equal(preview.status,200);
    const published=await request('regional-leagues/registration-windows',{...env.input,apply:true,expected_revision:preview.data.revision},'admin');assert.equal(published.status,200);
    const window=published.data.window;assert.equal((await request('regional-leagues/registration-windows')).data.windows.length,1);
    assert.equal((await request('regional-leagues/registration-readiness/club')).data.eligible_count,3);
    assert.equal((await request('regional-leagues/registration-readiness/club',null,'other')).status,403);
    env.at(window.opens_at);
    const applied=await request(`regional-leagues/registration-windows/${window.id}/apply`,{club_id:'club',policy_version:policy.VERSION,division:1,owner_email:'forged'});
    assert.equal(applied.status,200);assert.equal(applied.data.registration.owner_email,'owner@test.local');assert.equal(applied.data.registration.division,undefined);
    env.at(window.registration_closes_at);
    const confirmed=await request(`regional-leagues/registrations/${applied.data.registration.id}/confirm`,{policy_version:policy.VERSION,player_ids:['p1','p2','p3']});
    assert.equal(confirmed.status,200);assert.equal(confirmed.data.registration.participation_status,'confirmed');
    assert.equal((await request('season-registrations',{club_id:'club',registration_policy_version:policy.VERSION,status:'approved'})).status,409);
    assert.equal((await request('regional-leagues/registration-windows',env.input,'owner')).status,403);
  } finally {await new Promise(resolve=>server.close(resolve));require.cache[modulePath].exports=saved;}
});
module.exports={fixture};

test('new Cup entry conditions are published before confirmation and cannot be retrofitted to old periods',async()=>{
 const env=fixture();env.input.include_cup=true;const {window}=await env.publish();assert.equal(window.cup_policy_version,'regional_cup_v1');assert.match(window.rules_text,/enter automatically/);
 env.at(window.opens_at);const {registration}=await env.apply(window);env.at(window.registration_closes_at);await env.service.confirm(registration.id,{policy_version:policy.VERSION,player_ids:['p1','p2','p3']},{id:'owner'});env.at(window.confirmation_closes_at);
 env.at(require('../../lib/regionalReservePolicy').deadline(window));const field=await env.service.confirmedField('uk-ireland','cross-platform',1,0,['club'],env.query);assert.equal(field.window.cup_policy_version,'regional_cup_v1');
 const old=fixture();await old.publish();old.input.include_cup=true;await assert.rejects(old.publish(),/immutable/);assert.equal(old.state.windows[0].cup_policy_version,undefined);
 const na=fixture();na.state.definitions[0].region_slug='north-america';na.state.definitions[0].slug='north-america-div-1';na.input.include_cup=true;await assert.rejects(na.publish(),/time profile/);
});

test('Cup capture can read accepted confirmation evidence after league start without reopening registration',async()=>{
 const env=fixture();env.input.include_cup=true;const {window}=await env.publish();env.at(window.opens_at);const {registration}=await env.apply(window);env.at(window.registration_closes_at);await env.service.confirm(registration.id,{policy_version:policy.VERSION,player_ids:['p1','p2','p3']},{id:'owner'});env.at(window.confirmation_closes_at);env.state.definitions[0].status='in_progress';
 await assert.rejects(env.service.confirmedField('uk-ireland','cross-platform',1,0,['club'],env.query),/started/);
 env.at(require('../../lib/regionalReservePolicy').deadline(window));const before=structuredClone(env.state),field=await env.service.capturedField('uk-ireland','cross-platform',1,0,['club'],env.query);assert.equal(field.registrations[0].club_id,'club');assert.equal(field.window.cup_policy_version,'regional_cup_v1');assert.deepEqual(env.state,before);
 env.state.registrations=[];await assert.rejects(env.apply(window),/started/);env.state.definitions[0].edition_invalidated=true;await assert.rejects(env.service.capturedField('uk-ireland','cross-platform',1,0,['club'],env.query),/invalidated/);
});

test('new windows disclose automatic preparation and optional configured Monday without modifying legacy public shapes',async()=>{
 const f=fixture();f.input.league_start_monday='2026-12-21';
 const published=(await f.publish()).window;
 assert.equal(published.season_orchestration_policy_version,'regional_season_orchestration_v1');assert.equal(published.league_start_monday,'2026-12-21');
 const legacy={id:'legacy',policy_version:policy.VERSION};const shape=policy.publicWindow(legacy);assert.equal(Object.hasOwn(shape,'season_orchestration_policy_version'),false);assert.equal(Object.hasOwn(shape,'league_start_monday'),false);
 const bad=fixture();bad.input.league_start_monday='2026-12-22';await assert.rejects(bad.publish(),/Monday/);
});


test('recurring periods publish the next edition at the approved relative weeks, retain Plus/Cup conditions and retry safely',async()=>{
 const f=fixture();f.input.league_start_monday='2026-12-21';f.input.include_cup=true;
 const source=(await f.publish()).window;
 const next=await f.service.reconcileNextWindow(source.id,'2026-12-21');assert.equal(next.window.season_number,2);assert.equal(next.window.league_start_monday,'2027-03-22');
 assert.equal(next.window.opens_at,'2027-01-17T23:00:00.000Z');assert.equal(next.window.registration_closes_at,'2027-02-14T23:00:00.000Z');assert.equal(next.window.confirmation_closes_at,'2027-02-21T23:00:00.000Z');assert.equal(next.window.cup_policy_version,'regional_cup_v1');
 assert.equal(f.state.audits.at(-1)[1],null);assert.equal(f.state.windows.length,2);
 const retry=await f.service.reconcileNextWindow(source.id,'2026-12-21');assert.equal(retry.already_applied,true);assert.equal(f.state.windows.length,2);
});
test('recurring periods use local calendar weeks across DST and do not backdate a missed registration launch',async()=>{
 const f=fixture();f.input.league_start_monday='2027-03-01';const source=(await f.publish()).window;
 const next=await f.service.reconcileNextWindow(source.id,'2027-03-01');assert.equal(next.window.opens_at,'2027-03-28T22:00:00.000Z');assert.equal(next.window.registration_closes_at,'2027-04-25T22:00:00.000Z');
 const late=fixture();const old=(await late.publish()).window;late.at('2027-01-20T12:00:00Z');await assert.rejects(late.service.reconcileNextWindow(old.id,'2026-12-21'),/future|backdated/);assert.equal(late.state.windows.length,1);
});

test('reserve invitations use one shared deadline and acceptance rechecks Plus, roster and ownership',async()=>{
 const f=fixture(),{window}=await f.publish();f.at(window.opens_at);const {registration}=await f.apply(window);
 f.at(window.confirmation_closes_at);const status=await f.service.reconcileReserves(window.id);assert.equal(status.status,'awaiting_reserves');assert.equal(f.state.notifications.length,1);
 const invitation=structuredClone(f.state.registrations[0].reserve_invitation);await f.service.reconcileReserves(window.id);assert.deepEqual(f.state.registrations[0].reserve_invitation,invitation);assert.equal(f.state.notifications.length,1);
 const body={decision:'accept',player_ids:['p1','p2','p3']};await assert.rejects(f.service.respondReserve(registration.id,body,{id:'other'}),e=>e.status===403);
 f.state.players[2].subscription='free';await assert.rejects(f.service.respondReserve(registration.id,body,{id:'owner'}),/active Plus/);f.state.players[2].subscription='stage_plus';
 const [a,b]=await Promise.all([f.service.respondReserve(registration.id,body,{id:'owner'}),f.service.respondReserve(registration.id,body,{id:'owner'})]);assert.equal(a.registration.id,b.registration.id);assert.equal(b.already_applied,true);
 assert.equal(require('../../lib/regionalReservePolicy').validConfirmation(window,f.state.registrations[0]),true);
 await assert.rejects(f.service.confirmedField('uk-ireland','cross-platform',1,0,['club']),/reserve deadline/);
 f.at(status.deadline);assert.equal((await f.service.confirmedField('uk-ireland','cross-platform',1,0,['club'])).registrations.length,1);
});
test('decline or reserve silence never confirms, and exact deadline does not extend per invitation',async()=>{
 for(const decision of ['decline','silence']){
  const f=fixture(),{window}=await f.publish();f.at(window.opens_at);const {registration}=await f.apply(window);f.at(new Date(Date.parse(window.confirmation_closes_at)+47*3600000).toISOString());
  await f.service.reconcileReserves(window.id);assert.equal(f.state.registrations[0].reserve_invitation.deadline,require('../../lib/regionalReservePolicy').deadline(window));
  if(decision==='decline')await f.service.respondReserve(registration.id,{decision},{id:'owner'});
  f.at(require('../../lib/regionalReservePolicy').deadline(window));await assert.rejects(f.service.respondReserve(registration.id,{decision:'accept',player_ids:['p1','p2','p3']},{id:'owner'}));assert.equal(f.state.registrations[0].participation_status,'registered');
 }
});

'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {planCalendar,loadViolations}=require('../../lib/regionalCalendarPlan');
const {scheduleTime}=require('../../lib/officialScheduleTime');
const {createService,busyEvents}=require('../regionalCalendarService');
const {planFixtures}=require('../leagueLifecycleService');
function fixture() {
 let state={editions:[{id:'edition',slug:'uk-ireland-div-1',region_slug:'uk-ireland',platform:'cross-platform',division:1,season_number:1,status:'in_progress',regional_participation_policy_version:'regional_registration_v1',registered_club_ids:Array.from({length:20},(_,i)=>`club${i}`)}],fixtures:[],events:{matches:[],engines:[],fixtures:[]},selections:[],record:null,audits:[],notifications:[],contacts:{},settings:{},preferenceReads:[],user:{id:'admin',email:'admin@test',role_id:0}};
 state.fixtures=planFixtures('regional_league',state.editions[0],state.editions[0].registered_club_ids.map(id=>({id,name:id})));
 const copy=structuredClone;
 const model={actor:async id=>id===state.user.id?copy(state.user):{id,role_id:1},lock:async()=>{},editions:async()=>copy(state.editions),fixtures:async ids=>copy(state.fixtures.filter(f=>ids.includes(f.league_id))),events:async()=>copy(state.events),selections:async()=>copy(state.selections),published:async()=>copy(state.record),createMatch:async row=>{state.events.matches.push(copy(row));},updateMatch:async row=>{state.events.matches[state.events.matches.findIndex(m=>m.id===row.id)]=copy(row);},saveFixture:async row=>{state.fixtures[state.fixtures.findIndex(f=>f.id===row.id)]=copy(row);},saveEngine:async row=>{state.events.engines[state.events.engines.findIndex(e=>e.id===row.id)]=copy(row);},audit:async(ctx,user,before,after)=>{state.audits.push(copy({before,after,user}));},save:async record=>{state.record=copy(record);},summary:async clubs=>{if(state.fail==='notify')throw Error('notification failed');state.notifications.push(copy(clubs));}};
 model.cycle=async id=>state.cycle?.id===id?copy(state.cycle):null;
 const query=async(sql,v)=>{
  if(sql.startsWith('SELECT c.*')){const contact=Object.hasOwn(state.contacts,v[0])?state.contacts[v[0]]:{id:v[0],name:v[0],president_user_email:`${v[0]}@test.local`};return contact?[copy(contact)]:[];}
  if(sql.startsWith('SELECT notification_settings')){if(state.fail==='preferences')throw Error('Settings unavailable');state.preferenceReads.push(v[0]);return [{notification_settings:copy(state.settings[v[0]] || {})}];}
  if(sql.startsWith('INSERT INTO notifications')){if(state.fail==='notice' && state.notifications.length===3)throw Error('Notice write failed');state.notifications.push(copy(v));return {};}
  throw Error('Unexpected calendar notification query');
 };
 const service=createService({model,transaction:async fn=>{const before=copy(state);try{return await fn(query);}catch(e){state=before;throw e;}},clock:()=>new Date('2026-11-03T12:00:00Z')});
 const body={edition_ids:['edition'],start_monday:'2026-11-09'};
 return {model,service,body,get state(){return state;},preview:()=>service.action(body,{id:'admin'}),publish:revision=>service.action({...body,apply:true,reason:'Reviewed complete calendar',expected_revision:revision},{id:'admin'})};
}
function useNativeSummary(f){f.model.summary=require('../../models/regionalCalendarModel').RegionalCalendarModel.prototype.summary;}
test('native calendar notices target each exact edition and persist aggregate counts atomically with publication',async()=>{
 const f=fixture();useNativeSummary(f);const p=await f.preview();assert.equal(f.state.notifications.length,0);
 const published=await f.publish(p.revision);assert.deepEqual(published.notification_summary,{version:'regional_calendar_notice_v1',stored:20,muted:0});
 assert.equal(f.state.notifications.length,20);assert.equal(new Set(f.state.notifications.map(n=>n[0])).size,20);
 for(const n of f.state.notifications){assert.match(n[0],/^[a-f0-9-]{36}$/);assert.equal(n[2],'match_scheduled');assert.equal(n[5],'/leagues/edition?season=edition&tab=stages');assert.equal(n[6],'edition');assert.match(n[4],/Season 1/);assert.match(n[4],/Europe\/Brussels/);}
 const before=structuredClone(f.state);assert.equal((await f.publish(p.revision)).already_published,true);assert.deepEqual(f.state,before);
});
test('calendar notices honor match preferences and current president contacts, with one notice per club even for shared contacts',async()=>{
 const f=fixture();useNativeSummary(f);
 f.state.contacts.club0={id:'club0',name:'First',president_user_email:' Current@Test.local ',owner_user_email:'stale@test.local'};
 f.state.contacts.club1={id:'club1',name:'Second',president_user_email:'current@test.local'};
 f.state.settings['club2@test.local']={web:{match_reminders:false},mobile:{match_reminders:false},email:{match_reminders:true},push:{match_reminders:true}};
 const p=await f.preview(),record=await f.publish(p.revision);assert.equal(record.notification_summary.muted,1);assert.equal(record.notification_summary.stored,19);
 const shared=f.state.notifications.filter(n=>n[1]==='current@test.local');assert.equal(shared.length,2);assert.notEqual(shared[0][0],shared[1][0]);assert.notEqual(shared[0][7],shared[1][7]);
 assert.equal(f.state.preferenceReads.filter(email=>email==='current@test.local').length,1);assert.ok(f.state.notifications.every(n=>!['stale@test.local','club2@test.local'].includes(n[1])));
 assert.doesNotMatch(JSON.stringify(record),/current@test|notification_settings|stale@test/);
});
test('native contact, preference, notice and final calendar-save failures roll back every publication write',async()=>{
 for(const mode of ['contact','preferences','notice','save']) {
  const f=fixture();useNativeSummary(f);if(mode==='contact')f.state.contacts.club3=null;else f.state.fail=mode;
  if(mode==='save')f.model.save=async()=>{throw Error('Calendar save failed');};
  const p=await f.preview(),before=structuredClone(f.state);await assert.rejects(f.publish(p.revision));assert.deepEqual(f.state,before);
 }
});
test('already published calendars are not backfilled or notified again under the new summary policy',async()=>{
 const f=fixture(),p=await f.preview();await f.publish(p.revision);const before=structuredClone(f.state);
 f.model.summary=async()=>{throw Error('Must not backfill');};assert.equal((await f.publish(p.revision)).already_published,true);assert.deepEqual(f.state,before);
});
test('native notices preserve distinct group links and deterministic identities across a rolled-back attempt',async()=>{
 const f=fixture();useNativeSummary(f);
 const second={...f.state.editions[0],id:'second',division:2,slug:'uk-ireland-div-2',registered_club_ids:Array.from({length:20},(_,i)=>`second${i}`)};
 f.state.editions.push(second);f.state.fixtures.push(...planFixtures('regional_league',second,second.registered_club_ids.map(id=>({id,name:id}))));f.body.edition_ids.push('second');
 const p=await f.preview(),attempts=[];const summary=f.model.summary;
 f.model.summary=async(clubs,record,q)=>{const result=await summary(clubs,record,async(sql,args)=>{if(sql.startsWith('INSERT INTO notifications'))attempts.push(args[0]);return q(sql,args);});throw Error(`Simulated failure after ${result.stored} notices`);};
 await assert.rejects(f.publish(p.revision),/Simulated failure/);assert.equal(f.state.notifications.length,0);assert.equal(f.state.record,null);
 f.model.summary=summary;const saved=await f.publish(p.revision);assert.equal(saved.notification_summary.stored,40);assert.deepEqual(f.state.notifications.map(n=>n[0]),attempts);
 const secondNotices=f.state.notifications.filter(n=>n[6]==='second');assert.equal(secondNotices.length,20);assert.ok(secondNotices.every(n=>n[5]==='/leagues/second?season=second&tab=stages'));
});
function captureCycle(f) {
 f.state.cycle={id:'cycle',status:'allocated',region_slug:'uk-ireland',platform:'cross-platform',season_number:1,reset_series:0,allocated_groups:f.state.editions.map(e=>({id:e.id,permanent_league_id:e.permanent_league_id || e.id,division:e.division,group_code:e.group_code || 'A'}))};
 for(const edition of f.state.editions)edition.regional_cycle_id='cycle';
 return {cycle_id:'cycle',start_monday:f.body.start_monday};
}
test('stored-cycle calendar derives the entire group selection without writes and retains reviewed publication',async()=>{
 const f=fixture(),second={...f.state.editions[0],id:'d2',slug:'uk-ireland-div-2',division:2,registered_club_ids:Array.from({length:20},(_,i)=>`second${i}`)};
 f.state.editions.push(second);f.state.fixtures.push(...planFixtures('regional_league',second,second.registered_club_ids.map(id=>({id,name:id}))));
 const body=captureCycle(f),before=structuredClone(f.state),p=await f.service.action(body,{id:'admin'});
 assert.deepEqual(f.state,before);assert.deepEqual(p.edition_ids,['d2','edition']);assert.equal(p.source_cycle_id,'cycle');assert.equal(p.entries.length,760);
 const published=await f.service.action({...body,apply:true,reason:'Reviewed saved cycle calendar',expected_revision:p.revision},{id:'admin'});
 assert.equal(published.status,'published');assert.equal(f.state.audits.length,760);assert.equal(f.state.events.matches.length,760);
 const saved=structuredClone(f.state);assert.equal((await f.service.action({...body,apply:true},{id:'admin'})).already_published,true);assert.deepEqual(f.state,saved);
});
test('cycle calendar refuses client group overrides, invalid sources and mismatched saved allocations',async()=>{
 for(const change of [f=>{delete f.state.cycle;},f=>{f.state.cycle.status='ready';},f=>{f.state.cycle.edition_invalidated=true;},f=>{f.state.cycle.invalidated_at='reset';},f=>{f.state.cycle.allocated_groups=[];},f=>{f.state.cycle.allocated_groups.push(f.state.cycle.allocated_groups[0]);},f=>{f.state.cycle.region_slug='france';},f=>{f.state.cycle.reset_series=1;},f=>{f.state.cycle.allocated_groups[0].division=2;},f=>{f.state.cycle.allocated_groups[0].permanent_league_id='other';},f=>{f.state.cycle.allocated_groups[0].group_code='B';},f=>{f.state.editions[0].regional_cycle_id='other';},f=>{f.state.editions[0].status='draft';},f=>{f.state.fixtures=[];}]) {
  const f=fixture(),body=captureCycle(f);change(f);const before=structuredClone(f.state);await assert.rejects(f.service.action(body,{id:'admin'}));assert.deepEqual(f.state,before);
 }
 const f=fixture(),body=captureCycle(f);await assert.rejects(f.service.action({...body,edition_ids:['edition']},{id:'admin'}),/not both/);
 let read=false;f.model.cycle=async()=>{read=true;};await assert.rejects(f.service.action(body,{id:'player'}),/Admin/);assert.equal(read,false);
});
test('cycle selection is bound to the preview revision and rechecked before publication',async()=>{
 const f=fixture(),body=captureCycle(f),manual=await f.preview();
 await assert.rejects(f.service.action({...body,apply:true,expected_revision:manual.revision,reason:'Review'},{id:'admin'}),/source changed/);
 const preview=await f.service.action(body,{id:'admin'});f.state.cycle.allocated_groups[0].group_code='B';
 await assert.rejects(f.service.action({...body,apply:true,expected_revision:preview.revision,reason:'Review'},{id:'admin'}),/no longer matches/);assert.equal(f.state.record,null);
});
test('38 round calendar gives every club 38 games over ten weeks, final rounds simultaneously within each group',async()=>{
 const f=fixture(),before=structuredClone(f.state),p=await f.preview();assert.deepEqual(f.state,before);
 assert.equal(p.entries.length,380);assert.equal(p.blockers.length,0);
 const first=p.entries.find(e=>e.matchday===1),last=p.entries.find(e=>e.matchday===38);
 assert.equal(first.scheduled_date,'2026-11-10 20:00:00');assert.equal(last.scheduled_date,'2027-01-12 20:40:00');
 for(let md=1;md<=38;md++){const rows=p.entries.filter(e=>e.matchday===md);assert.equal(rows.length,10);assert.equal(new Set(rows.map(r=>r.instant)).size,1);}
 assert.deepEqual(p.reserved_weeks.map(w=>w.week),[11,12]);
});
test('planner preserves local European kickoff across daylight saving changes',()=>{
 const f=fixture(),p=planCalendar({editions:f.state.editions,fixtures:f.state.fixtures,start_monday:'2027-03-01',now:new Date('2027-01-01')});
 const before=p.entries.find(e=>e.matchday===1),after=p.entries.find(e=>e.matchday===21);
 assert.match(new Date(before.instant).toISOString(),/19:00:00/);assert.match(new Date(after.instant).toISOString(),/18:00:00/);assert.match(after.scheduled_date,/20:00:00$/);
});
test('full draw, Monday, supported region, unique participants and round identities are mandatory',async()=>{
 for(const change of [f=>{f.body.start_monday='2026-11-10';},f=>{f.body.start_monday='2026-02-30';},f=>{f.state.fixtures.pop();},f=>{f.state.fixtures[1].home_club_id=f.state.fixtures[0].home_club_id;},f=>{f.state.editions[0].registered_club_ids[1]='club0';},f=>{f.state.editions[0].region_slug='north-america';f.state.editions[0].slug='north-america-div-1';}]){const f=fixture();change(f);await assert.rejects(f.preview());}
});
test('match intervals permit touching blocks but reject overlap, too many games and too many evenings',()=>{
 const e=(id,date,minutes=40)=>({id,home_club_id:'club',away_club_id:`other${id}`,instant:scheduleTime(date,'Europe/Brussels').instant,minutes});
 assert.deepEqual(loadViolations([e('a','2026-11-10T20:00'),e('b','2026-11-10T20:40')]),[]);
 assert.match(loadViolations([e('a','2026-11-10T20:00',60),e('b','2026-11-10T20:40')]).join(),/overlapping/);
 assert.match(loadViolations([e('a','2026-11-10T20:00'),e('b','2026-11-10T20:40'),e('c','2026-11-10T21:20')]).join(),/more than 2/);
 const rows=Array.from({length:5},(_,i)=>e(i,`2026-11-${String(9+i).padStart(2,'0')}T20:00`));assert.match(loadViolations(rows).join(),/more than 4 playing/);
 assert.match(loadViolations([...rows,...rows.slice(0,3).map((r,i)=>({...r,id:`extra${i}`,instant:r.instant+40*60000}))]).join(),/more than 7/);
});
test('busy alias normalization counts canonical match once, preserves different fixtures, and refuses missing timezone',()=>{
 const m={id:'match',source_fixture_id:'engine',home_club_id:'club',away_club_id:'other',scheduled_date:'2026-11-10 20:00:00',timezone:'Europe/Brussels',status:'scheduled',type:'league'};
 const events={matches:[m],engines:[{...m,id:'engine',legacy_fixture_id:'fixture',match_id:'match',scheduled_at:m.scheduled_date}],fixtures:[{...m,id:'fixture',match_id:'match'}]};
 assert.equal(busyEvents(events).length,1);assert.equal(busyEvents(events)[0].minutes,40);
 assert.throws(()=>busyEvents({matches:[{...m,timezone:null}]}),/timezone/);
});
test('publication is atomic and idempotent, keeps fixture IDs and links all canonical GameDay matches',async()=>{
 const f=fixture(),preview=await f.preview(),ids=f.state.fixtures.map(r=>r.id);const published=await f.publish(preview.revision);
 assert.equal(published.status,'published');assert.equal(f.state.events.matches.length,380);assert.equal(f.state.audits.length,380);assert.equal(f.state.notifications.length,1);
 assert.deepEqual(f.state.fixtures.map(r=>r.id),ids);
 assert.ok(f.state.fixtures.every(r=>r.match_id && r.scheduling_status==='confirmed'));
 const before=structuredClone(f.state);assert.equal((await f.publish(preview.revision)).already_published,true);assert.deepEqual(f.state,before);
 f.body.start_monday='2026-11-16';await assert.rejects(f.preview(),/already has/);
});
test('changed source, new external conflicts, permission and old editions block publication',async()=>{
 const f=fixture(),p=await f.preview();f.state.fixtures[0].home_club_name='Changed';await assert.rejects(f.publish(p.revision),/source changed/);assert.equal(f.state.record,null);
 const g=fixture(),time=(await g.preview()).entries[0];g.state.events.matches.push({id:'external',home_club_id:time.home_club_id,away_club_id:'externalclub',scheduled_date:time.scheduled_date,timezone:'Europe/Brussels',type:'cup',status:'scheduled'});
 const blocked=await g.preview();assert.ok(blocked.blockers.length);await assert.rejects(g.publish(blocked.revision),/conflicts/);assert.equal(g.state.audits.length,0);
 await assert.rejects(f.service.action(f.body,{id:'player'}),/Admin/);f.state.editions[0].regional_participation_policy_version=null;await assert.rejects(f.preview(),/new official/);
});
test('failed notification rolls back the entire calendar including all match and audit writes',async()=>{
 const f=fixture(),p=await f.preview();f.state.fail='notify';const before=structuredClone(f.state);await assert.rejects(f.publish(p.revision),/notification failed/);assert.deepEqual(f.state,before);
});
test('already scheduled, shared GameDay, prepared matches and omitted populated groups cannot be overwritten',async()=>{
 const f=fixture();f.state.fixtures[0].scheduled_date='2026-11-10 20:00:00';await assert.rejects(f.preview(),/unscheduled/);
 const g=fixture();g.state.selections.push({id:'evidence'});await assert.rejects(g.preview(),/evidence/);
 const h=fixture();h.state.editions.push({...h.state.editions[0],id:'division2',slug:'uk-ireland-div-2',division:2});await assert.rejects(h.preview(),/all populated/);
 const j=fixture();j.state.editions[0].retired_at='2026-11-01';await assert.rejects(j.preview(),/active league/);
});
test('calendar HTTP action serves preview and publication and preserves business status codes',async()=>{
 const express=require('express'),f=fixture();const path=require.resolve('../regionalCalendarService'),saved=require.cache[path];let server;
 require.cache[path]={exports:f.service};
 try {
  const app=express();app.use(express.json(),(req,res,next)=>{req.user={id:req.headers['x-actor'] || 'admin'};next();});
  app.use('/regional-leagues',require('../../controllers/leagueEntityController').makeRouter('regional_league'));
  server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const call=async(body,actor='admin')=>{const r=await fetch(`http://127.0.0.1:${server.address().port}/regional-leagues/calendar`,{method:'POST',headers:{'Content-Type':'application/json','x-actor':actor},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
  assert.equal((await call(f.body,'player')).status,403);
  const cycleBody=captureCycle(f);assert.equal((await call(cycleBody,'player')).status,403);
  const derived=await call(cycleBody);assert.equal(derived.status,200);assert.equal(derived.data.source_cycle_id,'cycle');assert.deepEqual(derived.data.edition_ids,['edition']);assert.equal(f.state.record,null);
  assert.equal((await call({...cycleBody,edition_ids:['edition']})).status,400);
  const p=await call(f.body);assert.equal(p.status,200);assert.equal(p.data.entries.length,380);assert.equal(f.state.record,null);
  assert.equal((await call({...f.body,apply:true,expected_revision:'stale',reason:'Review'})).status,409);
  useNativeSummary(f);
  const published=await call({...cycleBody,apply:true,expected_revision:derived.data.revision,reason:'Review'});assert.equal(published.status,200);assert.equal(published.data.status,'published');assert.equal(published.data.source_cycle_id,'cycle');assert.equal(published.data.notification_summary.stored,20);
 } finally {if(server)await new Promise(resolve=>server.close(resolve));if(saved)require.cache[path]=saved;else delete require.cache[path];}
});
test('calendar cycle lookup is parameterized, scoped and locked with indexed status preserved',async()=>{
 const {RegionalCalendarModel}=require('../../models/regionalCalendarModel');let statement,args;
 const record=await new RegionalCalendarModel().cycle('cycle',async(sql,v)=>{statement=sql;args=v;return [{id:'cycle',status:'allocated',data_json:JSON.stringify({status:'ready',allocated_groups:[{id:'edition'}]})}];});
 assert.match(statement,/entity_type='regional_cycle'/);assert.match(statement,/id=\? FOR UPDATE/);assert.deepEqual(args,['cycle']);assert.equal(record.status,'allocated');assert.equal(record.allocated_groups[0].id,'edition');
});
test('conflicting stored engine pointers and unrelated GameDay identities are never silently repaired',async()=>{
 const f=fixture(),source=f.state.fixtures[0];source.match_id='missing';
 f.state.events.engines.push({id:'engine',legacy_fixture_id:source.id,legacy_fixture_type:'regional_league',match_id:'match',home_club_id:source.home_club_id,away_club_id:source.away_club_id,status:'unscheduled'});
 f.state.events.matches.push({id:'match',source_fixture_id:source.id,source_fixture_type:'regional_league',home_club_id:source.home_club_id,away_club_id:source.away_club_id,status:'unscheduled'});
 await assert.rejects(f.preview(),/pointers disagree/);
 const g=fixture(),other=g.state.fixtures[0];other.match_id='arranged';g.state.events.matches.push({id:'arranged',source_fixture_type:'arranged',home_club_id:other.home_club_id,away_club_id:other.away_club_id,status:'unscheduled'});
 await assert.rejects(g.preview(),/source identity/);
});
test('multiple divisions publish together and preserve an existing unscheduled engine/GameDay binding',async()=>{
 const f=fixture(),first=f.state.fixtures[0];
 const second={...f.state.editions[0],id:'division2',slug:'uk-ireland-div-2',division:2,registered_club_ids:Array.from({length:20},(_,i)=>`d2club${i}`)};
 f.state.editions.push(second);f.state.fixtures.push(...planFixtures('regional_league',second,second.registered_club_ids.map(id=>({id,name:id}))));f.body.edition_ids.push('division2');
 first.match_id='match';f.state.events.engines.push({id:'engine',legacy_fixture_type:'regional_league',legacy_fixture_id:first.id,match_id:'match',home_club_id:first.home_club_id,away_club_id:first.away_club_id,status:'unscheduled',scheduling_status:'open'});
 f.state.events.matches.push({id:'match',source_fixture_type:'competition_engine',source_fixture_id:'engine',home_club_id:first.home_club_id,away_club_id:first.away_club_id,status:'pending_schedule'});
 const p=await f.preview();assert.equal(p.entries.length,760);assert.deepEqual(p.blockers,[]);
 await f.publish(p.revision);assert.equal(f.state.events.matches.length,760);assert.equal(f.state.events.engines[0].match_id,'match');assert.equal(f.state.events.engines[0].scheduled_at,f.state.events.matches.find(m=>m.id==='match').scheduled_date);
});


test('automatic season calendars use the captured Monday and existing transaction without an Admin identity',async()=>{
 const f=fixture();captureCycle(f);f.state.cycle.participation_window_snapshot={policy_version:'regional_registration_v1',result_policy_version:'regional_result_review_v2',season_orchestration_policy_version:'regional_season_orchestration_v1',league_start_monday:f.body.start_monday};
 f.model.actor=async()=>{throw Error('A system task must not impersonate an Admin');};
 const published=await f.service.reconcileCalendar('cycle');assert.equal(published.status,'published');assert.equal(f.state.events.matches.length,380);assert.equal(f.state.audits[0].user.id,null);
 const before=structuredClone(f.state);assert.equal((await f.service.reconcileCalendar('cycle')).already_published,true);assert.deepEqual(f.state,before);
});
test('new automatic calendars require the confirmed 48-hour publication lead time and never invent a date',async()=>{
 const f=fixture();captureCycle(f);f.state.cycle.participation_window_snapshot={policy_version:'regional_registration_v1',result_policy_version:'regional_result_review_v2',season_orchestration_policy_version:'regional_season_orchestration_v1'};
 assert.equal((await f.service.reconcileCalendar('cycle')).status,'awaiting_date');
 f.state.cycle.participation_window_snapshot.league_start_monday='2026-11-02';await assert.rejects(f.service.reconcileCalendar('cycle'),error=>error.details?.some?.(message=>/48 hours/.test(message)) || /conflicts/.test(error.message));assert.equal(f.state.events.matches.length,0);
});


test('an explicitly published manual calendar satisfies a missing captured automatic date without inventing one',async()=>{
 const f=fixture();captureCycle(f);f.state.cycle.participation_window_snapshot={policy_version:'regional_registration_v1',result_policy_version:'regional_result_review_v2',season_orchestration_policy_version:'regional_season_orchestration_v1'};
 f.state.record={id:'published',status:'published',edition_ids:['edition'],start_monday:'2026-11-09'};
 const existing=await f.service.reconcileCalendar('cycle');assert.equal(existing.already_published,true);assert.equal(existing.id,'published');assert.equal(f.state.events.matches.length,0);
});

'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createService}=require('../regionalPromotionCalendarService');
const sporting=require('../../lib/regionalStructure');
const policy=require('../../lib/regionalPromotionCalendarPolicy.json');
function fixture() {
 let state={cycle:{id:'cycle',input:{mode:'transition',target_count:40},status:'running',region_slug:'uk-ireland',policy_version:sporting.VERSION,source_ranking_policy_version:sporting.SOURCE_RANKING_VERSION,participation_window_snapshot:{policy_version:'regional_registration_v1'},source_edition_ids:['d1','d2'],source_snapshot:[{edition_id:'d1',identity:{division:1,group_code:'A'},club_ids:Array.from({length:20},(_,i)=>`d1-${i}`)},{edition_id:'d2',identity:{division:2,group_code:'A'},club_ids:Array.from({length:20},(_,i)=>`club${i}`)}],fixture_refs:{}},plan:{fixtures:[],pending:[]},fixtures:[],matches:[],bookings:{matches:[],engines:[],fixtures:[]},calendars:[{id:'source-calendar',status:'published',policy_version:'regional_calendar_europe_v1',timezone:'Europe/Brussels',start_monday:'2026-11-09',edition_ids:['d1','d2']}],records:[],audits:[],notifications:[],selections:[]};
 const refs=['promotion:D2A:sf:2-5','promotion:D2A:sf:3-4'];
 refs.forEach((ref,i)=>{
  const id=`fixture${i}`,matchId=`match${i}`,home=`club${i*2}`,away=`club${i*2+1}`;
  state.cycle.fixture_refs[ref]=id;state.plan.fixtures.push({ref,home,away,allow_penalties:true,round:1});state.plan.pending.push(state.plan.fixtures.at(-1));
  state.fixtures.push({id,match_id:matchId,legacy_fixture_type:'regional_pathway',legacy_fixture_id:id,competition_instance_id:'cycle',home_club_id:home,away_club_id:away,status:'unscheduled',scheduling_status:'open'});
  state.matches.push({id:matchId,source_fixture_type:'competition_engine',source_fixture_id:id,competition_context:'cycle',home_club_id:home,away_club_id:away,status:'pending_schedule',allow_penalties:1,type:'knockout'});
 });
 const copy=structuredClone;
 const model={actor:async id=>id==='admin'?{id,role_id:0,email:'admin@test'}:{id,role_id:1},lock:async()=>{},cycle:async()=>copy(state.cycle),published:async id=>copy(state.records.find(r=>r.id===id)),calendars:async()=>copy(state.calendars),cycleMatches:async()=>copy(state.matches),events:async()=>copy({matches:[...state.matches,...state.bookings.matches],engines:[...state.fixtures,...state.bookings.engines],fixtures:state.bookings.fixtures}),selections:async()=>copy(state.selections),updateMatch:async row=>{state.matches[state.matches.findIndex(r=>r.id===row.id)]=copy(row);},saveEngine:async row=>{state.fixtures[state.fixtures.findIndex(r=>r.id===row.id)]=copy(row);},audit:async(ctx,user,before,after)=>{state.audits.push(copy({ctx,user,before,after}));return {id:`audit${state.audits.length}`};},notify:async row=>{if(state.fail==='notify')throw Error('notification failed');state.notifications.push(copy(row));},save:async record=>{state.records.push(copy(record));}};
 const evaluate=async()=>{if(state.fail==='source')throw Error('Regional source data changed');return {plan:copy(state.plan),stored:copy(state.fixtures)};};
 const transaction=async fn=>{const before=copy(state);try{return await fn(()=>{});}catch(e){state=before;throw e;}};
 const service=createService({model,evaluate,transaction,clock:()=>new Date(state.now || '2026-11-03T12:00:00Z')});
 const body={stage:'semifinal'};
 return {model,service,evaluate,transaction,body,get state(){return state;},preview:()=>service.action('cycle',body,{id:'admin'}),publish:revision=>service.action('cycle',{...body,apply:true,expected_revision:revision,reason:'Reviewed promotion calendar'},{id:'admin'})};
}
test('semifinal dates derive from week eleven; preview does not change the draw or Match IDs',async()=>{
 const f=fixture(),before=structuredClone(f.state),p=await f.preview();assert.deepEqual(f.state,before);assert.equal(p.entries.length,2);assert.deepEqual(p.blockers,[]);
 assert.ok(p.entries.every(e=>e.scheduled_date==='2027-01-19 20:00:00' && e.minutes===60));assert.equal(p.source_calendar_id,'source-calendar');
 await f.publish(p.revision);assert.equal(f.state.records.length,1);assert.equal(f.state.audits.length,2);assert.equal(f.state.notifications.length,2);
 assert.deepEqual(f.state.matches.map(m=>m.id),['match0','match1']);assert.ok(f.state.fixtures.every(e=>e.status==='scheduled'));
 const published=structuredClone(f.state);assert.equal((await f.publish(p.revision)).already_published,true);assert.deepEqual(f.state,published);
});
test('final waits for recorded winners and is then scheduled Thursday, without inventing opponents',async()=>{
 const f=fixture();f.body.stage='final';const waiting=await f.preview();assert.equal(waiting.entries.length,0);assert.match(waiting.blockers.join(),/not ready/);await assert.rejects(f.publish(waiting.revision),/blockers/);
 f.state.matches.forEach(m=>{m.status='completed';m.scheduled_date='2027-01-19 20:00:00';m.timezone='Europe/Brussels';});f.state.plan.pending=[];
 const ref='promotion:D2A:final';f.state.cycle.fixture_refs[ref]='final';f.state.plan.fixtures.push({ref,home:'club0',away:'club2',allow_penalties:true,round:2});
 f.state.fixtures.push({...f.state.fixtures[0],id:'final',legacy_fixture_id:'final',match_id:'final-match',home_club_id:'club0',away_club_id:'club2'});
 f.state.matches.push({...f.state.matches[0],id:'final-match',source_fixture_id:'final',status:'pending_schedule',scheduled_date:null,home_club_id:'club0',away_club_id:'club2'});
 const p=await f.preview();assert.equal(p.entries[0].scheduled_date,'2027-01-21 20:00:00');assert.deepEqual(p.blockers,[]);await f.publish(p.revision);assert.equal(f.state.matches.at(-1).status,'scheduled');
});
test('unresolved decisions, growth routes, missing anchors, unsupported regions and elapsed kickoffs fail closed',async()=>{
 for(const modify of [f=>{f.state.calendars=[];},f=>{f.state.cycle.region_slug='north-america';},f=>{f.state.cycle.participation_window_snapshot=null;}]){const f=fixture();modify(f);await assert.rejects(f.preview());}
 for(const modify of [f=>{f.state.plan.pending.push({ref:'source:D2A:tie:decision'});},f=>{f.state.plan.fixtures.push({ref:'growth:D2A:11-14'});},f=>{f.state.now='2027-01-20T00:00:00Z';}]){const f=fixture();modify(f);const p=await f.preview();assert.ok(p.blockers.length);await assert.rejects(f.publish(p.revision),/blockers/);assert.equal(f.state.audits.length,0);}
});
test('stale sources and new bookings invalidate review; sixty-minute overlap prevents publication',async()=>{
 const f=fixture(),p=await f.preview();f.state.bookings.matches.push({id:'external',home_club_id:'club0',away_club_id:'elsewhere',scheduled_date:'2027-01-19 20:40:00',timezone:'Europe/Brussels',status:'scheduled',type:'league'});
 await assert.rejects(f.publish(p.revision),/sources changed/);const next=await f.preview();assert.match(next.blockers.join(),/overlapping/);await assert.rejects(f.publish(next.revision),/blockers/);
 const g=fixture(),preview=await g.preview();g.state.fail='source';await assert.rejects(g.publish(preview.revision),/source data changed/);
});
test('active/report evidence, incorrect opponents and preparation prevent overwrite',async()=>{
 for(const modify of [f=>{f.state.matches[0].home_submission='{}';},f=>{f.state.fixtures[0].away_club_id='foreign';},f=>{f.state.selections=[{id:'selection'}];},f=>{f.state.matches[0].source_fixture_id='wrong';}]){const f=fixture();modify(f);await assert.rejects(f.preview());assert.equal(f.state.records.length,0);}
});
test('publication rolls back both semifinals, audits and notifications if delivery fails',async()=>{
 const f=fixture(),p=await f.preview();f.state.fail='notify';const before=structuredClone(f.state);await assert.rejects(f.publish(p.revision),/notification failed/);assert.deepEqual(f.state,before);
});
test('Admin identity, server-derived dates and explicit policy confirmation cannot be bypassed',async()=>{
 const f=fixture();await assert.rejects(f.service.action('cycle',f.body,{id:'player'}),/Admin/);
 await assert.rejects(f.service.action('cycle',{...f.body,date:'2027-01-01'},{id:'admin'}),/Dates and participants/);
 const unconfirmed=createService({model:f.model,evaluate:f.evaluate,transaction:f.transaction,policy:{...policy,status:'awaiting_confirmation'},clock:()=>new Date('2026-11-03')});
 const p=await unconfirmed.action('cycle',f.body,{id:'admin'});assert.match(p.blockers.join(),/confirmation/);await assert.rejects(unconfirmed.action('cycle',{...f.body,apply:true,expected_revision:p.revision,reason:'Bypass'},{id:'admin'}),/confirmation/);
});
test('promotion HTTP action supports protected preview and publication with normal business errors',async()=>{
 const express=require('express'),f=fixture(),path=require.resolve('../regionalPromotionCalendarService'),saved=require.cache[path];let server;require.cache[path]={exports:f.service};
 try {
  const app=express();app.use(express.json(),(req,res,next)=>{req.user={id:req.headers['x-actor'] || 'admin'};next();});app.use('/regional-leagues',require('../../controllers/leagueEntityController').makeRouter('regional_league'));
  server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const call=async(body,actor='admin')=>{const r=await fetch(`http://127.0.0.1:${server.address().port}/regional-leagues/cycles/cycle/calendar`,{method:'POST',headers:{'Content-Type':'application/json','x-actor':actor},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
  assert.equal((await call(f.body,'player')).status,403);const p=await call(f.body);assert.equal(p.status,200);assert.equal(p.data.entries.length,2);
  assert.equal((await call({...f.body,apply:true,expected_revision:'stale',reason:'Review'})).status,409);assert.equal((await call({...f.body,apply:true,expected_revision:p.data.revision,reason:'Review'})).data.status,'published');
 } finally {if(server)await new Promise(resolve=>server.close(resolve));if(saved)require.cache[path]=saved;else delete require.cache[path];}
});
test('real schedule model loads legacy JSON fixture bookings without a missing-import failure',async()=>{
 const {OfficialScheduleModel}=require('../../models/officialScheduleModel');const model=new OfficialScheduleModel();const events=await model.events(['club0'],async sql=>sql.includes('FROM league_entities')?[{id:'legacy',data_json:JSON.stringify({home_club_id:'club0',away_club_id:'club1',scheduled_date:'2027-01-19 20:00:00',timezone:'Europe/Brussels'})}]:[]);
 assert.equal(events.fixtures[0].home_club_id,'club0');assert.equal(events.fixtures[0].scheduled_date,'2027-01-19 20:00:00');
});

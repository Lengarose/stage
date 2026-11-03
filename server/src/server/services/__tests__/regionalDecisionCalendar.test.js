'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createService}=require('../regionalDecisionCalendarService');
const sporting=require('../../lib/regionalStructure');
function fixture(count=4) {
 const clubs=Array.from({length:count},(_,i)=>`club${i}`),prefix='source:D2A:tie:captured';
 let state={cycle:{id:'cycle',status:'running',region_slug:'uk-ireland',policy_version:sporting.VERSION,tie_policy_version:sporting.TIE_VERSION,participation_window_snapshot:{policy_version:'regional_registration_v1'},fixture_refs:{}},plan:{fixtures:count===2?[{ref:prefix,home:clubs[0],away:clubs[1],round:1,allow_penalties:true}]:sporting.roundRobin(clubs,prefix)},matches:[],engines:[],records:[],audits:[],notices:[],bookings:[],selections:[]};
 state.plan.pending=structuredClone(state.plan.fixtures);
 state.plan.fixtures.forEach((f,i)=>{const id=`engine${i}`,matchId=`match${i}`;state.cycle.fixture_refs[f.ref]=id;state.engines.push({id,competition_instance_id:'cycle',legacy_fixture_type:'regional_pathway',legacy_fixture_id:id,match_id:matchId,home_club_id:f.home,away_club_id:f.away,status:'unscheduled'});state.matches.push({id:matchId,competition_context:'cycle',source_fixture_type:'competition_engine',source_fixture_id:id,home_club_id:f.home,away_club_id:f.away,status:'pending_schedule',type:f.allow_penalties?'knockout':'league',allow_penalties:f.allow_penalties?1:0});});
 const copy=structuredClone,model={actor:async id=>({id,role_id:id==='admin'?0:1,email:'admin@test'}),lock:async()=>{},cycle:async()=>copy(state.cycle),published:async id=>copy(state.records.find(r=>r.id===id)),calendars:async()=>copy(state.calendars || []),cycleMatches:async()=>copy(state.matches),selections:async()=>copy(state.selections),events:async()=>({matches:copy([...state.matches,...state.bookings]),engines:copy(state.engines),fixtures:[]}),updateMatch:async row=>{state.matches[state.matches.findIndex(m=>m.id===row.id)]=copy(row);},saveEngine:async row=>{state.engines[state.engines.findIndex(e=>e.id===row.id)]=copy(row);},audit:async(ctx,user,before,after)=>{state.audits.push(copy({user,before,after}));return {id:`audit${state.audits.length}`};},notify:async row=>{if(state.fail)throw Error('notification failed');state.notices.push(copy(row));},save:async row=>{state.records.push(copy(row));}};
 const service=createService({model,transaction:async fn=>{const before=copy(state);try{return await fn(()=>{});}catch(e){state=before;throw e;}},evaluate:async()=>({plan:copy(state.plan),stored:copy(state.engines)}),clock:()=>new Date('2026-11-03')});
 const body={round_slots:Array.from({length:count===2?1:3},(_,i)=>({round:i+1,date:`2026-11-${10+i}T20:00`}))};
 return {service,body,get state(){return state;},preview:()=>service.action('cycle',body,{id:'admin'}),publish:p=>service.action('cycle',{...body,apply:true,expected_revision:p.revision,fixture_ids:p.fixture_ids,reason:'Reviewed decision rounds'},{id:'admin'})};
}
test('four-club mini-league publishes all six actual games in three rounds without changing the sporting draw',async()=>{
 const f=fixture(),before=structuredClone(f.state),p=await f.preview();assert.deepEqual(f.state,before);assert.equal(p.entries.length,6);assert.ok(p.entries.every(e=>e.minutes===40));assert.deepEqual(p.blockers,[]);
 await f.publish(p);assert.equal(f.state.audits.length,6);assert.equal(f.state.notices.length,6);assert.equal(f.state.records[0].stage,'decisions');assert.ok(f.state.matches.every(m=>m.timezone==='Europe/Brussels' && m.scheduling_status==='confirmed'));
 const after=structuredClone(f.state);assert.equal((await f.publish(p)).already_published,true);assert.deepEqual(f.state,after);
});
test('two clubs get one sixty-minute knockout decision, while three clubs have one bye each in a three-round mini-league',async()=>{
 const f=fixture(2),p=await f.preview();assert.equal(p.entries.length,1);assert.equal(p.entries[0].minutes,60);await f.publish(p);
 const g=fixture(3),r=await g.preview();assert.equal(r.entries.length,3);assert.deepEqual(r.blockers,[]);await g.publish(r);
});
test('overlaps, stale review, nonchronological rounds and unsupported rounds are blocked',async()=>{
 const f=fixture(),p=await f.preview();f.state.bookings.push({id:'other',home_club_id:'club0',away_club_id:'outside',status:'scheduled',type:'knockout',scheduled_date:'2026-11-10 20:20:00',timezone:'Europe/Brussels'});
 await assert.rejects(f.publish(p),/sources changed/);const r=await f.preview();assert.match(r.blockers.join(),/overlapping/);await assert.rejects(f.publish(r),/blockers/);
 const g=fixture();g.body.round_slots[1].date='2026-11-09T20:00';assert.match((await g.preview()).blockers.join(),/chronological/);
 const h=fixture();h.body.round_slots.pop();await assert.rejects(h.preview(),/exactly the rounds/);
});
test('identity, preparation, old policy and Admin guards preserve existing games',async()=>{
 for(const edit of [f=>{f.state.matches[0].source_fixture_id='wrong';},f=>{f.state.engines[0].home_club_id='wrong';},f=>{f.state.selections=[{id:'prep'}];},f=>{f.state.cycle.tie_policy_version=null;},f=>{f.state.matches[0].status='completed';}]){const f=fixture();edit(f);await assert.rejects(f.preview());assert.equal(f.state.audits.length,0);}
 const f=fixture();await assert.rejects(f.service.action('cycle',f.body,{id:'player'}),/Admin/);
});
test('decision publication rolls back the entire mini-league after delivery failure',async()=>{
 const f=fixture(),p=await f.preview();f.state.fail=true;const before=structuredClone(f.state);await assert.rejects(f.publish(p),/notification failed/);assert.deepEqual(f.state,before);
});
test('decision calendar HTTP route returns preview, stale-review errors and the published mini-league',async()=>{
 const express=require('express'),f=fixture(),path=require.resolve('../regionalDecisionCalendarService'),saved=require.cache[path];let server;require.cache[path]={exports:f.service};
 try {
  const app=express();app.use(express.json(),(req,res,next)=>{req.user={id:req.headers['x-actor'] || 'admin'};next();});app.use('/regional-leagues',require('../../controllers/leagueEntityController').makeRouter('regional_league'));
  server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const call=async(body,actor='admin')=>{const r=await fetch(`http://127.0.0.1:${server.address().port}/regional-leagues/cycles/cycle/decision-calendar`,{method:'POST',headers:{'Content-Type':'application/json','x-actor':actor},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
  assert.equal((await call(f.body,'player')).status,403);const p=await call(f.body);assert.equal(p.status,200);assert.equal(p.data.entries.length,6);
  const body={...f.body,apply:true,fixture_ids:p.data.fixture_ids,expected_revision:p.data.revision,reason:'Reviewed mini-league'};
  assert.equal((await call({...body,expected_revision:'stale'})).status,409);assert.equal((await call(body)).data.status,'published');
 } finally {if(server)await new Promise(resolve=>server.close(resolve));if(saved)require.cache[path]=saved;else delete require.cache[path];}
});

test('source decision rounds respect the fixed promotion deadline and capture the source calendar revision',async()=>{
 const f=fixture();f.state.cycle.input={mode:'transition'};f.state.cycle.source_snapshot=[{identity:{division:2}}];f.state.cycle.source_edition_ids=['league'];
 await assert.rejects(f.preview(),/source league calendar/);
 f.state.calendars=[{id:'calendar',status:'published',policy_version:'regional_calendar_europe_v1',edition_ids:['league'],start_monday:'2026-11-09'}];
 const p=await f.preview();f.state.calendars[0].start_monday='2026-11-16';await assert.rejects(f.publish(p),/sources changed/);
 f.body.round_slots=[{round:1,date:'2027-01-26T20:00'},{round:2,date:'2027-01-27T20:00'},{round:3,date:'2027-01-28T20:00'}];
 const late=await f.preview();assert.match(late.blockers.join(),/reserved promotion/);await assert.rejects(f.publish(late),/blockers/);assert.equal(f.state.audits.length,0);
});

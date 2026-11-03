'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createService,scheduleTime}=require('../officialScheduleService');
function fixture({missing=false,legacy=false,pathway=false}={}) {
 let state={ctx:{official:!legacy,root:{id:'edition'},sourceFixture:pathway?null:{id:'fixture',league_id:'edition',home_club_id:'home',away_club_id:'away',scheduling_status:'open'},engine:pathway?{id:'engine',legacy_fixture_id:'engine',match_id:'match',home_club_id:'home',away_club_id:'away'}:null,match:missing?null:{id:'match',home_club_id:'home',away_club_id:'away',source_fixture_type:pathway?'competition_engine':'regional_league',source_fixture_id:pathway?'engine':'fixture',status:'pending_schedule',timezone:'Europe/Brussels'}},prep:null,audits:[],notifications:[],clashes:[],user:{id:'admin',email:'admin@test',role_id:0,timezone:'Europe/Brussels'}};
 const copy=structuredClone;
 const model={lock:async()=>{},events:async()=>({matches:[],engines:[],fixtures:[]}),hasKickoff:async()=>Boolean(state.kickoff),actor:async id=>id===state.user.id?copy(state.user):{id,role_id:1},createMatch:async row=>{state.ctx.match=copy(row);return row;},updateMatch:async row=>{state.ctx.match=copy(row);},saveFixture:async row=>{state.ctx.sourceFixture=copy(row);},saveEngine:async row=>{state.ctx.engine=copy(row);},clashes:async()=>copy(state.clashes),audit:async(ctx,user,before,after,reason)=>{if(state.fail==='audit')throw Error('audit failed');state.audits.push({before:copy(before),after:copy(after),reason,user});return {id:`audit${state.audits.length}`};},notify:async match=>{if(state.fail==='notify')throw Error('notify failed');state.notifications.push(copy(match));}};
 const preparations={selectOne:async()=>copy(state.prep),save:async row=>{state.prep=copy(row);}};
 const transaction=async fn=>{const before=copy(state);try{return await fn(()=>{});}catch(e){state=before;throw e;}};
 const service=createService({model,preparations,context:async()=>copy(state.ctx),transaction,clock:()=>new Date('2026-11-03T12:00:00Z')});
 const body={date:'2026-11-04T20:00',timezone:'Europe/Brussels',admin_note:'Published official calendar'};
 return {service,body,model,get state(){return state;},force:(extra={},actor={id:'admin'})=>service.force('fixture',{...body,...extra},actor)};
}
test('kickoff timestamps retain explicit instants and valid wall-clock timezone semantics',()=>{
 assert.equal(scheduleTime('2026-11-04T19:00:00Z','Europe/Brussels').wall,'2026-11-04 20:00:00');
 assert.equal(scheduleTime('2026-07-04T20:00','Europe/Brussels').iso,'2026-07-04T20:00:00+02:00');
 for(const [date,zone] of [['2026-02-30T20:00:00Z','Europe/Brussels'],['2026-02-30T20:00','Europe/Brussels'],['2026-03-29T02:30','Europe/Brussels'],['no','Europe/Brussels'],['2026-11-04T20:00','bad']])assert.throws(()=>scheduleTime(date,zone));
});
test('initial publication creates one canonical match and links the fixture atomically; conversion remains read-only',async()=>{
 const f=fixture({missing:true});const first=await f.force();
 assert.equal(first.match.source_fixture_id,'fixture');assert.equal(first.fixture.match_id,first.match.id);assert.equal(f.state.audits.length,1);assert.equal(f.state.notifications.length,1);
 assert.equal(first.match.scheduled_date,first.match.confirmed_date);assert.equal(first.fixture.confirmed_date,first.match.scheduled_date);
 const before=structuredClone(f.state);const read=await f.service.reuse('fixture');assert.equal(read.data.match.id,first.match.id);assert.deepEqual(f.state,before);
});
test('native pathway engine and canonical match share the same confirmed time',async()=>{
 const f=fixture({pathway:true});const result=await f.force();assert.equal(result.match.scheduled_date,f.state.ctx.engine.confirmed_at);assert.equal(f.state.ctx.engine.match_id,'match');
});
test('rescheduling clears readiness durably, including moving away and back; same-time retry preserves fresh readiness',async()=>{
 const f=fixture();await f.force();f.state.prep.sides.home={ready_at:'2026-11-04T18:40:00Z'};
 await f.force();assert.ok(f.state.prep.sides.home.ready_at);assert.equal(f.state.notifications.length,1);
 await f.force({date:'2026-11-04T21:00'});assert.deepEqual(f.state.prep.sides,{});assert.equal(f.state.prep.history.length,1);
 await f.force();assert.deepEqual(f.state.prep.sides,{});assert.equal(f.state.prep.history.length,2);
});
test('actors, active matches, evidence, unresolved identities and exact same-start clashes are guarded',async()=>{
 const f=fixture();await assert.rejects(f.force({}, {id:'other'}),/Admin/);await assert.rejects(f.force({admin_note:''}),/Explain/);await assert.rejects(f.force({date:'2026-11-02T20:00'}),/future/);
 await assert.rejects(f.force({date:'2026-11-03T12:03:00Z'}),/five minutes/);
 f.state.kickoff=true;await assert.rejects(f.force(),/Kickoff evidence/);f.state.kickoff=false;
 f.state.ctx.match.status='in_progress';await assert.rejects(f.force(),/started/);
 f.state.ctx.match.status='scheduled';f.state.ctx.match.home_submission='{}';await assert.rejects(f.force(),/reported/);f.state.ctx.match.home_submission=null;
 f.state.ctx.sourceFixture.away_club_id='wrong';await assert.rejects(f.force(),/opponents disagree/);f.state.ctx.sourceFixture.away_club_id='away';
 f.state.clashes=[{scheduled_date:'2026-11-04 20:00:00',timezone:'Europe/Brussels'}];await assert.rejects(f.force(),/already has/);
 const g=fixture({missing:true});g.state.ctx.sourceFixture.match_id='missing-match';await assert.rejects(g.force(),/Missing official/);
 assert.equal(f.state.audits.length,0);
});
test('audit or delivery failure rolls back match, fixture, preparation and notifications',async()=>{
 for(const fail of ['audit','notify']){const f=fixture();f.state.fail=fail;const before=structuredClone(f.state);await assert.rejects(f.force(),new RegExp(`${fail} failed`));assert.deepEqual(f.state,before);}
});
test('legacy schedules retain their original route, but new official fixtures reject legacy writes',async()=>{
 const f=fixture();await assert.rejects(f.service.assertLegacyWrite('fixture'),/official calendar/);
 const old=fixture({legacy:true});assert.equal(await old.force(),null);await old.service.assertLegacyWrite('fixture');assert.equal(await old.service.reuse('fixture'),null);
});
test('Match model can insert using the transaction connection, including source identity and timezone',async()=>{
 const {OfficialScheduleModel}=require('../../models/officialScheduleModel');let recorded;
 const model=new OfficialScheduleModel();await model.createMatch({id:'new',home_club_id:'home',away_club_id:'away',scheduled_date:'2026-11-04 20:00:00',timezone:'Europe/Brussels',source_fixture_id:'fixture',source_fixture_type:'regional_league'},async(sql,values)=>{recorded={sql,values};});
 assert.match(recorded.sql,/INSERT INTO matches/);assert.ok(recorded.values.includes('Europe/Brussels'));assert.ok(recorded.values.includes('fixture'));
});
test('existing force-schedule HTTP route uses the shared official action, returns business errors and rejects unprivileged users',async()=>{
 const express=require('express');const f=fixture({pathway:true});
 const paths=['../../db/database','../officialScheduleService','../../controllers/fixtureAdminActionController'].map(require.resolve);const saved=paths.map(p=>require.cache[p]);
 let role=0;
 require.cache[paths[0]]={exports:{EXECUTESQL:async()=>[{id:'admin',email:'admin@test',role_id:role}]}};
 require.cache[paths[1]]={exports:f.service};delete require.cache[paths[2]];
 let server;
 try {
  const app=express();app.use(express.json(),(req,res,next)=>{req.user={id:'admin'};next();});app.use('/actions',require(paths[2]));server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const call=async body=>{const r=await fetch(`http://127.0.0.1:${server.address().port}/actions/force-schedule`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fixture_id:'engine',fixture_type:'regional_pathway',...f.body,...body})});return {status:r.status,data:await r.json()};};
  const result=await call({});assert.equal(result.status,200);assert.equal(result.data.managed_official,true);assert.equal(result.data.match.id,'match');
  f.state.ctx.match.status='in_progress';assert.equal((await call({})).status,409);
  role=1;assert.equal((await call({})).status,403);
 } finally {if(server)await new Promise(resolve=>server.close(resolve));paths.forEach((p,i)=>{if(saved[i])require.cache[p]=saved[i];else delete require.cache[p];});}
});

test('European one-off scheduling also enforces forty/sixty-minute blocks and weekly club limits',async()=>{
 const f=fixture();f.state.ctx.root.region_slug='uk-ireland';
 f.model.events=async()=>({matches:[{id:'cup',home_club_id:'home',away_club_id:'other',scheduled_date:'2026-11-04 19:20:00',timezone:'Europe/Brussels',type:'cup',status:'scheduled'}]});
 await assert.rejects(f.force(),/load limits/);assert.equal(f.state.audits.length,0);
 f.model.events=async()=>({matches:[{id:'cup',home_club_id:'home',away_club_id:'other',scheduled_date:'2026-11-04 19:00:00',timezone:'Europe/Brussels',type:'cup',status:'scheduled'}]});
 assert.equal((await f.force()).success,true);
});

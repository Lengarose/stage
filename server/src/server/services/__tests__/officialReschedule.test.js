'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createService}=require('../officialRescheduleService');
const policy=require('../../lib/officialReschedulePolicy');
function fixture(){
 let state={match:{id:'match',status:'scheduled',home_club_id:'home',away_club_id:'away',confirmed_date:'2026-11-05 20:00:00',scheduled_date:'2026-11-05 20:00:00',timezone:'Europe/Brussels',type:'league'},root:{id:'edition',region_slug:'uk-ireland',participation_window_snapshot:{reschedule_policy_version:policy.VERSION}},fixture:{id:'fixture',league_id:'edition',matchday:4},requests:[],audits:[],notices:[],bookings:[],now:'2026-11-02T12:00:00Z',started:false,fail:false};
 let sequence=0,queue=Promise.resolve();const copy=structuredClone;
 const model={lock:async()=>{},hasKickoff:async()=>state.started,requests:async()=>copy(state.requests),approved:async(edition,club)=>state.requests.filter(r=>r.edition_id===edition && r.requester_club_id===club && r.status==='approved').length,save:async row=>{const i=state.requests.findIndex(r=>r.id===row.id);if(i<0)state.requests.push(copy(row));else state.requests[i]=copy(row);},operation:async(...args)=>{state.audits.push(copy(args.slice(0,5)));},notice:async(...args)=>{if(state.fail)throw Error('notice failure');state.notices.push(copy(args.slice(0,3)));},events:async()=>({matches:copy(state.bookings),engines:[],fixtures:[]}),updateMatch:async row=>{state.match=copy(row);},saveFixture:async row=>{state.fixture=copy(row);},saveEngine:async()=>{}};
 const transaction=fn=>{const result=queue.then(async()=>{const before=copy(state);try{return await fn(()=>{});}catch(e){state=before;throw e;}});queue=result.catch(()=>{});return result;};
 const service=createService({model,transaction,clock:()=>new Date(state.now),id:()=>`r${++sequence}`,context:async()=>({official:true,match:copy(state.match),root:copy(state.root),sourceFixture:copy(state.fixture),aliases:['match','fixture']}),permission:async(actor,club)=>{if(actor?.id!==club)throw Object.assign(Error('Forbidden'),{status:403});return {user:{id:club,email:`${club}@test`,role_id:1}};}});
 const act=(action,club,extra={})=>service.act('match',{action,club_id:club,...extra},{id:club});
 return {service,act,get state(){return state;},at:value=>{state.now=value;}};
}
test('the policy requires the original 48h lead, same week, allowed windows and the proposed 24h lead',()=>{
 const match=fixture().state.match,now=new Date('2026-11-02T12:00:00Z');
 assert.equal(policy.proposal(match,'2026-11-06T20:00',now).new_time.wall,'2026-11-06 20:00:00');
 for(const date of ['2026-11-06T19:00','2026-11-08T20:00','2026-11-09T20:00','2026-11-07T21:01'])assert.throws(()=>policy.proposal(match,date,now),/approved kickoff/);
 assert.throws(()=>policy.proposal(match,'2026-11-06T20:00',new Date('2026-11-04T12:00:00Z')),/48 hours/);
 assert.equal(policy.proposal({...match,confirmed_date:new Date('2026-11-05T20:00:00Z')},'2026-11-06T20:00',now).new_time.wall,'2026-11-06 20:00:00');
});
test('a proposal does not move the fixture or consume quota; only the opponent may approve',async()=>{
 const f=fixture(),initial=f.state.match.confirmed_date;
 const report=await f.act('request','home',{date:'2026-11-06T20:00'}),request=report.requests[0];assert.equal(report.used,0);assert.equal(f.state.match.confirmed_date,initial);assert.equal(f.state.requests[0].status,'pending');
 await assert.rejects(f.act('approve','home',{request_id:request.id}),e=>e.status===403);
 const accepted=await f.act('approve','away',{request_id:request.id});assert.equal(accepted.match_updated,true);assert.equal(f.state.match.confirmed_date,'2026-11-06 20:00:00');assert.equal(f.state.fixture.confirmed_date,f.state.match.confirmed_date);assert.equal((await f.act('read','home')).used,1);assert.equal((await f.act('read','away')).used,0);
 const before=structuredClone(f.state);assert.equal((await f.act('approve','away',{request_id:request.id})).already_applied,true);assert.deepEqual(f.state,before);
});
test('concurrent retries store one pending proposal and approval charges only the requesting club once',async()=>{
 const f=fixture();const [first,second]=await Promise.all([f.act('request','home',{date:'2026-11-06T20:00'}),f.act('request','home',{date:'2026-11-06T20:00'})]);assert.equal(first.requests[0].id,second.requests[0].id);assert.equal(f.state.requests.length,1);
 await Promise.all([f.act('approve','away',{request_id:first.requests[0].id}),f.act('approve','away',{request_id:first.requests[0].id})]);assert.equal((await f.act('read','home')).used,1);assert.equal(f.state.notices.length,2);
});
test('silence, decline and withdrawal preserve the original kickoff and consume no allowance',async()=>{
 for(const action of ['decline','cancel','expire']){
  const f=fixture(),request=(await f.act('request','home',{date:'2026-11-06T20:00'})).requests[0];
  if(action==='expire'){f.at('2026-11-03T12:00:00Z');const read=await f.act('read','away');assert.equal(read.requests[0].status,'expired');await assert.rejects(f.act('approve','away',{request_id:request.id}),/expired/);}
  else await f.act(action,action==='cancel'?'home':'away',{request_id:request.id});
  assert.equal(f.state.match.confirmed_date,'2026-11-05 20:00:00');assert.equal((await f.act('read','home')).used,0);
 }
});
test('quota is checked again on approval; conflicting or started matches never move',async()=>{
 const f=fixture(),request=(await f.act('request','home',{date:'2026-11-06T20:00'})).requests[0];
 f.state.requests.push(...[1,2].map(i=>({id:`approved-${i}`,edition_id:'edition',requester_club_id:'home',status:'approved'})));
 await assert.rejects(f.act('approve','away',{request_id:request.id}),/two approved/);assert.equal(f.state.match.confirmed_date,'2026-11-05 20:00:00');
 const conflict=fixture(),r=(await conflict.act('request','home',{date:'2026-11-06T20:00'})).requests[0];conflict.state.bookings.push({id:'other',status:'scheduled',home_club_id:'home',away_club_id:'else',confirmed_date:'2026-11-06 20:00:00',timezone:'Europe/Brussels',type:'league'});
 await assert.rejects(conflict.act('approve','away',{request_id:r.id}),/conflicts/);
 const started=fixture();started.state.started=true;await assert.rejects(started.act('request','home',{date:'2026-11-06T20:00'}),/unavailable/);
});
test('changed schedules, unsupported editions, last rounds and unauthorized actors do not acquire a new ordinary change',async()=>{
 const f=fixture(),r=(await f.act('request','home',{date:'2026-11-06T20:00'})).requests[0];f.state.match.confirmed_date='2026-11-05 20:40:00';await assert.rejects(f.act('approve','away',{request_id:r.id}),/expired|changed/);assert.equal(f.state.match.confirmed_date,'2026-11-05 20:40:00');
 const legacy=fixture();delete legacy.state.root.participation_window_snapshot.reschedule_policy_version;assert.equal((await legacy.act('read','home')).enabled,false);await assert.rejects(legacy.act('request','home',{date:'2026-11-06T20:00'}),/no captured/);
 const final=fixture();final.state.fixture.matchday=37;assert.equal((await final.act('read','home')).can_request,false);await assert.rejects(final.act('request','home',{date:'2026-11-06T20:00'}),/Admin review/);
 await assert.rejects(f.service.act('match',{action:'read',club_id:'home'},{id:'other',role_id:0}),e=>e.status===403);
});
test('notification failure rolls back the proposal, quota, schedule and audit together',async()=>{
 const f=fixture();f.state.fail=true;await assert.rejects(f.act('request','home',{date:'2026-11-06T20:00'}),/notice failure/);assert.equal(f.state.requests.length,0);assert.equal(f.state.audits.length,0);
 f.state.fail=false;const r=(await f.act('request','home',{date:'2026-11-06T20:00'})).requests[0];f.state.fail=true;await assert.rejects(f.act('approve','away',{request_id:r.id}),/notice failure/);assert.equal(f.state.match.confirmed_date,'2026-11-05 20:00:00');assert.equal(f.state.requests[0].status,'pending');
});

test('official rescheduling read, request and opponent decision routes are exercised over local HTTP',async()=>{
 const express=require('express'),f=fixture(),path=require.resolve('../officialRescheduleService'),saved=require.cache[path];
 require.cache[path]={exports:f.service};
 const {createRouter}=require('../../controllers/gameDayViewController');
 const app=express();let actor='home';app.use((req,res,next)=>{req.user={id:actor,role_id:0};next();});app.use('/game-day',createRouter({query:async()=>[],resolveIdentity:async()=>null}));
 const server=app.listen(0,'127.0.0.1');await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
 try{
  const base=`http://127.0.0.1:${server.address().port}/game-day/match/reschedule`;
  const read=await fetch(base+'?club_id=home');assert.equal(read.status,200);assert.equal((await read.json()).limit,2);
  const request=await fetch(base,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'request',club_id:'home',date:'2026-11-06T20:00'})});assert.equal(request.status,200);const id=(await request.json()).requests[0].id;
  actor='away';const accepted=await fetch(base,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'approve',club_id:'away',request_id:id})});assert.equal(accepted.status,200);assert.equal((await accepted.json()).match_updated,true);
  actor='outsider';assert.equal((await fetch(base+'?club_id=home')).status,403);
  actor='home';require.cache[path].exports={act:async()=>{throw Error('private database SQL');}};const failed=await fetch(base+'?club_id=home');assert.equal(failed.status,500);assert.doesNotMatch(JSON.stringify(await failed.json()),/private database/);
 }finally{await new Promise(resolve=>server.close(resolve));require.cache[path]=saved;}
});

'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const cup=require('../../lib/regionalCupPlan');
const {createService}=require('../regionalCupService');
function fixture() {
 let state={records:[{id:'calendar',entity_type:'regional_calendar',edition_ids:['league'],start_monday:'2026-11-09',status:'published'}],editions:[{id:'league',division:1,season_number:1,region_slug:'uk-ireland',platform:'cross-platform',slug:'uk-ireland-div-1',status:'in_progress',regional_participation_policy_version:'regional_registration_v1',registered_club_ids:Array.from({length:20},(_,i)=>`club${i}`)}],events:{matches:[],engines:[],fixtures:[]},trophy:{state:'assigned',revision:'art-v1',trophy:{id:'trophy',name:'Cup',image_url:'/uploads/cup.png'}},field:{window:{id:'window',cup_policy_version:cup.policy.version}},audits:[]};
 const copy=structuredClone,model={actor:async id=>({id,role_id:id==='admin'?0:1,email:'admin@test'}),lock:async()=>{},cycle:async()=>copy(state.cycle || null),records:async()=>copy(state.records),editions:async()=>copy(state.editions),events:async()=>copy(state.events),create:async(type,row,user,reason)=>{if(state.fail)throw Error('audit failed');state.records.push({...copy(row),entity_type:type});state.audits.push({type,user,reason});}};
 const transaction=async fn=>{const before=copy(state);try{return await fn(()=>{});}catch(e){state=before;throw e;}};
 const service=createService({model,transaction,assignment:async()=>copy(state.trophy),assign:async(id,body,user,tx,type)=>{assert.equal(type,'regional_cup');assert.equal(user.id,'admin');if(body.revision!==state.trophy.revision)throw Object.assign(Error('Trophy changed'),{status:409});return copy(state.trophy);},confirmedField:async()=>copy(state.field),clock:()=>new Date('2026-11-03T00:00:00Z')});
 return {service,get state(){return state;},async configure(){const body={action:'configure',permanent_league_id:'league'},p=await service.action(body,{id:'admin'});return service.action({...body,apply:true,expected_revision:p.revision,reason:'Configure approved Cup'},{id:'admin'});},prepare:body=>service.action({action:'prepare',source_calendar_id:'calendar',...body},{id:'admin'})};
}
test('all approved Cup fields fit the exact knockout depth; byes and real opponents cover every club once',()=>{
 for(const count of [20,40,60,80,100,120,180,240]) {
  const ids=Array.from({length:count},(_,i)=>`club${i}`),draw=cup.drawRound(ids,'recorded-server-seed-1234567890'),dates=cup.calendar(count,'2026-11-09','uk-ireland');
  assert.equal(dates.length,Math.ceil(Math.log2(count)));assert.equal(dates.at(-1).week,12);assert.ok(dates.every(d=>new Date(d.instant).getUTCDay()===0));
  assert.equal(draw.byes.length+draw.fixtures.length*2,count);assert.equal(new Set([...draw.byes,...draw.fixtures.flatMap(f=>[f.home_club_id,f.away_club_id])]).size,count);
  assert.equal(draw.next_field_count,draw.byes.length+draw.fixtures.length);assert.deepEqual(cup.drawRound(ids,'recorded-server-seed-1234567890'),draw);
 }
 assert.throws(()=>cup.calendar(20,'2026-11-09','north-america'),/profile/);assert.throws(()=>cup.calendar(13,'2026-11-09','france'),/approved/);
 assert.throws(()=>cup.drawRound(['same','same'],'seed'),/unique/);
});
test('one stable Cup identity, one immutable draft edition and first draw; no Matches, awards or payouts',async()=>{
 const f=fixture(),definition=(await f.configure()).record;assert.equal(definition.name,'STAGE UK & Ireland Cup');assert.equal((await f.configure()).already_applied,true);
 const p=await f.prepare({cup_id:definition.id});assert.deepEqual(p.blockers,[]);assert.equal(p.record.round_calendar.length,5);assert.equal(f.state.records.length,2);
 const r=await f.prepare({cup_id:definition.id,apply:true,expected_revision:p.revision,reason:'Reviewed new Cup draft'});assert.equal(r.record.play_enabled,false);assert.equal(r.record.first_round.byes.length,12);assert.equal(r.record.first_round.fixtures.length,4);assert.equal(r.record.trophy_snapshot.id,'trophy');
 const before=structuredClone(f.state);assert.equal((await f.prepare({cup_id:definition.id,apply:true})).already_applied,true);assert.deepEqual(f.state,before);assert.equal(f.state.audits.length,2);
});
test('accepted Cup conditions and valid catalogue assignment are mandatory; old seasons are preserved',async()=>{
 for(const change of [f=>{f.state.field=null;},f=>{f.state.field.window.cup_policy_version=null;},f=>{f.state.trophy.state='conflict';},f=>{f.state.trophy.trophy.image_url=null;}]) {
  const f=fixture(),definition=(await f.configure()).record;change(f);const p=await f.prepare({cup_id:definition.id});assert.ok(p.blockers.length);await assert.rejects(f.prepare({cup_id:definition.id,apply:true,expected_revision:p.revision,reason:'Try'}),/blockers/);assert.equal(f.state.records.length,2);
 }
});
test('source changes, retired groups, omitted groups, club duplicates and calendar collisions block preparation',async()=>{
 const f=fixture(),definition=(await f.configure()).record,p=await f.prepare({cup_id:definition.id});f.state.trophy.revision='changed';await assert.rejects(f.prepare({cup_id:definition.id,apply:true,expected_revision:p.revision,reason:'Review'}),/sources changed/);
 for(const change of [f=>{f.state.editions[0].retired=true;},f=>{f.state.editions[0].registered_club_ids[1]='club0';},f=>{f.state.editions.push({...f.state.editions[0],id:'second',division:2,slug:'uk-ireland-div-2'});}]){const g=fixture(),d=(await g.configure()).record;change(g);await assert.rejects(g.prepare({cup_id:d.id}));}
 const g=fixture(),d=(await g.configure()).record;g.state.events.matches.push({id:'conflict',home_club_id:'club0',away_club_id:'external',status:'scheduled',type:'league',scheduled_date:'2026-12-06 20:00:00',timezone:'Europe/Brussels'});assert.match((await g.prepare({cup_id:d.id})).blockers.join(),/overlapping/);
});
test('Admin identity, server-controlled roster and audit rollback are enforced',async()=>{
 const f=fixture();await assert.rejects(f.service.catalogue({id:'player'}),/Admin/);await assert.rejects(f.service.action({action:'configure',permanent_league_id:'league',club_ids:['injected']},{id:'admin'}),/participants/);
 const p=await f.service.action({action:'configure',permanent_league_id:'league'},{id:'admin'});f.state.fail=true;const before=structuredClone(f.state);await assert.rejects(f.service.action({action:'configure',permanent_league_id:'league',apply:true,expected_revision:p.revision,reason:'Review'},{id:'admin'}),/audit failed/);assert.deepEqual(f.state,before);
});
test('Cup catalogue trophy flow reuses the existing assignment resolver, including source ownership checks',async()=>{
 const art=require('../gostOverviewService');const source={id:'cup',name:'Regional Cup'},items=[{id:'trophy',name:'Silver Cup',image_url:'/uploads/cup.png'}];
 const q=async(sql,values)=>sql.includes("entity_type='regional_cup'")?[{id:'cup',data_json:JSON.stringify(source)}]:sql.includes('FROM trophy_items')?items:[];
 const result=await art.assignment('cup',async(sql,values)=>sql.includes("entity_type='reward_configuration'")?[{data_json:JSON.stringify({trophy_item_id:'trophy'})}]:q(sql,values),false,'regional_cup');
 assert.equal(result.state,'assigned');assert.equal(result.trophy.id,'trophy');items[0].linked_source_type='regional_league';items[0].linked_source_id='other';assert.equal(art.resolveAssignment(source,{trophy_item_id:'trophy'},items,'regional_cup').state,'invalid');
});
test('Cup HTTP catalogue, preparation and shared trophy actions are protected and exercised',async()=>{
 const express=require('express'),f=fixture(),path=require.resolve('../regionalCupService'),saved=require.cache[path];let server;require.cache[path]={exports:f.service};
 try {
  const app=express();app.use(express.json(),(req,res,next)=>{req.user={id:req.headers['x-actor'] || 'admin'};next();});app.use('/regional-leagues',require('../../controllers/leagueEntityController').makeRouter('regional_league'));
  server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const call=async(path,body,actor='admin')=>{const r=await fetch(`http://127.0.0.1:${server.address().port}/regional-leagues/cups${path}`,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','x-actor':actor},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};};
  assert.equal((await call('',null,'player')).status,403);assert.equal((await call('')).status,200);
  const request={action:'configure',permanent_league_id:'league'},p=await call('',request);assert.equal(p.status,200);
  const configured=await call('',{...request,apply:true,expected_revision:p.data.revision,reason:'Reviewed Cup'});assert.equal(configured.status,200);const id=configured.data.record.id;
  assert.equal((await call(`/${id}/trophy`)).data.state,'assigned');assert.equal((await call(`/${id}/trophy`,{trophy_item_id:'trophy',revision:'stale',reason:'Review'})).status,409);assert.equal((await call(`/${id}/trophy`,{trophy_item_id:'trophy',revision:'art-v1',reason:'Review'})).status,200);
  const preview=await call('',{action:'prepare',cup_id:id,source_calendar_id:'calendar'});assert.equal(preview.status,200);assert.equal(preview.data.record.participant_ids.length,20);
 } finally {if(server)await new Promise(resolve=>server.close(resolve));if(saved)require.cache[path]=saved;else delete require.cache[path];}
});


test('automatic Cup preparation derives its configured identity and approved field from the published season',async()=>{
 const f=fixture();Object.assign(f.state.field.window,{policy_version:'regional_registration_v1',result_policy_version:'regional_result_review_v2',season_orchestration_policy_version:'regional_season_orchestration_v1'});
 f.state.records[0].source_cycle_id='cycle';f.state.cycle={id:'cycle',status:'allocated',allocated_groups:[{id:'league',division:1,permanent_league_id:'league'}],participation_window_snapshot:structuredClone(f.state.field.window)};
 const result=await f.service.reconcileForCalendar('calendar');assert.equal(result.record.status,'draft');assert.equal(result.record.participant_ids.length,20);assert.equal(result.record.cup_reward_snapshot.budget,'10000000.00');assert.equal(f.state.audits.at(-1).user.id,null);
 const before=structuredClone(f.state);assert.equal((await f.service.reconcileForCalendar('calendar')).already_applied,true);assert.deepEqual(f.state,before);
 const legacy=fixture();await assert.rejects(legacy.service.reconcileForCalendar('calendar'),/captured regional calendar/);
});

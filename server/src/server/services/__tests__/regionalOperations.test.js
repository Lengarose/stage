'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {report,createService}=require('../regionalOperationsService');
const {resultRevision}=require('../regionalCupLifecycleService');
const now=new Date('2026-11-03T19:00:00Z');
const row=(type,id,data={})=>({id,entity_type:type,status:data.status,data_json:JSON.stringify(data)});
const root=row('regional_league','root',{status:'registration',region_slug:'uk-ireland',platform:'cross-platform',season_number:1,reset_series:0});
const window=patch=>row('regional_registration_window','window',{status:'published',permanent_league_id:'root',region_slug:'uk-ireland',platform:'cross-platform',season_number:1,reset_series:0,opens_at:'2026-09-29T18:00:00Z',registration_closes_at:'2026-10-27T18:00:00Z',confirmation_closes_at:'2026-11-03T19:00:00Z',...patch});
test('closed confirmation shows a field review without expiry writes; a captured cycle removes the duplicate action',()=>{
  const data=[root,window(),row('season_registration','a',{status:'approved',registration_window_id:'window',participation_status:'confirmed',owner_email:'private@test',confirmed_player_ids:['secret-player']})];
  const result=report(data,[],now);assert.equal(result.counts.action,1);assert.match(result.issues[0].message,/1 bevestigde/);assert.equal(result.read_only,true);assert.doesNotMatch(JSON.stringify(result),/private@test|secret-player/);
  const linked=report([...data,row('regional_cycle','cycle',{status:'running',participation_window_snapshot:{id:'window'}})],[],now);assert.equal(linked.issues.length,0);
  const expired=report([row('regional_league','root',{status:'registration',reset_series:1}),window()],[],now);assert.equal(expired.issues.length,0);assert.equal(expired.counts.windows,0);
});
test('deadline boundary uses a common exact timestamp and malformed deadlines require review',()=>{
  assert.equal(report([root,window()],[],new Date(now.getTime()-1)).issues[0].code,'confirmation_open');
  assert.equal(report([root,window()],[],now).issues[0].code,'field_review');
  assert.equal(report([root,window({confirmation_closes_at:'invalid'})],[],now).issues[0].code,'invalid_deadline');
  assert.equal(report([row('regional_league','root',{status:'in_progress',region_slug:'uk-ireland',platform:'cross-platform',season_number:1}),window()],[],now).issues.length,0);
});
test('allocated groups request a calendar only until each group has a published calendar',()=>{
  const cycle=row('regional_cycle','c',{status:'allocated',allocated_groups:[{id:'a'},{id:'b'}]});
  assert.equal(report([cycle],[],now).issues[0].code,'league_calendar');
  assert.equal(report([cycle,row('regional_calendar','calendar',{status:'published',edition_ids:['a','b']})],[],now).issues.length,0);
  const pending=row('regional_cycle','c',{status:'running',fixture_refs:{x:'f'}});assert.equal(report([pending],[],now).issues[0].code,'pathway_schedule');
});
test('Cup progress, consumed score changes, overdue results and payment review remain separate from any mutation',()=>{
  const m={fixture_id:'f',id:'match',competition_instance_id:'cup',status:'completed',result_state:'CONFIRMED',home_club_id:'a',away_club_id:'b',home_score:2,away_score:1};
  const data={name:'Cup',status:'running',play_enabled:true,cup_reward_snapshot:{version:'v1'},rounds:[{number:1,fixture_ids:['f']}],round_calendar:[{round:1,instant:now.getTime()-7200000,minutes:60}],draw_seed:'private-seed'};
  assert.equal(report([row('regional_cup_edition','cup',data)],[m],now).issues[0].code,'cup_progress');
  const consumed=structuredClone(data);consumed.rounds[0].results_revision=resultRevision([m]);
  assert.equal(report([row('regional_cup_edition','cup',consumed)],[{...m,home_score:3}],now).issues[0].code,'cup_source_changed');
  const overdue=report([row('regional_cup_edition','cup',data)],[{...m,status:'scheduled'}],now);assert.equal(overdue.issues[0].code,'cup_results_due');
  const completed=report([row('regional_cup_edition','cup',{...consumed,status:'completed',prize_settlement_state:'paid',honours_state:'pending_review'})],[m],now);assert.equal(completed.issues[0].code,'cup_settlement');assert.doesNotMatch(JSON.stringify(completed),/private-seed/);
  assert.equal(report([row('regional_cup_edition','cup',{...consumed,edition_invalidated:true})],[m],now).issues.length,0);
});
test('unreadable sources and failed ledgers surface as review, while reset history stays excluded',()=>{
  const records=[{id:'broken',entity_type:'regional_cycle',data_json:'{'},row('competition_settlement','s',{status:'failed',source_type:'regional_league',source_id:'old'}),row('regional_league','old',{status:'reset',edition_invalidated:true})];
  const result=report(records,[],now);assert.equal(result.counts.review,1);assert.equal(result.issues[0].code,'unreadable_source');
  assert.equal(report([records[1]],[],now).issues[0].target,'rewards');
});
test('overview enforces database role and does not turn read failures into an empty success',async()=>{
  const calls=[],service=createService({model:{actor:async id=>({id,role_id:id==='admin'?2:1}),records:async()=>{calls.push('records');return [];},fixtures:async()=>{calls.push('fixtures');return [];}},transaction:fn=>fn(),clock:()=>now});
  await assert.rejects(service.overview({id:'player',role_id:2}),/Admin/);await assert.rejects(service.overview({}),/Admin/);assert.equal(calls.length,0);
  const result=await service.overview({id:'admin'});assert.equal(result.as_of,now.toISOString());assert.deepEqual(calls,['records','fixtures']);
  const failed=createService({model:{actor:async()=>({role_id:0}),records:async()=>{throw Error('Storage unavailable');}},transaction:fn=>fn()});await assert.rejects(failed.overview({id:'admin'}),/Storage unavailable/);
});
test('operations model uses SELECT-only scoped queries, retaining missing Match mappings',async()=>{
  const {RegionalOperationsModel}=require('../../models/regionalOperationsModel'),model=new RegionalOperationsModel(),calls=[];
  const q=async(sql,args)=>{calls.push({sql,args});return [];};await model.actor('admin',q);await model.records(q);await model.fixtures(q);
  assert.ok(calls.every(c=>c.sql.startsWith('SELECT ')));assert.match(calls[2].sql,/LEFT JOIN matches/);assert.match(calls[2].sql,/legacy_source_type='regional_cycle'/);assert.deepEqual(calls[0].args,['admin']);
});
test('operations HTTP route is Admin-only and returns a read-only snapshot',async()=>{
  const express=require('express'),modulePath=require.resolve('../regionalOperationsService'),saved=require.cache[modulePath];let server;
  require.cache[modulePath]={exports:createService({model:{actor:async id=>({id,role_id:id==='admin'?0:1}),records:async()=>[root,window()],fixtures:async()=>[]},transaction:fn=>fn(),clock:()=>now})};
  try {
    const app=express();app.use((req,res,next)=>{req.user={id:req.headers['x-actor']};next();});app.use('/regional-leagues',require('../../controllers/leagueEntityController').makeRouter('regional_league'));
    server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
    const call=async actor=>{const r=await fetch(`http://127.0.0.1:${server.address().port}/regional-leagues/operations`,{headers:{'x-actor':actor}});return {status:r.status,data:await r.json()};};
    assert.equal((await call('player')).status,403);const response=await call('admin');assert.equal(response.status,200);assert.equal(response.data.read_only,true);assert.equal(response.data.counts.action,1);
  }finally{if(server)await new Promise(resolve=>server.close(resolve));if(saved)require.cache[modulePath]=saved;else delete require.cache[modulePath];}
});

'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {report,createService}=require('../regionalOperationsService');
const {resultRevision}=require('../regionalCupLifecycleService');
const {windowRevision}=require('../../lib/regionalRegistrationPolicy');
const now=new Date('2026-11-03T19:00:00Z');
const row=(type,id,data={})=>({id,entity_type:type,status:data.status,data_json:JSON.stringify(data)});
const root=row('regional_league','root',{status:'registration',region_slug:'uk-ireland',platform:'cross-platform',season_number:1,reset_series:0});
const window=patch=>row('regional_registration_window','window',{status:'published',permanent_league_id:'root',region_slug:'uk-ireland',platform:'cross-platform',season_number:1,reset_series:0,opens_at:'2026-09-29T18:00:00Z',registration_closes_at:'2026-10-27T18:00:00Z',confirmation_closes_at:'2026-11-03T19:00:00Z',...patch});
test('stored league, pathway and Cup disputes surface once per canonical match without score or evidence leakage',()=>{
 const sources=[row('regional_league','league',{status:'in_progress',name:'League'}),row('regional_cycle','cycle',{status:'running'}),row('regional_cup_edition','cup',{status:'running',play_enabled:true})];
 const matches=sources.map((source,i)=>({id:`m${i}`,competition_instance_id:source.id,status:'disputed',result_state:i?'DISPUTED':'ADMIN_REVIEW',home_submission:'private proof',home_owner_email:'private@email',home_score:99}));
 const before=JSON.stringify({sources,matches}),result=report(sources,[...matches,matches[0]],now),items=result.issues.filter(i=>i.target==='results');
 assert.equal(items.length,3);assert.equal(new Set(items.map(i=>i.match_id)).size,3);assert.ok(items.every(i=>i.severity==='review'));assert.equal(result.read_only,true);assert.doesNotMatch(JSON.stringify(items),/private|home_score|99/);assert.equal(JSON.stringify({sources,matches}),before);
});
test('result reviews do not infer timeouts or include closed, reset, disabled or missing regional sources',()=>{
 const match={id:'match',competition_instance_id:'source',status:'disputed',result_state:'ADMIN_REVIEW'};
 for(const source of [null,row('regional_league','source',{status:'completed'}),row('regional_league','source',{status:'in_progress',retired_at:'retired'}),row('regional_league','source',{status:'in_progress',edition_invalidated:true}),row('regional_cycle','source',{status:'allocated'}),row('regional_cup_edition','source',{status:'running',play_enabled:false})]) {
  assert.equal(report(source?[source]:[],[match],now).issues.filter(i=>i.target==='results').length,0);
 }
 const child=row('regional_league','source',{status:'in_progress',permanent_league_id:'parent'});
 for(const parent of [row('regional_league','parent',{status:'retired'}),row('regional_league','parent',{status:'registration',active_reset_series:1})])assert.equal(report([child,parent],[match],now).issues.filter(i=>i.target==='results').length,0);
 const source=row('regional_league','source',{status:'in_progress'});
 for(const state of ['AWAITING_AWAY_CONFIRMATION','AWAITING_HOME_REVIEW','CONFIRMED','VOIDED'])assert.equal(report([source],[{...match,status:'awaiting_confirmation',result_state:state,confirmation_due_at:'2000-01-01'}],now).issues.filter(i=>i.target==='results').length,0);
});
test('a disputed match mapped to multiple active sources asks for identity review without choosing a destination',()=>{
 const sources=['a','b'].map(id=>row('regional_league',id,{status:'in_progress'}));
 const result=report(sources,sources.map(source=>({id:'m',competition_instance_id:source.id,status:'disputed'})),now);
 assert.equal(result.issues.length,2);assert.ok(result.issues.every(i=>i.code==='result_mapping:m' && i.target==='sources' && !i.match_id));
});
test('the Admin overview assesses new closed fields and blocks unreadable confirmations without exposing rosters',()=>{
  const w=window({policy_version:'regional_registration_v1',rules_text:'Published terms'}),data={...JSON.parse(w.data_json),id:w.id};
  const apps=Array.from({length:40},(_,i)=>row('season_registration',`r${i}`,{club_id:`club${i}`,registration_window_id:'window',registration_policy_version:data.policy_version,accepted_rules_revision:windowRevision(data),region_slug:data.region_slug,platform:data.platform,season_number:1,reset_series:0,status:'approved',participation_status:'confirmed',confirmed_at:'2026-10-28T19:00:00Z',confirmed_player_ids:['private1','private2','private3']}));
  const result=report([root,w,...apps],[],now),item=result.issues[0];
  assert.equal(item.severity,'action');assert.equal(item.field_assessment.status,'structure_supported');assert.equal(item.field_assessment.structure.d1_groups,1);assert.equal(item.field_assessment.structure.d2_groups,1);assert.equal(result.read_only,true);
  assert.doesNotMatch(JSON.stringify(result),/private1|club0/);
  const unreadable=report([root,w,...apps,{id:'broken',entity_type:'season_registration',data_json:'{'}],[],now);
  assert.equal(unreadable.issues.find(i=>i.code==='field_review').field_assessment.status,'needs_review');
  const unsupported=report([root,w,...apps.slice(0,30)],[],now).issues[0];assert.equal(unsupported.severity,'review');assert.equal(unsupported.field_assessment.confirmed_clubs,30);
});
test('closed confirmation shows a field review without expiry writes; a captured cycle removes the duplicate action',()=>{
  const data=[root,window(),row('season_registration','a',{status:'approved',registration_window_id:'window',participation_status:'confirmed',owner_email:'private@test',confirmed_player_ids:['secret-player']})];
  const result=report(data,[],now);assert.equal(result.counts.action,1);assert.match(result.issues[0].message,/1 confirmed/);assert.equal(result.read_only,true);assert.doesNotMatch(JSON.stringify(result),/private@test|secret-player/);
  const linked=report([...data,row('regional_cycle','cycle',{status:'running',participation_window_snapshot:{id:'window'}})],[],now);assert.equal(linked.issues.length,0);
  const expired=report([row('regional_league','root',{status:'registration',reset_series:1}),window()],[],now);assert.equal(expired.issues.length,0);assert.equal(expired.counts.windows,0);
});
test('deadline boundary uses a common exact timestamp and malformed deadlines require review',()=>{
  assert.equal(report([root,window()],[],new Date(now.getTime()-1)).issues[0].code,'confirmation_open');
  assert.equal(report([root,window()],[],now).issues[0].code,'field_review');
  assert.equal(report([root,window({confirmation_closes_at:'invalid'})],[],now).issues[0].code,'invalid_deadline');
  assert.equal(report([row('regional_league','root',{status:'in_progress',region_slug:'uk-ireland',platform:'cross-platform',season_number:1}),window()],[],now).issues.length,0);
});
test('confirmation notice counts remain aggregate and separate from actual confirmation or deadline changes',()=>{
  const w=window({confirmation_notice_policy_version:'regional_confirmation_notice_v1'}),apps=[
    row('season_registration','a',{registration_window_id:'window',status:'pending',participation_status:'registered',confirmation_notice:{version:'regional_confirmation_notice_v1',status:'stored',notification_id:'private-notice'}}),
    row('season_registration','b',{registration_window_id:'window',status:'pending',participation_status:'registered',confirmation_notice:{version:'regional_confirmation_notice_v1',status:'muted'}}),
    row('season_registration','c',{registration_window_id:'window',status:'pending',participation_status:'registered'}),
  ];
  const result=report([root,w,...apps],[],new Date(now.getTime()-1)),item=result.issues[0];
  assert.deepEqual(item.confirmation_notices,{stored:1,muted:1,pending:1});assert.match(item.message,/0 of 3/);assert.equal(result.read_only,true);assert.doesNotMatch(JSON.stringify(result),/private-notice/);
});
test('allocated groups request a calendar only until each group has a published calendar',()=>{
  const cycle=row('regional_cycle','c',{status:'allocated',allocated_groups:[{id:'a'},{id:'b'}]});
  assert.equal(report([cycle],[],now).issues[0].code,'league_calendar');
  assert.equal(report([cycle,row('regional_calendar','calendar',{status:'published',edition_ids:['a','b']})],[],now).issues.length,0);
  const pending=row('regional_cycle','c',{status:'running',fixture_refs:{x:'f'}});assert.equal(report([pending],[],now).issues[0].code,'pathway_schedule');
});
test('reminder recovery review is scoped to pending current-week applications and never exposes stored errors',()=>{
  const w=window({confirmation_notice_policy_version:'regional_confirmation_notice_v1'}),app=row('season_registration','a',{registration_window_id:'window',status:'pending',participation_status:'registered'}),job=row('regional_confirmation_notice_progress','j',{source_id:'a',status:'review_required',last_error:'private contact and SQL'});
  const check=rows=>report(rows,[],new Date(now.getTime()-1)).issues.filter(i=>i.code==='confirmation_notice_review');
  const issues=check([root,w,app,job]);assert.equal(issues.length,1);assert.equal(issues[0].severity,'review');assert.equal(issues[0].source_id,'window');assert.doesNotMatch(JSON.stringify(issues),/private contact|SQL/);
  const done={...app,data_json:JSON.stringify({...JSON.parse(app.data_json),confirmation_notice:{version:'regional_confirmation_notice_v1',status:'stored'}})};
  assert.equal(check([root,w,done,job]).length,0);assert.equal(check([root,window(),app,job]).length,0);
  assert.equal(report([root,w,app,job],[],now).issues.some(i=>i.code==='confirmation_notice_review'),false);
  const reset={...root,data_json:JSON.stringify({...JSON.parse(root.data_json),reset_series:1})};assert.equal(check([reset,w,app,job]).length,0);
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
  assert.match(calls[3].sql,/lf.entity_type='regional_league_fixture'/);assert.match(calls[3].sql,/m.source_fixture_id=lf.id/);assert.match(calls[3].sql,/m.id=cf.match_id/);assert.match(calls[3].sql,/'ADMIN_REVIEW','DISPUTED'/);
  await assert.rejects(model.fixtures(async sql=>{if(sql.includes('SELECT DISTINCT'))throw Error('Result inventory failed');return [];}),/Result inventory failed/);
});
test('Cup recovery blockers appear in English without exposing stored worker errors or invalidated sources',()=>{
  const cup=row('regional_cup_edition','cup',{status:'running',play_enabled:true,cup_reward_snapshot:{},rounds:[{number:1,fixture_ids:['f']}],round_calendar:[{round:1,instant:now.getTime()+86400000,minutes:60}]});
  const job=row('regional_cup_progress','job',{source_id:'cup',status:'review_required',last_error:'private worker details'}),m={fixture_id:'f',id:'match',competition_instance_id:'cup',status:'scheduled'};
  const data=report([cup,job],[m],now);assert.ok(data.issues.some(i=>i.code==='cup_recovery_review'));assert.doesNotMatch(JSON.stringify(data),/private worker details/);
  const invalidated={...cup,data_json:JSON.stringify({...JSON.parse(cup.data_json),edition_invalidated:true})};assert.equal(report([invalidated,job],[m],now).issues.length,0);
});
test('operations HTTP route is Admin-only and returns a read-only snapshot',async()=>{
  const express=require('express'),modulePath=require.resolve('../regionalOperationsService'),saved=require.cache[modulePath];let server;
  require.cache[modulePath]={exports:createService({model:{actor:async id=>({id,role_id:id==='admin'?0:1}),records:async()=>[root,window(),row('regional_league','live',{status:'in_progress'})],fixtures:async()=>[{id:'review-match',competition_instance_id:'live',status:'disputed',result_state:'ADMIN_REVIEW',home_submission:'private evidence'}]},transaction:fn=>fn(),clock:()=>now})};
  try {
    const app=express();app.use((req,res,next)=>{req.user={id:req.headers['x-actor']};next();});app.use('/regional-leagues',require('../../controllers/leagueEntityController').makeRouter('regional_league'));
    server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
    const call=async actor=>{const r=await fetch(`http://127.0.0.1:${server.address().port}/regional-leagues/operations`,{headers:{'x-actor':actor}});return {status:r.status,data:await r.json()};};
    assert.equal((await call('player')).status,403);const response=await call('admin');assert.equal(response.status,200);assert.equal(response.data.read_only,true);assert.equal(response.data.counts.action,1);assert.equal(response.data.counts.review,1);assert.equal(response.data.issues.find(i=>i.target==='results').match_id,'review-match');assert.doesNotMatch(JSON.stringify(response.data),/private evidence/);
  }finally{if(server)await new Promise(resolve=>server.close(resolve));if(saved)require.cache[modulePath]=saved;else delete require.cache[modulePath];}
});

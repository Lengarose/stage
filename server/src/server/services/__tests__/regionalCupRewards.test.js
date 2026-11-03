'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {setup}=require('./rewardFlowFixture.cjs');
const life=require('../regionalCupLifecycleService');
const {configuration,validate,VERSION}=require('../../lib/regionalCupRewards');
function fixture() {
  const env=setup('regional_cup_edition',20);
  env.state.entities.splice(1);
  env.state.items[0].linked_source_type='regional_cup';env.state.items[0].linked_source_id='cup';
  const final={id:'final',source_fixture_id:'final-fixture',home_club_id:env.ids[0],away_club_id:env.ids[1],home_score:2,away_score:2,decided_on_penalties:1,penalty_winner_side:'home',status:'completed',result_state:'CONFIRMED'};
  env.state.matches.push(final);
  env.setRoot({permanent_cup_id:'cup',participant_ids:env.ids,type:'knockout',play_enabled:true,status:'completed',winner_club_id:env.ids[0],completed_at:'2026-11-03T18:00:00Z',trophy_snapshot:{id:'trophy',name:'Original Cup',image_url:'/uploads/original-cup.png'},rounds:[{number:1,fixture_ids:[final.source_fixture_id],draw:{fixtures:[{}],byes:[]},results_revision:life.resultRevision([final]),advancers:[env.ids[0]]}]});
  env.setRoot({cup_reward_snapshot:configuration(env.root),effective_prize_budget_stc:'10000000.00'});
  // Scope loading uses real SQL projection; complete draw verification is covered
  // by regionalCupLifecycle.test.js. Isolate its source oracle in this ledger suite.
  const original=life.evaluate;
  life.evaluate=async root=>{
    if(root.edition_invalidated)throw Object.assign(Error('Invalidated Cup'),{status:409});
    return {matches:env.state.matches,fixtures:[],clubs:env.state.clubs};
  };
  return {...env,get root(){return env.root;},get state(){return env.state;},restore(){life.evaluate=original;}};
}
test('Cup: confirmed penalty final pays precisely 7m/3m, awards captured design, retries safely and exposes cabinet entitlement',async()=>{
  const e=fixture();try {
    e.state.players.push({id:'p1',club_id:e.ids[0]});
    e.state.items[0].name='Edited catalogue';e.state.items[0].image_url='/uploads/changed.png';
    const first=await e.prizes.review('regional_cup_edition','edition',{apply:false});
    assert.equal(first.state,'unpaid');assert.equal(first.obligations.length,2);assert.equal(e.state.ledgers.length,0);
    const reports=await Promise.all([e.prizes.review('regional_cup_edition','edition',{apply:true}),e.prizes.review('regional_cup_edition','edition',{apply:true})]);
    assert.ok(reports.every(r=>r.state==='paid' && r.trophy_state==='awarded'));
    assert.equal(e.state.clubs[0].stc,'7000000.00');assert.equal(e.state.clubs[1].stc,'3000000.00');assert.equal(e.state.clubs[2].stc,'0.00');
    assert.equal(e.state.ledgers.length,2);assert.equal(e.state.payouts.length,2);assert.equal(e.state.awards.length,2);
    const award=JSON.parse(e.state.awards[0].metadata_json);assert.equal(award.image_url,'/uploads/original-cup.png');assert.equal(award.design_name,'Original Cup');assert.equal(award.archive_path,'/regional-cups?edition=edition');
    const cabinet=await require('../trophyEntitlementService').review(e.ids[0],'club',e.query);assert.equal(cabinet.titles.all_time,1);
    const check=await e.prizes.review('regional_cup_edition','edition');assert.equal(check.trophy_state,'awarded');assert.equal(check.state,'paid');
  }finally{e.restore();}
});
test('Cup: failure rolls back both recipients and awards; a retry proves each ledger once',async()=>{
  const e=fixture();try {
    e.setFailure('INSERT INTO stc_transactions',1);
    await assert.rejects(e.prizes.review('regional_cup_edition','edition',{apply:true}),/Injected/);
    assert.equal(e.state.clubs[0].stc,'0.00');assert.equal(e.state.ledgers.length,0);assert.equal(e.state.awards.length,0);
    e.setFailure(null);assert.equal((await e.prizes.review('regional_cup_edition','edition',{apply:true})).state,'paid');assert.equal(e.state.ledgers.length,2);
  }finally{e.restore();}
});
test('Cup: missing historical promise requires explicit adoption; changed obligations, invalidation and unresolved results block payment',async()=>{
  const e=fixture();try {
    e.setRoot({cup_reward_snapshot:null});assert.equal((await e.prizes.review('regional_cup_edition','edition',{apply:true})).state,'blocked');assert.equal(e.state.awards.length,0);
    const preview=await e.prizes.adoptConfiguration('regional_cup_edition','edition',{admin:{id:'admin'},reason:'Review',version:VERSION});assert.equal(preview.dry_run,true);assert.equal(e.root.cup_reward_snapshot,null);
    await e.prizes.adoptConfiguration('regional_cup_edition','edition',{admin:{id:'admin'},reason:'Confirmed Cup promises',version:VERSION,apply:true});
    e.state.matches[0].result_state='DISPUTED';assert.equal((await e.prizes.review('regional_cup_edition','edition',{apply:true})).state,'blocked');assert.equal(e.state.ledgers.length,0);
    e.state.matches[0].result_state='CONFIRMED';await e.prizes.review('regional_cup_edition','edition',{apply:true});
    await assert.rejects(e.prizes.adoptConfiguration('regional_cup_edition','edition',{admin:{id:'admin'},reason:'Replace paid',version:VERSION,apply:true}),/Payment evidence/);
    e.setRoot({edition_invalidated:true});await assert.rejects(e.prizes.review('regional_cup_edition','edition',{apply:true}),/Invalidated/);
    assert.equal(e.state.ledgers.length,2);
  }finally{e.restore();}
});
test('Cup promise rejects amount, budget, roster, edition and trophy changes',()=>{
  const edition={id:'e',permanent_cup_id:'cup',participant_ids:['a','b'],trophy_snapshot:{id:'t'}};
  const c=configuration(edition);assert.equal(validate(c,edition),c);
  for(const patch of [{budget:'1.00'},{funding:'club'},{roster:['b','a']},{edition_id:'other'},{rows:[{position:1,stc_amount:'1.00'}]},{trophy_item_id:'other'}])assert.throws(()=>validate({...c,...patch},edition),/review/);
});
test('the existing retry job recovers a completed Cup without a settlement record after a crash',async()=>{
  const e=fixture(),dbPath=require.resolve('../../db/database'),servicePath=require.resolve('../competitionPrizeService'),db=require.cache[dbPath],service=require.cache[servicePath];
  try {
    const query=async(sql,v)=>{
      if(sql.startsWith('SELECT * FROM league_entities') && sql.includes("entity_type='competition_settlement' AND (status"))return [];
      if(sql.startsWith('SELECT id FROM league_entities') && sql.includes("entity_type='regional_cup_edition'"))return [{id:'edition'}];
      return e.query(sql,v);
    };
    require.cache[dbPath]={exports:{...db.exports,EXECUTESQL:query}};delete require.cache[servicePath];
    const recovered=require('../competitionPrizeService');assert.equal(e.state.ledgers.length,0);
    await recovered.retryPending();await recovered.retryPending();assert.equal(e.state.ledgers.length,2);assert.equal(e.state.awards.length,1);assert.equal(e.root.prize_settlement_state,'paid');
  }finally{require.cache[dbPath]=db;require.cache[servicePath]=service;e.restore();}
});
test('reviewed regional history reset revokes Cup awards while preserving payment evidence',async()=>{
  const e=fixture();try {
    await e.prizes.review('regional_cup_edition','edition',{apply:true});
    const history=require('../competitionHistoryResetService'),selection={edition_ids:['edition']};
    const preview=await history.preview('regional',e.query,false,selection);assert.equal(preview.award_count,1);
    await e.withTransaction(q=>history.revoke('regional',q,{id:'admin'},'Reviewed reset',selection));
    assert.equal(e.state.awards[0].status,'revoked');assert.equal(e.state.ledgers.length,2);assert.equal(e.state.clubs[0].stc,'7000000.00');
    const report=await require('../trophyEntitlementService').review(e.ids[0],'club',e.query);assert.equal(report.titles.all_time,0);
  }finally{e.restore();}
});
test('Cup reward endpoint service derives Admin from storage and rejects participant/anonymous writes',async()=>{
  const {createService}=require('../regionalCupRewardService');const calls=[];
  const service=createService({query:async(sql,[id])=>[{id,role_id:id==='admin'?2:1,email:'stored@example.test'}],prizes:{review:async(...args)=>{calls.push(args);return {state:'pending'};},adoptConfiguration:async(...args)=>{calls.push(args);return {dry_run:true};}}});
  await assert.rejects(service.action('e',{action:'review',apply:true,reason:'x'},{}),/Admin/);
  await assert.rejects(service.action('e',{action:'review',apply:true,reason:'x'},{id:'player',role_id:2}),/Admin/);
  await assert.rejects(service.action('e',{action:'review',apply:true},{id:'admin'}),/Explain/);
  await service.action('e',{action:'review',admin:{id:'fake'}},{id:'admin'});assert.equal(calls[0][2].admin.email,'stored@example.test');assert.equal(calls[0][2].apply,false);
});
test('Cup reward HTTP route enforces stored Admin identity and exposes review/adoption actions',async()=>{
  const express=require('express'),{createService}=require('../regionalCupRewardService');
  const modulePath=require.resolve('../regionalCupRewardService'),saved=require.cache[modulePath],calls=[];let server;
  require.cache[modulePath]={exports:createService({query:async(sql,[id])=>[{id,role_id:id==='admin'?2:1}],prizes:{review:async(...args)=>{calls.push(args);return {state:'unpaid',dry_run:true};},adoptConfiguration:async()=>({dry_run:true})}})};
  try {
    const app=express();app.use(express.json(),(req,res,next)=>{req.user={id:req.headers['x-actor']};next();});app.use('/regional-leagues',require('../../controllers/leagueEntityController').makeRouter('regional_league'));
    server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
    const call=async(actor,body)=>{const r=await fetch(`http://127.0.0.1:${server.address().port}/regional-leagues/cups/edition/rewards`,{method:'POST',headers:{'Content-Type':'application/json','x-actor':actor},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
    assert.equal((await call('player',{action:'review',apply:true,reason:'x'})).status,403);
    assert.equal((await call('admin',{action:'review',apply:true})).status,400);
    assert.equal((await call('admin',{action:'review'})).data.state,'unpaid');assert.equal(calls.length,1);
    assert.equal((await call('admin',{action:'adopt'})).status,200);
  }finally{if(server)await new Promise(resolve=>server.close(resolve));if(saved)require.cache[modulePath]=saved;else delete require.cache[modulePath];}
});

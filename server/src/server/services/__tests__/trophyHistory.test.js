const test=require('node:test'),assert=require('node:assert/strict');
const {setup}=require('./rewardFlowFixture.cjs');
const {snapshot,titleSummary}=require('../../lib/trophyHistory');
const {archiveDue}=require('../tournamentArchiveService');
const admin={id:'admin',email:'admin@example.test'};
async function earn(env) {env.setRoot({status:'completed',completed_at:'2026-10-25 10:00:00'});await require('../trophyAwardService').awardClubTrophyToClubAndPlayers({query:env.query,clubId:'club-1',trophyItemId:'trophy',tournamentId:'edition',tournament:{_source_type:env.kind,_source_id:'edition'}});return env.state.awards[0];}
test('award snapshot survives renaming, new-season changes and removal of obsolete source records',async()=>{
  const env=setup();const award=await earn(env),name=JSON.parse(award.metadata_json).display_name;
  assert.equal(name,'Controlled Test League Trophy — Season 1');assert.equal(JSON.parse(award.metadata_json).participant_count,20);
  env.setRoot({name:'Renamed new season',season_number:2,status:'registration'});
  env.state.items[0].image_url='/uploads/new-art.png';
  let report=await require('../trophyEntitlementService').review('club-1','club',env.query);assert.equal(report.titles.all_time,1);assert.equal(report.awards[0].display_name,name);assert.equal(report.awards[0].image_url,'/uploads/test.png');
  env.state.entities.splice(0,env.state.entities.length);
  report=await require('../trophyEntitlementService').review('club-1','club',env.query);assert.equal(report.awards.length,1);assert.equal(report.titles.official_ranking,1);
});
test('regional and GOST resets revoke only the selected family, retaining finances and unrelated titles',async()=>{
  const env=setup();await earn(env);
  const Model=require('../../models/trophyAwardModel'),model=new Model();
  const existing=env.state.awards[0];await model.create({...existing,source_type:'competition_season',source_id:'gost-edition',edition_id:'season2',metadata_json:JSON.parse(existing.metadata_json)},env.query);
  env.state.ledgers.push({id:'unchanged-payment',amount:'100.00'});
  const reset=require('../competitionHistoryResetService');
  assert.equal((await reset.preview('regional',env.query)).award_count,1);
  await reset.revoke('regional',env.query,admin,'Explicit regional reset');
  let report=await require('../trophyEntitlementService').review('club-1','club',env.query);assert.equal(report.titles.all_time,1);assert.equal(report.awards[0].source_type,'competition_season');
  await reset.revoke('regional',env.query,admin,'Idempotent retry');assert.equal(env.state.awards.filter(a=>a.status==='revoked').length,1);assert.equal(env.state.ledgers.length,1);
  await reset.revoke('gost',env.query,admin,'Explicit GOST reset');report=await require('../trophyEntitlementService').review('club-1','club',env.query);assert.equal(report.titles.all_time,0);assert.equal(env.state.ledgers[0].amount,'100.00');
});
test('seven-day boundary uses immutable completion time, never later edits or guessed legacy dates',()=>{
  const at=Date.parse('2026-10-25T12:00:00Z'),stamp='2026-10-18T12:00:00Z';
  assert.equal(archiveDue({status:'completed',completed_at:stamp,updated_date:'2099-01-01'},at),true);
  assert.equal(archiveDue({status:'completed',completed_at:stamp},at-1),false);
  assert.equal(archiveDue({status:'completed',end_date:stamp,updated_date:stamp},at),false);
});
test('snapshot names, actual entrants, human formats and title eligibility do not use placement year',()=>{
  const proof={source_type:'tournament',source_id:'t',winner:'p',scope:{root:{name:'October Cup',participant_type:'player',type:'swiss_ucl',completed_at:'2026-10-25T12:00:00Z',max_teams:64},participants:[{id:'p',name:'Winner'},{id:'opponent'}]},item:{image_url:'/uploads/original.png'}};
  const details=snapshot(proof,'player_champion',false);assert.equal(details.display_name,'October Cup Trophy — 2026');assert.equal(details.participant_count,2);assert.equal(details.format,'UCL/Swiss');
  const a={owner_id:'p',status:'earned',source_type:'tournament',source_id:'t',edition_id:'t',metadata_json:details};assert.deepEqual(titleSummary([a,a]),{all_time:1,official_ranking:0});
  assert.deepEqual(titleSummary([{...a,status:'revoked'}]),{all_time:0,official_ranking:0});
  delete proof.scope.root.completed_at;assert.equal(snapshot(proof,'player_champion',false).completed_at,null);
});
test('legacy arrangements need explicit association and are never locked during materialization',async()=>{
  const env=setup();const award=await earn(env);
  env.state.placements.push({id:'legacy',owner_id:'club-1',owner_type:'club',trophy_item_id:'trophy',win_count:2,x_percent:30,y_percent:40});
  const service=require('../trophyEntitlementService');
  let report=await service.repair('club-1','club',{action:'materialize',reason:'Review ambiguous aggregate'},admin);
  assert.ok(!report.placements[0].award_id);assert.ok(!report.placements[0].locked_at);
  report=await service.repair('club-1','club',{action:'associate_legacy',placement_id:'legacy',award_id:award.id,reason:'Choose the verified copy for the legacy arrangement'},admin);
  assert.equal(report.placements[0].award_id,award.id);assert.equal(report.placements[0].x_percent,30);assert.ok(!report.placements[0].locked_at);
});
test('completed legacy events without a trophy design still count only with verified winning evidence',async()=>{
  const env=setup();env.setRoot({status:'completed',winner_club_id:'club-1',trophy_item_id:null});env.state.items.length=0;
  const report=await require('../trophyEntitlementService').review('club-1','club',env.query);
  assert.equal(report.titles.all_time,1);assert.equal(report.awards[0].trophy_item_id,null);assert.equal(report.awards[0].persisted,false);
  assert.equal(report.awards[0].completed_at,null);
});

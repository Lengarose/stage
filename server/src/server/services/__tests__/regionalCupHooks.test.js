'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
test('confirmed Cup results use the existing central completion hook, and forfeits reconcile without exposing draw seeds',async()=>{
 const calls=[],fixture={id:'fixture',match_id:'match',competition_instance_id:'cup',legacy_fixture_type:'regional_cup',legacy_fixture_id:'fixture',home_participant_id:'home',away_participant_id:'away',phase:'knockout_final',round:1,status:'scheduled'};
 const query=async sql=>{if(/SELECT \* FROM competition_fixtures WHERE match_id/.test(sql))return [fixture];if(/UPDATE competition_fixtures/.test(sql))calls.push('mirror');return [];};
 const paths=['../../db/database','../regionalCupLifecycleService','../regionalCycleService','../competitionEngineService','../../models/competitionEngineModel','../competitionPrizeService'].map(require.resolve),saved=paths.map(p=>require.cache[p]);
 let closed=false,completed=false;
 try {
  require.cache[paths[0]]={exports:{EXECUTESQL:query,withTransaction:fn=>fn(query),pool:{}}};
  require.cache[paths[1]]={exports:{assertWritableFixture:async()=>{if(closed)throw Error('Cup closed');calls.push('guard');},reconcile:async id=>{calls.push(id);return {status:completed?'completed':'running',current_round:2,draw_seed:'private-seed'};}}};
  require.cache[paths[5]]={exports:{review:async(kind,id,options)=>{assert.equal(kind,'regional_cup_edition');assert.equal(id,'cup');assert.equal(options.apply,true);calls.push('settle');return {state:'paid',trophy_state:'awarded',private_report:'private-finance'};}}};
  require.cache[paths[2]]={exports:{assertWritableFixture:async()=>{}}};delete require.cache[paths[3]];delete require.cache[paths[4]];
  const service=require('../competitionEngineService'),match={id:'match',source_fixture_type:'competition_engine',source_fixture_id:'fixture',status:'completed',home_score:2,away_score:1};
  const result=await service.syncMatchResultToSource(match);assert.equal(result.advance.status,'running');assert.equal(result.advance.current_round,2);assert.doesNotMatch(JSON.stringify(result),/private-seed/);assert.deepEqual(calls,['guard','mirror','cup']);
  const forfeit=await service.advanceAfterFinalResult({match:{...match,status:'forfeit'}});assert.equal(forfeit.advance.status,'running');assert.equal(calls.at(-1),'cup');completed=true;const final=await service.syncMatchResultToSource(match);assert.equal(final.advance.rewards.state,'paid');assert.equal(calls.at(-1),'settle');assert.doesNotMatch(JSON.stringify(final),/private-finance/);closed=true;await assert.rejects(service.syncMatchResultToSource(match),/Cup closed/);
 } finally {paths.forEach((p,i)=>{if(saved[i])require.cache[p]=saved[i];else delete require.cache[p];});}
});

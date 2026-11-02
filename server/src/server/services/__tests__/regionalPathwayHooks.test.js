'use strict';
const test=require('node:test'),assert=require('node:assert/strict');

test('official completed and forfeited pathway results reconcile the captured regional cycle',async()=>{
  const calls=[];
  const fixture={id:'fixture',match_id:'match',competition_instance_id:'cycle',legacy_fixture_type:'regional_pathway',legacy_fixture_id:'fixture',home_participant_id:'home',away_participant_id:'away',phase:'league',round:1,status:'unscheduled'};
  const query=async(sql)=>{
    if(/SELECT \* FROM competition_fixtures WHERE match_id/.test(sql))return [fixture];
    return [];
  };
  const db=require.resolve('../../db/database'),cycle=require.resolve('../regionalCycleService'),engine=require.resolve('../competitionEngineService');
  require.cache[db]={id:db,filename:db,loaded:true,exports:{EXECUTESQL:query,withTransaction:fn=>fn(query),pool:{}}};
  require.cache[cycle]={id:cycle,filename:cycle,loaded:true,exports:{assertWritableFixture:async()=>{},progress:async id=>{calls.push(id);return {cycle:{status:'ready'}};}}};
  delete require.cache[engine];delete require.cache[require.resolve('../../models/competitionEngineModel')];
  const service=require('../competitionEngineService');
  const result=await service.syncMatchResultToSource({id:'match',source_fixture_type:'competition_engine',source_fixture_id:'fixture',status:'completed',home_score:2,away_score:1});
  assert.equal(result.advance.status,'ready');assert.equal(result.advance.cycle,undefined);assert.deepEqual(calls,['cycle']);
  const forfeit=await service.advanceAfterFinalResult({match:{id:'match',source_fixture_type:'competition_engine',status:'forfeit'}});
  assert.equal(forfeit.advance.status,'ready');assert.equal(forfeit.advance.cycle,undefined);assert.deepEqual(calls,['cycle','cycle']);
});

test('pathway shootouts use one deciding leg and closed cycles cannot accept new submissions',async()=>{
  const cycle=require.resolve('../regionalCycleService'),penalty=require.resolve('../penaltyPolicyService');
  let closed=false;
  require.cache[cycle]={id:cycle,filename:cycle,loaded:true,exports:{assertWritableFixture:async()=>{if(closed)throw Object.assign(new Error('Cycle closed'),{status:409});}}};
  delete require.cache[penalty];
  const service=require('../penaltyPolicyService');
  const match={id:'match',home_club_id:'a',away_club_id:'b',source_fixture_type:'competition_engine',source_fixture_id:'fixture'};
  const query=async()=>[{id:'fixture',legacy_fixture_type:'regional_pathway',phase:'knockout_final',leg:1}];
  const decision=await service.validateMatchPenalty(match,{home_score:2,away_score:2},{decided_on_penalties:1,penalty_winner_side:'away'},query);
  assert.equal(decision.decided_on_penalties,1);assert.equal(decision.penalty_winner_side,'away');
  closed=true;await assert.rejects(service.validateMatchPenalty(match,{home_score:2,away_score:2},{decided_on_penalties:1,penalty_winner_side:'away'},query),/closed/);
});

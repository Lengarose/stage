import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {penaltyOutcome} from '../penaltyOutcome.js';
import {scheduleResult} from '../scheduleResult.js';
const require=createRequire(import.meta.url);
const {normalizeCalendarEvents}=require('../../../server/src/server/services/scheduleCalendarService');
const {buildStageCatalogue,presentStageMatches}=require('../../../server/src/server/lib/tournamentStageView');
const {assertResultSnapshotCurrent}=require('../../../server/src/server/lib/matchResultNegotiation');
import {resultSnapshot} from '../gameDayResultFlow.js';
const result={id:'return',home_player_id:'b',away_player_id:'a',home_player_name:'Beta',away_player_name:'Alpha',home_score:2,away_score:1,status:'completed',result_state:'CONFIRMED',decided_on_penalties:1,penalty_winner_side:'away',aggregate_home_score:3,aggregate_away_score:3,scheduled_date:'2026-10-27 20:00:00',timezone:'Europe/Brussels'};
test('confirmed legacy played fixture is official; an unresolved legacy fixture remains proposed',()=>{
  const legacy={...result,status:'played',result_state:null,stats_processed:1};
  assert.equal(penaltyOutcome(legacy),'3 - 3 aggregate · Alpha won on penalties.');
  assert.match(penaltyOutcome({...legacy,stats_processed:0}),/^Proposed:/);
});
test('calendar serializer retains decision, confirmation and aggregate without private proof',()=>{
  const [event]=normalizeCalendarEvents({matches:[{...result,proof_url:'/private'}],identity:{player:{id:'a'}},timezone:'Europe/Brussels',from:'2026-10-01',to:'2026-11-01'});
  assert.equal(event.decided_on_penalties,1);
  assert.equal(event.penalty_winner_side,'away');
  assert.equal(event.result_state,'CONFIRMED');
  assert.equal(event.aggregate_home_score,3);
  assert.equal(event.proof_url,undefined);
  assert.equal(penaltyOutcome(event),'3 - 3 aggregate · Alpha won on penalties.');
  assert.equal(event.score,'2 - 1');
});
test('Schedule uses the confirmed penalty winner for W/L without altering ordinary goals',()=>{
  assert.deepEqual(scheduleResult(result,null,{id:'a'}),{outcome:'W',myScore:1,theirScore:2,display:'1–2'});
  assert.equal(scheduleResult(result,null,{id:'b'}).outcome,'L');
  assert.equal(scheduleResult({...result,status:'awaiting_confirmation'},null,{id:'a'}),null);
  assert.equal(scheduleResult({...result,result_state:'DISPUTED'},null,{id:'a'}),null);
  const club={...result,home_player_id:null,away_player_id:null,home_club_id:'b',away_club_id:'a'};
  assert.equal(scheduleResult(club,{id:'a'},null).outcome,'W');
});
test('Stages serializer preserves official confirmation and names for the shared label',()=>{
  const tournament={id:'cup',type:'knockout',participant_type:'player',max_teams:2,status:'in_progress'};
  const stored={...result,type:'knockout',round:1,tournament_id:'cup',home_score:1,away_score:1,aggregate_home_score:null,aggregate_away_score:null};
  const [stage]=buildStageCatalogue(tournament,[stored]);
  const [row]=presentStageMatches(stage,tournament,new Map(),null,new Map());
  assert.equal(penaltyOutcome(row),'Alpha won on penalties.');
  const [pending]=presentStageMatches({...stage,matches:[{...stored,status:'in_progress',result_state:'AWAITING_AWAY_CONFIRMATION'}]},tournament,new Map(),null,new Map());
  assert.match(penaltyOutcome(pending),/^Proposed:/);
});
test('browser snapshot matches server semantics and detects a replaced proposal',()=>{
  const reviewed={...result,home_submission:JSON.stringify({home_score:2,penalty_winner_side:'away'}),result_history:[]};
  assert.doesNotThrow(()=>assertResultSnapshotCurrent(resultSnapshot(reviewed),reviewed));
  assert.throws(()=>assertResultSnapshotCurrent(resultSnapshot(reviewed),{...reviewed,home_submission:JSON.stringify({home_score:2,penalty_winner_side:'home'})}),error=>error.status===409&&error.code==='RESULT_CHANGED');
});

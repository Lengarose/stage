import test from 'node:test';import assert from 'node:assert/strict';
import {filterGameDayMatches,isHubMatch} from '../gameDayHub.js';
import {penaltyOutcome} from '../penaltyOutcome.js';
const games=['supreme','elite','challenger','regional','tournament','friendly'].map((category,i)=>({id:String(i),category,status:'completed',result_state:'CONFIRMED',home_player_name:'Alpha',away_player_name:'Beta',competition_name:category}));
test('search, five competition scopes and four statuses compose without modifying records',()=>{
  assert.equal(filterGameDayMatches(games,{scope:'gost',status:'completed',search:'alpha'}).length,3);
  assert.equal(filterGameDayMatches(games,{scope:'regional'}).length,1);
  assert.equal(filterGameDayMatches(games,{scope:'tournament'}).length,1);
  assert.equal(filterGameDayMatches(games,{scope:'friendly'}).length,1);
  assert.equal(filterGameDayMatches(games,{status:'live'}).length,0);
  assert.equal(filterGameDayMatches([{id:'scheduled',status:'scheduled'}],{status:'upcoming'}).length,1);
  assert.equal(filterGameDayMatches(games,{search:'missing'}).length,0);
});
test('permanent completed history remains selectable without reviving voided matches',()=>{
  assert.equal(isHubMatch({...games[0],updated_date:'2001-01-01'}),true);
  assert.equal(isHubMatch({...games[0],status:'voided'}),false);
});
test('penalty labels preserve ordinary score and mark proposals, never invent shootout goals',()=>{
  const result={status:'completed',result_state:'CONFIRMED',home_club_name:'Alpha',away_club_name:'Beta',home_score:2,away_score:1,decided_on_penalties:1,penalty_winner_side:'away'};
  assert.equal(penaltyOutcome(result,[3,3]),'3 - 3 aggregate · Beta won on penalties.');
  assert.equal(penaltyOutcome({...result,status:'in_progress'}),'Proposed: Beta won on penalties.');
  assert.equal(result.home_score,2);
});

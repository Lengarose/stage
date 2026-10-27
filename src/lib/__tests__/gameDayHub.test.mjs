import test from 'node:test';import assert from 'node:assert/strict';
import {filterGameDayMatches,isHubMatch,enrichGameDayMatches,GAME_DAY_BACKEND_NOTICE} from '../gameDayHub.js';
import {penaltyOutcome} from '../penaltyOutcome.js';
const games=['supreme','elite','challenger','regional','tournament','friendly'].map((category,i)=>({id:String(i),category,status:'completed',result_state:'CONFIRMED',home_player_name:'Alpha',away_player_name:'Beta',competition_name:category}));
test('missing enrichment route retains existing matches and reports partial history',async()=>{
  const matches=new Map(games.map(game=>[game.id,game]));
  const notice=await enrichGameDayMatches(matches,async()=>{throw Object.assign(new Error('Route not found'),{status:404});});
  assert.equal(notice,GAME_DAY_BACKEND_NOTICE);
  assert.deepEqual([...matches.values()],games);
});
test('enrichment does not hide permissions, outages or later pagination failures',async()=>{
  for(const status of [401,403,500]){
    await assert.rejects(enrichGameDayMatches(new Map(),async()=>{throw Object.assign(new Error('Failure'),{status});}),{status});
  }
  await assert.rejects(enrichGameDayMatches(new Map(),async({offset})=>{
    if(offset)throw Object.assign(new Error('Missing page'),{status:404});
    return Array.from({length:100},(_,id)=>({id}));
  }),{status:404});
});
test('enrichment merges current records and ignores stale responses',async()=>{
  const matches=new Map([['one',{id:'one',home_player_name:'Alpha'}]]);
  assert.equal(await enrichGameDayMatches(matches,async()=>[{id:'one',category:'tournament'}]),'');
  assert.equal(matches.get('one').home_player_name,'Alpha');
  assert.equal(matches.get('one').category,'tournament');
  await enrichGameDayMatches(matches,async()=>[{id:'stale'}],()=>false);
  assert.equal(matches.has('stale'),false);
});
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

const test=require('node:test');
const assert=require('node:assert/strict');
const dbPath=require.resolve('../../db/database');
require.cache[dbPath]={id:dbPath,filename:dbPath,loaded:true,exports:{EXECUTESQL:async()=>[],pool:{}}};
const {readPenaltyContext,validateMatchPenalty}=require('../penaltyPolicyService');
const first={id:'a',home_player_id:'p',away_player_id:'q',home_score:2,away_score:1,status:'completed',result_state:'CONFIRMED',tournament_id:'cup',type:'quarter_final',round:1,leg:1,tie_id:'tie'};
const second={...first,id:'b',home_player_id:'q',away_player_id:'p',status:'in_progress',result_state:'AWAITING_RESULT',round:2,leg:2};
test('authoritative tournament configuration permits reversed level aggregate and persists totals separately',async()=>{
  const query=async sql=>sql.includes('FROM tournaments')?[{id:'cup',participant_type:'player',type:'group_stage',knockout_legs:2}]:sql.includes('FROM matches')?[first,second]:[];
  const context=await readPenaltyContext(second,2,1,query);assert.equal(context.applicable,true);
  const result=await validateMatchPenalty(second,{home_score:2,away_score:1},{decided_on_penalties:1,penalty_winner_side:'away',aggregate_home_score:999},query);
  assert.deepEqual(result,{decided_on_penalties:1,penalty_winner_side:'away',aggregate_home_score:3,aggregate_away_score:3});
  await assert.rejects(validateMatchPenalty(second,{home_score:1,away_score:1},{decided_on_penalties:1,penalty_winner_side:'away'},query),/already determines/);
});
test('missing prior-leg data blocks completion rather than inventing an aggregate',async()=>{
  const query=async sql=>sql.includes('FROM tournaments')?[{id:'cup',participant_type:'player',type:'group_stage',knockout_legs:2}]:sql.includes('FROM matches')?[second]:[];
  await assert.rejects(validateMatchPenalty(second,{home_score:2,away_score:1},{},query),/first-leg/);
});
test('native GOST playoff derives previous confirmed leg from permanent match identities',async()=>{
  const one={id:'leg1',home_club_id:'a',away_club_id:'b',home_score:2,away_score:1,status:'completed',result_state:'CONFIRMED'};
  const two={id:'leg2',home_club_id:'b',away_club_id:'a',status:'in_progress',source_fixture_type:'competition_engine',source_fixture_id:'engine2'};
  const query=async sql=>sql.startsWith('SELECT * FROM competition_fixtures')?[{id:'engine2',leg:2,phase:'playoff_round',tie_id:'tie',competition_instance_id:'gost'}]:sql.includes('JOIN matches')?[one,two]:[];
  assert.equal((await readPenaltyContext(two,2,1,query)).applicable,true);
  assert.equal((await readPenaltyContext({...two,allow_penalties:1},1,1,query)).applicable,false);
});
test('confirmation retains the proposed winner; correction can explicitly clear the old decision',()=>{
  const {acceptedForMatch}=require('../matchResultNegotiationService');
  const proposed={home_score:2,away_score:1,decided_on_penalties:1,penalty_winner_side:'away'};
  const accepted=acceptedForMatch(second,proposed,{});assert.equal(accepted.penalty_winner_side,'away');assert.equal(accepted.decided_on_penalties,1);
  const corrected=acceptedForMatch({...second,decided_on_penalties:1,penalty_winner_side:'away'},{...proposed,decided_on_penalties:0,penalty_winner_side:null},{});
  assert.equal(corrected.decided_on_penalties,0);assert.equal(corrected.penalty_winner_side,null);
});

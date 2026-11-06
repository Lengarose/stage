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
test('Admin penalty context over HTTP uses the actual reversed aggregate and refuses unrelated viewers',async()=>{
 const express=require('express'),{createRouter}=require('../../controllers/gameDayViewController');let includeFirst=true;
 const statements=[],query=async sql=>{
  statements.push(sql);
  if(sql.startsWith('SELECT * FROM matches WHERE id='))return [second];
  if(sql.includes('FROM tournaments'))return [{id:'cup',participant_type:'player',type:'group_stage',knockout_legs:2}];
  if(sql.includes('FROM matches'))return includeFirst?[first,second]:[second];
  throw Error('Unexpected penalty context query');
 };
 const app=express();app.use((req,res,next)=>{req.user={id:req.headers['x-user'] || 'admin2'};next();});
 app.use('/game-day',createRouter({query,resolveIdentity:async id=>({user:{id,role_id:id==='admin2'?2:id==='admin0'?0:1},player:{id:'unrelated'}})}));
 const server=app.listen(0,'127.0.0.1');await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
 try {
  const get=async(user,h=2,a=1)=>{const r=await fetch(`http://127.0.0.1:${server.address().port}/game-day/b/penalties?home_score=${h}&away_score=${a}`,{headers:{'x-user':user}});return {status:r.status,data:await r.json()};};
  for(const user of ['admin0','admin2']){const r=await get(user);assert.equal(r.status,200);assert.equal(r.data.required,true);assert.deepEqual(r.data.aggregate,{home:3,away:3});}
  assert.equal((await get('viewer')).status,403);assert.equal((await get('admin2','bad')).status,400);assert.equal((await get('admin2',1,1)).data.applicable,false);
  includeFirst=false;assert.equal((await get('admin2')).data.blocked,true);assert.ok(statements.every(sql=>sql.startsWith('SELECT')));
 }finally{await new Promise(resolve=>server.close(resolve));}
});

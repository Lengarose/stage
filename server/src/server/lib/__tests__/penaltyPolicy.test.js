const test=require('node:test'),assert=require('node:assert/strict');
const {penaltyEligibility:policy}=require('../penaltyPolicy');
const {normalizePenaltySelection}=require('../matchResultNegotiation');
const first={id:'one',home_club_id:'a',away_club_id:'b',home_score:2,away_score:1,status:'completed',result_state:'CONFIRMED'};
const second={id:'two',home_club_id:'b',away_club_id:'a',type:'knockout'};
test('deciding aggregate, not individual leg draw, determines eligibility by permanent identities',()=>{
  const context={match:second,rows:[first,second],phase:'playoff_round',legs:2,leg:2};
  const level=policy(context,2,1);assert.equal(level.required,true);assert.deepEqual(level.aggregate,{home:3,away:3});
  assert.equal(policy(context,1,1).applicable,false);
  assert.equal(policy({...context,leg:1},1,1).applicable,false);
  assert.match(policy({...context,rows:[second]},2,1).reason,/first-leg/);
  assert.match(policy({...context,rows:[{...first,result_state:'DISPUTED'},second]},2,1).reason,/first-leg/);
});
test('league/group/UCL league phase rejects shootouts even if legacy flags request them',()=>{
  for(const phase of ['league','group','ucl_league','swiss','regional_league']){
    const eligible=policy({match:{...first,allow_penalties:1},phase},1,1);
    assert.equal(eligible.applicable,false);
    assert.throws(()=>normalizePenaltySelection({homeScore:1,awayScore:1,decidedOnPenalties:1,penaltyWinnerSide:'home',allowed:eligible.applicable,eligibility:eligible}),/phase/);
  }
});
test('single knockout finals require a named winner only for a level final score',()=>{
  const context=policy({match:first,phase:'final',legs:1,leg:1},1,1);
  assert.equal(context.required,true);
  assert.throws(()=>normalizePenaltySelection({homeScore:1,awayScore:1,allowed:true,eligibility:context}),/Select the penalty winner/);
  assert.equal(policy({match:first,phase:'final',legs:1,leg:1},2,1).applicable,false);
});
test('player two-legged knockout reverses home/away without losing attribution',()=>{
  const one={...first,home_club_id:null,away_club_id:null,home_player_id:'p1',away_player_id:'p2'};
  const two={...second,home_club_id:null,away_club_id:null,home_player_id:'p2',away_player_id:'p1'};
  assert.equal(policy({match:two,rows:[one,two],phase:'ucl_qf',legs:2,leg:2},2,1).applicable,true);
});

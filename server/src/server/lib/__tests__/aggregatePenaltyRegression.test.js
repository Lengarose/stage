const test=require('node:test');
const assert=require('node:assert/strict');
const {normalizePenaltySelection}=require('../matchResultNegotiation');
test('a 2-1 return leg must retain the penalty winner when the authoritative aggregate is 3-3',()=>{
  assert.deepEqual(normalizePenaltySelection({homeScore:2,awayScore:1,decidedOnPenalties:true,penaltyWinnerSide:'away',allowed:true,eligibility:{applicable:true,required:true,aggregate:{home:3,away:3},decidingLeg:true}}),{decided_on_penalties:1,penalty_winner_side:'away'});
});

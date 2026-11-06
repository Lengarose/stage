import test from 'node:test';
import assert from 'node:assert/strict';
import {adminPenaltyDecision,adminPenaltyReady,resolutionPenaltyKey} from '../adminResolutionPenalty.js';

test('ordinary results explicitly clear inherited penalties; tied knockout decisions require an explicit winner',()=>{
 const ordinary=adminPenaltyDecision({applicable:false,required:false},'away','k');assert.deepEqual(ordinary,{key:'k',ready:true,decided_on_penalties:0,penalty_winner_side:null});assert.equal(adminPenaltyReady(ordinary,'k'),true);
 const tied={applicable:true,required:true,aggregate:{home:3,away:3},legs:2};
 for(const choice of ['',undefined,'none','unknown'])assert.equal(adminPenaltyDecision(tied,choice,'k').ready,false);
 for(const side of ['home','away']){const selected=adminPenaltyDecision(tied,side,'k');assert.equal(adminPenaltyReady(selected,'k'),true);assert.equal(selected.decided_on_penalties,1);assert.equal(selected.penalty_winner_side,side);}
});
test('missing, blocked and inconsistent contexts never enable a decision',()=>{
 for(const context of [null,{}, {applicable:false},{applicable:false,required:true},{applicable:true,required:true,blocked:true}])assert.equal(adminPenaltyDecision(context,'home','k').ready,false);
 assert.equal(adminPenaltyReady({key:'k',ready:true,decided_on_penalties:1,penalty_winner_side:null},'k'),false);
});
test('verified penalty choices cannot be reused for another match, score or approved proposal side',()=>{
 const match={id:'m'},score={home_score:'2',away_score:'1'},key=resolutionPenaltyKey(match,score,'home');
 const decision=adminPenaltyDecision({applicable:true,required:true},'away',key);
 for(const next of [resolutionPenaltyKey({id:'other'},score,'home'),resolutionPenaltyKey(match,{...score,home_score:'3'},'home'),resolutionPenaltyKey(match,score,'away')])assert.equal(adminPenaltyReady(decision,next),false);
 assert.equal(adminPenaltyReady(decision,key),true);
});

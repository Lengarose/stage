import test from 'node:test';
import assert from 'node:assert/strict';
import {officialResultNotice} from '../officialResultNotice.js';
const policy={match_id:'m',version:'regional_result_review_v2',response_hours:24,timeout_action:'admin_review',allow_either_initial:true};

test('captured conditions are bound to their match and legacy editions never inherit the current policy',()=>{
 assert.equal(officialResultNotice({id:'m'},null),null);assert.equal(officialResultNotice({id:'other'},policy),null);
 assert.equal(officialResultNotice({id:'m'},policy).allowEitherInitial,true);
 assert.equal(officialResultNotice({id:'m'},{...policy,version:'regional_result_review_v1',allow_either_initial:false}).allowEitherInitial,false);
 for(const patch of [{version:'future'},{response_hours:48},{timeout_action:'approve'},{allow_either_initial:false}])assert.equal(officialResultNotice({id:'m'},{...policy,...patch}).unsupported,true);
});
test('only the current response phase selects its stored absolute deadline, with UTC database values handled explicitly',()=>{
 const game={id:'m',status:'in_progress',result_state:'AWAITING_AWAY_CONFIRMATION',confirmation_due_at:'2026-11-05 20:00:00',review_due_at:'2026-11-06T22:00:00+02:00'};
 assert.equal(officialResultNotice(game,policy).deadline,'2026-11-05T20:00:00.000Z');
 assert.equal(officialResultNotice({...game,result_state:'AWAITING_HOME_REVIEW'},policy).deadline,'2026-11-06T20:00:00.000Z');
 assert.equal(officialResultNotice({...game,status:'completed'},policy).waiting,false);
 assert.equal(officialResultNotice({...game,result_state:'ADMIN_REVIEW'},policy).review,true);
 assert.equal(officialResultNotice({...game,result_state:'DISPUTED'},policy).deadline,null);
 assert.equal(officialResultNotice({...game,result_state:'AWAITING_RESULT',result_due_at:'2026-11-04T20:00:00Z'},policy).deadline,null);
});
test('malformed or missing response times do not invent a replacement deadline or extend participation',()=>{
 for(const deadline of [null,undefined,'bad','2026-11-05','2026-02-30T20:00:00Z','2026-11-05T25:00:00Z',{},42]) {
  const result=officialResultNotice({id:'m',result_state:'AWAITING_AWAY_CONFIRMATION',confirmation_due_at:deadline},policy);assert.equal(result.waiting,true);assert.equal(result.deadline,null);
 }
});

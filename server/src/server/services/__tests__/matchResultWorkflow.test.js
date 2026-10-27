const test = require('node:test');
const assert = require('node:assert/strict');

let row, finalized, writes;
const clone = value => JSON.parse(JSON.stringify(value));
const first = {id:'leg1',tournament_id:'cup',type:'quarter_final',tie_id:'tie',round:1,leg:1,home_player_id:'a',away_player_id:'b',home_score:2,away_score:1,status:'completed',result_state:'CONFIRMED'};
const proposal = side => ({home_score:2,away_score:1,decided_on_penalties:1,penalty_winner_side:side,player_stats:[],goal_events:[]});
function reset() {
  row = {id:'leg2',tournament_id:'cup',type:'quarter_final',tie_id:'tie',round:2,leg:2,home_player_id:'b',away_player_id:'a',home_player_name:'Beta',away_player_name:'Alpha',status:'in_progress',result_state:'AWAITING_AWAY_CONFIRMATION',home_submission:JSON.stringify(proposal('away')),away_submission:null,result_home_submitted:1,result_away_submitted:0,result_submit_side:'home',result_history:'[]',stats_processed:0,report_finalized:0};
  finalized=[];writes=[];
}
const query = async (sql, args=[]) => {
  if (sql.startsWith('SELECT * FROM tournaments')) return [{id:'cup',type:'group_stage',participant_type:'player',knockout_legs:2,status:'in_progress'}];
  if (sql.includes('FROM matches WHERE tournament_id')) return [first,clone(row)];
  if (sql.startsWith('SELECT * FROM matches WHERE id')) return [clone(row)];
  if (sql.startsWith('UPDATE matches SET')) {
    const keys=[...sql.split(' WHERE ')[0].matchAll(/`(\w+)` = \?/g)].map(m=>m[1]);
    if (sql.includes('home_submission <=>')) {
      const version=args.slice(keys.length,-1);
      const same=(a,b)=>JSON.stringify(a == null ? null : typeof a === 'string' && /^[\[{]/.test(a) ? JSON.parse(a) : a)===JSON.stringify(b == null ? null : typeof b === 'string' && /^[\[{]/.test(b) ? JSON.parse(b) : b);
      const fields=['home_submission','away_submission','result_state','status','result_history','home_dispute_submission','away_dispute_submission'];
      if (fields.some((key,i)=>!same(row[key],version[i])) || Number(row.stats_processed)===1 || Number(row.report_finalized)===1) return {affectedRows:0};
    }
    keys.forEach((key,i)=>{row[key]=args[i];});writes.push(keys);return {affectedRows:1};
  }
  throw Error(`Unexpected workflow SQL: ${sql}`);
};
function stub(relative,exports) {const id=require.resolve(relative);require.cache[id]={id,filename:id,loaded:true,exports};}
stub('../../db/database',{EXECUTESQL:query,pool:{}});
stub('../messageDeliveryService',{sendActionMessage:async()=>{}});
stub('../matchNotificationService',{notifyMatchSide:async()=>{},resolveMatchSideEmails:async()=>[]});
stub('../tournamentProgressionService',{assertTournamentMatchAction:async()=>{}});
stub('../../functions/legacyFunctions',{processMatchCompletion:async(match,accepted)=>{
  finalized.push(clone(accepted));Object.assign(row,{status:'completed',result_state:'CONFIRMED',stats_processed:1,...accepted});return {data:{status:'completed'}};
}});
const service = require('../matchResultNegotiationService');

test('confirmation uses the stored unequal-leg proposal and preserves its penalty winner',async()=>{
  reset();
  await service.confirmResult(clone(row),{side:'away'},{player_stats:[]});
  assert.equal(finalized.length,1);assert.equal(finalized[0].home_score,2);assert.equal(finalized[0].away_score,1);
  assert.equal(finalized[0].penalty_winner_side,'away');assert.equal(finalized[0].aggregate_home_score,3);
  assert.equal(row.result_state,'CONFIRMED');
});
test('stale confirmation cannot silently approve an amended penalty winner',async()=>{
  reset();const stale=clone(row);row.home_submission=JSON.stringify(proposal('home'));
  await assert.rejects(service.confirmResult(stale,{side:'away'},{}),error=>error.status===409);
  assert.equal(finalized.length,0);assert.equal(row.away_submission,null);
});
test('concurrent confirmations accept one snapshot only; retry cannot mutate the completed result',async()=>{
  reset();const stale=clone(row);
  const results=await Promise.allSettled([service.confirmResult(clone(stale),{side:'away'},{}),service.confirmResult(clone(stale),{side:'away'}, {})]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(results.filter(r=>r.status==='rejected'&&r.reason.status===409).length,1);
  assert.equal(finalized.length,1);
});
test('same-score opposing penalty winner enters correction, then acceptance retains the corrected winner',async()=>{
  reset();
  await service.handleSubmitResult(clone(row),{side:'away'},{...proposal('home')},null);
  assert.equal(row.result_state,'AWAITING_HOME_REVIEW');assert.equal(finalized.length,0);
  assert.equal(JSON.parse(row.away_submission).penalty_winner_side,'home');
  await service.acceptCorrection(clone(row),{side:'home'});
  assert.equal(finalized[0].penalty_winner_side,'home');assert.equal(finalized[0].home_score,2);assert.equal(finalized[0].away_score,1);
});
test('dispute evidence retains the claimed shootout side without finalising or advancing',async()=>{
  reset();
  await service.disputeResult(clone(row),{side:'away'},{...proposal('home'),proof_url:'/uploads/test-proof.png'});
  assert.equal(row.result_state,'DISPUTED');assert.equal(finalized.length,0);
  assert.equal(JSON.parse(row.away_dispute_submission).penalty_winner_side,'home');
});
test('a rejected timeout cannot leave an unresolved tie falsely marked confirmed',async()=>{
  reset();row.confirmation_due_at='2000-01-01T00:00:00Z';row.home_submission=JSON.stringify({...proposal('away'),home_score:3});
  await assert.rejects(service.settleMatchDeadlines(clone(row),new Date('2026-10-27T20:00:00Z')),/already determines/);
  assert.equal(row.status,'in_progress');assert.equal(row.result_state,'AWAITING_AWAY_CONFIRMATION');assert.equal(finalized.length,0);
});
test('the original submitter cannot confirm their own result or amend an acknowledged proposal',async()=>{
  reset();await assert.rejects(service.confirmResult(clone(row),{side:'home'},{}),error=>error.status===403);assert.equal(writes.length,0);
  row.away_submission=JSON.stringify({...proposal('away'),confirmed:true});row.result_away_submitted=1;
  await assert.rejects(service.amendSubmittedResult(clone(row),{side:'home'},proposal('home'),null),error=>error.status===409);assert.equal(writes.length,0);
});
test('a valid timeout preserves the confirmed proposal and aggregate at finalisation',async()=>{
  reset();row.confirmation_due_at='2000-01-01T00:00:00Z';
  await service.settleMatchDeadlines(clone(row),new Date('2026-10-27T20:00:00Z'));
  assert.equal(finalized.length,1);assert.equal(finalized[0].result_state,'AUTO_CONFIRMED_TIMEOUT');assert.equal(finalized[0].penalty_winner_side,'away');assert.equal(finalized[0].aggregate_home_score,3);
});

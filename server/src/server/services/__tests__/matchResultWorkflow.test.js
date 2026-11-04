const test = require('node:test');
const assert = require('node:assert/strict');

let row, finalized, writes, officialPolicy, notifiedSides, transactionQueue = Promise.resolve();
const { assertResultSnapshotCurrent } = require('../../lib/matchResultNegotiation');
const { writeGuardedMatchPatch } = require('../../lib/matchResultWrite');
const clone = value => JSON.parse(JSON.stringify(value));
const first = {id:'leg1',tournament_id:'cup',type:'quarter_final',tie_id:'tie',round:1,leg:1,home_player_id:'a',away_player_id:'b',home_score:2,away_score:1,status:'completed',result_state:'CONFIRMED'};
const proposal = side => ({home_score:2,away_score:1,decided_on_penalties:1,penalty_winner_side:side,player_stats:[],goal_events:[]});
function reset() {
  row = {id:'leg2',tournament_id:'cup',type:'quarter_final',tie_id:'tie',round:2,leg:2,home_player_id:'b',away_player_id:'a',home_player_name:'Beta',away_player_name:'Alpha',status:'in_progress',result_state:'AWAITING_AWAY_CONFIRMATION',home_submission:JSON.stringify(proposal('away')),away_submission:null,result_home_submitted:1,result_away_submitted:0,result_submit_side:'home',result_history:'[]',stats_processed:0,report_finalized:0};
  finalized=[];writes=[];
  officialPolicy = null;
  notifiedSides = [];
}
const query = async (sql, args=[]) => {
  if (sql.startsWith('SELECT * FROM tournaments')) return [{id:'cup',type:'group_stage',participant_type:'player',knockout_legs:2,status:'in_progress'}];
  if (sql.includes('FROM matches WHERE tournament_id')) return [first,clone(row)];
  if (sql.startsWith('SELECT * FROM matches WHERE id')) return [clone(row)];
  if (sql.startsWith('UPDATE matches SET')) {
    const keys=[...sql.split(' WHERE ')[0].matchAll(/`(\w+)` = \?/g)].map(m=>m[1]);
    if (sql.includes('BINARY home_submission <=>')) {
      const version=args.slice(keys.length,-1);
      const same=(a,b)=>JSON.stringify(a == null ? null : typeof a === 'string' && /^[\[{]/.test(a) ? JSON.parse(a) : a)===JSON.stringify(b == null ? null : typeof b === 'string' && /^[\[{]/.test(b) ? JSON.parse(b) : b);
      const fields=require('../../lib/matchResultNegotiation').RESULT_SNAPSHOT_FIELDS;
      if (fields.some((key,i)=>!same(row[key],version[i])) || Number(row.stats_processed)===1 || Number(row.report_finalized)===1) return {affectedRows:0};
    }
    keys.forEach((key,i)=>{row[key]=args[i];});writes.push(keys);return {affectedRows:1};
  }
  throw Error(`Unexpected workflow SQL: ${sql}`);
};
function stub(relative,exports) {const id=require.resolve(relative);require.cache[id]={id,filename:id,loaded:true,exports};}
function transaction(fn) {
  const pending=transactionQueue.then(async()=>{const before=clone(row);try{return await fn(query);}catch(e){row=before;throw e;}});
  transactionQueue=pending.catch(()=>{});return pending;
}
stub('../../db/database',{EXECUTESQL:query,withTransaction:transaction,pool:{}});
stub('../messageDeliveryService',{sendActionMessage:async()=>{}});
stub('../matchNotificationService',{notifyMatchSide:async(_,side)=>{notifiedSides.push(side);},resolveMatchSideEmails:async()=>[]});
stub('../tournamentProgressionService',{assertTournamentMatchAction:async()=>{}});
stub('../officialMatchEligibilityService',{context:async()=>({official:!!officialPolicy,root:{participation_window_snapshot:officialPolicy}}),assertParticipants:async()=>{}});
stub('../../functions/legacyFunctions',{processMatchCompletion:async(match,accepted,secondary,patch)=>transaction(async q=>{
  assertResultSnapshotCurrent(match,row);
  if(patch)await writeGuardedMatchPatch(q,match.id,patch,clone(row));
  finalized.push(clone(accepted));Object.assign(row,{status:'completed',result_state:'CONFIRMED',stats_processed:1,...accepted});return {data:{status:'completed'}};
})});
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

test('new official silence enters Admin review, preserves the 2–2 evidence and cannot finalize or settle twice', async () => {
  for (const side of ['home', 'away']) {
    reset(); officialPolicy = { result_policy_version: 'regional_result_review_v1' };
    row.source_fixture_type = 'regional_league'; row.result_submit_side = side;
    row.home_submission = side === 'home' ? JSON.stringify({home_score:2,away_score:2,proof_url:'/uploads/proof.png'}) : null;
    row.away_submission = side === 'away' ? JSON.stringify({home_score:2,away_score:2,proof_url:'/uploads/proof.png'}) : null;
    row.confirmation_due_at = '2026-11-04T20:00:00Z';
    const proposalBefore = [row.home_submission, row.away_submission];
    await service.settleMatchDeadlines(clone(row), new Date('2026-11-04T19:59:59Z'));
    assert.equal(writes.length, 0);
    await service.settleMatchDeadlines(clone(row), new Date('2026-11-04T20:00:00Z'));
    assert.equal(row.result_state, 'ADMIN_REVIEW'); assert.equal(row.status, 'disputed');
    assert.deepEqual([row.home_submission,row.away_submission], proposalBefore);
    assert.equal(row.stats_processed, 0); assert.equal(row.report_finalized, 0); assert.equal(finalized.length, 0);
    assert.equal(JSON.parse(row.result_history).at(-1).event, 'response_timeout_admin_review');
    const count = writes.length;
    await service.settleMatchDeadlines(clone(row), new Date('2026-11-05T20:00:00Z'));
    assert.equal(writes.length, count);
    await assert.rejects(service.confirmResult(clone(row), {side:side==='home'?'away':'home'}, {}), error => error.status===409);
  }
});

test('new correction timeout never applies the original score and a stale timeout cannot overwrite an amended proposal', async () => {
  reset(); officialPolicy = { result_policy_version: 'regional_result_review_v1' };
  row.source_fixture_type='regional_league'; row.result_state='AWAITING_HOME_REVIEW'; row.review_due_at='2026-11-04T20:00:00Z';
  await service.settleMatchDeadlines(clone(row),new Date('2026-11-04T20:00:00Z'));
  assert.equal(row.result_state,'ADMIN_REVIEW'); assert.equal(finalized.length,0);
  reset(); officialPolicy = { result_policy_version: 'regional_result_review_v1' };
  row.source_fixture_type='regional_league'; row.confirmation_due_at='2026-11-04T20:00:00Z';
  const stale=clone(row); row.home_submission=JSON.stringify({...proposal('away'),home_score:4});
  await assert.rejects(service.settleMatchDeadlines(stale,new Date('2026-11-04T20:00:00Z')),error=>error.code==='RESULT_CHANGED');
  assert.equal(row.result_state,'AWAITING_AWAY_CONFIRMATION'); assert.equal(finalized.length,0);
});

test('new regional amendments publish a 24-hour response deadline instead of the legacy 48-hour deadline', async () => {
  reset(); officialPolicy = { result_policy_version: 'regional_result_review_v1' };
  row.source_fixture_type='regional_league';
  const before=Date.now();
  await service.amendSubmittedResult(clone(row),{side:'home'},{...proposal('away'),proof_url:'/uploads/proof.png'},null);
  const due=Date.parse(row.confirmation_due_at);
  assert.ok(due>=before+24*3600000 && due<=Date.now()+24*3600000);
  assert.equal(finalized.length,0);
});

test('new initial submissions, corrections and counters each capture the 24-hour response term', async () => {
  for(const action of ['initial','correction','counter']) {
    reset();officialPolicy={result_policy_version:'regional_result_review_v1'};
    row.source_fixture_type='regional_league';
    if(action==='initial') {row.result_state='AWAITING_RESULT';row.home_submission=null;row.result_home_submitted=0;}
    if(action==='counter') {row.result_state='AWAITING_HOME_REVIEW';row.away_submission=JSON.stringify(proposal('home'));}
    const before=Date.now(),args={...proposal(action==='correction'?'home':'away'),proof_url:'/uploads/proof.png'};
    if(action==='initial')await service.submitInitialResult(clone(row),{side:'home'},args,null);
    if(action==='correction')await service.proposeCorrection(clone(row),{side:'away'},args);
    if(action==='counter')await service.counterResult(clone(row),{side:'home'},args,null);
    const due=Date.parse(action==='correction'?row.review_due_at:row.confirmation_due_at);
    assert.ok(due>=before+24*3600000 && due<=Date.now()+24*3600000);
    assert.equal(finalized.length,0);
  }
});

function openEitherSide() {
  reset(); officialPolicy={result_policy_version:'regional_result_review_v2'};
  row.source_fixture_type='regional_league';row.result_state='AWAITING_RESULT';row.home_submission=null;row.result_home_submitted=0;
}
test('new away-first proposal records its actual submitter, notifies home and can be confirmed by home only', async () => {
  openEitherSide();
  await service.submitInitialResult(clone(row),{side:'away'},{...proposal('away'),proof_url:'/uploads/proof.png'},null);
  assert.equal(row.result_submit_side,'away');assert.equal(row.result_home_submitted,0);assert.equal(row.result_away_submitted,1);
  assert.equal(row.home_submission,null);assert.equal(JSON.parse(row.away_submission).side,'away');
  assert.deepEqual(notifiedSides,['home']);assert.equal(finalized.length,0);
  await assert.rejects(service.confirmResult(clone(row),{side:'away'},{}),error=>error.status===403);
  await service.confirmResult(clone(row),{side:'home'},{});
  assert.equal(finalized.length,1);assert.equal(finalized[0].home_score,2);assert.equal(finalized[0].away_score,1);
});
test('simultaneous home and away first reports create exactly one proposal; the loser cannot overwrite it', async () => {
  openEitherSide();const before=clone(row),args={...proposal('away'),proof_url:'/uploads/proof.png'};
  const results=await Promise.allSettled(['home','away'].map(side=>service.submitInitialResult(clone(before),{side},args,null)));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(results.filter(r=>r.status==='rejected'&&r.reason.status===409).length,1);
  assert.equal(writes.length,1);assert.equal(Number(row.result_home_submitted)+Number(row.result_away_submitted),1);
  assert.equal(notifiedSides.length,1);assert.equal(finalized.length,0);
});
test('away-first proposal can be corrected by home and accepted by its original away submitter', async () => {
  openEitherSide();
  await service.submitInitialResult(clone(row),{side:'away'},{...proposal('away'),proof_url:'/uploads/proof.png'},null);
  await service.proposeCorrection(clone(row),{side:'home'},proposal('home'));
  assert.equal(row.result_submit_side,'away');assert.deepEqual(notifiedSides,['home','away']);
  await service.acceptCorrection(clone(row),{side:'away'});
  assert.equal(finalized[0].penalty_winner_side,'home');
});
test('first-report permission cannot bypass proof, kickoff, participant identity or an existing proposal; v1 keeps home-first terms', async () => {
  openEitherSide();const args={...proposal('away'),proof_url:'/uploads/proof.png'};
  await assert.rejects(service.submitInitialResult(clone(row),{side:'spectator'},args,null),error=>error.status===403);
  await assert.rejects(service.submitInitialResult({...clone(row),status:'scheduled'},{side:'away'},args,null),error=>error.code==='MATCH_NOT_STARTED');
  await assert.rejects(service.submitInitialResult(clone(row),{side:'away'},proposal('away'),null),error=>error.code==='PROOF_REQUIRED');
  await assert.rejects(service.submitInitialResult({...clone(row),away_submission:JSON.stringify(proposal('away'))},{side:'home'},args,null),error=>error.code==='RESULT_ALREADY_SUBMITTED');
  officialPolicy={result_policy_version:'regional_result_review_v1'};
  await assert.rejects(service.submitInitialResult(clone(row),{side:'away'},{...args,allowEitherInitial:true},null),error=>error.code==='AWAITING_HOME_SUBMISSION');
  assert.equal(writes.length,0);
});

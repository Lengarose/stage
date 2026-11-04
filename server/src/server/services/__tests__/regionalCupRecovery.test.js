'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {RegionalCupRecoveryModel,jobId}=require('../../models/regionalCupRecoveryModel');
const {createService}=require('../regionalCupRecoveryService');
function fixture() {
  let now=new Date('2026-11-03T20:00:00Z'),serial=0,queue=Promise.resolve();
  const jobs=new Map(),cups=[{id:'cup',status:'running',play_enabled:true}],calls=[],sqls=[];
  const query=async(sql,v=[])=>{
    sqls.push(sql);
    if(sql.startsWith('SELECT e.id'))return cups.filter(c=>(c.status==='running' || c.status==='completed' && jobs.get(jobId(c.id))?.status==='running') && c.play_enabled && !c.edition_invalidated && (!jobs.get(jobId(c.id))?.next_attempt_at || jobs.get(jobId(c.id)).next_attempt_at<=v[0])).map(c=>({id:c.id}));
    if(sql.startsWith('INSERT IGNORE')){if(!jobs.has(v[0]))jobs.set(v[0],JSON.parse(v[1]));return {};}
    if(sql.startsWith('SELECT * FROM league_entities')){const j=jobs.get(v[0]);return j?[{id:j.id,data_json:JSON.stringify(j)}]:[];}
    if(sql.startsWith('UPDATE league_entities')){jobs.set(v[2],JSON.parse(v[0]));return {};}
    throw Error(`Unexpected test SQL: ${sql}`);
  };
  const transaction=fn=>{const result=queue.then(()=>fn(query));queue=result.catch(()=>{});return result;};
  const options={query,transaction,clock:()=>now,attemptId:()=>`attempt-${++serial}`,logger:{error:()=>{}},reconcile:async id=>{calls.push(id);return {status:'waiting_results'};}};
  return {query,transaction,jobs,cups,calls,sqls,options,clock:()=>now,advance:ms=>{now=new Date(now.getTime()+ms);}};
}
test('the Cup recovery worker only reconciles activated running Cups, with durable waiting checkpoints',async()=>{
  const f=fixture();f.cups.push({id:'draft',status:'draft',play_enabled:false},{id:'reset',status:'running',play_enabled:true,edition_invalidated:true});
  const worker=createService(f.options);await worker.tick();assert.deepEqual(f.calls,['cup']);
  assert.equal(f.jobs.get(jobId('cup')).status,'waiting_results');assert.equal(f.jobs.get(jobId('cup')).lease_until,null);
  await worker.tick();assert.equal(f.calls.length,1);f.advance(60000);await worker.tick();assert.equal(f.calls.length,2);
  assert.ok(f.sqls.every(s=>!/DELETE|stc_transactions|trophy_awards/.test(s)));
});
test('two workers share one stored lease; a worker also rejects overlapping local ticks',async()=>{
  const f=fixture();let release;const stalled=new Promise(resolve=>{release=resolve;});
  const first=createService({...f.options,reconcile:async id=>{f.calls.push(id);await stalled;return {status:'running',current_round:2};}}),second=createService(f.options);
  const running=first.tick();while(!f.calls.length)await new Promise(resolve=>setImmediate(resolve));
  assert.equal((await first.tick()).skipped,true);await second.tick();assert.equal(f.calls.length,1);
  release();await running;assert.equal(f.jobs.get(jobId('cup')).status,'progressed');assert.equal(f.jobs.get(jobId('cup')).current_round,2);
});
test('server restart recovers an expired lease and an old worker cannot overwrite its successor',async()=>{
  const f=fixture(),model=new RegionalCupRecoveryModel(),old=await f.transaction(q=>model.claim('cup',f.clock().toISOString(),new Date(f.clock().getTime()+120000).toISOString(),'crashed',q));
  await createService(f.options).tick();assert.equal(f.calls.length,0);f.advance(120001);
  await createService(f.options).tick();assert.equal(f.calls.length,1);assert.equal(f.jobs.get(old.id).attempts,2);
  assert.equal(await f.transaction(q=>model.finish(old,{status:'completed'},q)),false);assert.equal(f.jobs.get(old.id).status,'waiting_results');
});
test('a sporting/calendar blocker is persisted for review and does not trigger rapid retries or a redraw',async()=>{
  const f=fixture();let attempts=0;
  const worker=createService({...f.options,reconcile:async()=>{attempts++;throw Object.assign(Error('Cup calendar needs review'),{status:409});}});
  await worker.tick();assert.equal(f.jobs.get(jobId('cup')).status,'review_required');assert.equal(f.jobs.get(jobId('cup')).last_error,'Cup calendar needs review');
  f.advance(60000);await worker.tick();assert.equal(attempts,1);f.advance(900000);await worker.tick();assert.equal(attempts,2);
});
test('completion is checkpointed and unknown storage exceptions do not leak SQL details',async()=>{
  const f=fixture();let mode='complete';const worker=createService({...f.options,reconcile:async()=>{if(mode==='fail')throw Error('SQL private connection details');return {status:'completed'};}});
  await worker.tick();assert.equal(f.jobs.get(jobId('cup')).status,'completed');mode='fail';f.advance(60000);await worker.tick();assert.doesNotMatch(f.jobs.get(jobId('cup')).last_error,/SQL|private/);
});
test('a failed checkpoint leaves a retryable lease and does not block another Cup',async()=>{
  const f=fixture();f.cups.push({id:'cup2',status:'running',play_enabled:true});
  const model=new RegionalCupRecoveryModel(),finish=model.finish.bind(model);model.finish=async(job,result,q)=>{if(job.source_id==='cup')throw Error('Storage failed');return finish(job,result,q);};
  const result=await createService({...f.options,model}).tick();assert.deepEqual(result.results.map(r=>r.status),['checkpoint_failed','waiting_results']);assert.equal(f.jobs.get(jobId('cup')).status,'running');
});
test('candidate query scopes and limits the durable recovery queue without activating drafts',async()=>{
  const model=new RegionalCupRecoveryModel();let sql;
  await model.candidates('2026-11-03T20:00:00.000Z',async text=>{sql=text;return [];});
  assert.match(sql,/e.status='running'/);assert.match(sql,/play_enabled/);assert.match(sql,/edition_invalidated/);assert.match(sql,/next_attempt_at/);assert.match(sql,/LIMIT 50/);
});
test('a crash after the final can finish its expired checkpoint even though the Cup is already completed',async()=>{
  const f=fixture(),model=new RegionalCupRecoveryModel();model.finish=async()=>{throw Error('Process stopped after final');};
  await createService({...f.options,model,reconcile:async()=>{f.cups[0].status='completed';return {status:'completed'};}}).tick();
  assert.equal(f.jobs.get(jobId('cup')).status,'running');f.advance(120001);
  await createService({...f.options,reconcile:async()=>({status:'completed',already_applied:true})}).tick();
  assert.equal(f.jobs.get(jobId('cup')).status,'completed');
});

'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createService,project}=require('../regionalCycleRecoveryService');
const {RegionalCycleRecoveryModel}=require('../../models/regionalCycleRecoveryModel');
const {jobId,RegionalProgressModel}=require('../../models/regionalProgressModel');
function fixture() {
  const now=new Date('2026-11-03T20:00:00Z'),jobs=new Map(),calls=[];let queue=Promise.resolve();
  const query=async(sql,v=[])=>{
    if(sql.startsWith('SELECT e.id'))return [{id:'cycle'}];
    if(sql.startsWith('INSERT IGNORE')){if(!jobs.has(v[0]))jobs.set(v[0],JSON.parse(v[1]));return {};}
    if(sql.startsWith('SELECT * FROM league_entities')){const job=jobs.get(v[0]);return job?[{data_json:JSON.stringify(job)}]:[];}
    if(sql.startsWith('UPDATE league_entities')){jobs.set(v[2],JSON.parse(v[0]));return {};}
    throw Error(`Unexpected SQL: ${sql}`);
  };
  const transaction=fn=>{const p=queue.then(()=>fn(query));queue=p.catch(()=>{});return p;};
  return {jobs,calls,options:{query,transaction,clock:()=>now,attemptId:()=>String(Math.random()),logger:{error:()=>{}}}};
}
const plan=patch=>({fixtures:[],pending:[],...patch});
test('cycle progress maps pending play, final sporting rights and completed allocation without applying groups',()=>{
  assert.equal(project({cycle:{status:'running',plan:plan({pending:['final']})}}).status,'waiting_results');
  assert.equal(project({cycle:{status:'ready',plan:plan({ready:true})}}).status,'ready_for_allocation');
  assert.equal(project({cycle:{status:'allocated'}}).status,'completed');
  assert.throws(()=>project({cycle:{status:'review',plan:plan({blockers:['Source tie']})}}),/unresolved blockers/);
  assert.throws(()=>project({cycle:{status:'ready',plan:plan()}}),/incomplete/);
  assert.throws(()=>project({cycle:{status:'reset'}}),/review/);
});
test('recovery uses the trusted cycle progress action, never Admin allocation or publication',async()=>{
  const f=fixture(),path=require.resolve('../regionalCycleService'),saved=require.cache[path];
  require.cache[path]={exports:{progress:async(...args)=>{f.calls.push(args);return {cycle:{status:'ready',plan:plan({ready:true}),seed:'private seed'}};},allocate:()=>{throw Error('Must not allocate');}}};
  try {
    const worker=createService(f.options);await worker.tick();await worker.tick();assert.deepEqual(f.calls,[['cycle']]);
    const job=f.jobs.get(jobId('cycle','cycle'));assert.equal(job.status,'ready_for_allocation');assert.doesNotMatch(JSON.stringify(job),/private seed/);
  }finally{if(saved)require.cache[path]=saved;else delete require.cache[path];}
});
test('source changes and unresolved decisions preserve a review checkpoint instead of advancing rights',async()=>{
  const f=fixture();let writes=0;
  const worker=createService({...f.options,reconcile:async()=>{writes++;throw Object.assign(Error('Regional source data changed'),{status:409});}});
  await worker.tick();await worker.tick();assert.equal(writes,1);assert.equal(f.jobs.get(jobId('cycle','cycle')).status,'review_required');
  assert.match(f.jobs.get(jobId('cycle','cycle')).last_error,/source data changed/);
});
test('Cup and cycle jobs have independent durable identities and reject unsupported storage kinds',()=>{
  assert.notEqual(jobId('cycle','same'),jobId('cup','same'));assert.throws(()=>new RegionalProgressModel('tournament'),/Unsupported/);
});
test('cycle candidate query excludes closed sources except finishing an interrupted active checkpoint',async()=>{
  let sql;await new RegionalCycleRecoveryModel().candidates('2026-11-03T20:00:00Z',async text=>{sql=text;return [];});
  assert.match(sql,/entity_type='regional_cycle'/);assert.match(sql,/e.status IN \('running','review'\)/);assert.match(sql,/e.status IN \('ready','allocated'\) AND j.status='running'/);assert.match(sql,/edition_invalidated/);assert.match(sql,/LIMIT 50/);
  assert.match(sql,/automatic_allocation_policy_version/);assert.match(sql,/regional_auto_allocation_v1/);
});

test('new ready cycles use only the internal allocation follow-up and persist completion without private rights or seeds',async()=>{
  const f=fixture(),path=require.resolve('../regionalCycleService'),saved=require.cache[path];
  require.cache[path]={exports:{progress:async id=>({cycle:{id,status:'ready',automatic_allocation_policy_version:'regional_auto_allocation_v1',plan:plan({ready:true})}}),reconcileAllocation:async id=>{f.calls.push(id);return {cycle:{id,status:'allocated',seed:'private',plan:plan({ready:true})}};},allocate:()=>{throw Error('Public Admin action must not be used');}}};
  try {await createService(f.options).tick();assert.deepEqual(f.calls,['cycle']);const job=f.jobs.get(jobId('cycle','cycle'));assert.equal(job.status,'completed');assert.doesNotMatch(JSON.stringify(job),/private/);}
  finally {require.cache[path]=saved;}
});

test('allocation conflicts remain visible in ready cycles and back off instead of repeatedly applying groups',async()=>{
  const f=fixture(),path=require.resolve('../regionalCycleService'),saved=require.cache[path];
  require.cache[path]={exports:{progress:async()=>({cycle:{status:'ready',automatic_allocation_policy_version:'regional_auto_allocation_v1',plan:plan({ready:true})}}),reconcileAllocation:async()=>{f.calls.push('allocate');throw Object.assign(Error('Target group already has activity'),{status:409});}}};
  try {const worker=createService(f.options);await worker.tick();await worker.tick();assert.deepEqual(f.calls,['allocate']);assert.equal(f.jobs.get(jobId('cycle','cycle')).status,'review_required');}
  finally {require.cache[path]=saved;}
});
test('transition recovery connects confirmed sporting progression to the internal final planner',async()=>{
  const f=fixture(),paths=['../regionalCycleService','../regionalPromotionCalendarService'].map(require.resolve),saved=paths.map(p=>require.cache[p]);
  require.cache[paths[0]]={exports:{progress:async id=>{f.calls.push(`progress:${id}`);return {cycle:{status:'running',input:{mode:'transition'},plan:plan({fixtures:[{ref:'promotion:D2A:final'}],pending:[{ref:'promotion:D2A:final'}]})}};}}};
  require.cache[paths[1]]={exports:{reconcileFinal:async id=>{f.calls.push(`calendar:${id}`);return {status:'published',private_record:{seed:'secret'}};}}};
  try {
    await createService(f.options).tick();assert.deepEqual(f.calls,['progress:cycle','calendar:cycle']);
    const job=f.jobs.get(jobId('cycle','cycle'));assert.equal(job.promotion_calendar_status,'published');assert.doesNotMatch(JSON.stringify(job),/secret|private_record/);
  }finally{paths.forEach((p,i)=>{if(saved[i])require.cache[p]=saved[i];else delete require.cache[p];});}
});
test('Admin overview distinguishes ready allocation from cycle recovery failures and omits invalidated jobs',()=>{
  const {report}=require('../regionalOperationsService');
  const row=(entity_type,id,data)=>({entity_type,id,status:data.status,data_json:JSON.stringify(data)});
  const ready=row('regional_cycle','cycle',{status:'ready',plan:plan({ready:true})});assert.equal(report([ready],[]).issues[0].code,'cycle_allocation');
  const source=row('regional_cycle','cycle',{status:'review'}),job=row('regional_cycle_progress','job',{status:'review_required',source_id:'cycle',last_error:'private source details'});
  const result=report([source,job],[]);assert.equal(result.issues[0].code,'cycle_recovery_review');assert.doesNotMatch(JSON.stringify(result),/private source details/);
  const failedReady=row('regional_cycle','cycle',{status:'ready',automatic_allocation_policy_version:'regional_auto_allocation_v1',plan:plan({ready:true})});assert.ok(report([failedReady,job],[]).issues.some(i=>i.code==='cycle_recovery_review'));
  const unsupported=row('regional_cycle','cycle',{status:'ready',automatic_allocation_policy_version:'unknown',plan:plan({ready:true})});assert.equal(report([unsupported],[]).issues[0].code,'cycle_allocation_policy');
  assert.equal(report([row('regional_cycle','cycle',{status:'reset',edition_invalidated:true}),job],[]).issues.length,0);
});

test('new captured transitions connect to automatic semifinals as well as the existing final follow-up',async()=>{
 const f=fixture(),paths=['../regionalCycleService','../regionalPromotionCalendarService'].map(require.resolve),saved=paths.map(p=>require.cache[p]);
 require.cache[paths[0]]={exports:{progress:async()=>({cycle:{input:{mode:'transition'},status:'running',participation_window_snapshot:{status:'published',policy_version:'regional_registration_v1',result_policy_version:'regional_result_review_v2',season_orchestration_policy_version:'regional_season_orchestration_v1'},plan:plan({fixtures:[{ref:'promotion:D2A:sf:2-5'}],pending:[{ref:'promotion:D2A:sf:2-5'}]})}})}};
 require.cache[paths[1]]={exports:{reconcilePromotion:async id=>{f.calls.push(id);return {status:'waiting_semifinals'};},reconcileFinal:async()=>{throw Error('Legacy-only entry must not run');}}};
 try{await createService(f.options).tick();assert.deepEqual(f.calls,['cycle']);assert.equal(f.jobs.get(jobId('cycle','cycle')).promotion_calendar_status,'waiting_semifinals');}
 finally{paths.forEach((p,i)=>{require.cache[p]=saved[i];});}
});

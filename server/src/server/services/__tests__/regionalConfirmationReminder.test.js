'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createService:service}=require('../regionalConfirmationReminderService');
const {fixture}=require('./helpers/confirmationProgress');
const createService=options=>service({...fixture(),...options});
const eligible={id:'w',phase:'confirmation',policy_version:'regional_registration_v1',confirmation_notice_policy_version:'regional_confirmation_notice_v1'};
function durableFixture() {
  const f=fixture();let now=new Date('2026-11-04T12:00:00Z'),serial=0,open=true;
  const options={...f,clock:()=>now,attemptId:()=>`try-${++serial}`,windows:async()=>({windows:open?[eligible]:[]}),logger:{error:()=>{}},model:{reminderCandidates:async(_cursor,time,_q,ids)=>ids.length && (!f.job('a')?.next_attempt_at || f.job('a').next_attempt_at<=time)?[{id:'a'}]:[]}};
  return {...f,options,advance:ms=>{now=new Date(now.getTime()+ms);},close:()=>{open=false;}};
}
test('failed notices persist sanitized review with a fifteen-minute pause across worker recreation',async()=>{
  const f=durableFixture();let calls=0;
  const options={...f.options,remind:async()=>{calls++;throw Object.assign(Error('SQL private address'),{status:409});}};
  await service(options).tick();assert.equal(f.job('a').status,'review_required');assert.doesNotMatch(f.job('a').last_error,/SQL|private address/);
  f.advance(60000);await service(options).tick();assert.equal(calls,1);
  f.advance(840000);await service({...options,remind:async()=>{calls++;return {status:'muted'};}}).tick();
  assert.equal(calls,2);assert.equal(f.job('a').status,'completed');assert.equal(f.job('a').last_error,null);assert.equal(f.job('a').notice_status,'muted');
});
test('stored leases protect two workers and expired attempts cannot overwrite the successor',async()=>{
  const f=durableFixture(),{RegionalProgressModel}=require('../../models/regionalProgressModel');
  const progress=new RegionalProgressModel('confirmation_notice');let release,calls=0;
  const first=service({...f.options,remind:async()=>{calls++;await new Promise(resolve=>{release=resolve;});return {status:'stored'};}});
  const pending=first.tick();while(!release)await new Promise(resolve=>setImmediate(resolve));
  const old=structuredClone(f.job('a'));await service({...f.options,remind:async()=>{calls++;return {status:'stored'};}}).tick();assert.equal(calls,1);
  f.advance(120001);await service({...f.options,remind:async()=>({status:'already_checked'})}).tick();
  assert.equal(f.job('a').attempts,2);release();await pending;assert.equal(f.job('a').notice_status,'already_checked');
  assert.equal(await f.transaction(q=>progress.finish(old,{status:'review_required'},q)),false);
});
test('checkpoint storage failure leaves a recoverable lease; closing the window prevents late retry',async()=>{
  const f=durableFixture(),{RegionalProgressModel}=require('../../models/regionalProgressModel'),progress=new RegionalProgressModel('confirmation_notice');let calls=0;
  progress.finish=async()=>{throw Error('Storage failed');};
  await service({...f.options,progress,remind:async()=>{calls++;return {status:'stored'};}}).tick();assert.equal(f.job('a').status,'running');
  f.advance(120001);f.close();await service({...f.options,remind:async()=>{calls++;return {status:'stored'};}}).tick();assert.equal(calls,1);
});
test('worker uses current eligible windows, continues after one failure and does not expose contact or storage details',async()=>{
  const calls=[],logs=[];
  const worker=createService({windows:async()=>({windows:[eligible,{...eligible,id:'old',phase:'closed'}]}),model:{reminderCandidates:async(_cursor,_now,_q,ids)=>{assert.deepEqual(ids,['w']);return [{id:'failed'},{id:'muted'},{id:'stored'}];}},remind:async id=>{calls.push(id);if(id==='failed')throw Error('private storage details');return {status:id};},logger:{error:(...args)=>logs.push(args)}});
  assert.deepEqual(await worker.tick(),{stored:1,muted:1});assert.deepEqual(calls,['failed','muted','stored']);assert.doesNotMatch(JSON.stringify(logs),/private storage/);
});
test('bounded cursor scans progress past failed candidates, wrap for retry and skip overlapping ticks',async()=>{
  let release,block=true;const cursors=[];
  const worker=createService({windows:async()=>({windows:[eligible]}),model:{reminderCandidates:async cursor=>{cursors.push(cursor);if(block)await new Promise(resolve=>{release=resolve;});return cursors.length===1?Array.from({length:80},(_,i)=>({id:String(i).padStart(3,'0')})):[];}},remind:async()=>({status:'already_checked'})});
  const first=worker.tick();while(!release)await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(await worker.tick(),{skipped:true});block=false;release();await first;await worker.tick();await worker.tick();assert.deepEqual(cursors,['','079','']);
});
test('failed window reads are retried; candidate SQL is bounded and excludes acknowledged or out-of-window registrations',async()=>{
  const logs=[],worker=createService({windows:async()=>{throw Error('Storage unavailable');},logger:{error:(...args)=>logs.push(args)}});assert.equal((await worker.tick()).failed,true);assert.equal(logs.length,1);
  const {RegionalRegistrationModel}=require('../../models/regionalRegistrationModel'),model=new RegionalRegistrationModel();let sql,args;
  const q=async(s,a)=>{sql=s;args=a;return [];};assert.deepEqual(await model.reminderCandidates('','now',q,[]),[]);assert.equal(sql,undefined);
  await model.reminderCandidates('cursor','2026-11-04T12:00:00.000Z',q,['w']);assert.match(sql,/LIMIT 80/);assert.match(sql,/r.status='pending'/);assert.match(sql,/confirmation_notice.status/);assert.match(sql,/confirmation_closes_at/);assert.match(sql,/w.id IN \(\?\)/);assert.match(sql,/regional_confirmation_notice_progress/);assert.match(sql,/next_attempt_at/);assert.deepEqual(args,['cursor','w',...Array(3).fill(JSON.stringify('2026-11-04T12:00:00.000Z'))]);
});

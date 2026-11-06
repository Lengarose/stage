'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createService,createReconciler,project}=require('../regionalSeasonOrchestrationService');
const {RegionalSeasonProgressModel}=require('../../models/regionalSeasonProgressModel');
const {jobId}=require('../../models/regionalProgressModel');
test('season handoff follows canonical preparation, sporting recovery, group draws and explicit calendar',async()=>{
 const calls=[],cycle={id:'cycle',status:'running'};
 const reconcile=createReconciler({prepare:async id=>{calls.push(['prepare',id]);return {cycle};},progress:async id=>{calls.push(['progress',id]);return {cycle:{id,status:'allocated',allocated_groups:[{id:'D1A'},{id:'D2A'}],participation_window_snapshot:{league_start_monday:'2026-12-21'}}};},draw:async(...args)=>calls.push(['draw',...args]),calendar:async id=>{calls.push(['calendar',id]);return {id:'calendar',status:'published'};}});
 assert.equal(project(await reconcile('window')).status,'completed');assert.deepEqual(calls,[['prepare','window'],['progress','cycle'],['draw','D1A','cycle'],['draw','D2A','cycle'],['calendar','cycle']]);
});
test('pending matches never trigger group draws, and missing dates never get an invented calendar',async()=>{
 let draws=0,calendars=0;
 const base={prepare:async()=>({cycle:{id:'c',status:'running'}}),progress:async()=>({cycle:{id:'c',status:'running'}}),draw:async()=>{draws++;},calendar:async()=>{calendars++;return {status:'awaiting_date'};}};
 assert.equal((await createReconciler(base)('w')).stage,'waiting_pathway_results');assert.equal(draws,0);
 base.prepare=async()=>({cycle:{id:'c',status:'allocated',allocated_groups:[{id:'group'}]}});
 assert.equal((await createReconciler(base)('w')).stage,'calendar_date_required');assert.equal(draws,1);assert.equal(calendars,1);
});
test('a failed group draw stops calendar publication and candidate reads require explicit new-window capture',async()=>{
 let published=0;
 const reconcile=createReconciler({prepare:async()=>({cycle:{id:'c',status:'allocated',allocated_groups:[{id:'g'}],participation_window_snapshot:{league_start_monday:'2026-12-21'}}}),draw:async()=>{throw Error('source changed');},calendar:async()=>{published++;}});
 await assert.rejects(reconcile('w'),/source changed/);assert.equal(published,0);
 let sql;await new RegionalSeasonProgressModel().candidates('2026-12-01T00:00:00Z',async text=>{sql=text;return [];});assert.match(sql,/regional_season_orchestration_v1/);assert.match(sql,/confirmation_closes_at/);assert.match(sql,/LIMIT 50/);assert.notEqual(jobId('season','same'),jobId('cycle','same'));
});
test('the existing durable worker checkpoints season preparation, retries and private-data-free status',async()=>{
 const jobs=new Map(),now=new Date('2026-12-01T00:00:00Z');
 const query=async(sql,v=[])=>{
  if(sql.startsWith('SELECT w.id'))return [{id:'window'}];
  if(sql.startsWith('INSERT IGNORE')){if(!jobs.has(v[0]))jobs.set(v[0],JSON.parse(v[1]));return {};}
  if(sql.startsWith('SELECT *'))return jobs.has(v[0])?[{data_json:JSON.stringify(jobs.get(v[0]))}]:[];
  if(sql.startsWith('UPDATE')){jobs.set(v[2],JSON.parse(v[0]));return {};}
  throw Error(sql);
 };
 let calls=0;
 const worker=createService({query,transaction:fn=>fn(query),clock:()=>now,attemptId:()=>String(++calls),logger:{error(){}},reconcile:async()=>({stage:'league_calendar_published',cycle_id:'cycle',calendar_id:'calendar',seed:'must not leak'})});
 await worker.tick();await worker.tick();assert.equal(calls,2);const job=jobs.get(jobId('season','window'));assert.equal(job.status,'completed');assert.equal(job.cycle_id,'cycle');assert.doesNotMatch(JSON.stringify(job),/must not leak/);
});


test('accepted Cup inclusion connects first-calendar publication to automatic Cup preparation and activation',async()=>{
 let calls=[];
 const run=createReconciler({prepare:async()=>({cycle:{id:'cycle',status:'allocated',allocated_groups:[{id:'group'}],participation_window_snapshot:{league_start_monday:'2026-12-21',cup_policy_version:'regional_cup_v1'}}}),draw:async()=>{},calendar:async()=>({id:'calendar',status:'published'}),cup:async id=>{calls.push(id);return {status:'running',edition_id:'cup'};}});
 assert.equal((await run('w')).cup_id,'cup');assert.deepEqual(calls,['calendar']);
});


test('a configured recurring edition is published before Cup exceptions can block that independent next-season work',async()=>{
 const calls=[];const reconcile=createReconciler({prepare:async()=>({cycle:{id:'c',status:'allocated',allocated_groups:[{id:'g'}],participation_window_snapshot:{league_start_monday:'2026-12-21',recurring_schedule_policy_version:'regional_recurring_schedule_v1',cup_policy_version:'regional_cup_v1'}}}),draw:async()=>{},calendar:async()=>({id:'calendar',status:'published',start_monday:'2026-12-21'}),nextWindow:async(id,monday)=>{calls.push([id,monday]);return {window:{id:'next'}};},cup:async()=>{throw Object.assign(Error('Assign a trophy'),{status:409});}});
 await assert.rejects(reconcile('w'),/Regional Cup: Assign a trophy/);assert.deepEqual(calls,[['w','2026-12-21']]);
});


test('a confirmed next-season field waits normally for unfinished source matches without preparing a premature cycle',async()=>{
 let called=false;const run=createReconciler({prepare:async()=>({waiting_source_results:true}),progress:async()=>{called=true;},draw:async()=>{called=true;}});
 const result=project(await run('next-window'));assert.equal(result.stage,'waiting_source_results');assert.equal(result.status,'waiting_results');assert.equal(result.cycle_id,null);assert.equal(called,false);
});

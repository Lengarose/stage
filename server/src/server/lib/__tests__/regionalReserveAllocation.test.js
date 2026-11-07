'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const sporting=require('../regionalStructure'),{resolve}=require('../regionalReserveAllocation');
function fixture(count=40){
 const groups=sporting.structure(count).groups.map((g,i)=>({...g,final:true,ranked_club_ids:Array.from({length:20},(_,j)=>`${g.ref}-${j+1}`)}));
 const seed='stored-reserve-draw-seed',results=[];
 let plan=sporting.transition(count,count,groups,[],seed,results);
 while(!plan.ready){for(const f of plan.pending){if(!results.some(r=>r.ref===f.ref))results.push({ref:f.ref,home:f.home,away:f.away,status:'completed',confirmed:true,home_score:1,away_score:0});}plan=sporting.transition(count,count,groups,[],seed,results);}
 const missing=plan.rights.find(r=>r.division===1).club_id;
 const confirmed=plan.rights.filter(r=>r.club_id!==missing).map(r=>r.club_id).concat('replacement');
 return {plan,options:{count,confirmed,willing:confirmed,seed,results,rankings:groups,replacements:['replacement']},missing};
}
test('a D1 vacancy promotes the losing D2 finalist before other positions and fills the lower vacancy with the confirmed entrant',()=>{
 const {plan,options,missing}=fixture();const next=resolve(plan,options);
 assert.deepEqual(next.reserve_allocation.promoted,['D2A-3']);assert.equal(next.rights.find(r=>r.club_id==='replacement').division,2);assert.equal(next.rights.some(r=>r.club_id===missing),false);assert.equal(next.reserve_allocation.removed_rights[0].club_id,missing);assert.equal(next.groups.length,2);assert.ok(next.groups.every(g=>g.club_ids.length===20));assert.equal(new Set(next.groups.flatMap(g=>g.club_ids)).size,40);
});
test('equivalent finalists across groups use the saved draw, not raw points, and a retry preserves allocation',()=>{
 const {plan,options}=fixture(60),first=resolve(plan,options);assert.ok(['D2A-3','D2B-3'].includes(first.reserve_allocation.promoted[0]));
 options.rankings.forEach((g,i)=>{g.points=i?999:0;g.gd=i?1000:0;});assert.deepEqual(resolve(plan,options),first);
});
test('no reserve willingness invents no promotion and pending playoffs cannot allocate vacancies',()=>{
 const {plan,options}=fixture();assert.throws(()=>resolve(plan,{...options,willing:[]}),/Not enough/);
 const pending={ready:false,pending:[{ref:'final'}],fixtures:[]};assert.equal(resolve(pending,options),pending);
});

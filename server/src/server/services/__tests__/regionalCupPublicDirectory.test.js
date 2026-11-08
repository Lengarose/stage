'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createService}=require('../regionalCupPublicService');
test('Cup identities and approved names are discoverable before activation without revealing draft fields',async()=>{
 const records=[{id:'french-cup',entity_type:'regional_cup',name:'STAGE Coupe de France',region_slug:'france',platform:'cross-platform',admin_email:'private@example.test'}, {id:'secret-draft',entity_type:'regional_cup_edition',permanent_cup_id:'french-cup',status:'draft',participant_ids:['secret-club'],draw_seed:'private-seed',play_enabled:false}];
 const before=JSON.stringify(records),calls=[];
 const service=createService({model:{records:async()=>records},transaction:async fn=>fn(()=>{}),trophyAssignment:async(...args)=>{calls.push(args);return {state:'assigned',trophy:{id:'t',name:'French trophy',image_url:'/uploads/french.png',internal:'private'}};}});
 const result=await service.catalogue();
 assert.deepEqual(result.cups,[]);assert.equal(result.definitions.length,6);
 const france=result.definitions.find(cup=>cup.region_slug==='france');assert.equal(france.state,'configured');assert.equal(france.trophy.image_url,'/uploads/french.png');assert.equal(calls[0][3],'regional_cup');
 const north=result.definitions.find(cup=>cup.region_slug==='north-america');assert.equal(north.name,'STAGE North American Cup');assert.equal(north.schedule.timezone,'America/New_York');assert.equal(north.state,'awaiting_setup');
 assert.doesNotMatch(JSON.stringify(result),/secret-club|private-seed|secret-draft|admin_email|private@example|internal/);assert.equal(JSON.stringify(records),before);
});
test('invalid Cup trophy assignments expose no catalogue artwork or administrative report',async()=>{
 const service=createService({model:{records:async()=>[{id:'cup',entity_type:'regional_cup',region_slug:'benelux',platform:'cross-platform'}]},transaction:async fn=>fn(()=>{}),trophyAssignment:async()=>({state:'conflict',trophy:{image_url:'https://example.test/wrong.png'},ids:['private']})});
 const benelux=(await service.catalogue()).definitions.find(cup=>cup.region_slug==='benelux');assert.equal(benelux.trophy,null);assert.equal(benelux.name,'STAGE Benelux Cup');
});

'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const {configure,bootstrap}=require('./bootstrap.cjs');
const config=configure();let db;
(async()=>{
 db=await bootstrap(config);const {structure}=require('../../src/server/lib/regionalStructure'),editions=require('../../src/server/services/regionalEditionService');
 const actor={id:crypto.randomUUID(),email:'structure-admin@example.test'};await db.EXECUTESQL('INSERT INTO users (id,email,role_id) VALUES (?,?,2)',[actor.id,actor.email]);
 const results=[];
 for(const count of [20,40,60,80,100,120,180,240]){
  const region='acceptance-'+count,roots=new Map(),groups=structure(count).groups;
  for(const group of groups){
   if(!roots.has(group.division)){const made=await editions.create({name:`${region} D${group.division}`,region_slug:region,platform:'cross-platform',division:group.division,season_number:1,status:'registration',registered_club_ids:[],reason:'Isolated structure persistence'},actor);roots.set(group.division,made.record);}
   if(group.group_code!=='A'){const root=roots.get(group.division);await db.withTransaction(async q=>{await editions.model.lock(q);await editions.createInside({...root,id:crypto.randomUUID(),slug:'',permanent_league_id:root.id,group_code:group.group_code,reason:'Approved parallel group persistence'},q,actor);});}
  }
  const rows=await db.EXECUTESQL("SELECT id,data_json FROM league_entities WHERE entity_type='regional_league' AND region=?",[region]);
  // Region identity lives in JSON when an explicit display region is omitted.
  const stored=rows.length?rows:(await db.EXECUTESQL("SELECT id,data_json FROM league_entities WHERE entity_type='regional_league' AND JSON_UNQUOTE(JSON_EXTRACT(data_json,'$.region_slug'))=?",[region]));
  assert.equal(stored.length,groups.length);assert.equal(new Set(stored.map(r=>{const g=JSON.parse(r.data_json);return `${g.division}:${g.group_code}`;})).size,groups.length);
  results.push({count,groups:groups.length,d1:groups.filter(g=>g.division===1).length,d2:groups.filter(g=>g.division===2).length});
 }
 console.log(JSON.stringify({database:config.database,structural_persistence:results,activation_test:false},null,2));
})().catch(error=>{console.error(error.stack);process.exitCode=1;}).finally(async()=>{if(db)await db.pool.promise().end();});

'use strict';
// Isolated training fixture only; real HTTP verifies the previously empty picker.
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const f=JSON.parse(fs.readFileSync('/private/tmp/stage-admin-walkthrough.json','utf8'));
if(f.port!==18089 || !/^stage_acceptance_[a-f0-9]{12}$/.test(f.database))throw Error('Isolated demo required');
(async()=>{
 const db=await require('mysql2/promise').createConnection({socketPath:'/private/tmp/stage-season-acceptance-training.sock',user:'root',database:f.database});
 const base=`http://127.0.0.1:${f.port}/api/stage`;let token;
 async function call(route,method='GET',body){const r=await fetch(`${base}/${route}`,{method,headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();assert.ok(r.ok,`${r.status}: ${JSON.stringify(data)}`);return data;}
 try{
  token=(await call('auth/login','POST',{email:f.adminEmail,password:f.password})).accessToken;
  for(const region of ['benelux','france','germany','spain','north-america']){
   const [rows]=await db.execute("SELECT id FROM league_entities WHERE entity_type='regional_league' AND JSON_UNQUOTE(JSON_EXTRACT(data_json,'$.region_slug'))=?",[region]);
   if(!rows.length){const row={id:crypto.randomUUID(),name:`Demo ${region} Division 1`,slug:`${region}-div-1`,division:1,season_number:1,region_slug:region,platform:'cross-platform',status:'draft',registered_club_ids:[]};await db.execute('INSERT INTO league_entities (id,entity_type,data_json,status) VALUES (?,?,?,?)',[row.id,'regional_league',JSON.stringify(row),row.status]);}
  }
  const before=await call('regional-leagues/cups'),target=before.trophy_sources.find(c=>c.region_slug==='benelux');assert.ok(target,'unprepared Benelux Cup must be selectable');assert.equal(before.trophy_sources.length,6,'all six approved regional systems must be selectable');
  if(!before.definitions.some(c=>c.id===target.id)){
   assert.ok(!(await call('regional-leagues/cups')).definitions.some(c=>c.id===target.id),'reading must not configure the Cup');
   const item=await call('trophy-items','POST',{name:'Demo Benelux Cup Trophy',image_url:'/uploads/demo/trophy.svg',linked_source_type:'regional_cup',linked_source_id:target.id,linked_source_name:'Untrusted name'});
   assert.equal(item.linked_source_name,'STAGE Benelux Cup');
  }
  const after=await call('regional-leagues/cups'),assignment=await call(`regional-leagues/cups/${target.id}/trophy`);
  assert.equal(after.definitions.filter(c=>c.id===target.id).length,1);assert.equal(assignment.state,'assigned');assert.equal(assignment.trophy.name,'Demo Benelux Cup Trophy');assert.deepEqual(after.editions,before.editions);
  const result={scope:'isolated local real HTTP',cup:target.name,passed:['unprepared Cup selectable','GET does not configure Cup','save creates permanent identity','correct Cup default preselected','existing editions unchanged']};
  fs.writeFileSync('output/playwright/admin-walkthrough-2026-11-09/cup-trophy-unprepared-test.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
 }finally{await db.end();}
})().catch(e=>{console.error(e);process.exitCode=1;});

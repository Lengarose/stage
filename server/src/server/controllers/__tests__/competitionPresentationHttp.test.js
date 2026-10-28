const test=require('node:test');
const assert=require('node:assert/strict');
const db=require.resolve('../../db/database');
let activeQuery=async()=>[];
require.cache[db]={id:db,filename:db,loaded:true,exports:{EXECUTESQL:(...args)=>activeQuery(...args),withTransaction:fn=>fn(activeQuery)}};
const express=require('express');
const regional=require('../regionalPublicController');
const tournament=require('../tournamentPresentationController');
const {key}=require('../../services/rewardConfigurationService');
test('regional history retains captured roster, prizes and trophy art while current defaults remain division-specific',()=>{
 const {publicEdition}=require('../../services/regionalPublicService');
 const root={id:'old',edition_id:'historic',status:'archived',division:2,season_number:1,registered_club_ids:['wrong'],trophy_item_id:'current'};
 const rows=[{id:'capture',entity_type:'competition_settlement',data_json:JSON.stringify({source_type:'regional_league',source_id:'old',edition_id:'historic',config:{roster:['original'],rows:[{position:1,stc_amount:'123.45'}],trophy_snapshot:{id:'old-art',name:'Captured design',image_url:'/uploads/old.png'}}})}];
 const result=publicEdition(root,rows,[{id:'current',name:'Changed current art',image_url:'/uploads/new.png'}],[],[]);
 assert.equal(result.trophy.image_url,'/uploads/old.png');assert.deepEqual(result.participant_ids,['original']);assert.equal(result.rewards.rows[0].stc_amount,'123.45');
 const current=publicEdition({...root,status:'registration',registered_club_ids:[]},[],[],[],[]);
 assert.equal(current.rewards.rows[0].stc_amount,'33000000.00');assert.equal(current.rewards.rows[19].stc_amount,'700000.00');
 assert.equal(publicEdition({...root,registered_club_ids:undefined},[],[],[],[]).participant_count,null);
 const legacy=publicEdition({...root,reward_snapshot:[{position:1,stc_amount:'99.00',position_label:'Winner'}]},[],[],[],[]);
 assert.equal(legacy.rewards.rows[0].stc_amount,'99.00');assert.equal(legacy.rewards.origin,'saved edition snapshot');
});
test('regional public reads, catalogue assignment and tournament presentation are exercised over isolated HTTP',async()=>{
 const entity=(id,entity_type,data)=>({id,entity_type,data_json:JSON.stringify(data)});
 const roots=[entity('r1','regional_league',{slug:'north-america-div-1',region_slug:'north-america',division:1,platform:'Cross-Platform',season_number:1,status:'registration',registered_club_ids:['c','c'],max_clubs:20}),entity('r2','regional_league',{slug:'north-america-div-2',region_slug:'north-america',division:2,platform:'Cross-Platform',season_number:1,status:'archived',registered_club_ids:['c']})];
 const cup={id:'cup',name:'Selected catalogue design',image_url:'/uploads/cup.png'};
 const t={id:'t',name:'Test tournament',creator_email:'owner@example.test',participant_type:'player',registered_players:'["p","p"]',status:'registration',banner_url:'/uploads/original.png',banner_position:'50% 50%',prize_pool_stc:'10.00',prize_winner_stc:'10.00'};
 const audits=[],writes=[];
 const query=async(sql,args=[])=>{
  if(sql.includes('FROM users'))return args[0]?[{id:args[0],email:args[0]==='owner'?'owner@example.test':'member@example.test',role_id:args[0]==='admin'?2:1}]:[];
  if(sql.includes('FROM tournaments WHERE id='))return args[0]==='t'?[{...t}]:[];
  if(sql.includes('FROM players WHERE user_id'))return [];
  if(sql.includes('FROM players WHERE id IN'))return [{id:'p',gamertag:'Player',platform:'PlayStation',country_code:'BE'}];
  if(sql.includes('FROM clubs WHERE id IN'))return [{id:'c',name:'Club',country_code:'US'}];
  if(sql.includes('FROM trophy_items'))return [cup];
  if(sql.includes('FROM trophy_awards')||sql.includes('FROM reward_configs'))return [];
  if(sql.includes('entity_type IN'))return structuredClone(roots);
  if(sql.includes("entity_type='regional_league' AND id=?"))return roots.filter(r=>r.id===args[0]);
  if(sql.includes("entity_type='reward_configuration' AND id=?"))return roots.filter(r=>r.id===args[0]);
  if(sql.includes("entity_type='competition_settlement'"))return [];
  if(sql.startsWith('INSERT INTO league_entities')){roots.push(entity(args[0],'reward_configuration',JSON.parse(args[1])));writes.push(sql);return {};}
  if(sql.startsWith('INSERT INTO admin_audit_log')){audits.push(args);return {};}
  if(sql.startsWith('UPDATE tournaments')){const keys=sql.match(/SET (.*),updated_date/)[1].split(',').map(v=>v.split('=')[0]);keys.forEach((k,i)=>{t[k]=args[i];});writes.push(sql);return {};}
  throw new Error(`Unexpected fixture query: ${sql}`);
 };
 const app=express();app.use(express.json());app.use((req,res,next)=>{const id=req.headers.authorization?.replace('Bearer ','');if(id)req.user={id};next();});
 activeQuery=query;
 app.use('/legacy-tournaments',require('../tournamentController'));
 app.use('/regional',regional.createRouter({query,transaction:fn=>fn(query)}));
 app.use('/public',tournament({query,publicRead:true}));app.use('/tournaments',tournament({query,transaction:fn=>fn(query)}));
 const server=await new Promise((resolve,reject)=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));s.on('error',reject);});
 const url=`http://127.0.0.1:${server.address().port}`;
 const call=(path,user='member',body)=>fetch(url+path,{method:body?'POST':'GET',headers:{...(user?{Authorization:`Bearer ${user}`} : {}),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 try{
  assert.equal((await call('/regional/overview',null)).status,401);
  const overview=await(await call('/regional/overview')).json();assert.equal(overview.editions.length,2);assert.equal(overview.editions[0].participant_count,1);
  assert.equal(overview.editions[0].rewards.rows[0].stc_amount,'54000000.00');assert.equal(overview.editions[1].rewards,null,'today defaults must not fill historical gaps');
  assert.equal((await(await call('/regional/r1/clubs')).json()).participants.length,1);
  assert.equal((await call('/regional/missing/clubs')).status,404);
  assert.equal((await call('/regional/r1/trophy')).status,403);
  const review=await(await call('/regional/r1/trophy','admin')).json();
  assert.equal((await call('/regional/r1/trophy','member',{trophy_item_id:'cup'})).status,403);
  const saved=await call('/regional/r1/trophy','admin',{trophy_item_id:'cup',reason:'Local reviewed assignment',revision:review.revision});assert.equal(saved.status,200,await saved.clone().text());
  assert.equal(roots.some(r=>r.id===key('regional_league','r1')),true);assert.equal(audits.length,1);
  const publicData=await(await call('/public/tournaments/t/presentation',null)).json();assert.equal(publicData.participants.length,1);assert.equal(publicData.participants[0].platform,'PlayStation');assert.equal(publicData.champion,null);assert.equal(publicData.prizes.payment_state,'Not verified');
  assert.equal((await call('/public/tournaments/missing/presentation',null)).status,404);
  assert.equal((await call('/tournaments/t/presentation',null,{banner_position:'10% 80%'})).status,401);
  assert.equal((await call('/tournaments/t/presentation','member',{banner_position:'10% 80%'})).status,403);
  assert.equal((await call('/tournaments/t/presentation','owner',{banner_position:'101% 80%'})).status,400);
  const edited=await call('/tournaments/t/presentation','owner',{banner_position:'10% 80%'});assert.equal(edited.status,200);assert.equal(t.banner_url,'/uploads/original.png');assert.equal(t.banner_position,'10% 80%');
  assert.equal((await call('/tournaments/t/presentation','admin',{name:'Edited'})).status,200);assert.equal(audits.length,2);
  const legacyPatch=await fetch(url+'/legacy-tournaments/t',{method:'PATCH',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify({banner_position:'20% 30%'})});assert.equal(legacyPatch.status,200);assert.equal(t.banner_position,'20% 30%');
  const deniedPatch=await fetch(url+'/legacy-tournaments/t',{method:'PATCH',headers:{Authorization:'Bearer member','Content-Type':'application/json'},body:JSON.stringify({banner_position:'20% 30%'})});assert.equal(deniedPatch.status,403);
  t.status='archived';assert.equal((await call('/tournaments/t/presentation','admin',{banner_position:'20% 30%'})).status,409);
  assert.equal(writes.some(sql=>/payout|stc_transaction|trophy_awards/.test(sql)),false);
 }finally{await new Promise(resolve=>server.close(resolve));}
});

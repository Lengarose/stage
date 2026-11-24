'use strict';
// Uses only a fresh schema on the explicitly configured isolated acceptance MySQL.
const {configure,bootstrap}=require('./bootstrap.cjs');
const assert=require('node:assert/strict');
const {randomUUID:id}=require('node:crypto');
const config=configure();let db,server;
(async()=>{
  db=await bootstrap(config);
  const express=require('express'),jwt=require('jsonwebtoken'),app=express();app.use(express.json());
  const verify=require('../../src/server/authMiddleware');
  app.use('/api/stage/landing-configs',verify.verifyToken || verify,require('../../src/server/controllers/landingConfigController'));
  const Model=require('../../src/server/models/landingConfigModel');
  app.get('/api/stage/public/landing-content',async(_req,res)=>res.json((await new Model().selectAll(1))[0]||{}));
  const admin=id(),reader=id();
  for(const [uid,role] of [[admin,2],[reader,1]])await db.EXECUTESQL('INSERT INTO users (id,email,password_hash,role_id) VALUES (?,?,?,?)',[uid,`${uid}@landing.acceptance.test`,'not-a-login-password',role]);
  server=app.listen(0,'127.0.0.1');await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
  async function call(path,method='GET',body,uid=admin,status=200){const response=await fetch(`http://127.0.0.1:${server.address().port}/api/stage/${path}`,{method,headers:{'content-type':'application/json',authorization:'Bearer '+jwt.sign({id:uid},process.env.ACCESS_TOKEN_SECRET,{expiresIn:'5m'})},...(body?{body:JSON.stringify(body)}:{})});const json=await response.json();assert.equal(response.status,status,JSON.stringify(json));return json;}
  const content={copy:{'commonPages.landHeroYour':'Your next chapter'},slides:Array.from({length:6},(_,i)=>({url:`/uploads/slide-${i}.png`,position:'35% 65%',zoom:130})),platform_image:{url:'/uploads/platform.png'},interval:7};
  await call('landing-configs','POST',{content_json:content},reader,403);
  const created=await call('landing-configs','POST',{hero_title:'Arena',content_json:content},admin,201);
  assert.deepEqual(JSON.parse(created.content_json),content);
  content.slides[5].url='/uploads/replaced.png';content.copy['commonPages.landHeroYour']='Your updated chapter';
  await call(`landing-configs/${created.id}`,'PATCH',{content_json:content});
  const publicContent=await call('public/landing-content');assert.deepEqual(JSON.parse(publicContent.content_json),content);assert.equal(publicContent.hero_title,'Arena');
  assert.equal((await call('landing-configs'))[0].id,created.id);
  assert.equal((await db.EXECUTESQL("SELECT COUNT(*) AS n FROM admin_audit_log WHERE entity_type='landing_config'"))[0].n,2);
  console.log('PASS: six slides, crop settings, copy and feature image persist through Admin create/update and public read; reader writes rejected; audit retained.');
})().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(async()=>{if(server)await new Promise(resolve=>server.close(resolve));if(db)await db.pool.promise().end();});

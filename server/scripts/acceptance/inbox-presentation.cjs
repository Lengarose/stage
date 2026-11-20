'use strict';
// Real HTTP against a new, isolated acceptance schema; never contacts Stripe.
const {configure,bootstrap}=require('./bootstrap.cjs');
const {randomUUID:id}=require('node:crypto'),assert=require('node:assert/strict');
let db,server;
(async()=>{
 db=await bootstrap(configure());const q=db.EXECUTESQL,admin=id(),user=id();
 await q('INSERT INTO users(id,email,role_id) VALUES(?,?,2),(?,?,1)',[admin,'admin@store.acceptance.test',user,'user@store.acceptance.test']);
 const app=require('express')();app.use(require('express').json());
 require('../../src/server/routes/registerStageRoutes').registerStageRoutes(app,require('../../src/server/authMiddleware'));
 server=app.listen(0,'127.0.0.1');await new Promise((r,j)=>{server.once('listening',r);server.once('error',j);});
 const call=async(who,method,path,body)=>{const r=await fetch(`http://127.0.0.1:${server.address().port}/api/stage/inbox-page-configs${path}`,{method,headers:{authorization:'Bearer '+require('jsonwebtoken').sign({id:who,email:who===admin?'admin@store.acceptance.test':'user@store.acceptance.test'},process.env.ACCESS_TOKEN_SECRET,{expiresIn:'1h'}),'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};};
 const defaults=await call(user,'GET','?key=main');assert.equal(defaults.status,200);assert.equal(defaults.data.length,0);
 const created=await call(admin,'POST','',{key:'main',background_url:'/uploads/inbox-test.jpg',reason:'Acceptance fixture'});assert.equal(created.status,201,JSON.stringify(created.data));
 assert.equal(created.data.background_url,'/uploads/inbox-test.jpg');
 const cid=created.data.id;
 assert.equal((await call(user,'POST','',{key:'main',background_url:'/unauthorized'})).status,403);
 assert.equal((await call(user,'PATCH',`/${cid}`,{background_url:'/unauthorized'})).status,403);
 assert.equal((await call(user,'DELETE',`/${cid}`)).status,403);
 const loaded=await call(user,'GET',`/${cid}`);assert.equal(loaded.data.background_url,created.data.background_url);
 const clear=await call(admin,'PATCH',`/${cid}`,{background_url:'',reason:'Clear image'});assert.equal(clear.status,200);assert.equal(clear.data.background_url,'');
 assert.equal((await q("SELECT COUNT(*) AS n FROM admin_audit_log WHERE entity_id=?",[cid]))[0].n,2);
 console.log('PASS Inbox presentation HTTP: empty default, create/read/update/clear, non-Admin create/update/delete denial, audit records.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(server)await new Promise(r=>server.close(r));if(db)await db.pool.promise().end();});

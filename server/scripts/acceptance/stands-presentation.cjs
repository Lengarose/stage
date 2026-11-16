'use strict';
const assert=require('node:assert/strict');
const {randomUUID:id}=require('node:crypto');
const {configure,bootstrap}=require('./bootstrap.cjs');
let server,db;
(async()=>{
 const config=configure();db=await bootstrap(config);const q=db.EXECUTESQL;
 const admin=id(),viewer=id();for(const [uid,role]of[[admin,2],[viewer,1]])await q('INSERT INTO users(id,email,role_id) VALUES(?,?,?)',[uid,`${uid}@example.test`,role]);
 const app=require('express')();app.use(require('express').json());require('../../src/server/routes/registerStageRoutes').registerStageRoutes(app,require('../../src/server/authMiddleware'));
 server=app.listen(0,'127.0.0.1');await new Promise((r,j)=>{server.once('listening',r);server.once('error',j);});
 async function call(uid,path,method='GET',body){const token=require('jsonwebtoken').sign({id:uid,email:`${uid}@example.test`},process.env.ACCESS_TOKEN_SECRET,{expiresIn:'1h'});const response=await fetch(`http://127.0.0.1:${server.address().port}/api/stage${path}`,{method,headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:response.status,data:await response.json()};}
 const payload={key:'main',accent:'gold',background_url:'/uploads/stands-test.png',background_position:'60% 40%',background_zoom:130,reason:'Isolated Stands presentation acceptance'};
 assert.equal((await call(viewer,'/stands-page-configs','POST',payload)).status,403);
 const created=await call(admin,'/stands-page-configs','POST',payload);assert.equal(created.status,201);const cid=created.data.id;assert.ok(cid);
 const read=await call(viewer,`/stands-page-configs/${cid}`);assert.equal(read.status,200);assert.equal(read.data.accent,'gold');assert.equal(read.data.background_url,payload.background_url);assert.equal(read.data.background_position,'60% 40%');assert.equal(read.data.background_zoom,130);
 const list=await call(viewer,'/stands-page-configs?key=main');assert.equal(list.status,200);assert.equal(list.data.length,1);
 assert.equal((await call(viewer,`/stands-page-configs/${cid}`,'PATCH',{accent:'gold'})).status,403);
 assert.equal((await call(viewer,`/stands-page-configs/${cid}`,'DELETE')).status,403);
 assert.equal((await call(admin,`/stands-page-configs/${cid}`,'PATCH',{accent:'violet',reason:'Acceptance update'})).status,200);
 assert.equal((await call(viewer,`/stands-page-configs/${cid}`)).data.accent,'violet');
 assert.equal((await call(admin,`/stands-page-configs/${cid}`,'DELETE',{reason:'Acceptance cleanup'})).status,200);
 const audits=await q('SELECT action FROM admin_audit_log WHERE entity_type=? AND entity_id=?',['stands_page_config',cid]);assert.equal(audits.length,3);
 console.log('PASS: The Stands presentation config HTTP create/read/filter/update/delete, viewer write protection, slide crop persistence and three Admin audits.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(server)await new Promise(r=>server.close(r));if(db)await db.pool.promise().end();});

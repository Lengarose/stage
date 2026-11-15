'use strict';
// Exact reported mismatch: a Belgian browser says Closed, while the UTC server
// still considers the same SQL DATETIME row open and rejects its replacement.
const {configure,bootstrap}=require('./bootstrap.cjs');
const assert=require('node:assert/strict'),{randomUUID:id}=require('node:crypto'),{pathToFileURL}=require('node:url'),path=require('node:path');
const config=configure();let db,server;const oldTZ=process.env.TZ,oldNow=Date.now;
(async()=>{
 process.env.TZ='UTC';Date.now=()=>Date.parse('2026-11-15T11:00:00Z');
 db=await bootstrap(config);const q=db.EXECUTESQL;
 const uid=id(),email=`${uid}@expiry.acceptance.test`,expired=id();
 await q('INSERT INTO users (id,email,role_id) VALUES (?,?,2)',[uid,email]);
 await q("INSERT INTO transfer_windows (id,label,status,start_date,end_date) VALUES (?,'Winter 2026','open','2026-11-14 00:30:02','2026-11-15 00:00:00')",[expired]);
 const older=id();await q("INSERT INTO transfer_windows (id,label,status,start_date,end_date,created_date) VALUES (?,'Older expired window','open','2026-11-01 20:00:00','2026-11-10 20:00:00','2026-11-01 20:00:00')",[older]);
 const app=require('express')();app.use(require('express').json());require('../../src/server/routes/registerStageRoutes').registerStageRoutes(app,require('../../src/server/authMiddleware'));
 server=app.listen(0,'127.0.0.1');await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
 const token=require('jsonwebtoken').sign({id:uid},process.env.ACCESS_TOKEN_SECRET,{expiresIn:'1h'});
 async function call(body,userToken=token){const r=await fetch(`http://127.0.0.1:${server.address().port}/api/stage/functions/transferWindowActions`,{method:'POST',headers:{authorization:`Bearer ${userToken}`,'content-type':'application/json'},body:JSON.stringify(body)});return {status:r.status,value:await r.json()};}
 const current=await call({action:'get_current'});assert.equal(current.status,200);
 const {isTransferWindowOpen}=await import(pathToFileURL(path.resolve(__dirname,'../../../src/lib/transferWindow.js')));
 process.env.TZ='Europe/Brussels';const shownOpen=isTransferWindowOpen(current.value.data.window);process.env.TZ='UTC';
 assert.equal(shownOpen,false,'The screenshot shows Closed after the exact chosen deadline');
 const opened=await call({action:'open_window',label:'New Transfer',start_date:'2026-11-15T11:00:00Z',end_date:'2026-11-20T20:00:00Z'});
 assert.equal(opened.status,200,`A window shown Closed must not block opening a new one: ${JSON.stringify(opened.value)}`);
 assert.equal(opened.value.data.window.label,'New Transfer');
 assert.equal(Number((await q("SELECT COUNT(*) AS n FROM transfer_windows WHERE status='open'"))[0].n),1,'Every expired open row is retired, not only the latest');
 assert.equal((await q('SELECT status FROM transfer_windows WHERE id=?',[expired]))[0].status,'closed');
 const cutoff=Date.parse(opened.value.data.window.end_date);
 process.env.TZ='America/New_York';assert.equal(isTransferWindowOpen(opened.value.data.window,cutoff-1),true);assert.equal(isTransferWindowOpen(opened.value.data.window,cutoff),false);process.env.TZ='UTC';
 const duplicate=await call({action:'open_window',label:'Duplicate'});assert.equal(duplicate.status,409,'A genuinely open window must reject a second opening');
 const regular=id();await q('INSERT INTO users (id,email,role_id) VALUES (?,?,1)',[regular,`${regular}@expiry.acceptance.test`]);
 const regularToken=require('jsonwebtoken').sign({id:regular},process.env.ACCESS_TOKEN_SECRET,{expiresIn:'1h'});
 assert.equal((await call({action:'close_window',window_id:opened.value.data.window.id},regularToken)).status,403);
 const closed=await call({action:'close_window',window_id:opened.value.data.window.id});assert.equal(closed.status,200);assert.equal(closed.value.data.window.window_state,'closed');
 const invalid=await call({action:'open_window',end_date:'2026-11-14T10:00:00Z'});assert.equal(invalid.status,400);
 const unlimited=await call({action:'open_window',label:'No expiry'});assert.equal(unlimited.status,200);assert.equal(unlimited.value.data.window.is_open,true);
 await call({action:'close_window',window_id:unlimited.value.data.window.id});
 const audit=await q("SELECT action FROM admin_audit_log WHERE entity_type='transfer_window'");assert(audit.some(r=>r.action==='open_transfer_window'));assert(audit.some(r=>r.action==='close_transfer_window'));
 // Concurrent requests must not create two global open windows.
 const raced=await Promise.all([call({action:'open_window',label:'Concurrent A'}),call({action:'open_window',label:'Concurrent B'})]);assert.deepEqual(raced.map(r=>r.status).sort(),[200,409]);
 assert.equal(Number((await q("SELECT COUNT(*) AS n FROM transfer_windows WHERE status='open'"))[0].n),1);
 console.log('PASS: Belgian browser and UTC server agree at the exact closing time; expired window is replaced; a genuinely open window still blocks duplicates.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{Date.now=oldNow;if(oldTZ===undefined)delete process.env.TZ;else process.env.TZ=oldTZ;if(server)await new Promise(r=>server.close(r));if(db)await db.pool.promise().end();});

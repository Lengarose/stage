'use strict';
// Disposable MySQL + JWT exercise of opponent chat and manager notification.
const {configure,bootstrap}=require('./bootstrap.cjs');
const {randomUUID:id}=require('node:crypto'),assert=require('node:assert/strict');
let db,server;
(async()=>{
 db=await bootstrap(configure());const q=db.EXECUTESQL;
 const home=id(),away=id(),outsider=id(),hc=id(),ac=id(),mid=id();
 const email=u=>`${u}@chat.acceptance.test`;
 for(const u of [home,away,outsider])await q('INSERT INTO users(id,email,role_id) VALUES(?,?,1)',[u,email(u)]);
 for(const [cid,uid,name] of [[hc,home,'Home Athletic'],[ac,away,'Away United']])await q('INSERT INTO clubs(id,name,user_id,president_user_id,logo_url,owner_email) VALUES(?,?,?,?,?,?)',[cid,name,uid,uid,'/uploads/test-logo.png',email(uid)]);
 await q("INSERT INTO matches(id,home_club_id,away_club_id,home_club_name,away_club_name,mode,status) VALUES(?,?,?,?,?,'club','scheduled')",[mid,hc,ac,'Home Athletic','Away United']);
 const app=require('express')();app.use(require('express').json());require('../../src/server/routes/registerStageRoutes').registerStageRoutes(app,require('../../src/server/authMiddleware'));
 server=app.listen(0,'127.0.0.1');await new Promise((r,j)=>{server.once('listening',r);server.once('error',j);});
 const call=async(u,path,method='GET',body)=>{const token=require('jsonwebtoken').sign({id:u,email:email(u)},process.env.ACCESS_TOKEN_SECRET,{expiresIn:'1h'});const res=await fetch(`http://127.0.0.1:${server.address().port}/api/stage${path}`,{method,headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:res.status,data:await res.json()};};
 const sent=await call(home,'/chat-messages','POST',{match_id:mid,sender_email:email(home),sender_name:'Home Athletic',content:'Ready for kickoff?'});assert.equal(sent.status,201);
 for(let n=0;n<30;n++){if((await q('SELECT id FROM notifications WHERE recipient_email=?',[email(away)])).length)break;await new Promise(r=>setTimeout(r,50));}
 const notices=await q('SELECT * FROM notifications WHERE recipient_email=?',[email(away)]);
 assert.equal(notices.length,1,'Opponent manager must receive a notification even when not a squad player and no stale owner-email snapshot exists');
 assert.match(notices[0].link,/chat=1/,'Notification opens the selected match chat');
 assert.match(notices[0].body,/Ready for kickoff/);
 assert.equal((await call(away,`/chat-messages?match_id=${mid}`)).data[0].content,'Ready for kickoff?');
 assert.equal((await call(outsider,`/chat-messages?match_id=${mid}`)).status,403,'Unrelated user cannot read match chat');
 assert.equal((await call(outsider,'/chat-messages','POST',{match_id:mid,content:'Intrusion'})).status,403);
 const reply=await call(away,'/chat-messages','POST',{match_id:mid,sender_email:email(home),sender_name:'Spoofed',content:'Yes, ready.'});assert.equal(reply.status,201);assert.equal(reply.data.sender_email,email(away),'Server derives sender');assert.equal(reply.data.sender_name,'Away United');assert.equal(reply.data.sender_avatar,'/uploads/test-logo.png');
 const unread=await call(outsider,'/chat-reads/unread-counts');assert.equal(unread.data.total,0,'Unrelated users do not see private match unread counts');
 // Player-versus-player chat uses personal identity rather than a club label.
 const hp=id(),ap=id(),solo=id();
 for(const [pid,uid,name] of [[hp,home,'Home Player'],[ap,away,'Away Player']]) {
   await q('INSERT INTO players(id,user_id,email,gamertag,avatar_url) VALUES(?,?,?,?,?)',[pid,uid,email(uid),name,'/uploads/test-player.png']);
   await q('UPDATE users SET player_id=? WHERE id=?',[pid,uid]);
 }
 await q("INSERT INTO matches(id,home_player_id,away_player_id,mode,status) VALUES(?,?,?,'solo','scheduled')",[solo,hp,ap]);
 const personal=await call(home,'/chat-messages','POST',{match_id:solo,content:'Player match ready.'});assert.equal(personal.status,201);assert.equal(personal.data.sender_name,'Home Player');
 assert.equal((await call(away,`/chat-messages?match_id=${solo}`)).data[0].sender_avatar,'/uploads/test-player.png');
 assert.equal((await call(away,`/chat-messages/${personal.data.id}`,'PATCH',{content:'Not my message'})).status,403);
 assert.equal((await call(away,`/chat-messages/${personal.data.id}`,'DELETE')).status,403);
 const pn=await q('SELECT link FROM notifications WHERE recipient_email=? AND related_id=?',[email(away),`live_chat:${solo}`]);assert.equal(pn.length,1);assert.match(pn[0].link,/chat=1/);
 // The existing Admin config route persists the new accent beside all slide crops.
 const admin=id();await q('INSERT INTO users(id,email,role_id) VALUES(?,?,2)',[admin,email(admin)]);
 const config=await call(admin,'/game-day-configs','POST',{key:'main',accent:'gold',banner_slides:[{url:'/uploads/sample.png',position:'20% 40%',zoom:120}],banner_interval_seconds:8});assert.equal(config.status,201);
 assert.equal((await call(home,`/game-day-configs/${config.data.id}`)).data.accent,'gold');
 assert.equal((await call(home,`/game-day-configs/${config.data.id}`,'PATCH',{accent:'blue'})).status,403);
 console.log('PASS: two managers exchange messages with canonical names/avatars; recipient notification links directly to chat; unrelated reads/writes/counts are excluded.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(server)await new Promise(r=>server.close(r));if(db)await db.pool.promise().end();});

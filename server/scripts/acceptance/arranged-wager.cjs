'use strict';
const {configure,bootstrap}=require('./bootstrap.cjs');
const {randomUUID:id}=require('node:crypto'),assert=require('node:assert/strict');
let db,server;
(async()=>{
 db=await bootstrap(configure());const q=db.EXECUTESQL,sides=[];
 for(const name of ['Home','Away']){
  const uid=id(),pid=id(),cid=id(),email=`${uid}@wager.acceptance.test`;
  await q('INSERT INTO users(id,email,role_id,player_id) VALUES(?,?,1,?)',[uid,email,pid]);
  await q('INSERT INTO clubs(id,user_id,president_user_id,owner_email,name,stc) VALUES(?,?,?,?,?,50000)',[cid,uid,uid,email,`${name} FC`]);
  await q('INSERT INTO players(id,user_id,email,gamertag,club_id,stc) VALUES(?,?,?,?,?,50000)',[pid,uid,email,`${name} Player`,cid]);
  sides.push({uid,pid,cid,email,name});
 }
 const app=require('express')();app.use(require('express').json());require('../../src/server/routes/registerStageRoutes').registerStageRoutes(app,require('../../src/server/authMiddleware'));
 server=app.listen(0,'127.0.0.1');await new Promise((r,j)=>{server.once('listening',r);server.once('error',j);});
 const call=async(u,fn,body)=>{const r=await fetch(`http://127.0.0.1:${server.address().port}/api/stage/functions/${fn}`,{method:'POST',headers:{authorization:'Bearer '+require('jsonwebtoken').sign({id:u.uid,email:u.email},process.env.ACCESS_TOKEN_SECRET,{expiresIn:'1h'}),'content-type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
 const [home,away]=sides;
 for(const mode of ['club','player']){
  const table=mode==='club'?'clubs':'players',key=mode==='club'?'cid':'pid';
  await q(`UPDATE ${table} SET stc=50000 WHERE id IN (?,?)`,[home[key],away[key]]);
  const meta={invitation_type:mode==='club'?'club_vs_club':'player_vs_player',timezone:'Europe/Brussels',challenger_club_id:mode==='club'?home.cid:null,opponent_club_id:mode==='club'?away.cid:null,challenger_player_id:home.pid,opponent_player_id:away.pid,challenger_name:home.name,opponent_name:away.name,scheduled_date:'2027-06-01 20:00:00',wager_stc:10000};
  const sent=await call(home,'sendInboxMessage',{recipient_email:away.email,sender_email:home.email,sender_gamertag:home.name,subject:'Wager match invitation',body:'Please review the kickoff and 10,000 STC stake per side.',message_type:'match_invite',action_type:'accept_decline_date',event_id:id(),related_entity_id:away[key],related_entity_type:mode,metadata:meta});assert.equal(sent.status,200,JSON.stringify(sent.data));
  const [invite]=await q("SELECT * FROM inbox_messages WHERE recipient_email=? AND status='pending' ORDER BY created_date DESC LIMIT 1",[away.email]);assert(invite);
  await q(`UPDATE ${table} SET stc=0 WHERE id=?`,[away[key]]);
  const rejected=await call(away,'respondInboxMessage',{message_id:invite.id,action:'accepted'});assert(rejected.status>=400,'Insufficient funds must reject acceptance');
  assert.equal((await q('SELECT status FROM inbox_messages WHERE id=?',[invite.id]))[0].status,'pending','Failed stake reservation must leave the invitation pending');
  assert.equal((await q('SELECT COUNT(*) AS n FROM matches'))[0].n,mode==='club'?0:1,'Failed reservation must not leave an unfunded match');
  assert.equal(Number((await q(`SELECT stc FROM ${table} WHERE id=?`,[home[key]]))[0].stc),50000);
  await q(`UPDATE ${table} SET stc=50000 WHERE id=?`,[away[key]]);
  const accepted=await call(away,'respondInboxMessage',{message_id:invite.id,action:'accepted'});assert.equal(accepted.status,200,JSON.stringify(accepted.data));const mid=accepted.data.match.id;
  const [match]=await q('SELECT * FROM matches WHERE id=?',[mid]);assert.equal(match.wager_status,'active');assert.equal(Number(match.wager_home_locked),1);assert.equal(Number(match.wager_away_locked),1);
  for(const side of sides)assert.equal(Number((await q(`SELECT stc FROM ${table} WHERE id=?`,[side[key]]))[0].stc),40000);
  assert.equal((await call(away,'respondInboxMessage',{message_id:invite.id,action:'accepted'})).status,409);
  // Stream fields are durable on the same real arranged Match in either mode.
  for(const [side,field] of [[home,'home_stream_url'],[away,'away_stream_url']]) {
   const token=require('jsonwebtoken').sign({id:side.uid,email:side.email},process.env.ACCESS_TOKEN_SECRET,{expiresIn:'1h'});
   const response=await fetch(`http://127.0.0.1:${server.address().port}/api/stage/matches/${mid}`,{method:'PATCH',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({[field]:'https://www.youtube.com/watch?v=sample'})});
   assert.equal(response.status,200,await response.text());
   assert.equal((await q(`SELECT ${field} FROM matches WHERE id=?`,[mid]))[0][field],'https://www.youtube.com/watch?v=sample');
  }

  await q("UPDATE matches SET home_score=2,away_score=1,status='completed',result_state='CONFIRMED',report_finalized=1,stats_processed=1 WHERE id=?",[mid]);
  const settlement=require('../../src/server/services/wagerSettlementService');await settlement.settle(mid);await settlement.settle(mid);
  assert.equal(Number((await q(`SELECT stc FROM ${table} WHERE id=?`,[home[key]]))[0].stc),60000,'Winner receives the funded pot once');assert.equal(Number((await q(`SELECT stc FROM ${table} WHERE id=?`,[away[key]]))[0].stc),40000);
  console.log(`PASS ${mode}: real invite, insufficient-fund rollback, retry, atomic two-sided reservation and exactly-once winner payout.`);
 }
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(server)await new Promise(r=>server.close(r));if(db)await db.pool.promise().end();});

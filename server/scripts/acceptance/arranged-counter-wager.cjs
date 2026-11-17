'use strict';
const {configure,bootstrap}=require('./bootstrap.cjs');
const {randomUUID:id}=require('node:crypto'),assert=require('node:assert/strict');
let db,server;
(async()=>{
 db=await bootstrap(configure());const q=db.EXECUTESQL,sides=[];
 for(const name of ['Home','Away','Outsider']){
  const uid=id(),pid=id(),cid=id(),email=`${uid}@counter.acceptance.test`;
  await q('INSERT INTO users(id,email,role_id,player_id) VALUES(?,?,1,?)',[uid,email,pid]);
  await q('INSERT INTO clubs(id,user_id,president_user_id,owner_email,name,stc) VALUES(?,?,?,?,?,50000)',[cid,uid,uid,email,`${name} FC`]);
  await q('INSERT INTO players(id,user_id,email,gamertag,club_id,stc) VALUES(?,?,?,?,?,50000)',[pid,uid,email,`${name} Player`,cid]);
  sides.push({uid,pid,cid,email,name});
 }
 const app=require('express')();app.use(require('express').json());require('../../src/server/routes/registerStageRoutes').registerStageRoutes(app,require('../../src/server/authMiddleware'));
 server=app.listen(0,'127.0.0.1');await new Promise((r,j)=>{server.once('listening',r);server.once('error',j);});
 const call=async(u,fn,body)=>{const r=await fetch(`http://127.0.0.1:${server.address().port}/api/stage/functions/${fn}`,{method:'POST',headers:{authorization:'Bearer '+require('jsonwebtoken').sign({id:u.uid,email:u.email},process.env.ACCESS_TOKEN_SECRET,{expiresIn:'1h'}),'content-type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
 const [home,away,outsider]=sides;
 for(const mode of ['club','player']){
  const table=mode==='club'?'clubs':'players',key=mode==='club'?'cid':'pid',ledger=mode==='club'?'stc_transactions':'player_stc_transactions';
  const meta={invitation_type:mode==='club'?'club_vs_club':'player_vs_player',timezone:'Europe/Brussels',challenger_club_id:mode==='club'?home.cid:null,opponent_club_id:mode==='club'?away.cid:null,challenger_player_id:home.pid,opponent_player_id:away.pid,challenger_name:home.name,opponent_name:away.name,scheduled_date:'2027-06-01 20:00:00',wager_stc:10000};
  const sent=await call(home,'sendInboxMessage',{recipient_email:away.email,sender_email:home.email,sender_gamertag:home.name,subject:'Counter-proposal wager invitation',body:'Review kickoff and stake.',message_type:'match_invite',action_type:'accept_decline_date',event_id:id(),related_entity_id:away[key],related_entity_type:mode,metadata:meta});assert.equal(sent.status,200,JSON.stringify(sent.data));
  const [invite]=await q("SELECT * FROM inbox_messages WHERE recipient_email=? AND status='pending' AND message_type='match_invite' ORDER BY created_date DESC LIMIT 1",[away.email]);
  const changed=await call(away,'respondInboxMessage',{message_id:invite.id,action:'date_change_requested',new_date:'2027-06-02',new_time:'20:40',new_timezone:'Europe/Brussels'});assert.equal(changed.status,200,JSON.stringify(changed.data));
  let [counter]=await q("SELECT * FROM inbox_messages WHERE recipient_email=? AND status='pending' AND message_type='match_invite' ORDER BY created_date DESC LIMIT 1",[home.email]);assert(counter);
  // Exercise another complete round-trip; the original home side remains home.
  for(const responder of [home,away]){
   const previous=counter.id;
   assert.equal((await call(responder,'respondInboxMessage',{message_id:previous,action:'date_change_requested',new_date:'2027-06-02',new_time:'20:40',new_timezone:'Europe/Brussels'})).status,200);
   [counter]=await q("SELECT * FROM inbox_messages WHERE status='pending' AND JSON_UNQUOTE(JSON_EXTRACT(metadata,'$.original_message_id'))=?",[previous]);assert(counter);
  }
  assert((await call(outsider,'respondInboxMessage',{message_id:counter.id,action:'accepted'})).status>=400);
  await q(`UPDATE ${table} SET stc=0 WHERE id=?`,[away[key]]);
  const unfunded=await call(home,'respondInboxMessage',{message_id:counter.id,action:'accepted'});
  assert.equal(unfunded.status,409);assert.match(unfunded.data.error,/Insufficient STC/);
  assert.equal((await q('SELECT status FROM inbox_messages WHERE id=?',[counter.id]))[0].status,'pending');
  assert.equal(Number((await q(`SELECT stc FROM ${table} WHERE id=?`,[home[key]]))[0].stc),50000);
  await q(`UPDATE ${table} SET stc=50000 WHERE id=?`,[away[key]]);
  const accepted=await call(home,'respondInboxMessage',{message_id:counter.id,action:'accepted'});assert.equal(accepted.status,200,JSON.stringify(accepted.data));
  const mid=accepted.data.match.id,[match]=await q('SELECT * FROM matches WHERE id=?',[mid]);
  assert.equal(match.wager_status,'active');assert.equal(Number(match.wager_home_locked),1);assert.equal(Number(match.wager_away_locked),1);assert.equal(match.scheduled_date,'2027-06-02 20:40:00');
  for(const side of [home,away])assert.equal(Number((await q(`SELECT stc FROM ${table} WHERE id=?`,[side[key]]))[0].stc),40000);
  assert.equal((await q(`SELECT COUNT(*) AS n FROM ${ledger} WHERE reference_id=? AND category='wager_stake'`,[mid]))[0].n,2);
  assert.equal((await call(home,'respondInboxMessage',{message_id:counter.id,action:'accepted'})).status,409);
  console.log(`PASS ${mode}: three counter-proposals, home acceptance, insufficient-funds rollback/retry, correct kickoff, two funded stakes, outsider denial and duplicate response protection.`);
  // A reported draw cannot release money before both sides confirm it.
  await q("UPDATE matches SET home_score=2,away_score=2,status='awaiting_confirmation',result_state='AWAITING_AWAY_CONFIRMATION' WHERE id=?",[mid]);
  assert.equal((await call(home,'processSoloWager',{match_id:mid})).data.data.skipped,true);
  assert.equal(Number((await q(`SELECT stc FROM ${table} WHERE id=?`,[home[key]]))[0].stc),40000);
  await q("UPDATE matches SET status='completed',result_state='CONFIRMED',report_finalized=1,stats_processed=1 WHERE id=?",[mid]);
  assert.equal((await call(home,'processSoloWager',{match_id:mid})).status,200);
  assert.equal((await call(away,'processSoloWager',{match_id:mid})).status,200);
  for(const side of [home,away])assert.equal(Number((await q(`SELECT stc FROM ${table} WHERE id=?`,[side[key]]))[0].stc),50000);
  assert.equal((await q('SELECT wager_status FROM matches WHERE id=?',[mid]))[0].wager_status,'refunded');
  assert.equal((await q(`SELECT COUNT(*) AS n FROM ${ledger} WHERE reference_id=? AND category='wager_refund'`,[mid]))[0].n,2);
  console.log(`PASS ${mode}: unconfirmed draw retains stakes; confirmed 2–2 refunds each stake exactly once.`);
 }
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(server)await new Promise(r=>server.close(r));if(db)await db.pool.promise().end();});

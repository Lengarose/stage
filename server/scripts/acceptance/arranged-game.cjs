'use strict';
const {configure,bootstrap}=require('./bootstrap.cjs');
const assert=require('node:assert/strict'),{randomUUID:id}=require('node:crypto');
const config=configure();let db,server;
const preview=process.argv.includes('--preview'),password=id()+id();
(async()=>{
 db=await bootstrap(config);const q=db.EXECUTESQL;
 const express=require('express'),jwt=require('jsonwebtoken'),app=express();app.use(express.json());require('../../src/server/routes/registerStageRoutes').registerStageRoutes(app,require('../../src/server/authMiddleware'));
 const sides=[];
 for(const name of ['Home','Away']){
  const uid=id(),pid=id(),cid=id(),email=`${uid}@arrangement.acceptance.test`;
  await q('INSERT INTO users (id,email,role_id,player_id,timezone,password_hash) VALUES (?,?,1,?,?,?)',[uid,email,pid,'Europe/Brussels',await require('bcryptjs').hash(password,10)]);
  await q('INSERT INTO clubs (id,name,owner_email,president_user_id,user_id,logo_url) VALUES (?,?,?,?,?,?)',[cid,`${name} FC`,email,uid,uid,preview?`/src/assets/landing/${name==='Home'?'triumph':'player'}.webp`:`/uploads/${name.toLowerCase()}-club.png`]);
  await q("INSERT INTO players (id,user_id,email,gamertag,club_id,avatar_url,country,country_code,position,platform) VALUES (?,?,?,?,?,?,'Belgium','BE','CM','PlayStation')",[pid,uid,email,`${name} Player`,cid,preview?`/src/assets/landing/${name==='Home'?'player':'triumph'}.webp`:`/uploads/${name.toLowerCase()}-player.png`]);
  sides.push({uid,pid,cid,email,name});
 }
 server=app.listen(preview?18105:0,'127.0.0.1');await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
 async function call(side,path,body,status=200){const r=await fetch(`http://127.0.0.1:${server.address().port}/api/stage/${path}`,{method:body?'POST':'GET',headers:{authorization:'Bearer '+jwt.sign({id:side.uid},process.env.ACCESS_TOKEN_SECRET,{expiresIn:'1h'}),'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const value=await r.json();assert.equal(r.status,status,JSON.stringify(value));return value;}
 const [home,away]=sides;
 for(const mode of ['club','player']){
  const meta={invitation_type:mode==='club'?'club_vs_club':'player_vs_player',timezone:'Europe/Brussels',challenger_name:`Home ${mode==='club'?'FC':'Player'}`,opponent_name:`Away ${mode==='club'?'FC':'Player'}`,challenger_club_id:mode==='club'?home.cid:null,opponent_club_id:mode==='club'?away.cid:null,challenger_player_id:home.pid,opponent_player_id:away.pid,scheduled_date:'2027-06-01 20:00:00'};
  const first=id();await q("INSERT INTO inbox_messages (id,recipient_email,sender_email,sender_gamertag,subject,body,message_type,action_type,status,metadata,related_entity_id,related_entity_type) VALUES (?,?,?,?,?,?,'match_invite','accept_decline_date','pending',?,?,?)",[first,away.email,home.email,meta.challenger_name,'Match invitation','Please review this match invitation.',JSON.stringify(meta),mode==='club'?away.cid:away.pid,mode]);
  await call(away,'functions/respondInboxMessage',{message_id:first,action:'date_change_requested',new_date:'2027-06-02',new_time:'20:40'});
  let replies=await q("SELECT * FROM inbox_messages WHERE recipient_email=? AND message_type='match_invite' AND id<>? ORDER BY created_date DESC",[home.email,first]);
  let reply=replies.find(m=>(typeof m.metadata==='string'?JSON.parse(m.metadata):m.metadata||{}).original_message_id===first);assert(reply,'Counter-proposal delivered');
  if(!process.argv.includes('--accept-only')) {assert.equal(reply.sender_gamertag,meta.opponent_name);if(!preview)assert.equal(reply.sender_avatar_url,mode==='club'?'/uploads/away-club.png':'/uploads/away-player.png');assert.doesNotMatch(reply.body,/\d{4}-\d\d-\d\d \d\d:\d\d:\d\d/);}
  await call(home,'functions/respondInboxMessage',{message_id:reply.id,action:'date_change_requested',new_date:'2027-06-03',new_time:'21:00'});
  const [back]=await q("SELECT * FROM inbox_messages WHERE recipient_email=? AND message_type='match_invite' AND JSON_UNQUOTE(JSON_EXTRACT(metadata,'$.original_message_id'))=?",[away.email,reply.id]);assert(back);
  if(!process.argv.includes('--accept-only'))assert.equal(back.sender_gamertag,meta.challenger_name);
  const accepted=await call(away,'functions/respondInboxMessage',{message_id:back.id,action:'accepted'});
  const matches=await q('SELECT * FROM matches WHERE '+(mode==='club'?'home_club_id=? AND away_club_id=?':'home_player_id=? AND away_player_id=?'),mode==='club'?[home.cid,away.cid]:[home.pid,away.pid]);
  assert.equal(matches.length,1,'Accepting the counter-proposal must create exactly one real match');
  assert.equal(accepted.match.id,matches[0].id);assert.match(matches[0].scheduled_date,/2027-06-03/);
  assert.equal(matches[0].scheduling_status,'confirmed');assert.equal(matches[0].timezone,'Europe/Brussels');
  for(const side of sides){const records=await call(side,'matches?'+(mode==='club'?(side===home?'home_club_id=':'away_club_id=')+side.cid:(side===home?'home_player_id=':'away_player_id=')+side.pid));assert(records.some(m=>m.id===matches[0].id),'The actual Schedule/Fixtures/GameDay query must find the accepted match');}
  await call(away,'functions/respondInboxMessage',{message_id:back.id,action:'accepted'},409);
  // Existing real matches are updated rather than replaced during a later negotiation.
  const later=id();await q("INSERT INTO inbox_messages (id,recipient_email,sender_email,message_type,action_type,status,metadata,related_entity_id,related_entity_type) VALUES (?,?,?,'match_invite','accept_decline_date','pending',?,?,'match')",[later,away.email,home.email,JSON.stringify({...meta,created_match_id:matches[0].id}),matches[0].id]);
  await call(away,'functions/respondInboxMessage',{message_id:later,action:'date_change_requested',new_date:'2027-06-04',new_time:'20:00'});
  const [laterReply]=await q("SELECT * FROM inbox_messages WHERE JSON_UNQUOTE(JSON_EXTRACT(metadata,'$.original_message_id'))=?",[later]);
  const changed=await call(home,'functions/respondInboxMessage',{message_id:laterReply.id,action:'accepted'});assert.equal(changed.match.id,matches[0].id);
  assert.match(String((await q('SELECT scheduled_date FROM matches WHERE id=?',[matches[0].id]))[0].scheduled_date),/2027-06-04/);
  // Restore the exact historical bug: accepted reschedule linked to an opponent ID, not a Match.
  const oldRoot=id(),oldReply=id(),opponentId=mode==='club'?away.cid:away.pid;
  await q("INSERT INTO inbox_messages (id,recipient_email,sender_email,message_type,status,metadata,related_entity_id,related_entity_type) VALUES (?,?,?,'match_invite','date_change_requested',?,?,?)",[oldRoot,away.email,home.email,JSON.stringify(meta),opponentId,mode]);
  await q("INSERT INTO inbox_messages (id,recipient_email,sender_email,subject,body,message_type,action_type,status,metadata,related_entity_id,related_entity_type) VALUES (?,?,?,?,?,'match_invite','accept_decline_date','accepted',?,?,'match')",[oldReply,home.email,away.email,'Reschedule Proposal',`${away.email} would like to reschedule.\nProposed: 2027-06-07 20:00:00`,JSON.stringify({...meta,reschedule_request:true,original_message_id:oldRoot,scheduled_date:'2027-06-07 20:00:00'}),opponentId]);
  const inbox=await call(home,'inbox-messages');const restored=inbox.find(m=>m.id===oldReply);assert.equal(restored.sender_gamertag,meta.opponent_name);assert(restored.sender_avatar_url);assert.match(restored.body,/Kind regards/);
  const recovery=await call(home,'functions/reconcileArrangedGames',{});assert.equal(recovery.repaired,1,JSON.stringify(recovery));
  assert.equal((await call(home,'functions/reconcileArrangedGames',{})).repaired,0,'Recovery must not create duplicate fixtures');
  console.log(`PASS ${mode}: identity retained through two counter-proposals; acceptance creates one confirmed match visible to both sides; retries rejected; existing match rescheduled; old accepted broken invitation recovered once.`);
 }
 if(preview){require('node:fs').writeFileSync('/private/tmp/stage-arranged-preview.json',JSON.stringify({database:config.database,password,sides}),{mode:0o600});console.log('Disposable arranged-game preview ready on 18105');await new Promise(resolve=>process.once('SIGTERM',resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(server)await new Promise(resolve=>server.close(resolve));if(db)await db.pool.promise().end();});

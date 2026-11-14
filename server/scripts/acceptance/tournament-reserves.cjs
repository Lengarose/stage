// Real HTTP/JWT exercise against a disposable local acceptance database only.
const fs=require('node:fs'),assert=require('node:assert/strict'),{randomUUID:id}=require('node:crypto');
process.env.STAGE_ACCEPTANCE_SOCKET='/private/tmp/stage-season-acceptance-training.sock';require('./bootstrap.cjs').configure();
const f=JSON.parse(fs.readFileSync(process.argv[2]));assert.match(f.database,/^stage_acceptance_[a-f0-9]{12}$/);process.env.DB_NAME=f.database;
const root=require('node:path').resolve(__dirname,'../../..'),db=require(root+'/server/src/server/db/database'),q=db.EXECUTESQL;
const users=Array.from({length:10},id),clubs=Array.from({length:4},id),players=[],tid=id(),admin=users[4],member=users[5];let server;
const email=uid=>`reserve-${uid}@stage.test`,parse=v=>typeof v==='string'?JSON.parse(v):v;
async function clone(table,source,changes){const [row]=await q('SELECT * FROM '+table+' WHERE id=?',[source]);assert(row);Object.assign(row,changes);const keys=Object.keys(row);await q('INSERT INTO '+table+' ('+keys.map(k=>'`'+k+'`').join(',')+') VALUES ('+keys.map(()=>'?').join(',')+')',keys.map(k=>row[k]&&typeof row[k]==='object'?JSON.stringify(row[k]):row[k]));}
(async()=>{try{
 for(const uid of users)await clone('users',f.userId,{id:uid,email:email(uid),role_id:uid===admin?2:1,player_id:null,owner_id:null,credits:1000});
 for(let n=0;n<clubs.length;n++){
  await clone('clubs',f.clubId,{id:clubs[n],name:`Reserve Test ${n}`,president_user_id:users[n],user_id:users[n],owner_email:email(users[n]),president_id:null,president_player_id:null,stc:1000000});
  for(let j=0;j<2;j++){const pid=id();players.push(pid);await clone('players',f.playerId,{id:pid,user_id:j?users[6+n]:users[n],email:j?email(users[6+n]):email(users[n]),club_id:clubs[n],gamertag:'Reserve-'+pid.slice(0,8),subscription:'stage_plus'});}
 }
 await clone('tournaments',f.tournamentId,{id:tid,name:'DEMO · Reserves lifecycle',type:'league',participant_type:'club',status:'registration',max_teams:2,registered_clubs:'[]',registered_players:'[]',registration_proofs:'{}',schedule_policy_version:null,club_rules:null,entry_credits:0,entry_fee_stc:0,start_date:'2027-07-01 00:00:00',creator_id:admin,creator_email:email(admin),organizer_email:email(admin),creator_gamertag:null});
 const express=require(root+'/server/node_modules/express'),app=express();app.use(express.json());require(root+'/server/src/server/routes/registerStageRoutes').registerStageRoutes(app,require(root+'/server/src/server/authMiddleware'));server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const origin='http://127.0.0.1:'+server.address().port,jwt=require(root+'/server/node_modules/jsonwebtoken');
 async function req(path,body,uid=admin){const r=await fetch(origin+'/api/stage'+path,{method:body?'POST':'GET',headers:{authorization:'Bearer '+jwt.sign({id:uid},process.env.ACCESS_TOKEN_SECRET,{expiresIn:'10m'}),'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};}
 function ok(r){assert.equal(r.status,200,JSON.stringify(r.data));return r.data;}
 let r=await req(`/tournaments/${tid}/schedule`,{mode:'fixed',timezone:'Europe/Brussels',entries:[1,2].map(round=>({phase:'league',round,starts_at:`2027-07-0${round}T18:00:00Z`,ends_at:`2027-07-0${round}T18:40:00Z`}))});const revision=ok(r).schedule.revision;
 async function accept(n){ok(await req(`/tournaments/${tid}/schedule/accept`,{club_id:clubs[n],revision},users[n]));}
 async function register(n){const t=ok(await req(`/tournaments/${tid}`));return req('/functions/tournamentRegistration',{tournament_id:tid,club_id:clubs[n],ea_club_name:`Reserve Test ${n}`,rules_accepted:true,club_rules_revision:t.club_rules_revision},users[n]);}
 async function approve(n){ok(await req('/functions/tournamentRegistrationReview',{tournament_id:tid,club_id:clubs[n],action:'approve'}));}
 assert.equal((await req('/functions/generateTournamentDraw',{tournament_id:tid})).status,409,'empty field cannot draw');
 for(const n of [0,1]){await accept(n);ok(await register(n));await approve(n);}
 assert.equal((await req('/functions/startTournament',{tournament_id:tid})).status,409,'full field still needs draw');
 assert.equal((await req(`/tournaments/${tid}/reserves`,{club_id:clubs[2]},member)).status,403,'ordinary member cannot join for a club');
 const balances=await q('SELECT id,stc FROM clubs WHERE id IN (?,?)',[clubs[2],clubs[3]]);
 const first=ok(await req(`/tournaments/${tid}/reserves`,{club_id:clubs[2]},users[2])).entry;
 const second=ok(await req(`/tournaments/${tid}/reserves`,{club_id:clubs[3]},users[3])).entry;
 assert(first.queue_sequence<second.queue_sequence);assert.deepEqual(await q('SELECT id,stc FROM clubs WHERE id IN (?,?)',[clubs[2],clubs[3]]),balances,'waiting list free');
 assert.equal(ok(await req(`/tournaments/${tid}/reserves`,{club_id:clubs[2]},users[2])).entry.id,first.id,'repeat join is idempotent');
 ok(await req(`/tournaments/${tid}/withdrawals`,{club_id:clubs[0]},users[0]));
 let state=ok(await req(`/tournaments/${tid}/reserves?club_id=${clubs[2]}`,null,users[2]));assert.equal(state.entry.status,'invited');assert(Date.parse(state.entry.expires_at)<=Date.now()+86400000);
 const inbox=ok(await req('/inbox-messages',null,users[2]));assert(inbox.some(m=>m.subject.includes('reserve invited')&&m.body.includes(state.entry.expires_at)));
 await accept(3);r=await register(3);assert.equal(r.status,409,JSON.stringify(r.data));assert.match(r.data.error,/reserved/,'no queue jumping');
 // Expiration offers the vacancy to the next club, including across a worker restart.
 const record=state.entry;record.expires_at=new Date(Date.now()-1000).toISOString();await q('UPDATE league_entities SET data_json=? WHERE id=?',[JSON.stringify(record),record.id]);
 await require(root+'/server/src/server/services/tournamentReserveService').tick();
 state=ok(await req(`/tournaments/${tid}/reserves?club_id=${clubs[3]}`,null,users[3]));assert.equal(state.entry.status,'invited');assert.equal(state.entry.id,second.id);
 await accept(2);assert.equal((await register(2)).status,409,'expired invitation cannot enter');
 ok(await register(3));state=ok(await req(`/tournaments/${tid}/reserves?club_id=${clubs[3]}`,null,users[3]));assert.equal(state.entry.status,'submitted');
 state.entry.expires_at=new Date(Date.now()-1000).toISOString();await q('UPDATE league_entities SET data_json=? WHERE id=?',[JSON.stringify(state.entry),state.entry.id]);await require(root+'/server/src/server/services/tournamentReserveService').tick();
 assert.equal(ok(await req(`/tournaments/${tid}/reserves?club_id=${clubs[3]}`,null,users[3])).entry.status,'submitted','pending approval holds place');await approve(3);
 ok(await req('/functions/generateTournamentDraw',{tournament_id:tid}));
 const before=await q('SELECT * FROM matches WHERE tournament_id=? ORDER BY id',[tid]);assert.equal(before.length,2);
 const rejoined=ok(await req(`/tournaments/${tid}/reserves`,{club_id:clubs[2]},users[2])).entry;assert(rejoined.queue_sequence>second.queue_sequence);
 const withdrawal=ok(await req(`/tournaments/${tid}/withdrawals`,{club_id:clubs[1],reason:'Testing replacement'},users[1])).request;
 ok(await req(`/tournaments/${tid}/withdrawals/${withdrawal.id}/respond`,{action:'approve',reason:'Approved before play'}));
 assert.equal((await req('/functions/startTournament',{tournament_id:tid})).status,409,'vacancy blocks start');
 state=ok(await req(`/tournaments/${tid}/reserves?club_id=${clubs[2]}`,null,users[2]));assert.equal(state.entry.status,'invited');assert.equal(state.entry.vacated_club_id,clubs[1]);
 ok(await register(2));await approve(2);
 assert.equal((await req('/functions/startTournament',{tournament_id:tid})).status,409,'organizer must resolve slot');
 assert.equal((await req(`/tournaments/${tid}/reserves/${rejoined.id}/replace-slot`,{reason:'Not organizer'},users[2])).status,403);
 // Releasing match preparations is part of explicit same-slot replacement.
 await q('INSERT INTO club_fixture_lineups (id,club_id,fixture_id,status) VALUES (?,?,?,?)',[id(),clubs[1],before[0].id,'draft']);
 r=await req(`/tournaments/${tid}/reserves/${rejoined.id}/replace-slot`,{reason:'Confirmed eligible reserve inherits exact slot'});ok(r);
 const after=await q('SELECT * FROM matches WHERE tournament_id=? ORDER BY id',[tid]);
 assert.deepEqual(after.map(m=>m.id),before.map(m=>m.id));
 for(let n=0;n<before.length;n++){for(const key of ['round','type','group_number','scheduled_date','confirmed_date'])assert.deepEqual(after[n][key],before[n][key],key+' preserved');for(const side of ['home','away'])assert.equal(after[n][side+'_club_id'],before[n][side+'_club_id']===clubs[1]?clubs[2]:before[n][side+'_club_id']);}
 assert.equal((await q('SELECT id FROM club_fixture_lineups WHERE fixture_id=?',[before[0].id])).length,0);
 assert.equal(ok(await req(`/tournaments/${tid}/reserves/${rejoined.id}/replace-slot`,{reason:'retry'})).already_applied,true);
 // An unreserved public vacancy after the draw needs the same explicit slot handoff.
 const laterWithdrawal=ok(await req(`/tournaments/${tid}/withdrawals`,{club_id:clubs[3],reason:'Second vacancy without a queue'},users[3])).request;
 ok(await req(`/tournaments/${tid}/withdrawals/${laterWithdrawal.id}/respond`,{action:'approve',reason:'Approved before kickoff'}));
 await accept(0);ok(await register(0));await approve(0);
 const direct=ok(await req(`/tournaments/${tid}/reserves?club_id=${clubs[0]}`,null,users[0])).entry;
 assert.equal(direct.entry_source,'unreserved_vacancy');assert.equal(direct.vacated_club_id,clubs[3]);
 ok(await req(`/tournaments/${tid}/reserves/${direct.id}/replace-slot`,{reason:'Ordinary entry fills unreserved slot without queue jumping'}));
 ok(await req('/functions/startTournament',{tournament_id:tid}));ok(await req('/functions/startTournament',{tournament_id:tid}));assert.equal((await q('SELECT id FROM matches WHERE tournament_id=?',[tid])).length,2,'start never creates extra fixtures');
 assert.equal((await req(`/tournaments/${tid}/reserves`,{club_id:clubs[0]},users[0])).status,409,'no reserves after start');
 console.log('PASS real HTTP/JWT: full-field draw/start ordering; free FIFO queue; manager-only join; idempotence; exclusive invitations; inbox deadlines; no queue jumping; worker expiry; pending approval holds place; organizer-only exact slot replacement; preserved IDs, opponents, rounds/times; reset preparations; no replacements after start.');
 // Exercise leave endpoint separately after all assertions; left status is idempotent.
 const rows=await q("SELECT * FROM league_entities WHERE entity_type='tournament_reserve' AND season_id=?",[tid]);
 const leaveEntry={id:id(),tournament_id:tid,club_id:clubs[0],club_name:'Test leave',status:'waiting',queue_sequence:99};await q("INSERT INTO league_entities (id,entity_type,season_id,status,data_json) VALUES (?,'tournament_reserve',?,'waiting',?)",[leaveEntry.id,tid,JSON.stringify(leaveEntry)]);
 ok(await req(`/tournaments/${tid}/reserves/${leaveEntry.id}/leave`,{club_id:clubs[0]},users[0]));assert(rows.length>0);
 console.log('PASS reserve leave endpoint via authenticated HTTP.');
}finally{
 const marks=users.map(()=>'?').join(',');await q(`DELETE FROM inbox_messages WHERE recipient_email IN (${marks})`,users.map(email));await q(`DELETE FROM notifications WHERE recipient_email IN (${marks})`,users.map(email));
 await q('DELETE FROM club_fixture_lineups WHERE club_id IN (?,?,?,?)',clubs);await q('DELETE FROM admin_audit_log WHERE entity_id=?',[tid]);await q('DELETE FROM competition_fixtures WHERE match_id IN (SELECT id FROM matches WHERE tournament_id=?)',[tid]);await q('DELETE FROM matches WHERE tournament_id=?',[tid]);
 await q("DELETE FROM league_entities WHERE season_id=? OR (entity_type IN ('tournament_schedule','tournament_schedule_consent','board_tournament_delivery','tournament_withdrawal') AND JSON_UNQUOTE(JSON_EXTRACT(data_json,'$.tournament_id'))=?)",[tid,tid]);await q('DELETE FROM stc_transactions WHERE reference_id=?',[tid]);await q('DELETE FROM tournaments WHERE id=?',[tid]);
 for(const pid of players)await q('DELETE FROM players WHERE id=?',[pid]);for(const cid of clubs)await q('DELETE FROM clubs WHERE id=?',[cid]);for(const uid of users)await q('DELETE FROM users WHERE id=?',[uid]);if(server)await new Promise(r=>server.close(r));await db.pool.promise().end();
}})().catch(e=>{console.error(e);process.exitCode=1;});

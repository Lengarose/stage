// Runs only against the dedicated local acceptance database; no production writes.
const fs=require('node:fs'),assert=require('node:assert/strict'),{randomUUID:id}=require('node:crypto');
process.env.STAGE_ACCEPTANCE_SOCKET='/private/tmp/stage-season-acceptance-training.sock';require('./bootstrap.cjs').configure();
const f=JSON.parse(fs.readFileSync(process.argv[2]));assert.match(f.database,/^stage_acceptance_[a-f0-9]{12}$/);process.env.DB_NAME=f.database;
const root=require('node:path').resolve(__dirname,'../../..'),db=require(root+'/server/src/server/db/database'),q=db.EXECUTESQL;
const manager=id(),member=id(),admin=id(),club=id(),players=[id(),id()],tid=id(),fixtureId=id();let server;
const email=uid=>`entry-${uid}@stage.test`;
async function clone(table,source,changes){const [row]=await q('SELECT * FROM '+table+' WHERE id=?',[source]);assert(row,table+' fixture');Object.assign(row,changes);const keys=Object.keys(row);await q('INSERT INTO '+table+' ('+keys.map(k=>'`'+k+'`').join(',')+') VALUES ('+keys.map(()=>'?').join(',')+')',keys.map(k=>row[k]&&typeof row[k]==='object'?JSON.stringify(row[k]):row[k]));}
(async()=>{try{
 for(const uid of [manager,member,admin])await clone('users',f.userId,{id:uid,email:email(uid),role_id:uid===admin?2:1,player_id:null,owner_id:null});
 await clone('clubs',f.clubId,{id:club,name:'DEMO Entry Consent FC',president_user_id:manager,user_id:manager,owner_email:email(manager),president_id:null,president_player_id:null,stc:1000000});
 for(let n=0;n<2;n++)await clone('players',f.playerId,{id:players[n],user_id:n?member:manager,email:email(n?member:manager),club_id:club,gamertag:'Consent-'+players[n].slice(0,6),subscription:'stage_plus'});
 await clone('tournaments',f.tournamentId,{id:tid,name:'DEMO · Tournament Entry',type:'league',participant_type:'club',status:'registration',max_teams:2,registered_clubs:'[]',registered_players:'[]',registration_proofs:'{}',schedule_policy_version:null,club_rules:null,entry_credits:0,entry_fee_stc:0,start_date:'2027-06-01 18:00:00',creator_id:admin,creator_email:email(admin),organizer_email:email(admin),creator_gamertag:null});
 const express=require(root+'/server/node_modules/express'),app=express();app.use(express.json());require(root+'/server/src/server/routes/registerStageRoutes').registerStageRoutes(app,require(root+'/server/src/server/authMiddleware'));server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const origin='http://127.0.0.1:'+server.address().port,jwt=require(root+'/server/node_modules/jsonwebtoken');
 async function request(path,body,uid=manager){const r=await fetch(origin+'/api/stage'+path,{method:body?'POST':'GET',headers:{authorization:'Bearer '+jwt.sign({id:uid},process.env.ACCESS_TOKEN_SECRET,{expiresIn:'5m'}),'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};}
 let result=await request('/tournaments/'+tid+'/schedule',{mode:'fixed',timezone:'Europe/Brussels',entries:[1,2].map(round=>({phase:'league',round,starts_at:`2027-06-0${round}T18:00:00Z`,ends_at:`2027-06-0${round}T18:40:00Z`}))},admin);assert.equal(result.status,200,JSON.stringify(result.data));const revision=result.data.schedule.revision;
 const payload={tournament_id:tid,club_id:club,ea_club_name:'DEMO Entry Consent FC',rules_accepted:true};
 result=await request('/functions/tournamentRegistration',payload);assert.equal(result.status,409,JSON.stringify(result.data));assert.match(result.data.error,/Accept the published schedule/);
 result=await request(`/tournaments/${tid}/schedule?club_id=${club}`,null,member);assert.equal(result.status,200);assert.equal(result.data.participation.can_act,false);
 result=await request('/tournaments/'+tid+'/schedule/accept',{club_id:club,revision},member);assert.equal(result.status,403,JSON.stringify(result.data));
 result=await request('/tournaments/'+tid+'/schedule/accept',{club_id:club,revision});assert.equal(result.status,200,JSON.stringify(result.data));
 result=await request(`/tournaments/${tid}/schedule?club_id=${club}`);assert.equal(result.data.participation.accepted,true);assert.equal(result.data.participation.can_act,true);
 result=await request('/functions/tournamentRegistration',payload);assert.equal(result.status,200,JSON.stringify(result.data));assert.equal(result.data.data.success,true,JSON.stringify(result.data));assert.equal(result.data.data.pending_review,true);
 let inbox=await request('/inbox-messages');assert(inbox.data.some(m=>m.sender_gamertag==='Club Board'&&m.body.includes('awaiting approval')&&m.body.includes('DEMO · Tournament Entry')));
 result=await request('/functions/tournamentRegistrationReview',{tournament_id:tid,club_id:club,action:'approve'},admin);assert.equal(result.status,200,JSON.stringify(result.data));assert.equal(result.data.data.success,true,JSON.stringify(result.data));
 for(const uid of [manager,member]){inbox=await request('/inbox-messages',null,uid);assert(inbox.data.some(m=>m.sender_gamertag==='Club Board'&&m.body.includes('is confirmed')&&m.body.includes('Match Squad')),'approved Board mail visible in real inbox');}
 const before=(await q("SELECT COUNT(*) AS n FROM inbox_messages WHERE related_entity_id=? AND sender_gamertag='Club Board'",[tid]))[0].n;
 await db.withTransaction(query=>require(root+'/server/src/server/services/boardTournamentNotices').reconcile(query));
 assert.equal((await q("SELECT COUNT(*) AS n FROM inbox_messages WHERE related_entity_id=? AND sender_gamertag='Club Board'",[tid]))[0].n,before,'worker must not duplicate delivered mail');
 result=await request('/functions/tournamentWithdrawal',{tournament_id:tid,club_id:club},member);assert.equal(result.status,403,JSON.stringify(result.data));
 const registered=(await q('SELECT registered_clubs FROM tournaments WHERE id=?',[tid]))[0].registered_clubs;assert.deepEqual(typeof registered==='string'?JSON.parse(registered):registered,[club]);
 result=await request('/functions/tournamentWithdrawal',{tournament_id:tid,club_id:club});assert.equal(result.status,200,JSON.stringify(result.data));assert.equal(result.data.data.success,true);
 // Exact captured refunds go to the original payer, even after a Manager change.
 const chargeProof={club:{[club]:{status:'approved',submitted_at:new Date().toISOString(),submitted_by_user_id:manager,credits_spent:50,stc_locked:100}}};
 await q('UPDATE tournaments SET registered_clubs=?,registration_proofs=? WHERE id=?',[JSON.stringify([club]),JSON.stringify(chargeProof),tid]);
 await q('UPDATE users SET credits=950 WHERE id=?',[manager]);await q('UPDATE clubs SET stc=999900,president_user_id=?,user_id=?,owner_email=? WHERE id=?',[member,member,email(member),club]);
 result=await request(`/tournaments/${tid}/withdrawals?club_id=${club}`,null,member);assert.equal(result.status,200);assert.equal(result.data.policy.mode,'immediate');
 result=await request(`/tournaments/${tid}/withdrawals`,{club_id:club},member);assert.equal(result.status,200,JSON.stringify(result.data));assert.equal(result.data.refunded_credits,50);assert.equal(result.data.refunded_stc,100);
 assert.equal(Number((await q('SELECT credits FROM users WHERE id=?',[manager]))[0].credits),1000);assert.equal(Number((await q('SELECT stc FROM clubs WHERE id=?',[club]))[0].stc),1000000);
 assert.equal((await request(`/tournaments/${tid}/withdrawals`,{club_id:club},member)).status,409);
 await q('UPDATE clubs SET president_user_id=?,user_id=?,owner_email=? WHERE id=?',[manager,manager,email(manager),club]);
 const renewed={club:{[club]:{status:'approved',submitted_at:new Date().toISOString(),submitted_by_user_id:manager,credits_spent:0,stc_locked:0}}};
 await q('UPDATE tournaments SET registered_clubs=?,registration_proofs=? WHERE id=?',[JSON.stringify([club]),JSON.stringify(renewed),tid]);
 await clone('matches',f.matchId,{id:fixtureId,tournament_id:tid,type:'league',round:1,mode:'club',home_club_id:club,away_club_id:f.clubId,home_club_name:'DEMO Entry Consent FC',away_club_name:'Test Opponent',status:'scheduled',result_state:null,stats_processed:0,source_fixture_id:null,source_fixture_type:null,competition_context:null,progression_key:null,home_submission:null,away_submission:null,scheduled_date:'2027-06-01 18:00:00',confirmed_date:'2027-06-01 18:00:00',timezone:'UTC'});
 result=await request(`/tournaments/${tid}/withdrawals?club_id=${club}`);assert.equal(result.data.policy.mode,'request');
 result=await request(`/tournaments/${tid}/withdrawals`,{club_id:club,reason:'Cannot field a squad'});assert.equal(result.status,200,JSON.stringify(result.data));const firstRequest=result.data.request.id;
 assert.equal((await request(`/tournaments/${tid}/withdrawals`,{club_id:club,reason:'retry'})).data.request.id,firstRequest);
 assert.equal((await request(`/tournaments/${tid}/withdrawals/${firstRequest}/respond`,{action:'approve',reason:'Not organizer'})).status,403);
 result=await request(`/tournaments/${tid}/withdrawals/${firstRequest}/respond`,{action:'decline',reason:'Discuss an alternative time first'},admin);assert.equal(result.status,200,JSON.stringify(result.data));
 result=await request(`/tournaments/${tid}/withdrawals`,{club_id:club,reason:'Club cannot continue'});const secondRequest=result.data.request.id;
 const beforeMatch=JSON.stringify((await q('SELECT * FROM matches WHERE id=?',[fixtureId]))[0]);
 result=await request(`/tournaments/${tid}/withdrawals/${secondRequest}/respond`,{action:'approve',reason:'Accepted; sporting resolution required'},admin);assert.equal(result.status,200,JSON.stringify(result.data));
 assert.equal(JSON.stringify((await q('SELECT * FROM matches WHERE id=?',[fixtureId]))[0]),beforeMatch,'approval never rewrites results or fixtures');
 assert.equal(Number((await q('SELECT credits FROM users WHERE id=?',[manager]))[0].credits),1000,'no automatic after-draw refund');
 assert.equal((await request(`/tournaments/${tid}/withdrawals/${secondRequest}/respond`,{action:'resolve',reason:'Premature'} ,admin)).status,409);
 await q("UPDATE matches SET status='forfeit',result_state='CONFIRMED',home_score=0,away_score=3,winner_club_id=? WHERE id=?",[f.clubId,fixtureId]);
 result=await request(`/tournaments/${tid}/withdrawals/${secondRequest}/respond`,{action:'resolve',reason:'Explicit fixture decision recorded in test fixture'},admin);assert.equal(result.status,200,JSON.stringify(result.data));
 result=await request(`/tournaments/${tid}/withdrawals`,{club_id:club,reason:'Already withdrawn'});assert.equal(result.status,409);
 console.log('PASS withdrawal HTTP/JWT: exact original-payer refunds, no double refund, after-draw requests, repeat-request idempotence, organizer-only approval/decline, unchanged results, no automatic late refund and verified sporting-resolution handoff.');
 console.log('PASS HTTP/JWT: manager-only consent and withdrawal, registration blocked before consent, persisted acceptance after reload, approval and Board mail visible for manager and player, retry without duplicate messages.');
}finally{
 await q('DELETE FROM inbox_messages WHERE recipient_email IN (?,?,?)',[email(manager),email(member),email(admin)]);await q('DELETE FROM notifications WHERE recipient_email IN (?,?,?)',[email(manager),email(member),email(admin)]);
 await q("DELETE FROM league_entities WHERE entity_type IN ('tournament_schedule','tournament_schedule_consent','board_tournament_delivery','tournament_withdrawal') AND JSON_UNQUOTE(JSON_EXTRACT(data_json,'$.tournament_id'))=?",[tid]);await q('DELETE FROM admin_audit_log WHERE entity_id=?',[tid]);await q('DELETE FROM matches WHERE id=?',[fixtureId]);await q('DELETE FROM stc_transactions WHERE reference_id=?',[tid]);await q('DELETE FROM tournaments WHERE id=?',[tid]);
 for(const pid of players)await q('DELETE FROM players WHERE id=?',[pid]);await q('DELETE FROM clubs WHERE id=?',[club]);for(const uid of [manager,member,admin])await q('DELETE FROM users WHERE id=?',[uid]);if(server)await new Promise(r=>server.close(r));await db.pool.promise().end();
}})().catch(e=>{console.error(e.message);process.exitCode=1});

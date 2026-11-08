'use strict';
const {configure,bootstrap}=require('./bootstrap.cjs');
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const socketArg=process.argv.indexOf('--socket');if(socketArg!==-1)process.env.STAGE_ACCEPTANCE_SOCKET=process.argv[socketArg+1];
const config=configure(),id=()=>crypto.randomUUID(),report={database:config.database,started_at:new Date().toISOString(),scenarios:[],complete:false};let db,server;
(async()=>{
 db=await bootstrap(config);await require('../../src/server/migrations/startupMigrations').runStartupMigrations();const q=db.EXECUTESQL,express=require('express'),jwt=require('jsonwebtoken'),app=express();app.use(express.json());app.use('/api/stage',require('../../src/server/authMiddleware').verifyToken);app.use('/api/stage/tournaments',require('../../src/server/controllers/tournamentController'));app.use('/api/stage/functions',require('../../src/server/controllers/functionsController'));app.use('/api/stage/matches',require('../../src/server/controllers/matchController'));
 const admin={id:id(),email:'admin@schedule.test'},host={id:id(),email:'host@schedule.test'},outsider={id:id(),email:'outsider@schedule.test'};
 for(const [u,role]of [[admin,2],[host,1],[outsider,1]])await q('INSERT INTO users (id,email,role_id,credits) VALUES (?,?,?,5000)',[u.id,u.email,role]);
 const entrants=[];for(let i=0;i<4;i++){const user={id:id(),email:`entrant${i}@schedule.test`},player=id();await q('INSERT INTO users (id,email,role_id,credits) VALUES (?,?,1,5000)',[user.id,user.email]);await q("INSERT INTO players (id,user_id,email,gamertag,subscription,stc,credits) VALUES (?,?,?,?,'stage_plus',100000000,5000)",[player,user.id,user.email,`Schedule entrant ${i}`]);entrants.push({user,player});}
 server=app.listen(0,'127.0.0.1');await new Promise((r,j)=>{server.once('listening',r);server.once('error',j);});
 const call=async(u,route,body,expected=200,method='POST')=>{const r=await fetch(`http://127.0.0.1:${server.address().port}/api/stage/${route}`,{method,headers:{'content-type':'application/json',authorization:`Bearer ${jwt.sign(u,process.env.ACCESS_TOKEN_SECRET,{expiresIn:'1h'})}`},...(body?{body:JSON.stringify(body)}:{})});const v=await r.json();assert.equal(r.status,expected,JSON.stringify(v));return v;};
 const tournament=await call(admin,'tournaments',{name:'Organizer schedule acceptance',type:'league',participant_type:'player',max_teams:4,platform:'PlayStation',status:'registration',organizer_email:host.email,creator_email:host.email,entry_credits:50,entry_fee_stc:100,rules_template_id:'standard_cup',start_date:'2027-06-01 18:00:00'},201);
 assert.equal(tournament.schedule_policy_version,'organizer_schedule_v1');
 const tid=tournament.id,route=`tournaments/${tid}/schedule`,entries=Array.from({length:6},(_,i)=>({phase:'league',round:i+1,starts_at:`2027-06-${String(i+1).padStart(2,'0')}T18:00:00Z`,ends_at:`2027-06-${String(i+1).padStart(2,'0')}T18:40:00Z`})),body={mode:'fixed',timezone:'Europe/Brussels',entries};
 await call(outsider,route,body,403);await call(host,route,{...body,entries:[{...entries[0],ends_at:entries[0].starts_at}]},422);
 const published=await call(host,route,body);assert.equal((await call(host,route,body)).already_applied,true);
 const source=await call(entrants[0].user,route,null,200,'GET');assert.equal(source.schedule.entries.length,6);assert.equal(source.rules_current,true);
 const register=e=>({tournament_id:tid,player_id:e.player,rules_accepted:true,rules_template_id:'standard_cup',registration_proof_url:'/uploads/synthetic-entry.svg'});
 const balances=async()=>await q('SELECT id,stc,credits FROM players ORDER BY id');const before=await balances();await call(entrants[0].user,'functions/tournamentRegistration',register(entrants[0]),409);assert.deepEqual(await balances(),before);
 await call(outsider,`${route}/accept`,{revision:published.schedule.revision,player_id:entrants[0].player},403);
 const conflict=id();await q("INSERT INTO matches (id,home_player_id,status,type,scheduled_date,timezone) VALUES (?,?,'scheduled','league','2027-06-01 18:00:00','UTC')",[conflict,entrants[0].player]);
 await call(entrants[0].user,`${route}/accept`,{revision:published.schedule.revision,player_id:entrants[0].player},422);await q("UPDATE matches SET status='cancelled' WHERE id=?",[conflict]);
 for(const e of entrants){await call(e.user,`${route}/accept`,{revision:published.schedule.revision,player_id:e.player});const registered=await call(e.user,'functions/tournamentRegistration',register(e));assert.equal(registered.data.success,true,JSON.stringify(registered));}
 await call(host,route,{...body,entries:[{...entries[0],starts_at:'2027-07-01T18:00:00Z',ends_at:'2027-07-01T18:40:00Z'}],expected_revision:published.schedule.revision},409);
 report.scenarios.push('Actual creation captures new scheduling terms; owner-only publication, exact snapshot consent before paid entry, outsider and conflicting entry refusal; registered participants prevent silent replacement');
 await call(host,'functions/generateTournamentDraw',{tournament_id:tid});
 const matches=await q('SELECT * FROM matches WHERE tournament_id=?',[tid]);assert.equal(matches.length,12);assert.ok(matches.every(m=>m.scheduled_date&&m.timezone==='UTC'&&m.scheduling_status==='confirmed'));
 await call(admin,`matches/${matches[0].id}`,{scheduled_date:'2027-08-01 18:00:00'},409,'PATCH');
 report.scenarios.push('Actual initial draw applies participant-accepted fixed rounds; generic schedule PATCH cannot escape them');
 const selected=matches[0],changeRoute=`tournaments/${tid}/schedule/changes`,proposal={decision_id:id(),match_id:selected.id,starts_at:'2027-06-10T18:00:00Z',reason:'Organizer requests an agreed alternative time.'};
 await call(outsider,changeRoute,proposal,403);const change=await call(host,changeRoute,proposal);const home=entrants.find(e=>e.player===selected.home_player_id),away=entrants.find(e=>e.player===selected.away_player_id),responsePath=`${changeRoute}/${change.change.id}/respond`;
 await call(outsider,responsePath,{action:'accept',revision:change.change.revision,player_id:home.player},403);
 await call(home.user,responsePath,{action:'accept',revision:change.change.revision,player_id:home.player});assert.equal((await q('SELECT scheduled_date FROM matches WHERE id=?',[selected.id]))[0].scheduled_date,selected.scheduled_date);
 await call(away.user,responsePath,{action:'accept',revision:change.change.revision,player_id:away.player});const agreed=(await q('SELECT * FROM matches WHERE id=?',[selected.id]))[0];assert.equal(agreed.scheduled_date,'2027-06-10 18:00:00');
 const notices=(await q('SELECT COUNT(*) AS n FROM notifications WHERE related_id=?',[change.change.id]))[0].n;assert.equal((await call(away.user,responsePath,{action:'accept',revision:change.change.revision,player_id:away.player})).already_applied,true);assert.equal((await q('SELECT COUNT(*) AS n FROM notifications WHERE related_id=?',[change.change.id]))[0].n,notices);
 await require('../../src/server/services/tournamentScheduleService').assertMatch(tournament,agreed,agreed.scheduled_date,q);await assert.rejects(require('../../src/server/services/tournamentScheduleService').assertMatch(tournament,agreed,'2027-06-10 19:00:00',q),/outside/);
 report.scenarios.push('Organizer-requested fixture change preserves the old time until both actual participants agree; outsider refusal, persisted exception, notification and acceptance retries verified');

 const service=require('../../src/server/services/tournamentScheduleService');
 const windows=await call(admin,'tournaments',{name:'Window schedule acceptance',type:'league',participant_type:'player',max_teams:4,platform:'PlayStation',status:'registration',entry_credits:50,entry_fee_stc:100,rules_template_id:'standard_cup'},201);
 await call(admin,`tournaments/${windows.id}/schedule`,{mode:'windows',timezone:'Europe/Brussels',entries:[{phase:'league',round:1,starts_at:'2027-09-01T18:00:00Z',ends_at:'2027-09-01T20:00:00Z'}]});
 const candidate={type:'league',round:1,timezone:'UTC',scheduled_date:'2027-09-01 18:00:00'};
 await service.assertMatch(windows,candidate,'2027-09-01 19:20:00',q);
 await assert.rejects(service.assertMatch(windows,candidate,'2027-09-01 19:30:00',q),/outside/);
 report.scenarios.push('Bounded windows allow a complete 40-minute block and reject a kickoff whose block overruns the end');report.organizer_schedule_route_complete=true;
})().catch(e=>{report.error=e.stack;process.exitCode=1;}).finally(async()=>{report.finished_at=new Date().toISOString();fs.writeFileSync(path.resolve(__dirname,'../../../docs/acceptance-results/organizer-schedule-2026-11-08.json'),JSON.stringify(report,null,2)+'\n');if(server)await new Promise(r=>server.close(r));if(db)await db.pool.promise().end();console.log(JSON.stringify(report,null,2));});

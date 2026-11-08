'use strict';
// Use existing isolated acceptance data; complete only the synthetic viewer profile. No production fallback or server jobs.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const socketArg=process.argv.indexOf('--socket');if(socketArg!==-1)process.env.STAGE_ACCEPTANCE_SOCKET=process.argv[socketArg+1];
const {configure}=require('./bootstrap.cjs');configure();
const report=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../docs/acceptance-results/normal-season-2026-11-06.json'),'utf8'));
if(!/^stage_acceptance_[a-f0-9]{12}$/.test(report.database))throw Error('Not an isolated acceptance schema');
process.env.DB_NAME=report.database;
const db=require('../../src/server/db/database'),express=require('express'),jwt=require('jsonwebtoken');
(async()=>{
 const app=express();app.use(express.json());
 require('../../src/server/routes/registerStageRoutes').registerStageRoutes(app,require('../../src/server/authMiddleware'));
 const [user]=await db.EXECUTESQL("SELECT id,email,player_id,owner_id FROM users WHERE email='acceptance-owner-0@example.test'");
 const [league]=await db.EXECUTESQL("SELECT id,data_json FROM league_entities WHERE entity_type='regional_league' AND season_number=2 ORDER BY id LIMIT 1");
 await db.EXECUTESQL("UPDATE players SET country='United Kingdom',country_code='GB',position='ST' WHERE id=?",[user.player_id]);
 await require('../../src/server/migrations/startupMigrations').runStartupMigrations();
 const [admin]=await db.EXECUTESQL("SELECT id,email FROM users WHERE email='acceptance-admin@example.test'");
 const tournamentId='98e4abe9-0932-4baa-84d5-e6e9a98199b8';
 await db.EXECUTESQL("INSERT INTO tournaments (id,name,type,participant_type,status,max_teams,schedule_policy_version,organizer_email,creator_email,registered_players,registered_clubs) VALUES (?,'Browser schedule example','league','player','registration',4,'organizer_schedule_v1',?,?,JSON_ARRAY(),JSON_ARRAY()) ON DUPLICATE KEY UPDATE id=id",[tournamentId,admin.email,admin.email]);
 const priorSchedule=await require('../../src/server/services/tournamentScheduleService').read(tournamentId);
 await require('../../src/server/services/tournamentScheduleService').publish(tournamentId,{expected_revision:priorSchedule.schedule?.revision,mode:'fixed',timezone:'Europe/Brussels',entries:[{phase:'league',round:1,starts_at:'2027-08-01T18:00:00Z',ends_at:'2027-08-01T18:40:00Z'}]},admin);
 const adminToken=jwt.sign({id:admin.id,email:admin.email},process.env.ACCESS_TOKEN_SECRET,{expiresIn:'48h'});
 const token=jwt.sign({id:user.id,email:user.email},process.env.ACCESS_TOKEN_SECRET,{expiresIn:'48h'});
  fs.writeFileSync('/private/tmp/stage-browser-fixture.json',JSON.stringify({adminToken,adminUserId:admin.id,tournamentId,accessToken:token,userId:user.id,playerId:user.player_id,ownerId:user.owner_id,leagueId:league.id,league:JSON.parse(league.data_json)}),{mode:0o600});
 const server=app.listen(18088,'127.0.0.1',()=>{
  console.log('Isolated browser fixture ready at 127.0.0.1:18088');
 });
 process.on('SIGTERM',()=>server.close(()=>db.pool.promise().end().then(()=>process.exit(0))));
})().catch(error=>{console.error(error);process.exitCode=1;db.pool.promise().end();});

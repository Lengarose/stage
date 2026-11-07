'use strict';
// Use existing isolated acceptance data; complete only the synthetic viewer profile. No production fallback or server jobs.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
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
 const token=jwt.sign({id:user.id,email:user.email},process.env.ACCESS_TOKEN_SECRET,{expiresIn:'48h'});
  fs.writeFileSync('/private/tmp/stage-browser-fixture.json',JSON.stringify({accessToken:token,userId:user.id,playerId:user.player_id,ownerId:user.owner_id,leagueId:league.id,league:JSON.parse(league.data_json)}),{mode:0o600});
 const server=app.listen(18088,'127.0.0.1',()=>{
  console.log('Isolated browser fixture ready at 127.0.0.1:18088');
 });
 process.on('SIGTERM',()=>server.close(()=>db.pool.promise().end().then(()=>process.exit(0))));
})().catch(error=>{console.error(error);process.exitCode=1;db.pool.promise().end();});

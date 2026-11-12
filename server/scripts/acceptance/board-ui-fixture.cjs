'use strict';
// Disposable local-only walkthrough. No production credentials or external jobs.
const {configure,bootstrap}=require('./bootstrap.cjs');
const config=configure(),fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
let db,server;
(async()=>{
 if(process.argv.includes('--resume')) {
  const saved=JSON.parse(fs.readFileSync('/private/tmp/stage-board-ui-fixture.json','utf8'));
  if(!/^stage_acceptance_[a-f0-9]{12}$/.test(saved.database))throw new Error('Disposable database required');
  process.env.DB_NAME=saved.database;db=require('../../src/server/db/database');
  const app=require('express')();app.use(require('express').json());require('../../src/server/routes/registerStageRoutes').registerStageRoutes(app,require('../../src/server/authMiddleware'));
  server=app.listen(18091,'127.0.0.1',()=>console.log('Resumed disposable Board UI walkthrough on 18091'));
  process.on('SIGTERM',()=>server.close(()=>db.pool.promise().end().then(()=>process.exit(0))));return;
 }
 db=await bootstrap(config);await require('../../src/server/migrations/startupMigrations').runStartupMigrations();const q=db.EXECUTESQL,id=()=>crypto.randomUUID();
 const app=require('express')();app.use(require('express').json());
 require('../../src/server/routes/registerStageRoutes').registerStageRoutes(app,require('../../src/server/authMiddleware'));
 const manager={id:id(),email:'manager@walkthrough.stage.test'},password=crypto.randomBytes(18).toString('hex');
 await q('INSERT INTO users (id,email,password_hash,role_id,credits) VALUES (?,?,?,1,1000)',[manager.id,manager.email,await require('bcryptjs').hash(password,10)]);
 const player=id();await q("INSERT INTO players (id,user_id,email,gamertag,position,platform,country,country_code,subscription,status) VALUES (?,?,?,'Arena Manager','CM','PlayStation','United Kingdom','GB','stage_plus','active')",[player,manager.id,manager.email]);
 const founder=await require('../../src/server/services/founderContractLifecycleService').createFounderContractLifecycle({user:manager,playerId:player,club:{name:'Arena Walkthrough FC',tag:'AWF',platform:'PlayStation'},idempotencyKey:'board-ui-demo'}),club=founder.club.id;
 await q('UPDATE users SET player_id=?,owner_id=? WHERE id=?',[player,founder.club.president_id||null,manager.id]);
 await q("INSERT INTO transfer_windows (id,label,status) VALUES (?,'Local walkthrough','open')",[id()]);
 for(let n=1;n<=2;n++){const uid=id(),pid=id();await q('INSERT INTO users (id,email,role_id) VALUES (?,?,1)',[uid,`player${n}@walkthrough.stage.test`]);await q("INSERT INTO players (id,user_id,email,gamertag,club_id,position,platform,country,country_code,subscription,status) VALUES (?,?,?,?,?,'ST','PlayStation','United Kingdom','GB','stage_plus','active')",[pid,uid,`player${n}@walkthrough.stage.test`,`Arena Player ${n}`,club]);}
 const away=id(),tournament=id(),match=id();await q("INSERT INTO clubs (id,name,tag,president_user_id,owner_email) VALUES (?,'Visiting Test FC','VTF',?,?)",[away,manager.id,'away@walkthrough.stage.test']);
 const rules=require('../../src/server/lib/clubTournamentParticipation').rules({minimum_human_players:3,goalkeeper_required:true,any_allowed:false});
 await q("INSERT INTO tournaments (id,name,type,participant_type,status,max_teams,registered_clubs,club_rules,custom_rules,organizer_email,creator_email) VALUES (?,'Arena Rules Demonstration','knockout','club','registration',8,JSON_ARRAY(),?, ?,?,?)",[tournament,JSON.stringify(rules),'Welcome to the Arena Cup. Three human starters are required, including a goalkeeper. ANY is not permitted. Confirm your Match Squad in GameDay before kickoff.',manager.email,manager.email]);
 await q("INSERT INTO matches (id,home_club_id,away_club_id,home_club_name,away_club_name,tournament_id,status,scheduling_status,mode,scheduled_date) VALUES (?,?,?,'Arena Walkthrough FC','Visiting Test FC',?,'scheduled','confirmed','club',DATE_ADD(NOW(),INTERVAL 30 MINUTE))",[match,club,away,tournament]);
 const related=id(),foreign=id();for(let n=0;n<205;n++)await q("INSERT INTO inbox_messages (id,recipient_email,sender_email,sender_gamertag,subject,body,is_read,status,action_type,related_entity_id,related_entity_type) VALUES (?,?,'board@stage.test','Club Board',?,?,0,'pending','none',?,'test_notice')",[id(),manager.email,`Season update ${n+1}`,'Dear Manager,\n\nYour club is preparing for the season. Review the calendar and confirm an eligible Match Squad before kickoff.\n\nKind regards,\nClub Board',related]);
 await q("INSERT INTO inbox_messages (id,recipient_email,sender_email,subject,body,is_read) VALUES (?,'other@walkthrough.stage.test','board@stage.test','Private message','Not visible to this account',0)",[foreign]);
 const jwt=require('jsonwebtoken'),token=jwt.sign(manager,process.env.ACCESS_TOKEN_SECRET,{expiresIn:'6h'});
 server=app.listen(18091,'127.0.0.1');await new Promise((r,j)=>{server.once('listening',r);server.once('error',j);});
 async function call(path,method='GET',body){const res=await fetch(`http://127.0.0.1:18091/api/stage/${path}`,{method,headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const data=await res.json();assert.equal(res.status,200,JSON.stringify(data));return data;}
 assert.equal((await call(`club-board/clubs/${club}/contract-options?player_id=${player}`)).card.level,1);
 assert.equal((await call(`tournaments/${tournament}/club-eligibility/${club}`)).eligible_count,3);
 await call('inbox-messages/mark-all-read','POST',{});assert.equal(Number((await q('SELECT COUNT(*) AS n FROM inbox_messages WHERE recipient_email=? AND is_read=0',[manager.email]))[0].n),0);assert.equal(Number((await q('SELECT is_read FROM inbox_messages WHERE id=?',[foreign]))[0].is_read),0);
 const [notice]=await q('SELECT * FROM inbox_messages WHERE related_entity_id=? LIMIT 1',[related]);const deleted=await call(`inbox-messages/${notice.id}/delete-conversation`,'POST',{});assert.equal(deleted.deleted_ids.length,205);assert.equal((await call('inbox-messages')).some(r=>r.related_entity_id===related),false);assert.equal(Number((await q('SELECT COUNT(*) AS n FROM inbox_messages WHERE related_entity_id=? AND deleted_at IS NOT NULL',[related]))[0].n),205);
 const out={database:config.database,origin:'http://127.0.0.1:4176',email:manager.email,password,userId:manager.id,playerId:player,clubId:club,tournamentId:tournament,matchId:match,proposalId:founder.boardOffers.find(p=>p.kind==='management').id};
 fs.writeFileSync('/private/tmp/stage-board-ui-fixture.json',JSON.stringify(out),{mode:0o600});
 console.log('PASS actual HTTP: contract options, roster eligibility, account-wide 200+ read, conversation deletion, recipient isolation and retained evidence. Isolated walkthrough ready on 18091.');
 process.on('SIGTERM',()=>server.close(()=>db.pool.promise().end().then(()=>process.exit(0))));
})().catch(async e=>{console.error(e);server?.close();if(db)await db.pool.promise().end();process.exitCode=1;});

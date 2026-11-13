// Run only with an existing disposable acceptance fixture; no production database is accepted.
// node server/scripts/acceptance/club-deletion.cjs /private/tmp/fixture.json [--repair]
const fs=require('fs'),assert=require('assert/strict'),{randomUUID:id}=require('crypto');
const root=require('path').resolve(__dirname,'../../..');
process.env.STAGE_ACCEPTANCE_SOCKET='/private/tmp/stage-season-acceptance-training.sock';require(root+'/server/scripts/acceptance/bootstrap.cjs').configure();
const saved=JSON.parse(fs.readFileSync(process.argv[2]));assert.match(saved.database,/^stage_acceptance_[a-f0-9]{12}$/);process.env.DB_NAME=saved.database;
const db=require(root+'/server/src/server/db/database'),q=db.EXECUTESQL;const actor=id(),player=id(),club=id(),contract=id(),otherUser=id(),otherPlayer=id(),otherContract=id(),pendingContract=id(),membership=id(),agreement=id(),proposal=id();
async function clone(table,source,changes){const [row]=await q('SELECT * FROM '+table+' WHERE id=?',[source]);assert.ok(row,table+' source');Object.assign(row,changes);const cols=Object.keys(row);await q('INSERT INTO '+table+' ('+cols.map(c=>'`'+c+'`').join(',')+') VALUES ('+cols.map(()=>'?').join(',')+')',cols.map(c=>row[c] != null && typeof row[c] === "object" ? JSON.stringify(row[c]) : row[c]));}
(async()=>{try{
 await clone('users',saved.userId,{id:actor,owner_id:club,email:'deletion-'+actor+'@stage.test'});
 await clone('players',saved.playerId,{id:player,user_id:actor,email:'deletion-'+actor+'@stage.test',club_id:null});
 await clone('users',saved.userId,{id:otherUser,owner_id:null,email:'member-'+otherUser+'@stage.test'});
 await clone('players',saved.playerId,{id:otherPlayer,user_id:otherUser,email:'member-'+otherUser+'@stage.test',club_id:null});
 await clone('clubs',saved.clubId,{id:club,president_id:null,president_user_id:actor,user_id:actor,owner_email:"deletion-"+actor+"@stage.test",president_player_id:player,name:'Disposable deletion repro'});
 await q('UPDATE players SET club_id=? WHERE id=?',[club,player]);
 const [template]=await q('SELECT id FROM player_contracts WHERE team_id=? LIMIT 1',[saved.clubId]);assert.ok(template,'contract template');
 await clone('player_contracts',template.id,{id:contract,team_id:club,user_id:player,status:'active'});
 await clone('player_contracts',template.id,{id:otherContract,team_id:club,user_id:otherPlayer,status:'active'});
 await clone('player_contracts',template.id,{id:pendingContract,team_id:club,user_id:otherPlayer,status:'pending'});
 await q('UPDATE players SET club_id=? WHERE id=?',[club,otherPlayer]);
 await q("INSERT INTO club_memberships (id,club_id,player_id,user_id,status) VALUES (?,?,?,?,'active')",[membership,club,otherPlayer,otherUser]);
 await q("INSERT INTO league_entities (id,entity_type,club_id,status,data_json) VALUES (?,'club_agreement',?,'active',?)",[agreement,club,JSON.stringify({id:agreement,club_id:club,player_id:player,kind:'management',status:'active',starts_at:new Date().toISOString(),ends_at:new Date().toISOString(),weekly_salary_stc:0,payroll_through:new Date().toISOString()})]);
 await q("INSERT INTO league_entities (id,entity_type,club_id,status,data_json) VALUES (?,'club_contract_proposal',?,'pending',?)",[proposal,club,JSON.stringify({id:proposal,club_id:club,player_id:player,status:'pending'})]);
 const express=require(root+'/server/node_modules/express'),app=express();app.use(express.json());
 require(root+'/server/src/server/routes/registerStageRoutes').registerStageRoutes(app,require(root+'/server/src/server/authMiddleware'));
 const server=app.listen(0,'127.0.0.1');await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject)});
 const origin='http://127.0.0.1:'+server.address().port;
 const token=require(root+'/server/node_modules/jsonwebtoken').sign({id:actor,email:'deletion-'+actor+'@stage.test',role_id:1},process.env.ACCESS_TOKEN_SECRET,{expiresIn:'5m'});
 const headers={authorization:'Bearer '+token,'content-type':'application/json'};
 async function invoke(){const res=await fetch(origin+'/api/stage/functions/deleteClub',{method:'POST',headers,body:JSON.stringify({club_id:club})});const data=await res.json();if(!res.ok)throw Object.assign(new Error(data.error),{status:res.status});return data;}
 const handlers={deleteClub:invoke};
 global.testServer=server;global.testOrigin=origin;global.testHeaders=headers;
 for(const type of ['regional_league','competition_season','regional_cup_edition']) {
   const event=id();await q('INSERT INTO league_entities (id,entity_type,status,data_json) VALUES (?,?,?,?)',[event,type,'running',JSON.stringify({status:'running',name:'Disposable guard',registered_club_ids:[club],participant_ids:[club]})]);
   await assert.rejects(()=>handlers.deleteClub({_auth_user_id:actor,club_id:club}),e=>e.status===409);
   assert.equal((await q('SELECT status FROM player_contracts WHERE id=?',[contract]))[0].status,'active');
   await q('DELETE FROM league_entities WHERE id=?',[event]);
 }
 if(process.argv.includes('--repair')) {await q('DELETE FROM clubs WHERE id=?',[club]);await require(root+'/server/src/server/services/clubDissolutionService').repairDeletedClubContracts();await require(root+'/server/src/server/services/clubDissolutionService').repairDeletedClubContracts();} else await invoke();
 const response=await fetch(global.testOrigin+'/api/stage/players/'+player,{headers:global.testHeaders});assert.equal(response.status,200);assert.equal((await response.json()).status,'free_agent');
 const [left]=await q('SELECT status FROM player_contracts WHERE id=?',[contract]);
 assert.equal(left?.status,'terminated','Deleted club must leave no active player contract');
 const [released]=await q('SELECT club_id,status FROM players WHERE id=?',[player]);assert.equal(released.club_id,null);assert.equal(released.status,'free_agent');
 assert.equal((await q('SELECT status FROM player_contracts WHERE id=?',[otherContract]))[0].status,'terminated');
 assert.equal((await q('SELECT status FROM player_contracts WHERE id=?',[pendingContract]))[0].status,'cancelled');
 assert.equal((await q('SELECT status FROM players WHERE id=?',[otherPlayer]))[0].status,'free_agent');
 assert.equal((await q('SELECT owner_id FROM users WHERE id=?',[actor]))[0].owner_id,null);
 assert.equal((await q('SELECT status FROM club_memberships WHERE id=?',[membership]))[0].status,'inactive');
 assert.equal((await q('SELECT status FROM league_entities WHERE id=?',[agreement]))[0].status,'terminated');
 assert.equal((await q('SELECT status FROM league_entities WHERE id=?',[proposal]))[0].status,'cancelled');
 assert.equal((await q("SELECT COUNT(*) n FROM inbox_messages WHERE related_entity_type='club_dissolution' AND JSON_UNQUOTE(JSON_EXTRACT(metadata,'$.club_id'))=?",[club]))[0].n,2);
 console.log('PASS: Regional League/GOST/Cup entries block deletion atomically; two players released; player + management contracts ended; pending offers cancelled; membership inactive; two release emails in Inbox.');
 }finally{if(global.testServer)await new Promise(r=>global.testServer.close(r));await q('DELETE FROM player_contracts WHERE team_id=?',[club]);await q('DELETE FROM club_memberships WHERE club_id=?',[club]);await q('DELETE FROM clubs WHERE id=?',[club]);await q('DELETE FROM league_entities WHERE club_id=?',[club]);await q('DELETE FROM players WHERE id IN (?,?)',[player,otherPlayer]);await q('DELETE FROM users WHERE id IN (?,?)',[actor,otherUser]);await db.pool.promise().end();}})().catch(e=>{console.error(e.message);process.exitCode=1});

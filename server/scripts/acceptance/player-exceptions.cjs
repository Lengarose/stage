'use strict';
const { configure, bootstrap } = require('./bootstrap.cjs');
const assert = require('node:assert/strict'), crypto = require('node:crypto'), fs = require('node:fs'), path = require('node:path');
const config = configure(), id = () => crypto.randomUUID();
let db, server;
const NativeDate = Date;
let now = NativeDate.parse('2027-03-10T12:00:00Z');
const report = { database: config.database, started_at: new NativeDate().toISOString(), scenarios: [], complete: false, scope: 'Permanent player transfers, individual conflicts and removal of loans; not the full programme exception matrix.' };
async function main() {
 db = await bootstrap(config);
 await require('../../src/server/migrations/startupMigrations').runStartupMigrations();
 global.Date = class extends NativeDate { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } };
 const q = db.EXECUTESQL, jwt = require('jsonwebtoken'), express = require('express'), app = express();
 app.use(express.json());app.use('/api/stage', require('../../src/server/authMiddleware').verifyToken);
 app.use('/api/stage/functions', require('../../src/server/controllers/functionsController'));
 app.use('/api/stage/player-loans', require('../../src/server/controllers/playerLoanController'));
 app.use('/api/stage/lineups', require('../../src/server/controllers/clubFixtureLineupController'));
 app.use('/api/stage/player-contracts', require('../../src/server/controllers/playerContractController'));
 app.use('/api/stage/players', require('../../src/server/controllers/playerController'));
 server = app.listen(0, '127.0.0.1');await new Promise((resolve,reject) => { server.once('listening',resolve);server.once('error',reject); });
 const actors = {};
 for (const [role, roleId] of [['admin',2],['owner',1],['player',1],['outsider',1]]) {
  actors[role] = { id: id(), email: `${role}@acceptance.example.test` };
  await q('INSERT INTO users (id,email,role_id) VALUES (?,?,?)', [actors[role].id,actors[role].email,roleId]);
 }
 async function call(actor, route, body, expected = 200, method = 'POST') {
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/stage/${route}`, {
   method, headers: { 'content-type':'application/json', authorization:`Bearer ${jwt.sign(actors[actor],process.env.ACCESS_TOKEN_SECRET,{expiresIn:'1h'})}` }, ...(body ? {body:JSON.stringify(body)} : {}),
  });const value=await response.json();assert.equal(response.status, expected, JSON.stringify(value));return value;
 }
 const clubs = [id(),id()];
 for (const [i, club] of clubs.entries()) await q("INSERT INTO clubs (id,name,user_id,president_user_id,owner_email,stc,wage_budget_stc,transfer_budget_stc,stadium_level) VALUES (?,?,?,?,?,100000000,1000000,1000000,1)", [club,`Club ${i}`,actors.owner.id,actors.owner.id,actors.owner.email]);
 const player = id();await q("INSERT INTO players (id,user_id,email,gamertag,club_id,subscription) VALUES (?,?,?,?,?,'stage_plus')", [player,actors.player.id,actors.player.email,'Transfer player',clubs[0]]);
 const contract = id();await q("INSERT INTO player_contracts (id,team_id,user_id,contract_type,status,weekly_salary_stc,signing_bonus_stc,transfer_fee_stc,max_days) VALUES (?,?,?,'squad','pending',0,100,200,90)",[contract,clubs[1],player]);
 const transfer = require('../../src/server/services/officialPlayerTransferService');
 const window = { id:id(),region_slug:'uk-ireland',status:'published',policy_version:'regional_registration_v1',player_transfer_policy_version:transfer.VERSION,confirmation_closes_at:'2027-03-07T23:00:00Z',league_start_monday:'2027-03-22' };
 await q("INSERT INTO league_entities (id,entity_type,status,data_json) VALUES (?,'regional_registration_window','published',?)",[window.id,JSON.stringify(window)]);
 const registration = {id:id(),club_id:clubs[1],registration_window_id:window.id,participation_status:'confirmed',club_roster_player_ids:[]};
 await q("INSERT INTO league_entities (id,entity_type,club_id,status,data_json) VALUES (?,'season_registration',?,'approved',?)",[registration.id,clubs[1],JSON.stringify(registration)]);
 const totals = async () => (await q('SELECT (SELECT COALESCE(SUM(stc),0) FROM clubs) AS clubs,(SELECT COALESCE(SUM(stc),0) FROM players) AS players,(SELECT COUNT(*) FROM stc_transactions) AS club_ledger,(SELECT COUNT(*) FROM player_stc_transactions) AS player_ledger'))[0];
 const before = await totals();
 await call('outsider','functions/contractManagement',{action:'accept',contract_id:contract},403);
 await call('player','functions/contractManagement',{action:'accept',contract_id:contract},422);
 assert.deepEqual(await totals(), before);
 assert.equal((await q('SELECT status FROM player_contracts WHERE id=?',[contract]))[0].status,'pending');
 await call('outsider',`player-contracts/${contract}`,{status:'active'},409,'PATCH');
 report.scenarios.push('Outsider forbidden and placement transfer rejected atomically, without financial or contract changes');
 now=NativeDate.parse('2027-04-26T12:00:00Z');
 await call('player','functions/contractManagement',{action:'accept',contract_id:contract});
 assert.equal((await q('SELECT club_id FROM players WHERE id=?',[player]))[0].club_id,clubs[1]);
 assert.equal((await q("SELECT COUNT(*) AS n FROM league_entities WHERE entity_type='official_player_transfer'"))[0].n,1);
 const paid=await totals();
 assert.equal((await call('player','functions/contractManagement',{action:'accept',contract_id:contract})).data.already_applied,true);
 assert.deepEqual(await totals(),paid);
 await call('player',`players/${player}`,{club_id:clubs[0]},422,'PATCH');
 report.scenarios.push('Week-six permanent transfer persists one receipt; a lost-response retry charges no second fee; profile PATCH cannot bypass registration');
 const selection={ids:[player],club_id:clubs[1]},ctx={root:{participation_window_snapshot:window},match:{id:id(),scheduled_date:'2027-04-26T18:00:00Z',timezone:'Europe/Brussels'},engine:{phase:'league'}};
 await db.withTransaction(query=>transfer.assertSelection(ctx,selection,query));
 const solo=id();await q("INSERT INTO matches (id,home_player_id,status,type,scheduled_date,timezone) VALUES (?,?,'scheduled','knockout','2027-04-26 18:30:00','UTC')",[solo,player]);
 await assert.rejects(db.withTransaction(query=>require('../../src/server/services/officialPlayerConflictService').assertSelection(ctx,selection,query)),/overlapping/);
 await q("UPDATE matches SET scheduled_date='2027-04-26 18:40:00' WHERE id=?",[solo]);
 await db.withTransaction(query=>require('../../src/server/services/officialPlayerConflictService').assertSelection(ctx,selection,query));
 report.scenarios.push('Individual tournament overlap rejected from persisted MySQL fixtures; adjacent blocks allowed');
 // Actual HTTP selection and readiness, with current stored club permissions.
 const homeRoster=[player],awayRoster=[];
 for(const [club,roster] of [[clubs[1],homeRoster],[clubs[0],awayRoster]]) {
  while(roster.length<3){const extra=id();roster.push(extra);await q("INSERT INTO players (id,gamertag,club_id,subscription) VALUES (?,?,?,'stage_plus')",[extra,`Selected ${extra.slice(0,6)}`,club]);}
 }
 registration.club_roster_player_ids=homeRoster.slice(1);
 await q("UPDATE league_entities SET data_json=? WHERE id=?",[JSON.stringify(registration),registration.id]);
 const awayRegistration={id:id(),club_id:clubs[0],registration_window_id:window.id,participation_status:'confirmed',club_roster_player_ids:awayRoster};
 await q("INSERT INTO league_entities (id,entity_type,club_id,status,data_json) VALUES (?,'season_registration',?,'approved',?)",[awayRegistration.id,clubs[0],JSON.stringify(awayRegistration)]);
 const league={id:id(),status:'in_progress',regional_participation_policy_version:'regional_registration_v1',participation_window_snapshot:window};
 await q("INSERT INTO league_entities (id,entity_type,status,data_json) VALUES (?,'regional_league','in_progress',?)",[league.id,JSON.stringify(league)]);
 const fixture=id();
 await q("INSERT INTO league_entities (id,entity_type,league_id,data_json) VALUES (?,'regional_league_fixture',?,?)",[fixture,league.id,JSON.stringify({id:fixture,league_id:league.id,match_id:ctx.match.id,home_club_id:clubs[1],away_club_id:clubs[0]})]);
 await q("INSERT INTO matches (id,home_club_id,away_club_id,home_owner_email,away_owner_email,status,type,scheduled_date,confirmed_date,timezone,scheduling_status,source_fixture_type,source_fixture_id) VALUES (?,?,?,?,?,'scheduled','regional_league','2027-04-26 18:00:00','2027-04-26 18:00:00','UTC','confirmed','regional_league',?)",[ctx.match.id,clubs[1],clubs[0],actors.owner.email,actors.owner.email,fixture]);
 const homeSelection={club_id:clubs[1],fixture_id:fixture,fixture_type:'regional_league',starting_players:homeRoster,bench_players:[],status:'published'};
 const awaySelection={...homeSelection,club_id:clubs[0],starting_players:awayRoster};
 await call('outsider','lineups',homeSelection,403);
 await q("UPDATE players SET subscription='free' WHERE id=?",[homeRoster[1]]);
 await call('owner','lineups',homeSelection,422);
 await q("UPDATE players SET subscription='stage_plus' WHERE id=?",[homeRoster[1]]);
 await call('owner','lineups',homeSelection,201);await call('owner','lineups',awaySelection,201);
 now=NativeDate.parse('2027-04-26T17:50:00Z');
 await q("UPDATE players SET subscription='free' WHERE id=?",[homeRoster[1]]);
 const preparationPath=`lineups/preparation/${clubs[1]}/${fixture}`;
 const prep=await call('owner',preparationPath,null,200,'GET');assert.equal(prep.eligible,false);
 await call('owner',preparationPath,{action:'ready',expected_revision:prep.selection_revision},422);
 await q("UPDATE players SET subscription='stage_plus' WHERE id=?",[homeRoster[1]]);
 for(const club of clubs){const route=`lineups/preparation/${club}/${fixture}`;const current=await call('owner',route,null,200,'GET');await call('owner',route,{action:'ready',expected_revision:current.selection_revision});}
 now=NativeDate.parse('2027-04-26T18:00:00Z');
 await q("UPDATE players SET subscription='free' WHERE id=?",[homeRoster[1]]);
 await call('owner','functions/matchKickoff',{action:'kickoff',match_id:ctx.match.id},422);
 assert.equal((await q("SELECT COUNT(*) AS n FROM league_entities WHERE entity_type='official_match_selection'"))[0].n,0);
 await q("UPDATE players SET subscription='stage_plus' WHERE id=?",[homeRoster[1]]);
 await call('owner','functions/matchKickoff',{action:'kickoff',match_id:ctx.match.id});
 report.scenarios.push('Actual owner/outsider HTTP lineup permissions; expired Plus rejected at publication, readiness and kickoff; a failed kickoff creates no frozen selection');
 now=NativeDate.parse('2027-05-03T12:00:00Z');
 const free=id(),freeContract=id();
 await q("INSERT INTO players (id,user_id,email,gamertag,subscription) VALUES (?,?,?,'Free player','stage_plus')",[free,actors.outsider.id,actors.outsider.email]);
 await q("INSERT INTO player_contracts (id,team_id,user_id,contract_type,status,weekly_salary_stc,max_days) VALUES (?,?,?,'squad','pending',0,90)",[freeContract,clubs[1],free]);
 const evidence=id();await q("INSERT INTO matches (id,home_club_id,home_submission,status) VALUES (?,?,?,'completed')",[evidence,clubs[0],JSON.stringify({participating_player_ids:[free]})]);
 await q("INSERT INTO league_entities (id,entity_type,data_json) VALUES (?,'official_match_selection',?)",[id(),JSON.stringify({match_id:evidence,edition_id:league.id})]);
 await call('outsider','functions/contractManagement',{action:'accept',contract_id:freeContract},422);
 await q("UPDATE matches SET home_submission=? WHERE id=?",[JSON.stringify({participating_player_ids:[],bench_players:[free]}),evidence]);
 const foreignRoot=id(),foreignMatch=id();
 const foreignWindow={...window,id:id(),region_slug:'france'};
 await q("INSERT INTO league_entities (id,entity_type,status,data_json) VALUES (?,'regional_league','in_progress',?)",[foreignRoot,JSON.stringify({id:foreignRoot,status:'in_progress',participation_window_snapshot:foreignWindow})]);
 await q("INSERT INTO matches (id,home_club_id,home_submission,status) VALUES (?,?,?,'completed')",[foreignMatch,clubs[0],JSON.stringify({participating_player_ids:[free]})]);
 await q("INSERT INTO league_entities (id,entity_type,data_json) VALUES (?,'official_match_selection',?)",[id(),JSON.stringify({match_id:foreignMatch,edition_id:foreignRoot})]);
 await call('outsider','functions/contractManagement',{action:'accept',contract_id:freeContract},422);
 await q("UPDATE matches SET home_submission=? WHERE id=?",[JSON.stringify({participating_player_ids:[],bench_players:[free]}),foreignMatch]);
 await call('outsider','functions/contractManagement',{action:'accept',contract_id:freeContract});
 report.scenarios.push('Actual HTTP free-player signing outside week six rejects prior declared play for another club but permits bench-only evidence');
 const newFree=id();await q("INSERT INTO players (id,user_id,email,gamertag,subscription) VALUES (?,?,?,'New free player','stage_plus')",[newFree,actors.admin.id,actors.admin.email]);
 const offered=await call('owner','functions/contractActions',{action:'offer',team_id:clubs[1],target_player_id:newFree,contract_type:'squad'});
 assert.ok(offered.data.contract_id);
 const availability=await call('owner','functions/transferWindowActions',{action:'get_current'});assert.equal(availability.data.window,null);assert.equal(availability.data.official_recruitment,true);
 await call('admin','functions/contractManagement',{action:'accept',contract_id:offered.data.contract_id});
 await call('owner','functions/contractActions',{action:'offer',team_id:clubs[0],target_player_id:player,contract_type:'squad'},422);
 report.scenarios.push('Actual official free-player offer and acceptance work outside the general transfer window; signed-player offers outside official windows are refused');
 // Historical records and original paid entries survive feature retirement.
 const retirementTotals=await totals();
 const loan=id();await q("INSERT INTO player_loans (id,player_id,contract_id,parent_club_id,loan_club_id,parent_wage_percentage,loan_wage_percentage,status,loan_fee_stc) VALUES (?,?,?,?,?,30,70,'ACTIVE',5000)",[loan,player,contract,clubs[1],clubs[0]]);
 const retirement=require('../../src/server/migrations/retirePlayerLoans');
 assert.equal((await retirement.retirePlayerLoans()).retired,1);
 assert.equal((await retirement.retirePlayerLoans()).retired,0);
 assert.equal((await q('SELECT status FROM player_loans WHERE id=?',[loan]))[0].status,'RETIRED');
 const [archive]=await q("SELECT data_json FROM league_entities WHERE entity_type='retired_player_loan'");
 assert.equal(JSON.parse(archive.data_json).original.status,'ACTIVE');
 assert.deepEqual(await totals(),retirementTotals);
 for (const role of Object.keys(actors)) {
  await call(role,'player-loans',null,410,'GET');
  await call(role,`player-loans/${loan}`,{},410,'PATCH');
  await call(role,`player-loans/${loan}`,null,410,'DELETE');
  for (const route of ['player-loans',`player-loans/${loan}/accept`, `player-loans/${loan}/exercise-option`]) await call(role,route,{},410);
 }
 report.scenarios.push('Loan actions removed for all four actual JWT roles; retirement snapshots source once, preserves club registration and financial history');
 report.player_exception_route_complete=true;
}
main().catch(error=>{report.error=error.stack;process.exitCode=1;console.error(error);}).finally(async()=>{
 global.Date=NativeDate;report.finished_at=new NativeDate().toISOString();
 const output=path.resolve(__dirname,'../../../docs/acceptance-results/player-exceptions-2026-11-07.json');fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
 if(server)await new Promise(resolve=>server.close(resolve));if(db)await db.pool.promise().end();console.log(JSON.stringify(report));
});

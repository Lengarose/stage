'use strict';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {configure,bootstrap}=require('./bootstrap.cjs');
const config=configure();
const report={database:config.database,started_at:new Date().toISOString(),steps:[],complete:false};
let db,http;
report.evidence_provenance='Synthetic result declarations and inline test images; no EA game, OCR verification or real payment provider.';
const uid=()=>crypto.randomUUID();
const NativeDate=Date;
let instant=NativeDate.parse('2027-01-11T12:00:00Z');
function at(value){instant=typeof value==='number'?value:NativeDate.parse(value);assert.ok(Number.isFinite(instant));}
function installClock(){global.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[instant]));}static now(){return instant;}};}
async function main(){
 db=await bootstrap(config);
 await require('../../src/server/migrations/startupMigrations').runStartupMigrations();
 installClock();
 const express=require('express'),app=express();app.use(express.json({limit:'3mb'}));
 const {verifyToken}=require('../../src/server/authMiddleware');app.use('/api/stage',verifyToken);
 const {makeRouter}=require('../../src/server/controllers/leagueEntityController');
 app.use('/api/stage/regional-leagues',makeRouter('regional_league'));
 app.use('/api/stage/functions',require('../../src/server/controllers/functionsController'));
 app.use('/api/stage/lineups',require('../../src/server/controllers/clubFixtureLineupController'));
 app.use('/api/stage/game-day',require('../../src/server/controllers/gameDayViewController').createRouter());
 http=app.listen(0,'127.0.0.1');await new Promise((resolve,reject)=>{http.once('listening',resolve);http.once('error',reject);});
 const jwt=require('jsonwebtoken');
 async function call(user,path,body,expected=200){
  const headers={'content-type':'application/json',authorization:`Bearer ${jwt.sign({id:user.id,email:user.email},process.env.ACCESS_TOKEN_SECRET,{expiresIn:'1h'})}`};
  const response=await fetch(`http://127.0.0.1:${http.address().port}/api/stage/${path}`,{method:body?'POST':'GET',headers,...(body?{body:JSON.stringify(body)}:{})});
  const value=await response.json();assert.equal(response.status,expected,`${path}: ${JSON.stringify(value)}`);return value;
 }
 const admin={id:uid(),email:'acceptance-admin@example.test'};
 await db.EXECUTESQL('INSERT INTO users (id,email,role_id) VALUES (?,?,2)',[admin.id,admin.email]);
 const clubs=[];
 async function seedClub(index){
  const owner={id:uid(),email:`acceptance-owner-${index}@example.test`},club={id:uid(),name:`Acceptance Club ${index}`,owner,players:[]};
  await db.EXECUTESQL('INSERT INTO users (id,email,role_id) VALUES (?,?,1)',[owner.id,owner.email]);
  await db.EXECUTESQL("INSERT INTO clubs (id,name,president_user_id,user_id,owner_email,platform,status,stc) VALUES (?,?,?,?,?,'cross-platform','active',100000000)",[club.id,club.name,owner.id,owner.id,owner.email]);
  for(let player=0;player<4;player++){
   const id=uid();club.players.push(id);
   await db.EXECUTESQL("INSERT INTO players (id,user_id,email,gamertag,club_id,platform,subscription,subscription_expires_at) VALUES (?,?,?,?,?,'cross-platform','stage_plus','2028-12-31 00:00:00')",[id,player===0?owner.id:null,player===0?owner.email:`acceptance-${index}-${player}@example.test`,`Player ${index}-${player}`,club.id]);
  }
  await db.EXECUTESQL('UPDATE users SET player_id=? WHERE id=?',[club.players[0],owner.id]);return club;
 }
 for(let index=0;index<40;index++)clubs.push(await seedClub(index));
 const roots=[];
 for(const division of [1,2]){
  const trophy=uid();await db.EXECUTESQL('INSERT INTO trophy_items (id,name,image_url,is_official) VALUES (?,?,?,1)',[trophy,`Acceptance D${division} Trophy`,'/uploads/acceptance-trophy.png']);
  const created=await call(admin,'regional-leagues',{name:`Acceptance Division ${division}`,region:'uk-ireland',region_slug:'uk-ireland',division,season_number:1,platform:'cross-platform',status:'registration',registered_club_ids:[],trophy_item_id:trophy,max_clubs:20,reason:'Isolated season acceptance'},201);
  roots.push(created);
 }
 const configureCup={action:'configure',permanent_league_id:roots[0].id,reason:'Isolated Regional Cup'};
 const cupPreview=await call(admin,'regional-leagues/cups',configureCup);
 const cupDefinition=(await call(admin,'regional-leagues/cups',{...configureCup,apply:true,expected_revision:cupPreview.revision})).record;
 const cupTrophy=uid();await db.EXECUTESQL('INSERT INTO trophy_items (id,name,image_url,is_official) VALUES (?,?,?,1)',[cupTrophy,'Acceptance Cup Trophy','/uploads/acceptance-cup.png']);
 const assignment=await call(admin,`regional-leagues/cups/${cupDefinition.id}/trophy`);
 await call(admin,`regional-leagues/cups/${cupDefinition.id}/trophy`,{trophy_item_id:cupTrophy,revision:assignment.revision,reason:'Isolated Cup catalogue assignment'});
 const body={permanent_league_id:roots[0].id,season_number:1,reset_series:0,opens_at:'2027-01-18T00:00:00Z',league_start_monday:'2027-03-15',rules_text:'Isolated approved regional competition acceptance.',include_cup:true,reason:'Isolated acceptance'};
 const preview=await call(admin,'regional-leagues/registration-windows',body);
 const {window}=await call(admin,'regional-leagues/registration-windows',{...body,apply:true,expected_revision:preview.revision});
 const registrations=[];at(window.opens_at);
 for(const club of clubs)registrations.push((await call(club.owner,`regional-leagues/registration-windows/${window.id}/apply`,{club_id:club.id,policy_version:window.policy_version})).registration);
 at(window.registration_closes_at);
 for(let i=0;i<39;i++)await call(clubs[i].owner,`regional-leagues/registrations/${registrations[i].id}/confirm`,{policy_version:window.policy_version,player_ids:clubs[i].players.slice(0,3)});
 at(window.confirmation_closes_at);
 const season=require('../../src/server/services/regionalSeasonOrchestrationService');
 console.log('reserveTick',JSON.stringify(await season.tick()));console.log('jobs',JSON.stringify(await db.EXECUTESQL("SELECT data_json FROM league_entities WHERE entity_type='regional_season_progress'")));
 const offers=await db.EXECUTESQL("SELECT data_json FROM league_entities WHERE entity_type='season_registration'");assert.equal(offers.filter(r=>JSON.parse(r.data_json).reserve_invitation).length,40);
 await call(clubs[39].owner,`regional-leagues/registrations/${registrations[39].id}/reserve`,{decision:'accept',player_ids:clubs[39].players.slice(0,3)});
 at(require('../../src/server/lib/regionalReservePolicy').deadline(window));await season.tick();
 let cycle=(await db.EXECUTESQL("SELECT data_json FROM league_entities WHERE entity_type='regional_cycle'"))[0];assert.ok(cycle,'Canonical cycle must be created');cycle=JSON.parse(cycle.data_json);
 assert.equal(cycle.plan.pending.length,80);report.steps.push({step:'registration-confirmation-reserve-placement',clubs:40,placement_fixtures:80});
 console.log(JSON.stringify({step:'registration-confirmation-reserve-placement',database:config.database}));
 const clubById=new Map(clubs.map((club,index)=>[club.id,{...club,index}]));
 async function entity(type,id){const [row]=await db.EXECUTESQL('SELECT data_json FROM league_entities WHERE entity_type=? AND id=?',[type,id]);return row?JSON.parse(row.data_json):null;}
 async function schedulePlacement(stage,slots){
  const request={stage,round_slots:slots.map((date,index)=>({round:index+1,date})),reason:'Explicit isolated placement calendar'};
  const preview=await call(admin,`regional-leagues/cycles/${cycle.id}/decision-calendar`,request);
  assert.deepEqual(preview.blockers,[]);
  await call(admin,`regional-leagues/cycles/${cycle.id}/decision-calendar`,{...request,apply:true,expected_revision:preview.revision,fixture_ids:preview.fixture_ids});
 }
 let played=0,specialVerified=false;
 async function play(match){
  const home=clubById.get(match.home_club_id),away=clubById.get(match.away_club_id),kickoff=Date.parse(require('../../src/server/lib/officialMatchWindows').matchWindows(match).kickoff_at);
  at(kickoff-16*60000);
  for(const club of [home,away]){
   await call(club.owner,'lineups',{club_id:club.id,fixture_id:match.id,fixture_type:'competition_engine',starting_players:club.players.slice(0,3),bench_players:[club.players[3]],status:'published'},201);
  }
  at(kickoff-10*60000);
  for(const club of [home,away]){const state=await call(club.owner,`lineups/preparation/${club.id}/${match.id}`);await call(club.owner,`lineups/preparation/${club.id}/${match.id}`,{action:'ready',expected_revision:state.selection_revision});}
  at(kickoff);await call(home.owner,'functions/matchKickoff',{action:'kickoff',match_id:match.id});at(kickoff+20*60000);
  const special=match.source_fixture_type==='regional_league' && !specialVerified;
  const h=special?2:home.index<away.index?1:0,a=special?2:1-h;
  const proof='data:image/svg+xml;base64,'+Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="100"><text x="10" y="35">SYNTHETIC ACCEPTANCE EVIDENCE</text><text x="10" y="70">Home ${h} - Away ${a}</text></svg>`).toString('base64');
  const submitter=special?away:home,confirmer=special?home:away;
  await call(submitter.owner,'functions/matchKickoff',{action:'submit_result',match_id:match.id,is_home_team:!special,home_score:h,away_score:a,participating_player_ids:submitter.players.slice(0,3),player_stats:[],goal_events:[],proof_url:proof});
  let [review]=await db.EXECUTESQL('SELECT * FROM matches WHERE id=?',[match.id]);
  const confirmation={action:'confirm_result',match_id:match.id,is_home_team:special,participating_player_ids:confirmer.players.slice(0,3),player_stats:[],goal_events:[],expected_result_snapshot:review};
  if(special){
   await call(submitter.owner,'functions/matchKickoff',{action:'amend_result',match_id:match.id,is_home_team:false,home_score:3,away_score:2,participating_player_ids:away.players.slice(0,3),proof_url:proof});
   await call(confirmer.owner,'functions/matchKickoff',confirmation,409);
   await call(submitter.owner,'functions/matchKickoff',{action:'amend_result',match_id:match.id,is_home_team:false,home_score:2,away_score:2,participating_player_ids:away.players.slice(0,3),proof_url:proof});
   [review]=await db.EXECUTESQL('SELECT * FROM matches WHERE id=?',[match.id]);confirmation.expected_result_snapshot=review;
  }
  await call(confirmer.owner,'functions/matchKickoff',confirmation);
  if(special){const before=await db.EXECUTESQL('SELECT id,wins,losses,draws FROM clubs ORDER BY id');await call(confirmer.owner,'functions/matchKickoff',confirmation);assert.deepEqual(await db.EXECUTESQL('SELECT id,wins,losses,draws FROM clubs ORDER BY id'),before);specialVerified=true;report.steps.push({step:'unchanged-2-2-away-first-stale-and-retry',passed:true});}

  const [finished]=await db.EXECUTESQL('SELECT * FROM matches WHERE id=?',[match.id]);assert.equal(finished.status,'completed');assert.equal(Number(finished.stats_processed),1);played++;
 }
 await schedulePlacement('placement',['2027-02-26T20:00','2027-02-27T20:00','2027-03-01T20:00','2027-03-02T20:00','2027-03-03T20:00']);
 for(const match of await db.EXECUTESQL('SELECT * FROM matches WHERE competition_context=? ORDER BY scheduled_date,id',[cycle.id]))await play(match);
 await require('../../src/server/services/regionalCycleService').progress(cycle.id);cycle=await entity('regional_cycle',cycle.id);
 assert.equal(cycle.plan.pending.length,4);at('2027-03-03T20:00:00Z');await schedulePlacement('placement_decisions',['2027-03-06T20:00']);
 for(const match of await db.EXECUTESQL("SELECT * FROM matches WHERE competition_context=? AND status<>'completed' ORDER BY scheduled_date,id",[cycle.id]))await play(match);
 at('2027-03-07T20:00:00Z');await season.tick();cycle=await entity('regional_cycle',cycle.id);
 assert.equal(cycle.status,'allocated');assert.equal(cycle.allocated_groups.length,2);
 const fixtures=await db.EXECUTESQL("SELECT id FROM league_entities WHERE entity_type='regional_league_fixture'");assert.equal(fixtures.length,760);
 report.steps.push({step:'placement-and-first-calendar',matches:played,groups:2,league_fixtures:fixtures.length});
 console.log(JSON.stringify(report.steps.at(-1)));
 // Exercise actual rescheduling transactions before any league kickoff.
 const [original]=await db.EXECUTESQL("SELECT * FROM matches WHERE source_fixture_type='regional_league' ORDER BY scheduled_date,id LIMIT 1");
 const requester=clubById.get(original.home_club_id),opponent=clubById.get(original.away_club_id);
 const path=`game-day/${original.id}/reschedule`;
 await call(opponent.owner,`lineups/preparation/${requester.id}/${original.id}`,null,403);
 await db.EXECUTESQL("CREATE TRIGGER acceptance_fail_reschedule BEFORE INSERT ON notifications FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Acceptance injected notification failure'");
 try{await call(requester.owner,path,{action:'request',club_id:requester.id,date:'2027-03-19T20:00'},500);}finally{await db.EXECUTESQL('DROP TRIGGER acceptance_fail_reschedule');}
 assert.equal((await db.EXECUTESQL("SELECT id FROM league_entities WHERE entity_type='official_reschedule_request'")).length,0);
 const proposal=(await call(requester.owner,path,{action:'request',club_id:requester.id,date:'2027-03-19T20:00'})).requests[0];
 await call(requester.owner,path,{action:'approve',club_id:requester.id,request_id:proposal.id},403);
 await call(opponent.owner,path,{action:'approve',club_id:opponent.id,request_id:proposal.id});
 await call(opponent.owner,path,{action:'approve',club_id:opponent.id,request_id:proposal.id});
 assert.equal((await call(requester.owner,path+`?club_id=${requester.id}`)).used,1);
 report.steps.push({step:'reschedule-rollback-opponent-approval-and-single-charge',passed:true});
 const nextWindow=(await db.EXECUTESQL("SELECT data_json FROM league_entities WHERE entity_type='regional_registration_window' AND season_number=2"))[0];assert.ok(nextWindow);const next=JSON.parse(nextWindow.data_json);
 const nextApps=[];let registeredNext=false,confirmedNext=false,reservedNext=false,reservesClosed=false;let nextClubs;
 const missingNext=clubs[0].id;
 async function advanceRegistration(time){
  if(!registeredNext && time>=Date.parse(next.opens_at)){at(next.opens_at);const extra=await seedClub(40);clubById.set(extra.id,{...extra,index:40});nextClubs=[...clubs,extra];for(const club of nextClubs)nextApps.push((await call(club.owner,`regional-leagues/registration-windows/${next.id}/apply`,{club_id:club.id,policy_version:next.policy_version})).registration);registeredNext=true;}
  if(!confirmedNext && time>=Date.parse(next.registration_closes_at)){at(next.registration_closes_at);for(let i=0;i<nextClubs.length;i++)if(nextClubs[i].id!==missingNext)await call(nextClubs[i].owner,`regional-leagues/registrations/${nextApps[i].id}/confirm`,{policy_version:next.policy_version,player_ids:nextClubs[i].players.slice(0,3)});confirmedNext=true;}
  if(!reservedNext && time>=Date.parse(next.confirmation_closes_at)){at(next.confirmation_closes_at);await season.tick();for(let i=0;i<nextClubs.length;i++)await call(nextClubs[i].owner,`regional-leagues/registrations/${nextApps[i].id}/reserve`,{decision:nextClubs[i].id===missingNext?'decline':'accept',player_ids:nextClubs[i].players.slice(0,3)});reservedNext=true;}
  if(!reservesClosed && time>=Date.parse(require('../../src/server/lib/regionalReservePolicy').deadline(next))){at(require('../../src/server/lib/regionalReservePolicy').deadline(next));await season.tick();reservesClosed=true;}
 }
 let iterations=0;
 while(iterations++<1000){
  const [match]=await db.EXECUTESQL("SELECT * FROM matches WHERE status IN ('scheduled','confirmed') ORDER BY scheduled_date,id LIMIT 1");
  if(!match)break;
  const time=Date.parse(require('../../src/server/lib/officialMatchWindows').matchWindows(match).kickoff_at);if(time>=Date.parse(next.league_start_monday+'T00:00:00Z'))break;
  await advanceRegistration(time);await play(match);
  const [upcoming]=await db.EXECUTESQL("SELECT scheduled_date FROM matches WHERE status IN ('scheduled','confirmed') ORDER BY scheduled_date,id LIMIT 1");
  if(!upcoming || upcoming.scheduled_date!==match.scheduled_date){at(time+22*60000);await require('../../src/server/services/regionalCupRecoveryService').tick();await require('../../src/server/services/regionalCycleRecoveryService').tick();await season.tick();}
  if(played%100===0)console.log(JSON.stringify({step:'official-play',matches:played}));
 }
 const leagueResults=await db.EXECUTESQL("SELECT COUNT(*) AS n FROM matches WHERE source_fixture_type='regional_league' AND status='completed'");
 assert.equal(Number(leagueResults[0].n),760);
 const cups=await db.EXECUTESQL("SELECT data_json FROM league_entities WHERE entity_type='regional_cup_edition' AND JSON_EXTRACT(data_json,'$.season_number')=1");assert.equal(cups.length,1);const cup=JSON.parse(cups[0].data_json);assert.equal(cup.status,'completed');
 const cupMatches=await db.EXECUTESQL('SELECT COUNT(*) AS n FROM matches WHERE competition_context=? AND status=?',[cup.id,'completed']);assert.equal(Number(cupMatches[0].n),39);
 await require('../../src/server/services/competitionPrizeService').retryPending();
 const secondCycle=(await db.EXECUTESQL("SELECT data_json FROM league_entities WHERE entity_type='regional_cycle' AND season_number=2"))[0];assert.ok(secondCycle);const following=JSON.parse(secondCycle.data_json);assert.equal(following.status,'allocated');assert.equal(following.plan.reserve_allocation.removed_rights[0].club_id,missingNext);assert.equal(following.plan.reserve_allocation.promoted.length,1);assert.equal(following.plan.rights.length,40);assert.equal(following.plan.rights.some(r=>r.club_id===missingNext),false);report.steps.push({step:'final-D1-vacancy-after-playoffs',promoted_reserves:1,final_clubs:40});
 const currentRoots=await require('../../src/server/services/regionalEditionService').catalogue(admin);assert.equal(currentRoots.definitions.length,2);
 report.steps.push({step:'league-cup-promotion-rollover',league_matches:760,cup_matches:39,total_matches:played,next_cycle:following.id});
 const payouts=await db.EXECUTESQL('SELECT * FROM competition_payouts WHERE source_id=?',[cup.id]);assert.equal(payouts.length,2);assert.equal(payouts.reduce((n,p)=>n+Number(p.amount_stc || p.amount || 0),0),10000000);
 const awards=await db.EXECUTESQL('SELECT * FROM trophy_awards WHERE source_id=?',[cup.id]);assert.equal(awards.filter(a=>a.owner_type==='club').length,1);assert.equal(new Set(awards.map(a=>a.award_key)).size,awards.length);
 const ledger=await db.EXECUTESQL('SELECT * FROM competition_payouts ORDER BY id');await require('../../src/server/services/competitionPrizeService').retryPending();assert.deepEqual(await db.EXECUTESQL('SELECT * FROM competition_payouts ORDER BY id'),ledger);assert.deepEqual(await db.EXECUTESQL('SELECT * FROM trophy_awards WHERE source_id=?',[cup.id]),awards);
 const [firstNext]=await db.EXECUTESQL("SELECT * FROM matches WHERE source_fixture_type='regional_league' AND status='scheduled' ORDER BY scheduled_date,id LIMIT 1");assert.ok(firstNext);await play(firstNext);
 const restarted=require('node:child_process').spawnSync(process.execPath,[require('node:path').join(__dirname,'restart-probe.cjs')],{env:{...process.env,STAGE_ACCEPTANCE_INSTANT:String(Date.now()+120000)},encoding:'utf8'});assert.equal(restarted.status,0,restarted.stderr);report.steps.push({step:'fresh-process-worker-recovery',passed:true});
 report.normal_season_route_complete=true;report.steps.push({step:'persisted-cup-prizes-trophy-retry-and-next-edition-play',cup_prize_total:10000000,next_match:firstNext.id});
 report.complete=false;report.blocker='Remaining approved player/withdrawal exception implementation and complete acceptance matrix still pending';
}
main().catch(error=>{report.error=error.message;process.exitCode=1;}).finally(async()=>{
 global.Date=NativeDate;
 if(http)await new Promise(resolve=>http.close(resolve));if(db)await db.pool.promise().end();
 report.finished_at=new Date().toISOString();console.log(JSON.stringify(report,null,2));
});

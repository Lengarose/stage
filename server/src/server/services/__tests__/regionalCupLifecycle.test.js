'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const plan=require('../../lib/regionalCupPlan');
const {createService}=require('../regionalCupLifecycleService');
function fixture(count=20) {
 const ids=Array.from({length:count},(_,i)=>`club${i}`),seed='captured-cup-draw-seed-1234567890',dates=plan.calendar(count,'2026-11-09','uk-ireland'),window={id:'window',policy_version:'regional_registration_v1',cup_policy_version:'regional_cup_v1'};
 let state={edition:{id:'cup-edition',entity_type:'regional_cup_edition',name:'STAGE UK & Ireland Cup',region_slug:'uk-ireland',platform:'cross-platform',season_number:1,reset_series:0,status:'draft',play_enabled:false,policy_version:plan.policy.version,participant_ids:ids,source_edition_ids:['league'],source_calendar_id:'calendar',round_calendar:dates,draw_seed:seed,first_round:plan.drawRound(ids,seed),trophy_snapshot:{id:'trophy',name:'Silver Cup',image_url:'/uploads/cup.png'},participation_window_snapshot:window,rules:plan.rules},anchors:[{id:'calendar',entity_type:'regional_calendar',status:'published',edition_ids:['league'],start_monday:'2026-11-09'}],roots:[{id:'league',status:'in_progress',registered_club_ids:ids}],clubs:ids.map(id=>({id,name:id,owner_email:`${id}@test.local`,logo_url:'/uploads/club.png'})),fixtures:[],matches:[],instances:[],participants:[],audits:[],notices:[],bookings:[],now:'2026-11-03T12:00:00Z'};
 const copy=structuredClone,model={actor:async id=>({id,email:'admin@test',role_id:id==='admin'?0:1}),lock:async()=>{},edition:async id=>id===state.edition.id?copy(state.edition):null,records:async()=>copy([...state.anchors,state.edition]),editions:async()=>copy(state.roots),fixtures:async()=>copy(state.fixtures),matches:async()=>copy(state.matches),clubs:async()=>copy(state.clubs),events:async()=>({matches:copy([...state.matches,...state.bookings]),engines:copy(state.fixtures),fixtures:[]}),createMatch:async row=>{if(state.matches.some(m=>m.id===row.id))throw Error('Duplicate Match');state.matches.push(copy(row));},insert:async(table,row)=>{const target={competition_instances:'instances',competition_participants:'participants',competition_fixtures:'fixtures'}[table];if(state[target].some(r=>r.id===row.id))throw Error('Duplicate engine row');state[target].push(copy(row));},audit:async(ctx,user,before,after)=>{if(state.fail==='audit')throw Error('audit failed');state.audits.push(copy({user,before,after}));return {id:`audit${state.audits.length}`};},notify:async row=>{if(state.fail==='notice')throw Error('notice failed');state.notices.push(copy(row));},saveEdition:async(before,row,user,reason)=>{state.edition=copy(row);state.audits.push(copy({before,after:row,user,reason}));},complete:async()=>{state.instances[0].status='completed';}};
 const transaction=async fn=>{const before=copy(state);try{return await fn(()=>{});}catch(e){state=before;throw e;}};
 const service=createService({model,transaction,confirmedField:async()=>({window:copy(state.confirmationWindow || window)}),clock:()=>new Date(state.now),seed:()=>`new-recorded-open-draw-${state.edition.rounds?.length || 0}-1234567890`});
 const preview=()=>service.action('cup-edition',{action:'activate'},{id:'admin'});
 const activate=async()=>{const p=await preview();return service.action('cup-edition',{action:'activate',apply:true,expected_revision:p.revision,reason:'Reviewed Cup activation'},{id:'admin'});};
 const finish=()=>{for(const m of state.matches.filter(m=>m.status==='scheduled'))Object.assign(m,{status:'completed',result_state:'CONFIRMED',home_score:2,away_score:0,stats_processed:1,winner_club_id:m.home_club_id});};
 return {service,model,transaction,preview,activate,finish,get state(){return state;}};
}
test('activation creates only four real first-round duels for twenty clubs, preserving twelve transparent byes',async()=>{
 const f=fixture(),before=structuredClone(f.state),p=await f.preview();assert.deepEqual(f.state,before);assert.deepEqual(p.blockers,[]);assert.equal(p.next_round,1);
 await f.activate();assert.equal(f.state.matches.length,4);assert.equal(f.state.fixtures.length,4);assert.equal(f.state.participants.length,20);assert.equal(f.state.edition.rounds[0].draw.byes.length,12);assert.equal(f.state.edition.play_enabled,true);
 assert.ok(f.state.matches.every(m=>m.source_fixture_type==='competition_engine' && m.allow_penalties===1 && m.scheduling_status==='confirmed' && m.timezone==='Europe/Brussels'));
 const after=structuredClone(f.state);assert.equal((await f.activate()).already_applied,true);assert.deepEqual(f.state,after);
});
test('five rounds use fresh recorded open draws only after every official result; final champion is recorded without payouts',async()=>{
 const f=fixture();await f.activate();assert.equal((await f.service.reconcile('cup-edition')).status,'waiting_results');
 for(let round=1;round<=5;round++) {assert.equal(f.state.edition.rounds.at(-1).number,round);f.finish();await f.service.reconcile('cup-edition');}
 assert.equal(f.state.edition.status,'completed');assert.equal(f.state.matches.length,19);assert.equal(f.state.edition.rounds.length,5);assert.ok(f.state.edition.participant_ids.includes(f.state.edition.winner_club_id));assert.equal(f.state.edition.honours_state,'pending_review');assert.equal(f.state.instances[0].status,'completed');
 const after=structuredClone(f.state);assert.equal((await f.service.reconcile('cup-edition')).already_applied,true);assert.deepEqual(f.state,after);
});
test('missing/disputed/timeout results and unresolved penalties never create the next draw',async()=>{
 for(const change of [m=>{m.status='disputed';},m=>{m.result_state='DISPUTED';},m=>{m.result_state='AUTO_CONFIRMED_TIMEOUT';},m=>{m.away_score=2;m.winner_club_id=null;}]) {
  const f=fixture();await f.activate();f.finish();change(f.state.matches[0]);const before=structuredClone(f.state);assert.equal((await f.service.reconcile('cup-edition')).status,'waiting_results');assert.deepEqual(f.state,before);
 }
 const f=fixture();await f.activate();f.finish();Object.assign(f.state.matches[0],{home_score:2,away_score:2,decided_on_penalties:1,penalty_winner_side:'away',winner_club_id:f.state.matches[0].away_club_id});await f.service.reconcile('cup-edition');assert.ok(f.state.edition.rounds[0].advancers.includes(f.state.matches[0].away_club_id));
});
test('consumed result changes, source resets, malformed draws and missing clubs require review',async()=>{
 const f=fixture();await f.activate();f.finish();await f.service.reconcile('cup-edition');f.state.matches[0].home_score=3;await assert.rejects(f.service.reconcile('cup-edition'),/consumed Cup result/);assert.equal(f.state.edition.rounds.length,2);
 for(const change of [f=>{f.state.roots[0].edition_invalidated=true;},f=>{f.state.edition.first_round.byes.pop();},f=>{f.state.clubs.pop();},f=>{f.state.edition.participation_window_snapshot.cup_policy_version=null;}]) {const g=fixture();change(g);await assert.rejects(g.preview());assert.equal(g.state.matches.length,0);}
});
test('stale activation review, late windows and external bookings block publication; audit/notices roll back all rows',async()=>{
 const f=fixture(),p=await f.preview();f.state.clubs[0].name='Changed';await assert.rejects(f.service.action('cup-edition',{action:'activate',apply:true,expected_revision:p.revision,reason:'Review'},{id:'admin'}),/sources changed/);
 for(const failure of ['audit','notice']) {const g=fixture();g.state.fail=failure;const before=structuredClone(g.state);await assert.rejects(g.activate(),/failed/);assert.deepEqual(g.state,before);}
 const g=fixture();g.state.now='2026-12-07';assert.ok((await g.preview()).blockers.length);await assert.rejects(g.activate(),/blockers/);
 const h=fixture(),pair=h.state.edition.first_round.fixtures[0];h.state.bookings.push({id:'other',home_club_id:pair.home_club_id,away_club_id:'external',scheduled_date:h.state.edition.round_calendar[0].scheduled_date,timezone:'Europe/Brussels',type:'league',status:'scheduled'});assert.ok((await h.preview()).blockers.length);await assert.rejects(h.activate(),/blockers/);
});
test('next-round calendar failure preserves the prior round and its unconsumed results for reviewed retry',async()=>{
 const f=fixture();await f.activate();f.finish();const next=f.state.edition.round_calendar[1];f.state.bookings.push({id:'other',home_club_id:'club0',away_club_id:'external',scheduled_date:next.scheduled_date,timezone:'Europe/Brussels',type:'league',status:'scheduled'});
 const before=structuredClone(f.state);await assert.rejects(f.service.reconcile('cup-edition'),/lifecycle blockers/);assert.deepEqual(f.state,before);f.state.bookings=[];await f.service.reconcile('cup-edition');assert.equal(f.state.edition.rounds.length,2);
});
test('anonymous/participant lifecycle calls and client-selected winners or seeds are rejected',async()=>{
 const f=fixture();await assert.rejects(f.service.action('cup-edition',{action:'activate'}),/Authentication/);await assert.rejects(f.service.action('cup-edition',{action:'activate'},{id:'player'}),/Admin/);await assert.rejects(f.service.action('cup-edition',{action:'activate',seed:'forged'},{id:'admin'}),/assigned/);
});
test('public Cup data contains actual GameDay links, localizable kickoffs and byes, without draw seeds, contact emails or drafts',async()=>{
 const f=fixture(),publicService=require('../regionalCupPublicService').createService({model:f.model,transaction:f.transaction});assert.deepEqual((await publicService.catalogue()).cups,[]);await f.activate();const data=await publicService.catalogue(),json=JSON.stringify(data);
 assert.equal(data.cups[0].rounds[0].matches.length,4);assert.equal(data.cups[0].rounds[0].byes.length,12);assert.ok(data.cups[0].rounds[0].matches[0].kickoff_at.endsWith('Z'));assert.equal(data.cups[0].rounds[1].drawn,false);assert.doesNotMatch(json,/draw_seed|owner_email|captured-cup-draw-seed|admin@test/);
});
test('public Cup conditions use only the exact stored snapshot and do not expose private snapshot fields',async()=>{
 const f=fixture();await f.activate();Object.assign(f.state.edition.participation_window_snapshot,{region_slug:'uk-ireland',platform:'cross-platform',season_number:1,reset_series:0,rules_text:'Original accepted Cup conditions',result_policy_version:'regional_result_review_v2',draw_seed:'private snapshot seed',admin_email:'private@email'});
 const service=require('../regionalCupPublicService').createService({model:f.model,transaction:f.transaction}),before=JSON.stringify(f.state),data=await service.catalogue();
 assert.equal(data.cups[0].participation_conditions.rules_text,'Original accepted Cup conditions');assert.doesNotMatch(JSON.stringify(data),/private snapshot seed|private@email/);assert.equal(JSON.stringify(f.state),before);
 f.state.edition.participation_window_snapshot.season_number=2;assert.deepEqual((await service.catalogue()).cups[0].participation_conditions,{state:'unavailable'});
});
test('Cup penalty context requires the single-match deciding shootout when scores remain level',async()=>{
 const f=fixture();await f.activate();const m=f.state.matches[0],engine=f.state.fixtures[0],{readPenaltyContext}=require('../penaltyPolicyService');
 const q=async sql=>sql.includes('FROM competition_fixtures')?[engine]:sql.includes("entity_type='regional_cup_edition'")?[{id:f.state.edition.id,data_json:JSON.stringify(f.state.edition)}]:[];
 assert.equal((await readPenaltyContext(m,2,2,q)).required,true);assert.equal((await readPenaltyContext(m,2,1,q)).applicable,false);
});
test('actual lifecycle and public HTTP actions are exercised with controlled persistence and authentication fixtures',async()=>{
 const express=require('express'),f=fixture(),life=require.resolve('../regionalCupLifecycleService'),pub=require.resolve('../regionalCupPublicService'),saved=[require.cache[life],require.cache[pub]];let server;
 require.cache[life]={exports:f.service};require.cache[pub]={exports:require('../regionalCupPublicService').createService({model:f.model,transaction:f.transaction})};
 try {
  const app=express();app.use(express.json(),(req,res,next)=>{req.user={id:req.headers['x-actor'] || 'admin'};next();});app.use('/regional-leagues',require('../../controllers/leagueEntityController').makeRouter('regional_league'));server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const call=async(path,body,actor='admin')=>{const r=await fetch(`http://127.0.0.1:${server.address().port}/regional-leagues/cups/${path}`,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','x-actor':actor},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};};
  assert.equal((await call('public',null,'player')).data.cups.length,0);assert.equal((await call('cup-edition/lifecycle',{action:'activate'},'player')).status,403);const p=await call('cup-edition/lifecycle',{action:'activate'});assert.equal(p.status,200);
  assert.equal((await call('cup-edition/lifecycle',{action:'activate',apply:true,expected_revision:p.data.revision,reason:'Reviewed first round'})).status,200);
  Object.assign(f.state.edition.participation_window_snapshot,{region_slug:'uk-ireland',platform:'cross-platform',season_number:1,reset_series:0,rules_text:'Published Cup participation terms'});
  const published=await call('public',null,'player');assert.equal(published.data.cups[0].rounds[0].matches.length,4);assert.equal(published.data.cups[0].participation_conditions.rules_text,'Published Cup participation terms');
 } finally {if(server)await new Promise(resolve=>server.close(resolve));[life,pub].forEach((p,i)=>{if(saved[i])require.cache[p]=saved[i];else delete require.cache[p];});}
});


test('only a new captured automatic Cup may activate internally; retries retain the stored draw',async()=>{
 const f=fixture();await assert.rejects(f.service.reconcileActivation('cup-edition'),/captured automatic/);
 Object.assign(f.state.edition.participation_window_snapshot,{result_policy_version:'regional_result_review_v2',season_orchestration_policy_version:'regional_season_orchestration_v1'});
 f.state.confirmationWindow=structuredClone(f.state.edition.participation_window_snapshot);
 const active=await f.service.reconcileActivation('cup-edition');assert.equal(active.status,'running');assert.ok(f.state.matches.length);assert.equal(f.state.audits[0].user?.id ?? null,null);
 const before=structuredClone(f.state);assert.equal((await f.service.reconcileActivation('cup-edition')).already_applied,true);assert.deepEqual(f.state,before);
});

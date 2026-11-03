'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createService}=require('../officialMatchEligibilityService');
const {VERSION}=require('../../lib/regionalRegistrationPolicy');
function fixture({legacy=false,pathway=false}={}) {
  let now=new Date('2026-11-02T19:00:00Z');
  let state={root:{id:'edition',status:pathway?'running':'in_progress',...(legacy?{}:pathway?{participation_window_snapshot:{policy_version:VERSION}}:{regional_participation_policy_version:VERSION})},
    engine:{id:'engine',match_id:'match',legacy_fixture_id:'fixture',legacy_fixture_type:pathway?'regional_pathway':'regional_league',competition_instance_id:'edition',status:'scheduled'},
    match:{id:'match',source_fixture_type:'competition_engine',source_fixture_id:'engine',home_club_id:'home',away_club_id:'away',status:'scheduled',scheduled_date:'2026-11-02T19:20:00Z',timezone:'UTC'},
    lineups:[],snapshot:null,preparation:null,audits:[],notifications:[],players:['home','away'].flatMap(club=>[1,2,3,4].map(i=>({id:`${club}${i}`,club_id:club,playing_club_id:club,subscription:'stage_plus'})))};
  const copy=structuredClone;
  const row=record=>({...record,data_json:JSON.stringify(record)});
  const q=async(sql,p=[])=>{
    if(sql.startsWith('SELECT * FROM competition_fixtures'))return (p.includes('engine') || p.includes('fixture') || p.includes('match'))&&state.engine?[copy(state.engine)]:[];
    if(sql.startsWith('SELECT * FROM matches'))return (p.includes('match') || p.includes('engine'))&&state.match?[copy(state.match)]:[];
    if(sql.includes("entity_type='regional_league_fixture'"))return p[0]==='fixture'?[row({id:'fixture',league_id:'edition'})]:[];
    if(sql.includes("entity_type='regional_league'") || sql.includes("entity_type='regional_cycle'"))return [row(copy(state.root))];
    if(sql.includes("entity_type='official_match_selection'"))return state.snapshot?[row(copy(state.snapshot))]:[];
    if(sql.startsWith('SELECT * FROM club_fixture_lineups WHERE id'))return copy(state.lineups.filter(l=>l.id===p[0]));
    if(sql.startsWith('SELECT * FROM club_fixture_lineups WHERE club_id'))return copy(state.lineups.filter(l=>l.club_id===p[0] && p.slice(1).includes(l.fixture_id)));
    if(sql.startsWith('INSERT INTO club_fixture_lineups')) {
      state.lineups.push(Object.fromEntries(['id','club_id','fixture_id','fixture_type','formation','starting_players','bench_players','captain_player_id','notes','status','created_by_user_id'].map((k,i)=>[k,p[i]])));return {};
    }
    if(sql.startsWith('UPDATE club_fixture_lineups')) {
      const l=state.lineups.find(l=>l.id===p.at(-1));Object.assign(l,Object.fromEntries(['club_id','fixture_id','fixture_type','formation','starting_players','bench_players','captain_player_id','notes','status','created_by_user_id'].map((k,i)=>[k,p[i]])));return {};
    }
    if(sql.startsWith('DELETE FROM club_fixture_lineups')){state.lineups=state.lineups.filter(l=>l.id!==p[0]);return {};}
    if(sql.includes("entity_type='official_match_preparation'"))return state.preparation?[row(copy(state.preparation))]:[];
    if(sql.includes("VALUES (?,'official_match_preparation'")){state.preparation=JSON.parse(p[1]);return {};}
    if(sql.startsWith('SELECT COALESCE(u.email'))return [{email:'opponent@test'}];
    if(sql.startsWith('INSERT INTO notifications')){if(state.failNotification)throw Error('notification failed');state.notifications.push(p);return {};}
    if(sql.startsWith('INSERT INTO league_entities')){state.snapshot=JSON.parse(p[1]);return {};}
    if(sql.startsWith('INSERT INTO club_operation_audit_logs') || sql.startsWith('INSERT INTO admin_audit_log')){if(state.failAudit)throw Error('audit failed');state.audits.push(p);return {};}
    throw Error(`Unhandled SQL: ${sql}`);
  };
  const transaction=async fn=>{const before=copy(state);try{return await fn(q);}catch(e){state=before;throw e;}};
  const service=createService({query:q,transaction,clock:()=>now,rosters:{players:async club=>copy(state.players.filter(p=>p.club_id===club))}});
  const user={id:'owner',email:'owner@test',role_id:1};
  const body=(club='home',alias='fixture')=>({club_id:club,fixture_id:alias,fixture_type:'pretend_casual',starting_players:[1,2,3].map(i=>`${club}${i}`),bench_players:[],status:'published'});
  const save=(b=body(),id)=>service.mutate({body:b,existingId:id,user});
  const action=async(club,body)=>{const status=await service.preparationStatus(club,'match');return service.preparationAction(club,'match',{expected_revision:status.selection_revision,...body},user);};
  const ready=async()=>{now=new Date('2026-11-02T19:05:00Z');for(const club of ['home','away'])await action(club,{action:'ready'});now=new Date('2026-11-02T19:20:00Z');};
  const start=()=>service.kickoff('match',async()=>{state.match.status='in_progress';});
  return {service,q,save,body,user,start,ready,action,get state(){return state;},at:date=>{now=new Date(date);}};
}
test('authoritative fixture aliases apply the new policy regardless of client type; old editions keep their policy',async()=>{
  for(const alias of ['fixture','engine','match']) {
    const f=fixture();f.state.players[0].subscription='free';
    await assert.rejects(f.save(f.body('home',alias)),/Every selected player/);assert.equal(f.state.lineups.length,0);
  }
  const old=fixture({legacy:true});assert.equal((await old.service.context('fixture')).official,false);
  const pathway=fixture({pathway:true});assert.equal((await pathway.service.context('engine')).official,true);
  pathway.state.root.status='allocated';await assert.rejects(pathway.service.context('engine'),/closed/);
});
test('publishing requires three eligible starters and checks bench, duplicate IDs, loans and captain',async()=>{
  const f=fixture(),body=f.body();
  await assert.rejects(f.save({...body,starting_players:body.starting_players.slice(0,2)}),/three/);
  await assert.rejects(f.save({...body,bench_players:['home1']}),/once/);
  await assert.rejects(f.save({...body,captain_player_id:'home4'}),/captain/);
  f.state.players[3].subscription='free';await assert.rejects(f.save({...body,bench_players:['home4']}),/Every selected/);
  f.state.players[0].playing_club_id='another';await assert.rejects(f.save(body),/Every selected/);
  f.state.players[0].playing_club_id='home';f.state.players[0].subscription_expires_at='bad';await assert.rejects(f.save(body),/Every selected/);
  f.state.players[0].subscription_expires_at='2026-11-02T19:00:00Z';await assert.rejects(f.save(body),/Every selected/);
});
test('draft can be incomplete, cannot include invalid members; identities and alias duplicate selections are protected',async()=>{
  const f=fixture();const draft=await f.save({...f.body(),starting_players:[],status:'draft'});
  await assert.rejects(f.save({club_id:'other'},draft.id),/cannot move/);
  await assert.rejects(f.save({fixture_id:'made-up'},draft.id),/cannot move/);
  await assert.rejects(f.save(f.body('home','match')),/already exists/);
  await assert.rejects(f.save(f.body('other')),/not a participant/);
  assert.equal(f.state.audits.length,1);
});
test('kickoff rechecks both published lineups and creates an atomic frozen snapshot; expiry during play leaves participation valid',async()=>{
  const f=fixture();await f.save();
  f.at('2026-11-02T19:20:00Z');await assert.rejects(f.start(),/Both clubs/);f.at('2026-11-02T19:00:00Z');assert.equal(f.state.snapshot,null);
  await f.save(f.body('away','engine'));
  await f.ready();
  f.state.players[0].subscription_expires_at='2026-11-02T19:19:59Z';
  await assert.rejects(f.start(),/Every selected/);assert.equal(f.state.match.status,'scheduled');assert.equal(f.state.snapshot,null);
  f.state.players[0].subscription_expires_at='2026-11-02T19:21:00Z';
  await f.start();const captured=structuredClone(f.state.snapshot);
  f.at('2026-11-02T19:30:00Z');await f.start();assert.deepEqual(f.state.snapshot,captured);
  await f.service.assertParticipants(f.state.match,'home',{participating_player_ids:['home1','home2','home3'],player_stats:[{player_id:'home1'}]});
  await assert.rejects(f.save({notes:'changed'},f.state.lineups[0].id),/frozen/);
  await assert.rejects(f.service.mutate({existingId:f.state.lineups[0].id,body:{},remove:true,user:f.user}),/frozen/);
  await assert.rejects(f.service.assertParticipants(f.state.match,'home',{participating_player_ids:['home1','home2','home4']}),/actual participants/);
  await assert.rejects(f.service.assertParticipants(f.state.match,'home',{participating_player_ids:['home1','home2','home3'],player_stats:[{player_id:'away1'}]}),/Statistics/);
});
test('kickoff rolls back the snapshot if changing the match fails, rejects unconfirmed schedule and missing kickoff evidence',async()=>{
  const f=fixture();await f.save();await f.save(f.body('away'));await f.ready();
  await assert.rejects(f.service.kickoff('match',()=>{throw Error('write failed');}),/write failed/);assert.equal(f.state.snapshot,null);
  f.state.match.status='pending_schedule';await assert.rejects(f.start(),/schedule/);
  f.state.match.status='in_progress';await assert.rejects(f.start(),/evidence is missing/);
});
test('generic PATCH cannot bypass official kickoff, move source or post results; closed/reset editions reject writes',async()=>{
  const f=fixture();
  for(const patch of [{status:'in_progress'},{source_fixture_type:'friendly'},{home_score:2}])await assert.rejects(f.service.assertGenericPatch(f.state.match,patch),/GameDay/);
  await f.service.assertGenericPatch(f.state.match,{notes:'OK'});
  await assert.rejects(f.service.assertGenericCreate({source_fixture_type:'casual',source_fixture_id:'engine'}),/protected competition/);
  await assert.rejects(f.service.assertGenericPatch({id:'casual',source_fixture_type:'friendly'},{source_fixture_id:'engine'}),/GameDay/);
  const legacy=fixture({legacy:true});await legacy.service.assertGenericCreate({source_fixture_id:'fixture'});
  f.state.root.edition_invalidated=true;await assert.rejects(f.save(),/closed/);
});

test('both HTTP publication routes and CRUD use the same eligibility checks',async()=>{
  const express=require('express');
  const f=fixture();
  const servicePath=require.resolve('../officialMatchEligibilityService');
  const operationsPath=require.resolve('../clubOperationsService');
  const modelPath=require.resolve('../../models/clubFixtureLineupModel');
  const originals=[servicePath,operationsPath,modelPath].map(p=>require.cache[p]);
  const routerPaths=['../../controllers/clubFixtureLineupController','../../controllers/clubController'].map(p=>require.resolve(p));
  const originalRouters=routerPaths.map(p=>require.cache[p]);
  let forbidden=false;
  try {
    require.cache[servicePath]={exports:f.service};
    require.cache[operationsPath]={exports:{ALL_PERMISSIONS:[],ROLE_PERMISSIONS:{},normalizeAssignableStaffRole:()=>null,writeClubAudit:async()=>{},requireClubPermission:async()=>{if(forbidden)throw Object.assign(Error('Forbidden'),{status:403});return {user:f.user};},parseJson:(value,fallback)=>value?typeof value==='string'?JSON.parse(value):value:fallback}};
    require.cache[modelPath]={exports:class {
      async selectOne(id){return f.state.lineups.filter(l=>l.id===id);}
      async selectAll({club_id,fixture_id}={}){return f.state.lineups.filter(l=>(!club_id||l.club_id===club_id)&&(!fixture_id||l.fixture_id===fixture_id));}
    }};
    for(const path of routerPaths)delete require.cache[path];
    const app=express();app.use(express.json());
    app.use('/lineups',require(routerPaths[0]));app.use('/clubs',require(routerPaths[1]));
    const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
    const call=async(path,method,body)=>{const r=await fetch(`http://127.0.0.1:${server.address().port}${path}`,{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.json()};};
    try {
      const created=await call('/lineups','POST',{...f.body(),bench_players:['home4'],status:'draft'});assert.equal(created.status,201);
      const id=created.body.id;f.state.players[0].subscription='free';
      for(const path of ['/lineups/publish/home/fixture','/clubs/home/lineups/fixture/publish']) {
        const denied=await call(path,'POST',{});assert.equal(denied.status,422);assert.match(denied.body.error,/Every selected/);
      }
      assert.equal((await call(`/lineups/${id}`,'PATCH',{status:'published'})).status,422);
      assert.equal((await call(`/lineups/${id}`,'PATCH',{fixture_id:'other'})).status,409);
      f.state.players[0].subscription='stage_plus';assert.equal((await call('/clubs/home/lineups/fixture/publish','POST',{})).status,200);
      await f.save(f.body('away'));
      const path='/lineups/preparation/home/fixture';
      const before=await call(path,'GET');assert.equal(before.status,200);assert.equal(before.body.can_ready,false);
      assert.equal((await call(path,'POST',{action:'ready',expected_revision:before.body.selection_revision})).status,409);
      f.at('2026-11-02T19:05:00Z');
      assert.equal((await call(path,'POST',{action:'ready',expected_revision:before.body.selection_revision})).status,200);
      await f.action('away',{action:'ready'});
      f.at('2026-11-02T19:15:00Z');
      assert.equal((await call(`/lineups/${id}`,'PATCH',{notes:'late'})).status,409);
      assert.equal((await call(path,'POST',{action:'reserve',out_player_id:'home1',in_player_id:'home4',expected_revision:before.body.selection_revision})).status,200);
      const changed=await call(path,'GET');assert.equal(changed.body.ready_at,null);
      assert.equal((await call(path,'POST',{action:'ready',expected_revision:changed.body.selection_revision})).status,200);
      f.at('2026-11-02T19:20:00Z');await f.start();
      assert.equal((await call(`/lineups/${id}`,'DELETE')).status,409);
      forbidden=true;assert.equal((await call(`/lineups/${id}`,'PATCH',{notes:'no'})).status,403);
    } finally {await new Promise(resolve=>server.close(resolve));}
  } finally {
    [servicePath,operationsPath,modelPath].forEach((p,i)=>{require.cache[p]=originals[i];});
    routerPaths.forEach((p,i)=>{if(originalRouters[i])require.cache[p]=originalRouters[i];else delete require.cache[p];});
  }
});

test('failed audit rolls back a selection; an admin acting as a club manager receives both audit records without a Plus exemption',async()=>{
  const f=fixture();f.state.failAudit=true;await assert.rejects(f.save(),/audit failed/);assert.equal(f.state.lineups.length,0);
  f.state.failAudit=false;f.user.role_id=0;await f.save();assert.equal(f.state.audits.length,2);
  f.state.players[0].subscription='free';await assert.rejects(f.save({status:'published'},f.state.lineups[0].id),/Every selected/);
});

test('ready opens at exactly minus fifteen and every alias locks at exactly minus five without a background timer',async()=>{
  const f=fixture();const row=await f.save();
  f.at('2026-11-02T19:04:59.999Z');await assert.rejects(f.action('home',{action:'ready'}),/fifteen/);
  f.at('2026-11-02T19:05:00Z');await f.action('home',{action:'ready'});
  f.at('2026-11-02T19:14:59.999Z');await f.save({notes:'before'},row.id);
  assert.equal((await f.service.preparationStatus('home','engine')).ready_at,null);
  f.at('2026-11-02T19:15:00Z');
  for(const action of [()=>f.save({notes:'late'},row.id),()=>f.save(f.body('home','match')),()=>f.service.mutate({existingId:row.id,body:{},remove:true,user:f.user})])await assert.rejects(action(),/locked five/);
  assert.equal((await f.service.preparationStatus('home','match')).locked,true);
});
test('only previously published reserves replace starters, clear readiness and notify atomically; repeated delivery is harmless',async()=>{
  const f=fixture();const row=await f.save({...f.body(),bench_players:['home4']});await f.save(f.body('away'));await f.ready();
  await assert.rejects(f.action('home',{action:'reserve',out_player_id:'home1',in_player_id:'away1'}),/previously declared/);
  f.state.failNotification=true;await assert.rejects(f.action('home',{action:'reserve',out_player_id:'home1',in_player_id:'home4'}),/notification failed/);
  assert.equal(JSON.parse(f.state.lineups[0].starting_players)[0],'home1');assert.ok(f.state.preparation.sides.home.ready_at);
  f.state.failNotification=false;
  await f.action('home',{action:'reserve',out_player_id:'home1',in_player_id:'home4'});
  assert.equal(f.state.notifications.length,1);assert.equal(f.state.preparation.sides.home.ready_at,null);
  await f.action('home',{action:'reserve',out_player_id:'home1',in_player_id:'home4'});assert.equal(f.state.notifications.length,1);
  await assert.rejects(f.start(),/mark their current/);
  await f.action('home',{action:'ready'});await f.start();
  assert.ok(f.state.snapshot.selections.home.starters.includes('home4'));assert.ok(!f.state.snapshot.selections.home.ids.includes('home1'));
  await assert.rejects(f.service.mutate({existingId:row.id,body:{},user:f.user}),/frozen/);
});
test('expired starters can be replaced by eligible reserves; expired unused reserves may be withdrawn without blocking the club',async()=>{
  const f=fixture();await f.save({...f.body(),bench_players:['home4']});f.at('2026-11-02T19:15:00Z');
  f.state.players[0].subscription='free';assert.equal((await f.service.preparationStatus('home','match')).eligible,false);
  await f.action('home',{action:'reserve',out_player_id:'home1',in_player_id:'home4'});
  assert.equal((await f.service.preparationStatus('home','match')).eligible,true);
  const g=fixture();await g.save({...g.body(),bench_players:['home4']});g.at('2026-11-02T19:15:00Z');g.state.players[3].subscription='free';
  await g.action('home',{action:'withdraw_reserve',out_player_id:'home4'});await g.action('home',{action:'ready'});
  assert.equal(g.state.notifications.length,1);assert.equal((await g.service.preparationStatus('home','match')).eligible,true);
});
test('schedule changes invalidate prior readiness and published preparation; no early kickoff or clock-based forfeit',async()=>{
  const f=fixture();await f.save();await f.save(f.body('away'));await f.ready();f.at('2026-11-02T19:19:59Z');await assert.rejects(f.start(),/scheduled time/);
  f.state.match.scheduled_date='2026-11-02T20:20:00Z';
  const status=await f.service.preparationStatus('home','match');assert.equal(status.ready_at,null);assert.equal(status.lineup_id,null);
  await assert.rejects(f.action('home',{action:'ready'}),/fifteen/);
  await f.save({notes:'republished'},f.state.lineups[0].id);
  assert.equal(f.state.preparation.history.length,1);
  f.at('2026-11-02T20:31:00Z');assert.equal((await f.service.preparationStatus('home','match')).waiting_elapsed,true);assert.equal(f.state.match.status,'scheduled');
  await assert.rejects(f.service.assertGenericPatch(f.state.match,{scheduled_date:'2026-11-03T20:20:00Z'}),/GameDay/);
});
test('stale readiness review, ineligible reserves and malformed scheduling fail closed; old editions do not adopt preparation',async()=>{
  const f=fixture();const row=await f.save({...f.body(),bench_players:['home4']});f.at('2026-11-02T19:05:00Z');
  const old=await f.service.preparationStatus('home','match');
  await f.save({starting_players:['home2','home1','home3']},row.id);
  await assert.rejects(f.service.preparationAction('home','match',{action:'ready',expected_revision:old.selection_revision},f.user),/changed/);
  f.at('2026-11-02T19:15:00Z');f.state.players[3].subscription='free';
  await assert.rejects(f.action('home',{action:'reserve',out_player_id:'home1',in_player_id:'home4'}),/Every selected/);
  f.state.match.scheduled_date=null;await assert.rejects(f.service.preparationStatus('home','match'),/valid/);
  const legacy=fixture({legacy:true});assert.deepEqual(await legacy.service.preparationStatus('home','match'),{official:false});
});
test('match window conversion uses the published timezone, including daylight saving offsets',()=>{
  const {matchWindows}=require('../../lib/officialMatchWindows');
  assert.equal(matchWindows({scheduled_date:'2026-11-03 20:00:00',timezone:'Europe/Brussels'},'2026-11-03T18:45:00Z').can_ready,true);
  assert.equal(matchWindows({scheduled_date:'2026-07-03 20:00:00',timezone:'Europe/Brussels'}).kickoff_at,'2026-07-03T18:00:00.000Z');
  assert.throws(()=>matchWindows({scheduled_date:'2026-11-03 20:00:00',timezone:'unknown'}),/timezone/);
});

test('only the internal calendar resolver can inspect a new ordinary fixture before its first GameDay match exists',async()=>{
 const f=fixture();f.state.engine=null;f.state.match=null;
 const pending=await f.service.context('fixture',f.q,{allowMissingMatch:true});assert.equal(pending.official,true);assert.equal(pending.sourceFixture.id,'fixture');
 await assert.rejects(f.service.context('fixture'),/unambiguous playable match/);
});

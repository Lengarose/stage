'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createService}=require('../officialMatchEligibilityService');
const {VERSION}=require('../../lib/regionalRegistrationPolicy');
function fixture({legacy=false,pathway=false}={}) {
  let now=new Date('2026-11-02T19:00:00Z');
  let state={root:{id:'edition',status:pathway?'running':'in_progress',...(legacy?{}:pathway?{participation_window_snapshot:{policy_version:VERSION}}:{regional_participation_policy_version:VERSION})},
    engine:{id:'engine',match_id:'match',legacy_fixture_id:'fixture',legacy_fixture_type:pathway?'regional_pathway':'regional_league',competition_instance_id:'edition',status:'scheduled'},
    match:{id:'match',source_fixture_type:'competition_engine',source_fixture_id:'engine',home_club_id:'home',away_club_id:'away',status:'scheduled'},
    lineups:[],snapshot:null,audits:[],players:['home','away'].flatMap(club=>[1,2,3,4].map(i=>({id:`${club}${i}`,club_id:club,playing_club_id:club,subscription:'stage_plus'})))};
  const copy=structuredClone;
  const row=record=>({...record,data_json:JSON.stringify(record)});
  const q=async(sql,p=[])=>{
    if(sql.startsWith('SELECT * FROM competition_fixtures'))return p.includes('engine') || p.includes('fixture') || p.includes('match')?[copy(state.engine)]:[];
    if(sql.startsWith('SELECT * FROM matches'))return p.includes('match') || p.includes('engine')?[copy(state.match)]:[];
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
    if(sql.startsWith('INSERT INTO league_entities')){state.snapshot=JSON.parse(p[1]);return {};}
    if(sql.startsWith('INSERT INTO club_operation_audit_logs') || sql.startsWith('INSERT INTO admin_audit_log')){if(state.failAudit)throw Error('audit failed');state.audits.push(p);return {};}
    throw Error(`Unhandled SQL: ${sql}`);
  };
  const transaction=async fn=>{const before=copy(state);try{return await fn(q);}catch(e){state=before;throw e;}};
  const service=createService({query:q,transaction,clock:()=>now,rosters:{players:async club=>copy(state.players.filter(p=>p.club_id===club))}});
  const user={id:'owner',email:'owner@test',role_id:1};
  const body=(club='home',alias='fixture')=>({club_id:club,fixture_id:alias,fixture_type:'pretend_casual',starting_players:[1,2,3].map(i=>`${club}${i}`),bench_players:[],status:'published'});
  const save=(b=body(),id)=>service.mutate({body:b,existingId:id,user});
  const start=()=>service.kickoff('match',async()=>{state.match.status='in_progress';});
  return {service,q,save,body,user,start,get state(){return state;},at:date=>{now=new Date(date);}};
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
  await assert.rejects(f.start(),/Both clubs/);assert.equal(f.state.snapshot,null);
  await f.save(f.body('away','engine'));
  f.state.players[0].subscription_expires_at='2026-11-02T19:00:01Z';f.at('2026-11-02T19:00:02Z');
  await assert.rejects(f.start(),/Every selected/);assert.equal(f.state.match.status,'scheduled');assert.equal(f.state.snapshot,null);
  f.state.players[0].subscription_expires_at='2026-11-02T19:01:00Z';
  await f.start();const captured=structuredClone(f.state.snapshot);
  f.at('2026-11-02T19:30:00Z');await f.start();assert.deepEqual(f.state.snapshot,captured);
  await f.service.assertParticipants(f.state.match,'home',{participating_player_ids:['home1','home2','home3'],player_stats:[{player_id:'home1'}]});
  await assert.rejects(f.save({notes:'changed'},f.state.lineups[0].id),/frozen/);
  await assert.rejects(f.service.mutate({existingId:f.state.lineups[0].id,body:{},remove:true,user:f.user}),/frozen/);
  await assert.rejects(f.service.assertParticipants(f.state.match,'home',{participating_player_ids:['home1','home2','home4']}),/actual participants/);
  await assert.rejects(f.service.assertParticipants(f.state.match,'home',{participating_player_ids:['home1','home2','home3'],player_stats:[{player_id:'away1'}]}),/Statistics/);
});
test('kickoff rolls back the snapshot if changing the match fails, rejects unconfirmed schedule and missing kickoff evidence',async()=>{
  const f=fixture();await f.save();await f.save(f.body('away'));
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
      const created=await call('/lineups','POST',{...f.body(),status:'draft'});assert.equal(created.status,201);
      const id=created.body.id;f.state.players[0].subscription='free';
      for(const path of ['/lineups/publish/home/fixture','/clubs/home/lineups/fixture/publish']) {
        const denied=await call(path,'POST',{});assert.equal(denied.status,422);assert.match(denied.body.error,/Every selected/);
      }
      assert.equal((await call(`/lineups/${id}`,'PATCH',{status:'published'})).status,422);
      assert.equal((await call(`/lineups/${id}`,'PATCH',{fixture_id:'other'})).status,409);
      f.state.players[0].subscription='stage_plus';assert.equal((await call('/clubs/home/lineups/fixture/publish','POST',{})).status,200);
      await f.save(f.body('away'));await f.start();
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

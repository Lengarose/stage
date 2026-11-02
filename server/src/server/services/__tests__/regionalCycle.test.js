'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');

function fixture(count=40) {
  let state={league_entities:[],clubs:[],matches:[],competition_instances:[],competition_participants:[],competition_fixtures:[],admin_audit_log:[]};
  let injected='';
  function entity(record,type='regional_league') { return {...record,entity_type:type,data_json:JSON.stringify(record)}; }
  for(let i=0;i<count;i++)state.clubs.push({id:`club-${i}`,name:`Club ${i}`,owner_email:`owner${i}@fixture.local`,platform:'cross-platform'});
  const definitions=[1,2].map(division=>({id:`root-${division}`,name:`Division ${division}`,region_slug:'fixture-region',region:'fixture-region',platform:'cross-platform',division,season_number:1,reset_series:0,group_code:'A',slug:`fixture-region-div-${division}`,status:'registration',max_clubs:20,num_clubs:division===1?Math.min(20,count):Math.min(20,Math.max(0,count-20)),registered_club_ids:state.clubs.slice((division-1)*20,division*20).map(c=>c.id),trophy_item_id:`trophy-${division}`}));
  state.league_entities.push(...definitions.map(d=>entity(d)));
  for(const club of state.clubs.slice(40))state.league_entities.push(entity({id:`registration-${club.id}`,club_id:club.id,status:'approved',region_slug:'fixture-region',platform:'cross-platform',division:1,season_number:1,reset_series:0},'season_registration'));
  async function query(sql,values=[]) {
    if(injected && sql.includes(injected))throw new Error('Injected cycle write failure');
    if(/FROM users/.test(sql))return values[0]==='admin'?[{id:'admin',email:'admin@fixture.local',role_id:2}]:values[0]==='super'?[{id:'super',email:'super@fixture.local',role_id:0}]:[];
    if(/regional-edition-write-lock/.test(sql))return [];
    if(/^SELECT/.test(sql)) {
      if(sql.includes('SELECT m.*, cf.legacy_fixture_id')) {
        const ids=new Set(values);return structuredClone(state.matches.filter(m=>ids.has(m.source_fixture_id)||ids.has(m.id)));
      }
      const table=/FROM\s+`?(\w+)/.exec(sql)?.[1];
      let rows=structuredClone(state[table] || []);
      const literal=/\bentity_type='([^']+)'/.exec(sql)?.[1];
      if(literal)rows=rows.filter(r=>r.entity_type===literal);
      let index=0;
      for(const m of sql.matchAll(/\b(id|entity_type|league_id|competition_instance_id|competition_context)\s*=\s*\?/g)) {
        const value=values[index++];rows=rows.filter(r=>r[m[1]]===value);
      }
      if(/\bid IN \(/.test(sql))rows=rows.filter(r=>values.includes(r.id));
      return rows.sort((a,b)=>String(a.id).localeCompare(String(b.id)));
    }
    if(/^INSERT INTO/.test(sql)) {
      const table=/INTO\s+`?(\w+)/.exec(sql)[1];
      const columns=/\(([^)]+)\)/.exec(sql)[1].split(',').map(k=>k.trim().replaceAll('`',''));
      const raw=/VALUES\s*\((.*)\)/s.exec(sql)[1].split(',');let i=0;
      const row=Object.fromEntries(columns.map((key,j)=>[key,raw[j]?.trim()==='?'?values[i++]:raw[j]?.trim().replace(/^'|'$/g,'')]));
      if(state[table].some(r=>r.id===row.id))throw new Error(`Duplicate ${table} ID`);
      if(row.regional_edition_key && state[table].some(r=>r.regional_edition_key===row.regional_edition_key))throw new Error('Duplicate regional identity');
      state[table].push(row);return {affectedRows:1};
    }
    if(/^UPDATE league_entities SET data_json=/.test(sql)) {
      const record=JSON.parse(values[0]);
      const row=state.league_entities.find(r=>r.id===values.at(-1));assert.ok(row,sql);
      Object.assign(row,record,{data_json:values[0],updated_date:'changed-after-write'});
      if(sql.includes('regional_edition_key=?'))row.regional_edition_key=values[1];
      return {affectedRows:1};
    }
    if(sql.startsWith("DELETE FROM league_entities WHERE entity_type='regional_league_standing'")) {
      state.league_entities=state.league_entities.filter(r=>!(r.entity_type==='regional_league_standing'&&r.league_id===values[0]));return {};
    }
    if(sql.startsWith('UPDATE competition_instances')) {state.competition_instances.find(r=>r.id===values[0]).status='completed';return {};}
    throw new Error(`Unhandled regional cycle fixture SQL: ${sql}`);
  }
  let queue=Promise.resolve();
  const withTransaction=fn=>{
    const run=queue.then(async()=>{const before=structuredClone(state);try{return await fn(query);}catch(e){state=before;throw e;}});
    queue=run.catch(()=>{});return run;
  };
  const db=require.resolve('../../db/database');require.cache[db]={id:db,filename:db,loaded:true,exports:{EXECUTESQL:query,withTransaction}};
  for(const file of ['../regionalCycleService','../regionalEditionService','../../models/competitionScopeModel','../../controllers/leagueEntityController'])delete require.cache[require.resolve(file)];
  const service=require('../regionalCycleService'), actor={id:'admin'};
  const input={mode:'placement',source_edition_ids:count>20?['root-1','root-2']:['root-1'],registration_ids:state.clubs.slice(40).map(c=>`registration-${c.id}`),target_count:count,reason:'Approved fixture test'};
  async function prepare(){const review=await service.prepare(input,actor);return service.prepare({...input,apply:true,expected_revision:review.revision},actor);}
  function finishMatches(cycle) {
    for(const match of state.matches.filter(m=>m.competition_context===cycle.id && m.status==='pending_schedule')) {
      const homeWins=match.home_club_id.localeCompare(match.away_club_id)<0;
      Object.assign(match,{status:'completed',result_state:'CONFIRMED',stats_processed:1,home_score:homeWins?1:0,away_score:homeWins?0:1});
    }
  }
  return {service,actor,input,prepare,query,entity,finishMatches,fail(value){injected=value;},get state(){return state;}};
}

function transitionFixture(from,to) {
  const env=fixture(to),spec=require('../../lib/regionalStructure').structure(from);
  env.state.league_entities.length=0;
  const roots=[1,2].map(division=>({id:`root-${division}`,name:`Division ${division}`,region_slug:'fixture-region',region:'fixture-region',platform:'cross-platform',division,season_number:1,reset_series:0,group_code:'A',slug:`fixture-region-div-${division}`,status:'completed',max_clubs:20,trophy_item_id:`trophy-${division}`,registered_club_ids:[],reward_snapshot:[{amount:999}],winner_club_id:'historical-winner'}));
  const source=[];
  for(const [index,g] of spec.groups.entries()) {
    const root=roots[g.division-1],club_ids=env.state.clubs.slice(index*20,index*20+20).map(c=>c.id);
    const id=g.group_code==='A'?root.id:`${root.id}-${g.group_code}`;
    const record={...root,id,permanent_league_id:root.id,group_code:g.group_code,registered_club_ids:club_ids,num_clubs:20,slug:root.slug+(g.group_code==='A'?'':`-group-${g.group_code.toLowerCase()}`)};
    if(id===root.id)Object.assign(root,record);
    else env.state.league_entities.push(env.entity(record));
    root.group_current_edition_ids={...root.group_current_edition_ids,[g.group_code]:id};
    root.current_edition_id=root.id;source.push(id);
    for(const club_id of club_ids) {
      const position=club_ids.slice().sort((a,b)=>a.localeCompare(b)).indexOf(club_id);
      env.state.league_entities.push(env.entity({id:`standing:${g.ref}:${club_id}`,league_id:id,club_id,played:38,wins:2*(19-position),losses:2*position,draws:0,points:6*(19-position),goals_for:2*(19-position),goals_against:2*position,goal_difference:38-4*position,status:'active'},'regional_league_standing'));
    }
    for(const home of club_ids)for(const away of club_ids.filter(c=>c!==home)) {
      const fixtureId=`${g.ref}:${home}:${away}`,matchId=`match:${fixtureId}`,win=home.localeCompare(away)<0;
      env.state.league_entities.push(env.entity({id:fixtureId,league_id:id,home_club_id:home,away_club_id:away,phase:'league',status:'played',stats_processed:1,home_score:win?1:0,away_score:win?0:1,match_id:matchId},'regional_league_fixture'));
      env.state.matches.push({id:matchId,source_fixture_id:fixtureId,source_fixture_type:'regional_league',home_club_id:home,away_club_id:away,status:'completed',result_state:'CONFIRMED',stats_processed:1,home_score:win?1:0,away_score:win?0:1});
    }
  }
  for(const root of roots)env.state.league_entities.push(env.entity(root.registered_club_ids.length?root:{...root,status:'registration'}));
  const registrationIds=[];
  for(const club of env.state.clubs.slice(from)) {
    const id=`new-${club.id}`;registrationIds.push(id);
    env.state.league_entities.push(env.entity({id,club_id:club.id,status:'approved',region_slug:'fixture-region',platform:'cross-platform',division:2,season_number:2,reset_series:0},'season_registration'));
  }
  Object.assign(env.input,{mode:'transition',source_edition_ids:source,registration_ids:registrationIds,target_count:to});
  return env;
}

function tieSource(env,ref,positions) {
  const group=env.state.league_entities.find(r=>r.entity_type==='regional_league' && `D${r.division}${r.group_code || 'A'}`===ref);
  const root=JSON.parse(group.data_json),ordered=root.registered_club_ids.slice().sort((a,b)=>a.localeCompare(b));
  const equal=positions.map(position=>ordered[position-1]);
  const games=env.state.matches.filter(m=>m.id.startsWith(`match:${ref}:`));
  for(const match of games.filter(m=>equal.includes(m.home_club_id)&&equal.includes(m.away_club_id)))Object.assign(match,{home_score:0,away_score:0});
  for(const row of env.state.league_entities.filter(r=>r.entity_type==='regional_league_standing'&&r.league_id===root.id)) {
    const standing=JSON.parse(row.data_json),own=games.filter(m=>[m.home_club_id,m.away_club_id].includes(row.club_id));
    let wins=0,draws=0,losses=0,gf=0,ga=0;
    for(const match of own) {
      const [forGoals,againstGoals]=match.home_club_id===row.club_id?[match.home_score,match.away_score]:[match.away_score,match.home_score];
      gf+=forGoals;ga+=againstGoals;if(forGoals>againstGoals)wins++;else if(forGoals===againstGoals)draws++;else losses++;
    }
    Object.assign(standing,{played:own.length,wins,draws,losses,points:wins*3+draws,goals_for:gf,goals_against:ga,goal_difference:gf-ga});
    Object.assign(row,standing,{data_json:JSON.stringify(standing)});
  }
  delete root.winner_club_id;root.status='in_progress';
  Object.assign(group,root,{data_json:JSON.stringify(root)});delete group.winner_club_id;
  return {equal,root,games};
}

test('ordinary league decisions precede promotion, preserve points and publish final relegation and title places',async()=>{
  const env=transitionFixture(40,40);
  const d1=tieSource(env,'D1A',[18,19]),d2=tieSource(env,'D2A',[1,2]);
  const originalGames=structuredClone(env.state.matches),originalStats=env.state.league_entities.filter(r=>r.entity_type==='regional_league_standing').map(r=>({id:r.id,points:r.points,goals_for:r.goals_for}));
  const {cycle}=await env.prepare();assert.equal(cycle.source_ranking_policy_version,require('../../lib/regionalStructure').SOURCE_RANKING_VERSION);
  assert.equal(cycle.plan.fixtures.length,2);assert.ok(cycle.plan.fixtures.every(f=>f.ref.startsWith('source:')));
  assert.equal((await env.service.allocate(cycle.id,{},env.actor)).ready,false);
  const games=env.state.matches.filter(m=>m.competition_context===cycle.id);
  for(const match of games)Object.assign(match,{status:'completed',result_state:'CONFIRMED',stats_processed:1,home_score:0,away_score:0,decided_on_penalties:1,penalty_winner_side:'away'});
  const after=(await env.service.progress(cycle.id,env.actor)).cycle;
  assert.equal(after.plan.fixtures.filter(f=>f.ref.startsWith('promotion:')).length,2);
  const sourceRankings=after.plan.source_rankings;
  const decidedD1=games.find(m=>d1.equal.includes(m.home_club_id)),decidedD2=games.find(m=>d2.equal.includes(m.home_club_id));
  assert.equal(sourceRankings.find(g=>g.ref==='D1A').ranked_club_ids[17],decidedD1.away_club_id);
  assert.equal(sourceRankings.find(g=>g.ref==='D2A').ranked_club_ids[0],decidedD2.away_club_id);
  for(let i=0;i<2;i++){env.finishMatches(cycle);await env.service.progress(cycle.id,env.actor);}
  const review=await env.service.allocate(cycle.id,{},env.actor);assert.equal(review.ready,true);
  assert.equal(review.rights.find(r=>r.club_id===decidedD1.home_club_id).division,2);
  assert.equal(review.rights.find(r=>r.club_id===decidedD1.away_club_id).division,1);
  await env.service.allocate(cycle.id,{apply:true,expected_revision:review.revision,reason:'Confirmed sporting decisions'},env.actor);
  for(const source of [d1,d2]) {
    const root=JSON.parse(env.state.league_entities.find(r=>r.id===source.root.id).data_json);
    assert.equal(root.status,'completed');assert.equal(root.regional_final_ranking_cycle_id,cycle.id);assert.equal(root.pending_regional_cycle_id,null);
    assert.equal(root.winner_club_id,root.regional_final_ranked_club_ids[0]);
    assert.notEqual(root.current_edition_id,root.id,'current pointer still opens the new season');
    const scope=await new (require('../../models/competitionScopeModel').CompetitionScopeModel)().selectOne('regional_league',root.id,env.query);
    const placements=require('../../lib/competitionPrizes').placements(scope,[{position:1,amount:'0.00'},{position:18,amount:'0.00'},{position:19,amount:'0.00'}]);
    assert.equal(placements.blocked,undefined);
    assert.equal(placements.map.get(1),root.regional_final_ranked_club_ids[0]);
    assert.equal(placements.map.get(18),root.regional_final_ranked_club_ids[17]);
    scope.root.regional_final_results_revision='stale';
    assert.match(require('../../lib/competitionPrizes').placements(scope,[{position:1,amount:'0.00'}]).blocked,/changed/);
  }
  assert.deepEqual(env.state.matches.slice(0,originalGames.length),originalGames);
  for(const before of originalStats) {
    const row=JSON.parse(env.state.league_entities.find(r=>r.id===before.id).data_json);
    assert.equal(row.points,before.points);assert.equal(row.goals_for,before.goals_for);assert.ok(row.final_position>=1&&row.final_position<=20);
  }
});

test('three tied ordinary league clubs receive a single-round mini-league; no promotion fixtures precede it',async()=>{
  const env=transitionFixture(40,40),{equal}=tieSource(env,'D2A',[1,2,3]);
  const {cycle}=await env.prepare();assert.equal(cycle.plan.fixtures.length,3);
  assert.ok(cycle.plan.fixtures.every(f=>f.ref.startsWith('source:D2A:tie:')&&!f.allow_penalties));
  assert.deepEqual(new Set(cycle.plan.fixtures.flatMap(f=>[f.home,f.away])),new Set(equal));
  for(const match of env.state.matches.filter(m=>m.competition_context===cycle.id))Object.assign(match,{status:'completed',result_state:'CONFIRMED',stats_processed:1,home_score:0,away_score:0});
  const review=(await env.service.progress(cycle.id,env.actor)).cycle;
  assert.equal(review.status,'review');assert.match(review.plan.unresolved_ties[0].reason,/remains tied/);
  assert.equal(review.plan.fixtures.length,3);assert.equal((await env.service.allocate(cycle.id,{},env.actor)).ready,false);
});

test('incomplete sources, already-recorded champions and five-way final league ties cannot allocate a new draw',async()=>{
  const env=transitionFixture(40,40);tieSource(env,'D1A',[1,2]);
  const game=env.state.matches.pop();await assert.rejects(env.prepare(),/380|standings/i);env.state.matches.push(game);
  const row=env.state.league_entities.find(r=>r.id==='root-1'),root=JSON.parse(row.data_json);
  Object.assign(row,{winner_club_id:'prior-champion',data_json:JSON.stringify({...root,winner_club_id:'prior-champion'})});
  await assert.rejects(env.prepare(),/historical edition already records a champion/);
  const large=transitionFixture(40,40);tieSource(large,'D1A',[1,2,3,4,5]);
  const report=await large.service.prepare(large.input,large.actor);assert.match(report.blockers[0],/sporting review/);
  await assert.rejects(large.service.prepare({...large.input,apply:true,expected_revision:report.revision},large.actor),/requires review/);
  assert.equal(large.state.competition_fixtures.length,0);
});

test('normal transition reads complete source matches, promotes via official playoffs and preserves historical snapshots',async()=>{
  const env=transitionFixture(40,40),{cycle}=await env.prepare();
  assert.equal(env.state.competition_fixtures.length,2);
  for(let round=0;round<2;round++){env.finishMatches(cycle);await env.service.progress(cycle.id,env.actor);}
  const preview=await env.service.allocate(cycle.id,{},env.actor);assert.equal(preview.ready,true);
  assert.equal(preview.rights.filter(r=>r.route==='promotion').length,2);
  const applied=await env.service.allocate(cycle.id,{apply:true,expected_revision:preview.revision,reason:'Normal sporting transition'},env.actor);
  assert.equal(applied.cycle.allocated_groups.length,2);
  for(const g of applied.cycle.allocated_groups) {
    const record=JSON.parse(env.state.league_entities.find(r=>r.id===g.id).data_json);
    assert.equal(record.season_number,2);assert.equal(record.registered_club_ids.length,20);assert.equal(record.reward_snapshot,undefined);assert.equal(record.winner_club_id,undefined);
    assert.equal(record.trophy_item_id,`trophy-${g.division}`);assert.equal(record.previous_season_id,`root-${g.division}`);
  }
  assert.deepEqual(JSON.parse(env.state.league_entities.find(r=>r.id==='root-1').data_json).reward_snapshot,[{amount:999}]);
  assert.equal((await env.service.prepare({...env.input,apply:true,reason:'Late HTTP retry'},env.actor)).already_applied,true,'a retry after the pointers moved must resolve the established operation');
});

test('a published participation window gates the complete field and assigned groups update every confirmed club',async()=>{
  const env=fixture(20),policy=require('../../lib/regionalRegistrationPolicy');
  const window={id:'participation-window',region_slug:'fixture-region',platform:'cross-platform',season_number:1,reset_series:0,opens_at:'2000-01-01T00:00:00.000Z',registration_closes_at:'2000-01-29T00:00:00.000Z',confirmation_closes_at:'2000-02-05T00:00:00.000Z',policy_version:policy.VERSION,rules_text:'Published test conditions'};
  env.state.league_entities.push(env.entity({...window,status:'published',permanent_league_id:'root-1'},'regional_registration_window'));
  await assert.rejects(env.prepare(),/valid confirmation/);
  const accepted_rules_revision=require('node:crypto').createHash('sha256').update(JSON.stringify(window)).digest('hex');
  for(const club of env.state.clubs)env.state.league_entities.push(env.entity({id:`confirmed:${club.id}`,club_id:club.id,status:'approved',participation_status:'confirmed',registration_window_id:window.id,registration_policy_version:policy.VERSION,confirmed_player_ids:['p1','p2','p3'],accepted_rules_revision},'season_registration'));
  const {cycle}=await env.prepare();assert.equal(cycle.participation_window_snapshot.id,window.id);
  const preview=await env.service.allocate(cycle.id,{},env.actor);
  await env.service.allocate(cycle.id,{apply:true,expected_revision:preview.revision,reason:'Apply fully confirmed field'},env.actor);
  const records=env.state.league_entities.filter(r=>r.entity_type==='season_registration').map(r=>JSON.parse(r.data_json));
  assert.equal(records.length,20);assert.ok(records.every(r=>r.assigned_league_id==='root-1' && r.assigned_division===1 && r.assigned_group_code==='A'));
  const group=JSON.parse(env.state.league_entities.find(r=>r.id==='root-1').data_json);
  assert.equal(group.regional_registration_window_id,window.id);assert.equal(group.regional_participation_policy_version,policy.VERSION);
  assert.equal(group.rules,window.rules_text);assert.equal(group.rules_file_url,null);
});

test('60 to 80 growth provisions B inside the original D1 identity and keeps new entrants in D2',async()=>{
  const env=transitionFixture(60,80),{cycle}=await env.prepare();assert.equal(env.state.competition_fixtures.length,4);
  env.finishMatches(cycle);await env.service.progress(cycle.id,env.actor);
  const review=await env.service.allocate(cycle.id,{},env.actor);assert.equal(review.ready,true);
  assert.equal(review.rights.filter(r=>r.division===1).length,40);
  assert.ok(review.rights.filter(r=>r.route==='new_entry').every(r=>r.division===2));
  const applied=await env.service.allocate(cycle.id,{apply:true,reason:'Sporting expansion',expected_revision:review.revision},env.actor);
  assert.equal(applied.cycle.allocated_groups.length,4);
  assert.equal(env.state.league_entities.filter(r=>r.entity_type==='regional_league'&&(!JSON.parse(r.data_json).permanent_league_id||JSON.parse(r.data_json).permanent_league_id===r.id)).length,2);
  const root=JSON.parse(env.state.league_entities.find(r=>r.id==='root-1').data_json);
  assert.ok(root.group_current_edition_ids.B);assert.notEqual(root.group_current_edition_ids.B,root.group_current_edition_ids.A);
});

test('changed final source results and a disputed playoff invalidate allocation; 180 to 240 waits for calendar verification',async()=>{
  const env=transitionFixture(40,40),{cycle}=await env.prepare();
  env.finishMatches(cycle);await env.service.progress(cycle.id,env.actor);env.finishMatches(cycle);await env.service.progress(cycle.id,env.actor);
  const review=await env.service.allocate(cycle.id,{},env.actor);
  const playoff=env.state.matches.find(m=>m.competition_context===cycle.id);playoff.result_state='DISPUTED';
  await assert.rejects(env.service.allocate(cycle.id,{apply:true,reason:'Stale proposal',expected_revision:review.revision},env.actor),/no longer follows|not final/);
  const growth=transitionFixture(180,240);const report=await growth.service.prepare(growth.input,growth.actor);
  assert.match(report.blockers[0],/calendar/);
  await assert.rejects(growth.service.prepare({...growth.input,apply:true,reason:'No calendar yet',expected_revision:report.revision},growth.actor),/requires review/);
  assert.equal(growth.state.competition_fixtures.length,0);
});

test('a tied placement boundary creates one official sporting decision and retries retain the published home side',async()=>{
  const env=fixture(),{cycle}=await env.prepare();
  assert.equal(cycle.tie_policy_version,require('../../lib/regionalStructure').TIE_VERSION);
  env.finishMatches(cycle);
  const firstGroup=cycle.plan.placement_groups[0].slice().sort((a,b)=>a.localeCompare(b));
  const equal=firstGroup.slice(1,3);
  const original=env.state.matches.find(m=>equal.includes(m.home_club_id)&&equal.includes(m.away_club_id));
  Object.assign(original,{home_score:0,away_score:0});
  const next=(await env.service.progress(cycle.id,env.actor)).cycle;
  const decisions=Object.entries(next.fixture_refs).filter(([ref])=>ref.includes(':tie:'));
  assert.equal(decisions.length,1);assert.equal(env.state.competition_fixtures.length,81);
  const draw=await env.service.draw(cycle.id,env.query);
  const official=draw.fixtures.find(f=>f.id===decisions[0][1]);
  assert.deepEqual(new Set([official.home_club_id,official.away_club_id]),new Set(equal));
  await env.service.progress(cycle.id,env.actor);
  assert.deepEqual(await env.service.draw(cycle.id,env.query),draw);
  const match=env.state.matches.find(m=>m.id===official.match_id);
  Object.assign(match,{status:'completed',result_state:'CONFIRMED',stats_processed:1,home_score:0,away_score:0,decided_on_penalties:1,penalty_winner_side:'away'});
  const thirds=(await env.service.progress(cycle.id,env.actor)).cycle;
  assert.equal(env.state.competition_fixtures.length,85);
  env.finishMatches(thirds);
  assert.equal((await env.service.progress(cycle.id,env.actor)).cycle.status,'ready');
  assert.equal((await env.service.allocate(cycle.id,{},env.actor)).ready,true);
});

test('an official supplementary mini-league that remains tied blocks allocation without creating another tournament',async()=>{
  const env=fixture(),{cycle}=await env.prepare();env.finishMatches(cycle);
  const equal=cycle.plan.placement_groups[0].slice().sort((a,b)=>a.localeCompare(b)).slice(0,3);
  for(const match of env.state.matches.filter(m=>equal.includes(m.home_club_id)&&equal.includes(m.away_club_id)))Object.assign(match,{home_score:0,away_score:0});
  const next=(await env.service.progress(cycle.id,env.actor)).cycle;
  const extra=Object.entries(next.fixture_refs).filter(([ref])=>ref.includes(':tie:'));
  assert.equal(extra.length,3);assert.equal(env.state.matches.length,83);
  for(const [,id] of extra) {
    const match=env.state.matches.find(m=>m.source_fixture_id===id);
    assert.equal(match.allow_penalties,0);
    Object.assign(match,{status:'completed',result_state:'CONFIRMED',stats_processed:1,home_score:0,away_score:0});
  }
  const review=(await env.service.progress(cycle.id,env.actor)).cycle;
  assert.equal(review.status,'review');assert.equal(review.plan.unresolved_ties.length,1);
  assert.match(review.plan.unresolved_ties[0].reason,/remains tied/);
  assert.equal((await env.service.allocate(cycle.id,{},env.actor)).ready,false);
  await env.service.progress(cycle.id,env.actor);assert.equal(env.state.matches.length,83);
});

test('a legacy captured cycle does not silently adopt supplementary matches',async()=>{
  const env=fixture(),{cycle}=await env.prepare();env.finishMatches(cycle);
  const equal=cycle.plan.placement_groups[0].slice().sort((a,b)=>a.localeCompare(b)).slice(1,3);
  const match=env.state.matches.find(m=>equal.includes(m.home_club_id)&&equal.includes(m.away_club_id));
  Object.assign(match,{home_score:0,away_score:0});
  const row=env.state.league_entities.find(r=>r.id===cycle.id),snapshot=JSON.parse(row.data_json);
  delete snapshot.tie_policy_version;delete row.tie_policy_version;row.data_json=JSON.stringify(snapshot);
  const review=(await env.service.progress(cycle.id,env.actor)).cycle;
  assert.equal(review.status,'review');assert.equal(env.state.matches.length,80);
  assert.equal(review.plan.unresolved_ties.length,1);
});

test('captured forty-club placement survives retries, creates official matches and allocates twenty per division',async()=>{
  const env=fixture();
  env.state.league_entities.push(env.entity({id:'seeded-registration',club_id:'club-0',assigned_league_id:'root-1',status:'approved'},'season_registration'));
  const before=structuredClone(env.state);
  const review=await env.service.prepare(env.input,env.actor);
  assert.deepEqual(env.state,before,'preview must be read only');assert.equal(review.initial_fixtures,80);
  const [first,second]=await Promise.all([env.service.prepare({...env.input,apply:true,expected_revision:review.revision},env.actor),env.service.prepare({...env.input,apply:true,expected_revision:review.revision},env.actor)]);
  assert.equal(first.cycle.id,second.cycle.id);assert.equal(first.cycle.seed,second.cycle.seed);
  assert.equal(env.state.competition_fixtures.length,80);assert.equal(env.state.matches.length,80);
  assert.equal(env.state.competition_instances.length,1);assert.equal(env.state.competition_participants.length,40);
  const id=first.cycle.id;
  const waiting=await env.service.allocate(id,{},env.actor);assert.equal(waiting.ready,false);
  await assert.rejects(env.service.allocate(id,{apply:true,reason:'Premature',expected_revision:waiting.revision},env.actor),/not final/);
  env.finishMatches(first.cycle);
  const decisions=(await env.service.progress(id,env.actor)).cycle;
  assert.equal(env.state.competition_fixtures.length,84);assert.equal(decisions.status,'running');
  const published=await env.service.draw(id,env.query);
  assert.equal(published.fixtures.filter(f=>f.phase==='knockout_final').length,4);
  assert.ok(published.fixtures.every(f=>f.match_id));
  assert.equal(published.seed,undefined,'public draw omits private snapshots and emails');
  env.finishMatches(decisions);
  const final=(await env.service.progress(id,env.actor)).cycle;assert.equal(final.status,'ready');
  const allocation=await env.service.allocate(id,{},env.actor);assert.equal(allocation.ready,true);
  const prior=structuredClone(env.state);env.fail('INSERT INTO league_entities');
  await assert.rejects(env.service.allocate(id,{apply:true,expected_revision:allocation.revision,reason:'Rollback allocation proof'},env.actor),/Injected/);
  assert.deepEqual(env.state,prior);env.fail('');
  const [applied,retry]=await Promise.all([1,2].map(()=>env.service.allocate(id,{apply:true,expected_revision:allocation.revision,reason:'Confirmed official placement'},env.actor)));
  assert.equal(retry.already_applied,true);
  assert.equal(applied.cycle.status,'allocated');
  for(const division of [1,2]) {
    const root=JSON.parse(env.state.league_entities.find(r=>r.id===`root-${division}`).data_json);
    assert.equal(root.registered_club_ids.length,20);assert.equal(root.trophy_item_id,`trophy-${division}`);
    assert.equal(root.group_current_edition_ids.A,root.id);assert.equal(root.regional_cycle_id,id);
  }
  assert.equal(env.state.league_entities.filter(r=>r.entity_type==='regional_league_standing').length,40);
  const registration=JSON.parse(env.state.league_entities.find(r=>r.id==='seeded-registration').data_json);
  const actualGroup=applied.cycle.plan.groups.find(g=>g.club_ids.includes('club-0'));
  assert.equal(registration.assigned_division,actualGroup.division);assert.equal(registration.assigned_group_code,actualGroup.group_code);
  assert.equal((await env.service.allocate(id,{apply:true,reason:'Retry'},env.actor)).already_applied,true);
  assert.equal(env.state.competition_fixtures.length,84);
  assert.equal(env.state.competition_instances[0].status,'completed');
  await assert.rejects(env.service.assertWritableFixture(env.state.competition_fixtures[0],env.query),/closed/);
});

test('changed roster invalidates prepare preview and failed match creation rolls back draw, source locks and audit',async()=>{
  const env=fixture(),review=await env.service.prepare(env.input,env.actor);
  const row=env.state.league_entities.find(r=>r.id==='root-1');const root=JSON.parse(row.data_json);root.registered_club_ids.reverse();row.data_json=JSON.stringify(root);delete row.registered_club_ids;
  await assert.rejects(env.service.prepare({...env.input,apply:true,expected_revision:review.revision},env.actor),/changed/);
  const latest=await env.service.prepare(env.input,env.actor),before=structuredClone(env.state);
  env.fail('INSERT INTO matches');
  await assert.rejects(env.service.prepare({...env.input,apply:true,expected_revision:latest.revision},env.actor),/Injected/);
  assert.deepEqual(env.state,before);
  env.fail('');assert.equal((await env.prepare()).applied,true);
});

test('disputes, missing clubs, tampered sources and client-supplied winners cannot assign rights',async()=>{
  const env=fixture();
  await assert.rejects(env.service.prepare({...env.input,winners:['club-1']},env.actor),/assigned by the server/);
  await assert.rejects(env.service.prepare(env.input,{id:'ordinary'}),/Admin/);
  const {cycle}=await env.prepare();env.finishMatches(cycle);
  const match=env.state.matches[0];Object.assign(match,{status:'disputed',result_state:'DISPUTED'});
  const held=await env.service.progress(cycle.id,env.actor);assert.equal(held.cycle.status,'running');assert.equal(held.cycle.plan.pending.length,1);
  env.state.clubs.pop();
  await assert.rejects(env.service.progress(cycle.id,env.actor),/unavailable/);
});

test('twenty-club launch has no placement matches and no relegation into an absent D2',async()=>{
  const env=fixture(20),{cycle}=await env.prepare();assert.equal(cycle.status,'ready');assert.equal(env.state.matches.length,0);
  const preview=await env.service.allocate(cycle.id,{},env.actor);
  await env.service.allocate(cycle.id,{apply:true,reason:'One full initial group',expected_revision:preview.revision},env.actor);
  const root=env.state.league_entities.find(r=>r.id==='root-1');assert.equal(JSON.parse(root.data_json).relegated_slots,0);
});

test('a registration-only launch fills its empty D1 source; a D2 source outside the target cannot be silently dropped',async()=>{
  const env=fixture(20),root=env.state.league_entities.find(r=>r.id==='root-1');
  const record={...JSON.parse(root.data_json),registered_club_ids:[],num_clubs:0};Object.assign(root,record,{data_json:JSON.stringify(record)});
  const registration_ids=env.state.clubs.map(club=>{
    const id=`approved-${club.id}`;env.state.league_entities.push(env.entity({id,club_id:club.id,status:'approved',region_slug:'fixture-region',platform:'cross-platform',division:1,season_number:1,reset_series:0},'season_registration'));return id;
  });
  Object.assign(env.input,{registration_ids});
  const {cycle}=await env.prepare();assert.equal(cycle.plan.ready,true);assert.equal(cycle.plan.rights.length,20);
  const wrong=fixture(20);
  for(const division of [1,2]) {
    const row=wrong.state.league_entities.find(r=>r.id===`root-${division}`);
    const data={...JSON.parse(row.data_json),registered_club_ids:division===2?wrong.state.clubs.map(c=>c.id):[],num_clubs:division===2?20:0};Object.assign(row,data,{data_json:JSON.stringify(data)});
  }
  await assert.rejects(wrong.service.prepare({...wrong.input,source_edition_ids:['root-2']},wrong.actor),/outside the target launch/);
});

test('cycle actions and the sanitized published draw are exercised over local HTTP',async()=>{
  const env=fixture(20),express=require('express');
  const app=express();app.use(express.json());app.use((req,_res,next)=>{req.user={id:req.headers['x-fixture-user'] || 'admin'};next();});
  app.use('/api/stage/regional-leagues',require('../../controllers/leagueEntityController').makeRouter('regional_league'));
  app.use('/api/stage/season-registrations',require('../../controllers/leagueEntityController').makeRouter('season_registration'));
  const server=app.listen(0,'127.0.0.1');await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
  async function call(path,body,user='admin') {
    const response=await fetch(`http://127.0.0.1:${server.address().port}/api/stage/regional-leagues${path}`,{method:body?'POST':'GET',headers:{'content-type':'application/json','x-fixture-user':user},...(body?{body:JSON.stringify(body)}:{})});
    return {status:response.status,data:await response.json()};
  }
  try {
    assert.equal((await call('/cycles',env.input,'ordinary')).status,403);
    assert.equal((await call('/cycles')).status,200);
    const preview=await call('/cycles',env.input);assert.equal(preview.status,200);
    const prepared=await call('/cycles',{...env.input,apply:true,expected_revision:preview.data.revision});assert.equal(prepared.status,200,JSON.stringify(prepared));
    const id=prepared.data.cycle.id;
    assert.equal((await call(`/cycles/${id}`)).status,200);
    assert.equal((await call(`/cycles/${id}` ,null,'ordinary')).status,403);
    assert.equal((await call(`/cycles/${id}/draw`,null,'ordinary')).status,200);
    assert.equal((await call(`/cycles/${id}/progress`,{})).status,200);
    const allocation=await call(`/cycles/${id}/allocate`,{});assert.equal(allocation.status,200);
    assert.equal((await call(`/cycles/${id}/allocate`,{apply:true,expected_revision:allocation.data.revision,reason:'HTTP allocation'})).status,200);
    const registration=await fetch(`http://127.0.0.1:${server.address().port}/api/stage/season-registrations/fabricated`,{method:'PATCH',headers:{'content-type':'application/json','x-fixture-user':'ordinary'},body:JSON.stringify({status:'approved'})});
    assert.equal(registration.status,403,'an ordinary account cannot forge approved entrants for a captured cycle');
    const forged=await fetch(`http://127.0.0.1:${server.address().port}/api/stage/season-registrations`,{method:'POST',headers:{'content-type':'application/json','x-fixture-user':'ordinary'},body:JSON.stringify({club_id:'club-1',status:'approved'})});
    assert.equal(forged.status,403);
  } finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});

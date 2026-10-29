const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture } = require('./regionalEditionHttp.test');

test('rollover keeps the permanent identity and inherits its trophy without another independent source', async () => {
  const env = fixture();
  const id = 'c2d6e60f-89e0-4813-81a1-967551d8d69f';
  env.legacy({ id, name: 'Premier Division', slug: 'uk-ireland-div-1', region_slug: 'uk-ireland', division: 1, platform: 'cross-platform', season_number: 1, status: 'completed', trophy_item_id: 'premier-trophy', rules: 'Recorded league rules' });
  const result = await require('../../services/regionalEditionService').nextSeason(id, { id: 'admin' });
  assert.equal(result.record.permanent_league_id, id, 'the next edition must reference the original permanent league');
  assert.equal(result.record.trophy_item_id, 'premier-trophy');
  assert.equal(result.record.rules, 'Recorded league rules');
  assert.equal([...env.rows.values()].filter(r => !JSON.parse(r.data_json).permanent_league_id || JSON.parse(r.data_json).permanent_league_id === r.id).length, 1);
});

test('requested Premier consolidation retains original identity and Season 2 fixture references',async()=>{
  const env=fixture(),review=require('../../services/regionalEditionReviewService');
  const canonical_id='c2d6e60f-89e0-4813-81a1-967551d8d69f',source_id='46dbb09f-8319-4607-ab97-ec941745bfd8';
  const base={name:'Premier Division',region_slug:'uk-ireland',platform:'cross-platform',division:1};
  env.legacy({...base,id:canonical_id,slug:'uk-ireland-div-1',season_number:1,status:'completed'});
  env.legacy({...base,id:source_id,slug:'uk-ireland-div-1-s2',season_number:2,status:'draft',registered_club_ids:['club-a','club-b']});
  env.rows.set('season-two-fixture',{id:'season-two-fixture',entity_type:'regional_league_fixture',league_id:source_id,data_json:JSON.stringify({league_id:source_id,status:'unscheduled'})});
  env.tables.trophy_items.push({id:'premier-cup',name:'Premier trophy',linked_source_type:'regional_league',linked_source_id:source_id});
  const body={source_id,canonical_id,mode:'consolidate'},actor={id:'admin'};
  const before=JSON.stringify([...env.rows]);
  const preview=await review.repair(body,actor);
  assert.deepEqual(preview.blockers,[]);assert.equal(JSON.stringify([...env.rows]),before);
  assert.equal(preview.discrepancies.canonical_completed_without_fixture_evidence,true);
  const fixtureJson=env.rows.get('season-two-fixture').data_json;
  const applied=await review.repair({...body,apply:true,expected_revision:preview.revision,reason:'Fixture-only reviewed consolidation'},actor);
  assert.equal(applied.applied,true);assert.equal(applied.dry_run,false);
  assert.equal(JSON.parse(env.rows.get(source_id).data_json).permanent_league_id,canonical_id);
  assert.equal(JSON.parse(env.rows.get(source_id).data_json).season_number,2);
  assert.equal(JSON.parse(env.rows.get(canonical_id).data_json).trophy_item_id,'premier-cup');
  assert.equal(env.tables.trophy_items[0].linked_source_id,canonical_id);
  assert.equal(env.rows.get('season-two-fixture').data_json,fixtureJson);
  const catalogue=await require('../../services/regionalEditionService').catalogue(actor);
  assert.equal(catalogue.leagues.length,1);assert.equal(catalogue.leagues[0].id,source_id);
  assert.equal(catalogue.leagues[0].permanent_league_id,canonical_id);
  assert.equal((await review.repair({...body,apply:true,expected_revision:preview.revision,reason:'Retry'},actor)).already_applied,true);
});

test('consolidation blocks identity mismatches and taking a trophy from an unrelated competition',async()=>{
 const env=fixture(),review=require('../../services/regionalEditionReviewService');
 const canonical_id='c2d6e60f-89e0-4813-81a1-967551d8d69f',source_id='46dbb09f-8319-4607-ab97-ec941745bfd8';
 const base={name:'Premier',region_slug:'uk-ireland',division:1,platform:'cross-platform'};
 env.legacy({...base,id:canonical_id,slug:'uk-ireland-div-1',season_number:1,status:'completed'});
 env.legacy({...base,id:source_id,slug:'uk-ireland-div-1-s2',season_number:2,status:'draft',trophy_item_id:'other-cup'});
 env.tables.trophy_items.push({id:'other-cup',linked_source_type:'competition',linked_source_id:'another-event'});
 const body={source_id,canonical_id,mode:'consolidate'},actor={id:'admin'};
 assert.ok((await review.repair(body,actor)).blockers.some(message=>message.includes('another competition')));
 env.rows.get(source_id).platform='Xbox';
 assert.ok((await review.repair(body,actor)).blockers.some(message=>message.includes('Indexed/JSON')));
});

test('North American reset-era identity is superseded only when unused, and financial activity blocks consolidation',async()=>{
 const env=fixture(),review=require('../../services/regionalEditionReviewService');
 const source_id='e582c55b-1e72-45f5-ab63-137c3420404a',canonical_id='e91c6c27-4fd2-45d9-b6ed-6a3591d7b210';
 const base={name:'North American League',region_slug:'north-america',slug:'north-america-div-1',division:1,season_number:1,platform:'Cross-Platform',status:'registration',registered_club_ids:[]};
 env.legacy({...base,id:canonical_id});env.legacy({...base,id:source_id});
 const body={source_id,canonical_id,mode:'consolidate'},actor={id:'admin'};
 env.tables.competition_payouts.push({id:'posted-fixture-payment',source_id,amount:'100.00',status:'paid'});
 const blocked=await review.repair(body,actor);
 assert.ok(blocked.blockers.some(b=>b.includes('provenance')));
 await assert.rejects(review.repair({...body,apply:true,expected_revision:blocked.revision,reason:'Unsafe fixture'},actor),/conflicts/);
 assert.equal(env.tables.competition_payouts[0].amount,'100.00');
 env.tables.competition_payouts.length=0;
 const preview=await review.repair(body,actor);assert.deepEqual(preview.blockers,[]);
 await review.repair({...body,apply:true,expected_revision:preview.revision,reason:'Unused reset-era fixture'},actor);
 const source=JSON.parse(env.rows.get(source_id).data_json);
 assert.equal(source.status,'superseded');assert.equal(source.reset_series,1);assert.equal(source.permanent_league_id,canonical_id);
 const seed=await require('../../services/regionalEditionService').seed([base],actor);
 assert.equal(seed.results[0].record.id,canonical_id);
 assert.equal((await require('../../services/regionalEditionService').catalogue(actor)).leagues.length,1);
});

test('permanent management, catalogue and consolidation routes are exercised over local HTTP', async () => {
  const express = require('express'), env = fixture();
  delete require.cache[require.resolve('../../services/regionalLeagueManagementService')];
  const app = express(); app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: req.headers['x-fixture-user'] || 'admin' }; next(); });
  app.use('/api/stage/regional-leagues', env.router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  async function request(path, body, user = 'admin') {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/stage/regional-leagues${path}`, {
      method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', 'x-fixture-user': user }, ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, data: await response.json() };
  }
  try {
    const creation = { action:'create', definition:{name:'Fixture Division', region_slug:'fixture-region', division:1, platform:'cross-platform', max_clubs:20}, reason:'Isolated management verification' };
    assert.equal((await request('/management', creation, 'ordinary')).status,403);
    assert.equal((await request('/management', {...creation,definition:{...creation.definition,permanent_league_id:'fabricated-parent'}})).status,400);
    const preview = await request('/management', creation);
    assert.equal(preview.status,200); assert.deepEqual(preview.data.blockers,[]);
    const created = await request('/management',{...creation,apply:true,expected_revision:preview.data.revision});
    assert.equal(created.status,200,JSON.stringify(created.data)); assert.equal(created.data.applied,true);
    const league_id = created.data.record.id;
    assert.equal((await request('/catalogue')).data.definitions.length,1);
    const invalidated={action:'retire',league_id,reason:'Preview must reject changed definition'};
    const stale=await request('/management',invalidated);
    env.rows.get(league_id).updated_date='changed-after-review';
    assert.equal((await request('/management',{...invalidated,apply:true,expected_revision:stale.data.revision})).status,409);
    const deletion={action:'delete',league_id,reason:'Remove isolated unused draft'};
    const dp=await request('/management',deletion); assert.deepEqual(dp.data.blockers,[]);
    assert.equal((await request('/management',{...deletion,apply:true,expected_revision:dp.data.revision})).data.applied,true);
    assert.equal((await request('/catalogue')).data.definitions.length,0);
    const base={name:'Premier Division',region_slug:'uk-ireland',division:1,platform:'cross-platform'};
    const canonical_id='c2d6e60f-89e0-4813-81a1-967551d8d69f',source_id='46dbb09f-8319-4607-ab97-ec941745bfd8';
    env.legacy({...base,id:canonical_id,slug:'uk-ireland-div-1',season_number:1,status:'completed'});
    env.legacy({...base,id:source_id,slug:'uk-ireland-div-1-s2',season_number:2,status:'draft'});
    const repair={mode:'consolidate',canonical_id,source_id};
    const rp=await request('/edition-review',repair); assert.deepEqual(rp.data.blockers,[]);
    assert.equal((await request('/edition-review',{...repair,apply:true,expected_revision:rp.data.revision,reason:'Isolated consolidation verification'})).data.applied,true);
    assert.equal((await request('/catalogue')).data.leagues.length,1);
    const retirement={action:'retire',league_id:canonical_id,reason:'Retain historical edition data'};
    const rtp=await request('/management',retirement);assert.deepEqual(rtp.data.blockers,[]);
    assert.equal((await request('/management',{...retirement,apply:true,expected_revision:rtp.data.revision})).data.applied,true);
    assert.equal((await request('/catalogue')).data.leagues[0].retired,true);
    assert.equal(env.rows.has(source_id),true,'retirement preserves the child season');
    const blockedDelete=await request('/management',{action:'delete',league_id:canonical_id,reason:'Must not delete historical parent'});
    assert.ok(blockedDelete.data.blockers.length);
    assert.ok(env.audits.length>=3);
  } finally { await new Promise(resolve=>server.close(resolve)); }
});

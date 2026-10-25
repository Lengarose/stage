const test=require('node:test');
const assert=require('node:assert/strict');
const {setup}=require('./rewardFlowFixture.cjs');
const {regionalRows,validateConfiguration}=require('../../lib/rewardPolicy');
const admin={id:'admin',email:'admin@example.test'};

test('both shared schedules, every position and smaller rosters are exact',()=>{
  for(const division of [1,2,3]) {
    const rows=regionalRows(20,{division});
    assert.deepEqual(rows.map(r=>r.stc_amount),Array.from({length:20},(_,i)=>`${(division===2?33000000:54000000)-i*1700000}.00`));
    assert.equal(validateConfiguration('regional_league',rows,20).budget,division===2?'337000000.00':'757000000.00');
    assert.equal(rows[19].position_label,'20th Place');
  }
  assert.equal(validateConfiguration('regional_league',regionalRows(2,{division:2}),2).budget,'64300000.00');
});
test('Division 2 no-config fallback captures and settles 337 million exactly once',async()=>{
  const env=setup();env.setRoot({division:2});
  const proposed=await env.config.read('regional_league','edition');
  assert.equal(proposed.proposed[0].stc_amount,'33000000.00');
  await env.prizes.capture('regional_league','edition');assert.equal(env.root.prize_pool_stc,'337000000.00');
  env.setRoot({status:'completed'});
  for(let i=0;i<2;i++)assert.equal((await env.prizes.review('regional_league','edition',{apply:true})).state,'paid');
  assert.equal(env.state.ledgers.length,20);
  assert.equal(env.state.clubs[0].stc,'33000000.00');assert.equal(env.state.clubs[19].stc,'700000.00');
});
test('reviewed existing source replacement preserves captured history and is idempotent',async()=>{
  const env=setup();env.setRoot({division:2});
  let current=await env.config.read('regional_league','edition');
  await env.config.save('regional_league','edition',{version:0,revision:current.revision,rows:regionalRows(20),participant_count:20,reason:'Legacy explicit first-division configuration'},admin);
  await env.prizes.capture('regional_league','edition');
  const frozen=structuredClone(env.state.entities.find(e=>e.entity_type==='competition_settlement'));
  const review=await env.config.divisionTwo({},admin);assert.equal(review.sources.length,1);assert.equal(review.sources[0].needs_update,true);assert.equal(review.sources[0].snapshot.requires_review,true);
  const input={apply:true,sources:review.sources,reason:'Reviewed Division 2 defaults'};
  const applied=await env.config.divisionTwo(input,admin);assert.equal(applied.results[0].changed,true);assert.equal(applied.results[0].budget,'337000000.00');
  assert.deepEqual(env.state.entities.find(e=>e.entity_type==='competition_settlement'),frozen);
  assert.equal(env.root.prize_pool_stc,'757000000.00');assert.equal(env.state.ledgers.length,0);
  const rows=env.state.configs.length,audits=env.state.audits.length;
  const repeated=await env.config.divisionTwo(input,admin);assert.equal(repeated.results[0].changed,false);assert.equal(env.state.configs.length,rows);assert.equal(env.state.audits.length,audits);
});
test('review/apply selects only explicit Division 2 and updates unstarted budgets without paying',async()=>{
  const env=setup();env.setRoot({division:'2',status:'draft'});
  for(const division of [1,3])env.state.entities.push(env.entity(`other-${division}`,'regional_league',{division,name:'Division 2',status:'draft',max_clubs:20}));
  let review=await env.config.divisionTwo({},admin);assert.equal(review.sources.length,1);
  const applied=await env.config.divisionTwo({apply:true,sources:review.sources,reason:'Update unstarted source'},admin);
  assert.equal(applied.results[0].changed,true);assert.equal(env.root.prize_pool_stc,'337000000.00');assert.equal(env.state.ledgers.length,0);
  review=await env.config.divisionTwo({},admin);assert.equal(review.sources[0].needs_update,false);
  assert.ok(env.state.audits.some(a=>a.action==='replace_reward_configuration'));
});
test('concurrent edits after review conflict instead of overwriting saved settings',async()=>{
  const env=setup();env.setRoot({division:2});const review=await env.config.divisionTwo({},admin);
  const current=await env.config.read('regional_league','edition');
  await env.config.save('regional_league','edition',{version:0,revision:current.revision,participant_count:20,rows:regionalRows(20),reason:'Another administrator saved'},admin);
  const applied=await env.config.divisionTwo({apply:true,sources:review.sources,reason:'Stale review'},admin);
  assert.equal(applied.results[0].status,409);assert.equal(env.state.configs.length,20);
});
test('already-correct legacy rows still receive a canonical version before snapshot capture',async()=>{
  const env=setup();env.setRoot({division:2,status:'draft'});
  for(const row of regionalRows(20,{division:2}))env.state.configs.push({...row,id:`legacy-${row.position}`,source_type:'regional_league',source_id:'edition',config_version:null});
  const review=await env.config.divisionTwo({},admin);assert.equal(review.sources[0].needs_update,true);
  await env.config.divisionTwo({apply:true,sources:review.sources,reason:'Version the reviewed legacy schedule'},admin);
  const config=await env.config.read('regional_league','edition');assert.equal(config.version,1);assert.equal(config.rows.length,20);
  await env.prizes.capture('regional_league','edition');assert.equal(env.root.prize_pool_stc,'337000000.00');
});

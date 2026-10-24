const test=require('node:test');
const assert=require('node:assert/strict');
const {setup}=require('./rewardFlowFixture.cjs');
const {regionalRows,validateConfiguration}=require('../../lib/rewardPolicy');
const admin={id:'admin',email:'admin@example.test'};
async function configure(env) {
  const type=env.kind==='regional_league'?'regional_league':'competition';
  const config=await env.config.read(type,env.sourceId);
  const rows=type==='regional_league'?regionalRows(env.ids.length):[{component_key:'participation',stc_amount:'10.00'},{component_key:'winner_bonus',stc_amount:'30.00'},{component_key:'runner_up_bonus',stc_amount:'20.00'}];
  return env.config.save(type,env.sourceId,{version:config.version,revision:config.revision,rows,participant_count:env.ids.length,trophy_item_id:'trophy',reason:'Controlled explicit configuration'},admin);
}
test('all regional amounts, labels and smaller budgets are exact; unsupported counts fail',()=>{
  const rows=regionalRows(20);assert.equal(validateConfiguration('regional_league',rows,20).budget,'757000000.00');
  assert.equal(validateConfiguration('regional_league',regionalRows(2),2).budget,'106300000.00');
  assert.throws(()=>regionalRows(33));assert.throws(()=>validateConfiguration('regional_league',[...rows.slice(0,19),rows[0]],20));
});
test('concurrent configuration replacement detects conflicts and transaction failure preserves the old set',async()=>{
  const env=setup();const cfg=await env.config.read('regional_league',env.sourceId);
  const input={version:0,revision:cfg.revision,rows:regionalRows(20),participant_count:20,reason:'Concurrent save test'};
  const results=await Promise.allSettled([env.config.save('regional_league',env.sourceId,input,admin),env.config.save('regional_league',env.sourceId,input,admin)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.status,409);
  assert.equal(env.state.configs.length,20);
  const current=await env.config.read('regional_league',env.sourceId);env.setFailure('INSERT INTO reward_configs',5);
  await assert.rejects(env.config.save('regional_league',env.sourceId,{...input,version:current.version,revision:current.revision},admin),/Injected/);
  assert.equal(env.state.configs.length,20);assert.equal((await env.config.read('regional_league',env.sourceId)).version,1);
});
test('all legacy rows beyond twenty are reviewed; identical duplicates can be cleaned, conflicts require replacement',async()=>{
  const env=setup();for(const r of regionalRows(20))for(let n=0;n<2;n++)env.state.configs.push({...r,id:`${r.position}-${n}`,source_type:'regional_league',source_id:env.sourceId,config_version:null});
  let cfg=await env.config.read('regional_league',env.sourceId);assert.equal(cfg.rows.length,40);assert.equal(cfg.issues.filter(i=>i.startsWith('Identical')).length,20);
  env.state.configs[1].stc_amount='1.00';cfg=await env.config.read('regional_league',env.sourceId);
  await assert.rejects(env.config.cleanup('regional_league',env.sourceId,{revision:cfg.revision,reason:'Explicit review'},admin),/Conflicting/);assert.equal(env.state.configs.length,40);
  env.state.configs[1].stc_amount=env.state.configs[0].stc_amount;cfg=await env.config.read('regional_league',env.sourceId);
  cfg=await env.config.cleanup('regional_league',env.sourceId,{revision:cfg.revision,reason:'Collapse only identical evidence'},admin);assert.equal(cfg.rows.length,20);
});
for(const kind of ['regional_league','competition_season'])test(`${kind}: capture, complete, club settlement, verified trophy, archive and retry are idempotent`,async()=>{
  const env=setup(kind,kind==='regional_league'?20:36);await configure(env);
  await env.prizes.capture(kind,'edition');
  assert.equal(env.root.prize_pool_stc,kind==='regional_league'?'757000000.00':'410.00');
  env.setRoot({status:'completed'});
  let report=await env.prizes.review(kind,'edition',{apply:false});assert.deepEqual(report.blocking_reasons,[]);assert.ok(report.obligations.every(o=>!o.blocking_reasons.length),JSON.stringify(report));
  report=await env.prizes.review(kind,'edition',{apply:true});assert.equal(report.state,'paid');assert.equal(report.trophy_state,'awarded',report.trophy_error);
  assert.equal(env.state.awards.filter(a=>a.owner_type==='club').length,1);assert.equal(env.state.awards[0].owner_id,'club-1');
  if(kind==='regional_league'){assert.equal(env.state.ledgers.length,20);assert.equal(env.state.clubs[0].stc,'54000000.00');assert.equal(env.state.clubs[19].stc,'21700000.00');}
  else {assert.equal(env.state.ledgers.length,38);assert.equal(env.state.clubs[0].stc,'40.00');assert.equal(env.state.clubs[1].stc,'30.00');assert.equal(env.state.clubs[2].stc,'10.00');assert.equal(new Set(env.state.payouts.map(p=>p.idempotency_key)).size,38);}
  const count=env.state.ledgers.length;
  await env.prizes.archive(kind,'edition',{admin,reason:'Verified settled archival'});assert.equal(env.root.status,'archived');
  await Promise.all([env.prizes.review(kind,'edition',{apply:true}),env.prizes.review(kind,'edition',{apply:true})]);
  assert.equal(env.state.ledgers.length,count);assert.equal(env.state.awards.length,1);
  await assert.rejects(env.prizes.adoptConfiguration(kind,'edition',{apply:true,admin,reason:'Cannot rewrite paid history',version:1}),/Payment evidence|obligations/);
});
test('failed financial transaction is visible, preserves balances and trophy evidence, then recovers once',async()=>{
  const env=setup();await configure(env);await env.prizes.capture('regional_league','edition');env.setRoot({status:'completed'});env.setFailure('INSERT INTO stc_transactions');
  await assert.rejects(env.prizes.review('regional_league','edition',{apply:true}),/Injected/);assert.ok(env.state.clubs.every(c=>c.stc==='0.00'));assert.equal(env.state.awards.length,0);
  assert.ok(env.state.entities.some(e=>e.entity_type==='competition_settlement'&&e.status==='failed'));
  env.setFailure(null);const result=await env.prizes.review('regional_league','edition',{apply:true});assert.equal(result.state,'paid');assert.equal(env.state.ledgers.length,20);
});
test('an unpaid archived edition requires an explicit new promise; archival alone cannot establish completion',async()=>{
  const env=setup();await configure(env);env.setRoot({status:'archived'});
  let report=await env.prizes.review('regional_league','edition');assert.equal(report.state,'blocked');assert.equal(report.configuration,undefined);
  const preview=await env.prizes.adoptConfiguration('regional_league','edition',{admin,reason:'Compare original unknown promise to reviewed new schedule',version:1});assert.equal(preview.proposed.budget,'757000000.00');assert.equal(env.state.ledgers.length,0);
  await env.prizes.adoptConfiguration('regional_league','edition',{apply:true,admin,reason:'Explicitly authorize the new schedule for this unpaid edition',version:1});
  const fixture=env.state.entities.find(r=>r.entity_type==='regional_league_fixture');fixture.status='scheduled';
  report=await env.prizes.review('regional_league','edition',{apply:true});assert.equal(report.state,'blocked');assert.equal(env.state.ledgers.length,0);
  fixture.status='played';report=await env.prizes.review('regional_league','edition',{apply:true});assert.equal(report.state,'paid');assert.equal(env.root.original_prize_pool_stc,'1.00');
});
test('GOST settings stay independent, edition snapshots do not follow later edits, and recipient corrections block payment',async()=>{
  const env=setup('competition_season',36);await configure(env);await env.prizes.capture(env.kind,'edition');
  env.state.entities.push(env.entity('elite','competition',{name:'Elite',max_clubs:36}));
  const elite=await env.config.read('competition','elite');await env.config.save('competition','elite',{version:0,revision:elite.revision,participant_count:36,rows:[{component_key:'participation',stc_amount:'2.00'},{component_key:'winner_bonus',stc_amount:'3.00'},{component_key:'runner_up_bonus',stc_amount:'1.00'}],reason:'Independent controlled amounts'},admin);
  const original=await env.config.read('competition','gost');await env.config.save('competition','gost',{version:original.version,revision:original.revision,participant_count:36,rows:original.rows.map(r=>({...r,stc_amount:'99.00'})),reason:'New template, not a historical promise'},admin);
  env.setRoot({status:'completed'});let report=await env.prizes.review(env.kind,'edition',{apply:true});assert.equal(report.state,'paid');assert.equal(report.budget,'410.00');
  assert.equal((await env.config.read('competition','elite')).settings.budget,'76.00');
  const final=env.state.entities.find(r=>r.phase==='knockout_final');Object.assign(final,{home_score:0,away_score:2});final.data_json=JSON.stringify({...JSON.parse(final.data_json),home_score:0,away_score:2});
  const before=env.state.ledgers.length;report=await env.prizes.review(env.kind,'edition',{apply:true});assert.equal(report.state,'blocked');assert.equal(env.state.ledgers.length,before);
});

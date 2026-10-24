const test=require('node:test');
const assert=require('node:assert/strict');
const express=require('express');
const path=require('node:path');
const {setup}=require('../../services/__tests__/rewardFlowFixture.cjs');
const {regionalRows}=require('../../lib/rewardPolicy');
test('reward configuration, snapshots, settlement/archive and entitlement-protected cabinet APIs',async()=>{
  const env=setup();
  const app=express();app.use(express.json());app.use((req,res,next)=>{req.user={id:req.headers.authorization?.replace('Bearer ','')||'intruder'};next();});
  for(const [url,file]of [['/config','rewardConfigController'],['/views','competitionViewsController'],['/cabinet','trophyPlacementController'],['/awards','trophyAwardController']]){delete require.cache[path.resolve(__dirname,`../${file}.js`)];app.use(url,require(`../${file}`));}
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  const base=`http://127.0.0.1:${server.address().port}`;
  async function request(url,method='GET',body,actor='admin') {const res=await fetch(base+url,{method,headers:{Authorization:`Bearer ${actor}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:res.status,data:await res.json()};}
  const root='/config/source/regional_league/edition',edition='/views/regional_league/edition/reconcile';
  try {
    let r=await request(root,'GET',null,'intruder');assert.equal(r.status,403);
    r=await request(root);assert.equal(r.status,200);const cfg=r.data;
    const input={version:cfg.version,revision:cfg.revision,participant_count:20,rows:regionalRows(20),trophy_item_id:'trophy',reason:'Local verified configuration'};
    r=await request(root+'/replace','POST',input);assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.rows.length,20);
    r=await request(root+'/replace','POST',input);assert.equal(r.status,409);
    r=await request(root+'/cleanup','POST',{revision:(await request(root)).data.revision,reason:'Idempotent reviewed cleanup'});assert.equal(r.status,200);
    r=await request('/config','POST',{source_type:'regional_league'});assert.equal(r.status,409);
    r=await request(edition,'POST',{action:'capture_rewards',reason:'Begin edition'});assert.equal(r.status,200);
    env.setRoot({status:'completed'});
    r=await request(edition,'POST',{action:'adopt_reward_configuration',version:1,reason:'Read-only historical comparison'});assert.equal(r.status,200);assert.equal(r.data.dry_run,true);assert.equal(env.state.ledgers.length,0);
    r=await request(edition,'POST',{});assert.equal(r.status,200);assert.equal(r.data.obligations.length,20);
    r=await request(edition,'POST',{apply:true,reason:'Pay verified unpaid amounts'});assert.equal(r.status,200);assert.equal(r.data.state,'paid');assert.equal(env.state.ledgers.length,20);
    r=await request(edition,'POST',{action:'archive',reason:'Archive verified settled season'});assert.equal(r.status,200);assert.equal(env.root.status,'archived');
    r=await request('/cabinet/entitlements?owner_id=club-1&owner_type=club');assert.equal(r.status,200);assert.equal(r.data.awards.length,1);
    r=await request('/cabinet/entitlements?owner_id=club-2&owner_type=club');assert.equal(r.data.awards.length,0);
    let placement=env.state.placements[0];assert.ok(placement);
    r=await request(`/cabinet/${placement.id}`,'PATCH',{x_percent:20},'intruder');assert.equal(r.status,403);
    r=await request(`/cabinet/${placement.id}`,'PATCH',{win_count:900},'user-club-1');assert.equal(r.status,403);
    r=await request(`/cabinet/${placement.id}`,'PATCH',{trophy_item_id:'wrong'},'user-club-1');assert.equal(r.status,403);
    r=await request(`/cabinet/${placement.id}`,'PATCH',{x_percent:20},'user-club-1');assert.equal(r.status,200);
    r=await request(`/cabinet/${placement.id}`,'DELETE',null,'user-club-1');assert.equal(r.status,200);assert.equal(env.state.awards.length,1);
    r=await request('/cabinet','POST',{owner_id:'club-1',owner_type:'club',trophy_item_id:'trophy',win_count:2},'user-club-1');assert.equal(r.status,403);
    r=await request('/cabinet','POST',{owner_id:'club-2',owner_type:'club',trophy_item_id:'trophy'},'user-club-2');assert.equal(r.status,403);
    r=await request('/cabinet','POST',{owner_id:'club-1',owner_type:'club',trophy_item_id:'trophy',x_percent:35,y_percent:45},'user-club-1');assert.equal(r.status,201,JSON.stringify(r.data));assert.equal(r.data.win_count,1);assert.equal(env.state.awards.length,1);
    r=await request('/cabinet/review/club/club-1','POST',{});assert.equal(r.status,200);
    r=await request('/cabinet/review/club/club-1','POST',{apply:true,action:'materialize',reason:'Verify historical provenance'});assert.equal(r.status,200);assert.equal(env.state.awards.length,1);
    r=await request('/awards?owner_id=club-1&owner_type=club');assert.equal(r.status,200);assert.equal(r.data.length,1);
    r=await request(`/awards/${env.state.awards[0].id}`);assert.equal(r.status,200);
    for(const method of ['POST','PATCH','DELETE']){r=await request(method==='POST'?'/awards':`/awards/${env.state.awards[0].id}`,method,{owner_id:'club-2'});assert.equal(r.status,403);}
    env.state.awards.push({...env.state.awards[0],id:'wrong-award',owner_id:'club-2',winning_club_id:'club-2'});
    r=await request('/cabinet/review/club/club-2','POST',{});assert.ok(r.data.discrepancies.some(d=>d.award_id==='wrong-award'));
    r=await request('/cabinet/review/club/club-2','POST',{apply:true,action:'revoke',award_id:'wrong-award',reason:'Proven nonwinner mismatch'});assert.equal(r.status,200);assert.equal(env.state.awards.find(a=>a.id==='wrong-award').status,'revoked');assert.equal(env.state.awards.find(a=>a.owner_id==='club-1').status,'earned');
    assert.ok(env.state.audits.length>0);assert.equal(env.state.ledgers.length,20);
  } finally {await new Promise(resolve=>server.close(resolve));}
});
test('GOST HTTP configuration and settlement keep participation separate from finalist bonuses',async()=>{
  const env=setup('competition_season',36),app=express();
  app.use(express.json());app.use((req,res,next)=>{req.user={id:'admin'};next();});
  for(const [url,file]of [['/config','rewardConfigController'],['/views','competitionViewsController']]){delete require.cache[path.resolve(__dirname,`../${file}.js`)];app.use(url,require(`../${file}`));}
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  async function request(url,body){const response=await fetch(`http://127.0.0.1:${server.address().port}`+url,{method:body?'POST':'GET',headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,data:await response.json()};}
  try {
    const cfg=(await request('/config/source/competition/gost')).data;
    const rows=[{component_key:'participation',stc_amount:'10.00'},{component_key:'winner_bonus',stc_amount:'30.00'},{component_key:'runner_up_bonus',stc_amount:'20.00'}];
    const input={version:cfg.version,revision:cfg.revision,participant_count:36,rows,trophy_item_id:'trophy',reason:'Synthetic local GOST settings'};
    let response=await request('/config/source/competition/gost/replace',{...input,rows:rows.map(r=>({...r,stc_amount:''}))});assert.equal(response.status,400);
    response=await request('/config/source/competition/gost/replace',input);assert.equal(response.status,200);assert.equal(response.data.settings.budget,'410.00');
    response=await request('/views/competition_season/edition/reconcile',{action:'capture_rewards',reason:'Capture local edition'});assert.equal(response.status,200);
    env.setRoot({status:'completed'});
    response=await request('/views/competition_season/edition/reconcile',{apply:true,reason:'Local verified settlement'});assert.equal(response.status,200);assert.equal(response.data.state,'paid');assert.equal(env.state.ledgers.length,38);
    assert.equal(env.state.clubs[0].stc,'40.00');assert.equal(env.state.clubs[1].stc,'30.00');
    response=await request('/views/competition_season/edition/reconcile',{action:'archive',reason:'Local settled archival'});assert.equal(response.status,200);
    response=await request('/views/competition_season/edition/reconcile',{apply:true,reason:'Local idempotent retry'});assert.equal(response.data.state,'paid');assert.equal(env.state.ledgers.length,38);
  }finally{await new Promise(resolve=>server.close(resolve));}
});

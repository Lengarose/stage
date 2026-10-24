const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const express=require('express');
const {setup}=require('../../services/__tests__/prizeFixture.cjs');
for (const kind of ['regional_league','competition_season']) test(`${kind} views, paginated stats and audited prize repair respond over local HTTP using isolated ledgers`,async()=>{
  const env=setup(false,kind);
  async function query(sql,v=[]) {
    if(/FROM users/.test(sql)) return [{id:v[0],email:`${v[0]}@example.test`,role_id:v[0]==='admin' ? 0:1}];
    if(/FROM match_player_stats/.test(sql)) return [
      {id:'played',match_id:'one',player_id:'p1',club_id:'a',player_gamertag:'Historical Keeper',participation_verified:1,position:'GK',goalkeeper_full_match:1,rating:null,goals:0,assists:0},
      {id:'unused',match_id:'one',player_id:'p2',club_id:'a',participation_verified:0,position:'GK',goalkeeper_full_match:0,goals:0,assists:0},
    ];
    return env.query(sql,v);
  }
  const db=path.resolve(__dirname,'../../db/database.js');
  require.cache[db].exports.EXECUTESQL=query;
  delete require.cache[path.resolve(__dirname,'../../models/competitionScopeModel.js')];
  delete require.cache[path.resolve(__dirname,'../competitionViewsController.js')];
  const app=express();app.use(express.json());app.use('/api/stage/competition-views',(req,res,next)=>{req.user={id:req.headers.authorization==='Bearer admin-token' ? 'admin':'member'};next();},require('../competitionViewsController'));
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  const base=`http://127.0.0.1:${server.address().port}/api/stage/competition-views/${kind}/cup`;
  try {
    let response=await fetch(base);assert.equal(response.status,200);const view=await response.json();assert.equal(view.matches.length,2);assert.equal(view.edition_id,kind === 'regional_league' ? 'cup:1':'cup');assert.equal(view.root.email,undefined);assert(view.participants.every(p=>p.email===undefined && p.stc===undefined));assert.equal(env.state.ledgers.length,0);
    response=await fetch(`${base}/statistics`);assert.equal(response.status,200);const stats=await response.json();assert.equal(stats.participants.goals[0].goals,3);assert.equal(stats.players.appearances.length,1);assert.equal(stats.players.appearances[0].appearances,1);assert.equal(stats.players.rating[0].rated_matches,0);assert.equal(stats.players.rating[0].average_rating,null);assert.equal(stats.goalkeepers.clean_sheets[0].club_id,'a');assert.equal(stats.goalkeepers.clean_sheets[0].clean_sheets,1);
    response=await fetch(`${base}/statistics?group=participants&category=goals&limit=1&offset=1`);const page=await response.json();assert.equal(response.status,200);assert.equal(page.total,2);assert.equal(page.rows.length,1);
    response=await fetch(`${base}/statistics?group=players&category=invalid`);assert.equal(response.status,400);
    const post=(body,admin=true)=>fetch(`${base}/reconcile`,{method:'POST',headers:{'Content-Type':'application/json',...(admin ? {Authorization:'Bearer admin-token'}:{})},body:JSON.stringify(body)});
    response=await post({},false);assert.equal(response.status,403);
    response=await post({});assert.equal(response.status,200);assert.equal((await response.json()).dry_run,true);assert.equal(env.state.ledgers.length,0);
    response=await post({apply:true});assert.equal(response.status,400);
    response=await post({apply:true,reason:'Controlled local payout verification'});assert.equal(response.status,200);assert.equal((await response.json()).state,'paid');assert.equal(env.state.ledgers.length,2);assert.equal(env.state.audits.length,1);
    response=await post({apply:true,reason:'Repeat idempotency check'});assert.equal(response.status,200);assert.equal(env.state.ledgers.length,2);
  } finally {await new Promise(resolve=>server.close(resolve));}
});

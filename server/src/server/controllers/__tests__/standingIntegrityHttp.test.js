const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const express = require('express');

for (const kind of ['regional_league','competition_season']) test(`${kind}: review and protected audited repair over isolated local HTTP`, async () => {
  const type = kind === 'regional_league' ? 'regional_league_standing' : 'competition_standing';
  const fixtureType = kind === 'regional_league' ? 'regional_league_fixture' : 'competition_fixture';
  const column = kind === 'regional_league' ? 'league_id' : 'season_id';
  const root = { id:'edition',status:'in_progress',registered_club_ids:['a','b','c'] };
  const entry = (id,club_id) => ({ id,entity_type:type,[column]:'edition',club_id,status:'active',data_json:JSON.stringify({ club_id,club_name:club_id,played:0,points:0,goals_for:0,goals_against:0,goal_difference:0 }) });
  let rows = [entry('first','a'),entry('duplicate','a')];
  const audits = [];
  const match = { id:'match',type:'league',status:'completed',result_state:'CONFIRMED',home_club_id:'a',away_club_id:'b',home_score:2,away_score:1,source_fixture_id:'fixture' };
  async function query(sql,v=[]) {
    if (/FROM users/.test(sql)) return [{id:v[0],email:'admin@example.test',role_id:v[0] === 'admin' ? 0 : 1}];
    if (/FROM competition_payouts/.test(sql)) return [];
    if (/^SELECT.*FROM league_entities WHERE id=/.test(sql)) return [{id:'edition',entity_type:kind,data_json:JSON.stringify(root)}];
    if (/FROM league_entities WHERE entity_type=/.test(sql)) {
      if (v[0] === type) return structuredClone(rows);
      if (v[0] === fixtureType) return [{id:'fixture',entity_type:fixtureType,[column]:'edition',data_json:JSON.stringify({ ...match,id:'fixture',match_id:'match',phase:'league',stats_processed:1 })}];
    }
    if (/FROM matches/.test(sql)) return [match];
    if (/FROM clubs/.test(sql)) return ['a','b','c'].map(id=>({id,name:id}));
    if (/INSERT INTO league_entities/.test(sql)) {
      const row = {id:v[0],entity_type:v[1],data_json:v[2],status:'active',[column]:v[3],club_id:v[4]};
      const i = rows.findIndex(r=>r.id===row.id); if(i<0) rows.push(row); else rows[i]=row;
      return {affectedRows:1};
    }
    if (/DELETE FROM league_entities/.test(sql)) { rows=rows.filter(r=>r.id!==v[0]);return {affectedRows:1}; }
    if (/INSERT INTO admin_audit_log/.test(sql)) { audits.push(v);return {affectedRows:1}; }
    throw new Error(`Unhandled SQL ${sql}`);
  }
  let queue=Promise.resolve();
  const withTransaction=fn=>{const result=queue.then(()=>fn(query));queue=result.catch(()=>{});return result;};
  const db=path.resolve(__dirname,'../../db/database.js');
  require.cache[db]={id:db,filename:db,loaded:true,exports:{EXECUTESQL:query,withTransaction}};
  for(const p of ['../../models/competitionScopeModel.js','../../services/competitionPrizeService.js','../../services/standingIntegrityService.js','../competitionViewsController.js']) delete require.cache[path.resolve(__dirname,p)];
  const app=express();app.use(express.json());app.use((req,res,next)=>{req.user={id:req.headers.authorization==='Bearer admin' ? 'admin':'member'};next();});app.use('/views',require('../competitionViewsController'));
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  const url=`http://127.0.0.1:${server.address().port}/views/${kind}/edition`;
  const post=(body,admin=true)=>fetch(`${url}/reconcile`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:admin?'Bearer admin':'Bearer member'},body:JSON.stringify(body)});
  try {
    let res=await fetch(`${url}?review=standings`);assert.equal(res.status,200);let report=await res.json();assert.deepEqual(report.missing,['b','c']);assert.deepEqual(report.duplicates,['a']);assert.equal(audits.length,0);
    res=await post({action:'standings'});assert.equal(res.status,200);assert.equal((await res.json()).dry_run,true);assert.equal(rows.length,2);
    res=await post({action:'standings',apply:true,reason:'test'},false);assert.equal(res.status,403);
    res=await post({action:'standings',apply:true});assert.equal(res.status,400);
    res=await post({action:'standings',apply:true,reason:'Local integrity test'});report=await res.json();assert.equal(res.status,200,JSON.stringify(report));assert.equal(report.changed,true);assert.equal(rows.length,3);assert.equal(audits.length,1);
    res=await post({action:'standings',apply:true,reason:'Idempotency test'});assert.equal(res.status,200);assert.equal((await res.json()).changed,false);assert.equal(audits.length,1);
    res=await fetch(`${url}?review=standings`);report=await res.json();assert.equal(report.requires_review,false);assert.equal(report.expected.find(r=>r.club_id==='a').points,3);
    root.status='completed';res=await post({action:'standings',apply:true,reason:'Cannot change completed history'});assert.equal(res.status,409);
  } finally { await new Promise(resolve=>server.close(resolve)); }
});

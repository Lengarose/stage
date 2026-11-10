'use strict';
const crypto=require('crypto');
const {buildCatalogue}=require('../lib/regionalLeagueHierarchy');
const {identity,fail}=require('../lib/regionalEditionIdentity');
const {policy}=require('../lib/regionalCupPlan');
const hash=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const stableId=v=>{const h=hash(v);return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`;};
// The trophy picker can name a Cup before its first edition is prepared.
function trophySources(editions, records) {
  const catalogue=buildCatalogue(editions), sources=new Map();
  for(const root of catalogue.definitions) {
    if(Number(root.division)!==1 || root.retired || root.retired_at || catalogue.groups.some(g=>g.permanent_league_id===root.id && (g.identity_conflict || g.identity_unverified)))continue;
    const scope=identity(root),name=policy.names[scope.region_slug];
    if(!name)continue;
    const id=stableId(['regional_cup',scope.region_slug,scope.platform]);
    sources.set(id,{id,name,region_slug:scope.region_slug,platform:scope.platform,status:'draft',policy_version:policy.version});
  }
  for(const row of records.filter(r=>r.entity_type==='regional_cup'))sources.set(row.id,row);
  return [...sources.values()].sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
}
// Caller holds the regional write lock and transaction; only a valid regional
// system may materialize a permanent Cup. No edition or fixtures are created.
async function ensureTrophySource(id,model,query,user) {
  const records=await model.records(query), existing=records.find(r=>r.entity_type==='regional_cup' && r.id===id);
  if(existing)return existing;
  const source=trophySources(await model.editions(query),records).find(r=>r.id===id);
  if(!source)fail('Regional Cup not found.',404);
  await model.create('regional_cup',source,user,'Trophy Library: configure the approved permanent Regional Cup',query);
  return source;
}
module.exports={trophySources,ensureTrophySource,stableId};

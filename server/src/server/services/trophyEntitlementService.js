'use strict';
const {EXECUTESQL,withTransaction}=require('../db/database');
const {CompetitionScopeModel}=require('../models/competitionScopeModel');
const Award=require('../models/trophyAwardModel');
const {placements,parse}=require('../lib/competitionPrizes');
const model=new Award();
const fail=(message,status=403)=>Object.assign(new Error(message),{status});
async function outcome(kind,id,query=EXECUTESQL) {
  const scope=await new CompetitionScopeModel().selectOne(kind,id,query);
  const placed=placements(scope,[{position:1,amount:'0.00'},{position:2,amount:'0.00'}]);
  if(placed.blocked || !placed.map.get(1))throw fail(placed.blocked||'Official winner is unresolved',409);
  return {scope,winner:String(placed.map.get(1))};
}
async function verifiedDesign(kind,id,trophyId,query=EXECUTESQL) {
  const {scope,winner}=await outcome(kind,id,query);
  let configured=scope.root.trophy_item_id;
  if(kind!=='tournament') {
    const settlementId=require('./competitionPrizeService').uuid(`prize-settlement:${kind}:${scope.edition_id}`);
    const [saved]=await query("SELECT * FROM league_entities WHERE id=? AND entity_type='competition_settlement'",[settlementId]);
    configured=parse(saved?.data_json,{}).config?.trophy_item_id||configured;
  }
  const sourceType=kind==='competition_season'?'competition':kind;
  const sourceId=kind==='competition_season'?scope.root.competition_id:id;
  if(!configured) {
    const items=await query('SELECT * FROM trophy_items WHERE linked_source_type=? AND linked_source_id=?',[sourceType,sourceId]);
    if(items.length===1)configured=items[0].id;
  }
  if(!configured || trophyId && String(trophyId)!==String(configured))throw fail('Exact event trophy design is unavailable or contradictory',409);
  const [item]=await query('SELECT * FROM trophy_items WHERE id = ? LIMIT 1',[configured]);
  if(!item || item.tournament_id && String(item.tournament_id)!==String(id)
    || item.linked_source_id && (String(item.linked_source_id)!==String(sourceId)||item.linked_source_type!==sourceType))throw fail('Trophy explicitly belongs to a different competition',409);
  return {scope,winner,item,source_type:kind,source_id:id,edition_id:scope.edition_id};
}
async function assertCabinetOwner(userId,ownerId,ownerType,query=EXECUTESQL) {
  if(!['club','player'].includes(ownerType)||!ownerId)throw fail('Valid cabinet identity required',400);
  const [u]=await query('SELECT id,email,role_id FROM users WHERE id=?',[userId]);
  if(!u)throw fail('Authentication required',401);
  const [owner]=await query(`SELECT * FROM ${ownerType==='club'?'clubs':'players'} WHERE id=?`,[ownerId]);
  if(!owner)throw fail('Cabinet owner not found',404);
  if([0,2].includes(Number(u.role_id)))return u;
  if(String(owner.user_id||'')===String(u.id)||String(owner.president_user_id||'')===String(u.id)||(u.email&&String(owner[ownerType==='club'?'owner_email':'email']||'').toLowerCase()===String(u.email).toLowerCase()))return u;
  throw fail('You cannot edit this cabinet');
}
async function review(ownerId,ownerType,query=EXECUTESQL) {
  if(!['club','player'].includes(ownerType)||!ownerId)throw fail('Valid cabinet identity required',400);
  const stored=await model.selectAll({owner_id:ownerId,owner_type:ownerType,status:'earned'},query);
  const tournaments=await query(`SELECT id FROM tournaments WHERE ${ownerType==='club'?'winner_club_id':'winner_player_id'}=? AND status IN ('completed','archived')`,[ownerId]);
  const editions=ownerType==='club'?await query("SELECT * FROM league_entities WHERE entity_type IN ('regional_league','competition_season') AND status IN ('completed','archived') AND JSON_UNQUOTE(JSON_EXTRACT(data_json,'$.winner_club_id'))=?",[ownerId]):[];
  const candidates=[...stored.map(a=>({kind:a.source_type,id:a.source_id,award:a})),...tournaments.map(t=>({kind:'tournament',id:t.id})),...editions.map(e=>({kind:e.entity_type,id:e.id}))];
  const verified=new Map(),discrepancies=[];
  for(const c of candidates)try {
    const proof=await verifiedDesign(c.kind,c.id,c.award?.trophy_item_id,query);
    const recipient=c.award?.winning_club_id||ownerId;
    if(proof.winner!==String(recipient))throw fail('Stored entitlement does not match the authoritative winner',409);
    if(ownerType==='club'&&proof.winner!==String(ownerId))throw fail('Club is not the event winner',409);
    const eventKey=[c.kind,c.id,proof.edition_id,proof.item.id].join(':');
    verified.set(eventKey,{id:c.award?.id||null,owner_id:ownerId,owner_type:ownerType,trophy_item_id:proof.item.id,source_type:c.kind,source_id:c.id,competition_id:proof.scope.root.competition_id||null,edition_id:proof.edition_id,winning_club_id:ownerType==='club'||c.award?.winning_club_id?proof.winner:null,name:proof.scope.root.name||proof.scope.root.competition_name,verified:true,persisted:!!c.award});
  }catch(e){discrepancies.push({source_type:c.kind,source_id:c.id,award_id:c.award?.id||null,reason:e.message});}
  const placementsRows=await query('SELECT * FROM trophy_placements WHERE owner_id=? AND owner_type=?',[ownerId,ownerType]);
  for(const p of placementsRows)if(![...verified.values()].some(a=>a.trophy_item_id===p.trophy_item_id))discrepancies.push({placement_id:p.id,trophy_item_id:p.trophy_item_id,reason:'Visual placement has no verified championship entitlement'});
  return {owner_id:ownerId,owner_type:ownerType,awards:[...verified.values()],discrepancies,placements:placementsRows};
}
async function repair(ownerId,ownerType,input,admin) {
  if(!['club','player'].includes(ownerType))throw fail('Invalid cabinet owner type',400);
  if(!admin?.id || !String(input.reason||'').trim())throw fail('Admin reason required');
  return withTransaction(async query=>{
    await query(`SELECT id FROM ${ownerType==='club'?'clubs':'players'} WHERE id=? FOR UPDATE`,[ownerId]);
    const before=await review(ownerId,ownerType,query);
    if(input.action==='materialize')for(const award of before.awards)await model.create(award,query);
    else if(input.action==='revoke') {
      const discrepancy=before.discrepancies.find(d=>d.award_id===input.award_id);
      if(!discrepancy)throw fail('Only a proven discrepant entitlement may be revoked',409);
      await model.update(input.award_id,{status:'revoked',revoked_reason:input.reason},query);
    }else if(input.action==='remove_invalid_placement') {
      if(!before.discrepancies.some(d=>d.placement_id===input.placement_id))throw fail('Placement is not proven invalid',409);
      await query('DELETE FROM trophy_placements WHERE id=?',[input.placement_id]);
    }else throw fail('Unknown trophy review action',400);
    const after=await review(ownerId,ownerType,query);
    await require('./rewardConfigurationService').audit(query,admin,'repair_trophy_entitlement',ownerType,ownerId,before,after,input.reason);
    return after;
  });
}
module.exports={outcome,verifiedDesign,assertCabinetOwner,review,repair};

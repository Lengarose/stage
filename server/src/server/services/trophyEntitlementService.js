'use strict';
const {EXECUTESQL,withTransaction}=require('../db/database');
const {CompetitionScopeModel}=require('../models/competitionScopeModel');
const Award=require('../models/trophyAwardModel');
const {placements,parse}=require('../lib/competitionPrizes');
const model=new Award();
const history=require('../lib/trophyHistory');
const fail=(message,status=403)=>Object.assign(new Error(message),{status});
async function outcome(kind,id,query=EXECUTESQL) {
  const scope=await new CompetitionScopeModel().selectOne(kind,id,query);
  const placed=placements(scope,[{position:1,amount:'0.00'},{position:2,amount:'0.00'}]);
  if(placed.blocked || !placed.map.get(1))throw fail(placed.blocked||'Official winner is unresolved',409);
  return {scope,winner:String(placed.map.get(1)),runner_up:placed.map.get(2)||null};
}
async function verifiedDesign(kind,id,trophyId,query=EXECUTESQL) {
  const {scope,winner,runner_up}=await outcome(kind,id,query);
  let configured=scope.root.trophy_item_id;
  let capturedDesign=null;
  if(kind!=='tournament') {
    const settlementId=require('./competitionPrizeService').uuid(`prize-settlement:${kind}:${scope.edition_id}`);
    const [saved]=await query("SELECT * FROM league_entities WHERE id=? AND entity_type='competition_settlement'",[settlementId]);
    const config=parse(saved?.data_json,{}).config;
    configured=config?.trophy_item_id||configured;
    capturedDesign=config?.trophy_snapshot;
  }
  const sourceType=kind==='competition_season'?'competition':kind;
  const sourceId=kind==='competition_season'?scope.root.competition_id:id;
  if(!configured) {
    const items=await query('SELECT * FROM trophy_items WHERE linked_source_type=? AND linked_source_id=?',[sourceType,sourceId]);
    if(items.length===1)configured=items[0].id;
  }
  if(!configured)throw fail('Exact event trophy design is unavailable',409);
  if(trophyId&&String(trophyId)!==String(configured))throw fail('Stored trophy contradicts the configured event design',409);
  const [item]=await query('SELECT * FROM trophy_items WHERE id = ? LIMIT 1',[configured]);
  if(!item)throw fail('Historical trophy design record is unavailable',409);
  if(item.tournament_id && String(item.tournament_id)!==String(id)
    || item.linked_source_id && (String(item.linked_source_id)!==String(sourceId)||item.linked_source_type!==sourceType))throw fail('Trophy explicitly belongs to a different competition',409);
  const historicalItem=capturedDesign?.id===configured?{...item,name:capturedDesign.name,image_url:capturedDesign.image_url}:item;
  return {scope,winner,runner_up,item:historicalItem,source_type:kind,source_id:id,edition_id:scope.edition_id};
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
  const allStored=await model.selectAll({owner_id:ownerId,owner_type:ownerType},query);
  const stored=allStored.filter(a=>a.status==='earned');
  const tournaments=await query(`SELECT id FROM tournaments WHERE ${ownerType==='club'?'winner_club_id':'winner_player_id'}=? AND status IN ('completed','archived')`,[ownerId]);
  const editions=ownerType==='club'?await query("SELECT * FROM league_entities WHERE entity_type IN ('regional_league','competition_season') AND status IN ('completed','archived') AND JSON_UNQUOTE(JSON_EXTRACT(data_json,'$.winner_club_id'))=?",[ownerId]):[];
  const revoked=new Set(allStored.filter(a=>a.status==='revoked'&&(a.award_key||String(a.revoked_reason||'').startsWith('[history-reset]'))).map(a=>`${a.source_type}:${a.source_id}:${a.edition_id}`));
  const permanent=stored.filter(history.durable);
  const candidates=[...stored.filter(a=>!history.durable(a)).map(a=>({kind:a.source_type,id:a.source_id,award:a})),...tournaments.map(t=>({kind:'tournament',id:t.id})),...editions.map(e=>({kind:e.entity_type,id:e.id}))];
  const verified=new Map(),discrepancies=[];
  for(const award of permanent) {
    const details=history.parse(award.metadata_json);
    verified.set(`${award.source_type}:${award.source_id}:${award.edition_id}:${award.trophy_item_id}`,{...award,...details,name:details.display_name,verified:true,persisted:true});
    if(details.associated_history_unavailable)discrepancies.push({award_id:award.id,reason:'Historical winning-club roster is unavailable; no player honours were guessed from current membership',can_revoke:false});
  }
  for(const c of candidates)try {
    if(permanent.some(a=>a.source_type===c.kind&&a.source_id===c.id))continue;
    let proof;
    try{proof=await verifiedDesign(c.kind,c.id,c.award?.trophy_item_id,query);}
    catch(error){if(c.award?.trophy_item_id)throw error;const result=await outcome(c.kind,c.id,query);proof={...result,item:null,source_type:c.kind,source_id:c.id,edition_id:result.scope.edition_id};}
    const recipient=c.award?.winning_club_id||ownerId;
    if(proof.winner!==String(recipient))throw fail('Stored entitlement does not match the authoritative winner',409);
    if(ownerType==='club'&&proof.winner!==String(ownerId))throw fail('Club is not the event winner',409);
    const eventKey=[c.kind,c.id,proof.edition_id,proof.item?.id||'no-design'].join(':');
    if(revoked.has(`${c.kind}:${c.id}:${proof.edition_id}`))continue;
    const root=proof.scope.root;
    let eligible=c.kind!=='tournament'||(!root.creator_id&&!root.creator_gamertag);
    if(!eligible)eligible=(await query('SELECT id FROM users WHERE role_id IN (0,2) AND email IN (?,?)',[root.creator_email||'',root.organizer_email||''])).length>0;
    const role=ownerType==='club'?'club_champion':c.award?.winning_club_id?'associated_player':'player_champion';
    const details=history.snapshot(proof,role,eligible);
    verified.set(eventKey,{...c.award,id:c.award?.id||null,status:'earned',owner_id:ownerId,owner_type:ownerType,trophy_item_id:proof.item?.id||null,source_type:c.kind,source_id:c.id,edition_id:proof.edition_id,winning_club_id:ownerType==='club'||c.award?.winning_club_id?proof.winner:null,metadata_json:details,...details,name:details.display_name,verified:true,persisted:false});
  }catch(e){discrepancies.push({source_type:c.kind,source_id:c.id,award_id:c.award?.id||null,reason:e.message,can_revoke:/does not match the authoritative winner|not the event winner|explicitly belongs to a different|contradicts the configured/.test(e.message)});}
  const placementsRows=await query('SELECT * FROM trophy_placements WHERE owner_id=? AND owner_type=?',[ownerId,ownerType]);
  const events=new Map();
  for(const award of stored){const key=[award.source_type,award.source_id,award.edition_id,award.award_role||ownerType].join(':');if(!events.has(key))events.set(key,[]);events.get(key).push(award.id);}
  for(const [event,ids]of events)if(ids.length>1)discrepancies.push({event,award_ids:ids,reason:'Duplicate historical award identities require explicit review; title counts are deduplicated',can_revoke:false});
  for(const award of verified.values())if(!award.persisted)discrepancies.push({award_id:award.id,source_type:award.source_type,source_id:award.source_id,reason:'Verified legacy win needs explicit permanent snapshot materialization',can_revoke:false});
  for(const p of placementsRows)if(![...verified.values()].some(a=>a.trophy_item_id===p.trophy_item_id))discrepancies.push({placement_id:p.id,trophy_item_id:p.trophy_item_id,reason:'Visual placement has no verified championship entitlement'});
  for(const p of placementsRows)if(!p.award_id)discrepancies.push({placement_id:p.id,reason:'Legacy arrangement needs an explicit verified award association before permanent confirmation'});
  return {owner_id:ownerId,owner_type:ownerType,awards:[...verified.values()],titles:history.titleSummary([...verified.values()]),discrepancies,placements:placementsRows};
}
async function repair(ownerId,ownerType,input,admin) {
  if(!['club','player'].includes(ownerType))throw fail('Invalid cabinet owner type',400);
  if(!admin?.id || !String(input.reason||'').trim())throw fail('Admin reason required');
  return withTransaction(async query=>{
    await query(`SELECT id FROM ${ownerType==='club'?'clubs':'players'} WHERE id=? FOR UPDATE`,[ownerId]);
    const before=await review(ownerId,ownerType,query);
    if(input.action==='materialize') {
      for(const award of before.awards)if(!award.persisted)await model.create({...award,metadata_json:{...history.parse(award.metadata_json),...(ownerType==='club'?{honoured_player_ids:[],associated_history_unavailable:true}:{})}},query);
      const afterAwards=(await review(ownerId,ownerType,query)).awards;
      for(const placement of before.placements.filter(p=>!p.award_id&&!p.locked_at)) {
        const choices=afterAwards.filter(a=>a.id&&a.trophy_item_id===placement.trophy_item_id&&!before.placements.some(p=>p.award_id===a.id));
        if(choices.length===1&&Number(placement.win_count||1)===1)await query('UPDATE trophy_placements SET award_id=? WHERE id=?',[choices[0].id,placement.id]);
      }
    }
    else if(input.action==='revoke') {
      const discrepancy=before.discrepancies.find(d=>d.award_id===input.award_id&&d.can_revoke);
      if(!discrepancy?.can_revoke)throw fail('Only a proven incorrect entitlement may be revoked; missing historical evidence requires review, not deletion',409);
      await model.update(input.award_id,{status:'revoked',revoked_reason:input.reason},query);
    }else if(input.action==='associate_legacy') {
      const placement=before.placements.find(p=>p.id===input.placement_id&&!p.award_id&&!p.locked_at);
      const award=before.awards.find(a=>a.id===input.award_id&&a.persisted);
      if(!placement||!award||placement.trophy_item_id!==award.trophy_item_id||before.placements.some(p=>p.award_id===award.id))throw fail('Choose an unassigned legacy draft and its verified, unplaced earned copy',409);
      await query('UPDATE trophy_placements SET award_id=? WHERE id=?',[award.id,placement.id]);
    }else if(input.action==='remove_invalid_placement') {
      if(!before.discrepancies.some(d=>d.placement_id===input.placement_id))throw fail('Placement is not proven invalid',409);
      await query('DELETE FROM trophy_placements WHERE id=?',[input.placement_id]);
    }else throw fail('Unknown trophy review action',400);
    const after=await review(ownerId,ownerType,query);
    if(ownerType==='club')await require('./competitionHistoryResetService').refreshCaches(query,ownerId);
    await require('./rewardConfigurationService').audit(query,admin,'repair_trophy_entitlement',ownerType,ownerId,before,after,input.reason);
    return after;
  });
}
module.exports={outcome,verifiedDesign,assertCabinetOwner,review,repair};

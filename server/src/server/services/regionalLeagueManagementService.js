'use strict';
const crypto = require('crypto');
const { EXECUTESQL, withTransaction } = require('../db/database');
const editions = require('./regionalEditionService');
const { unpack, identity, fail } = require('../lib/regionalEditionIdentity');
const { permanentId, leagueKey } = require('../lib/regionalLeagueHierarchy');
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

async function preview(body, actor, query=EXECUTESQL) {
  await editions.admin(actor,query);
  if (!['create','review','retire','delete'].includes(body.action)) fail('Unknown permanent league action',400);
  const rows=await editions.model.selectAll(query);
  const blockers=[];
  if (body.action==='create') {
    const d=body.definition || {};
    if (['id','permanent_league_id','reset_series','current_edition_id','previous_season_id','next_season_id','winner_club_id','edition_invalidated','retired','retired_at'].some(field=>Object.hasOwn(d,field))) fail('Permanent identity and lifecycle fields are assigned by the server',400);
    if (!String(d.name || '').trim() || !Number.isInteger(Number(d.max_clubs)) || Number(d.max_clubs)<2 || Number(d.max_clubs)>20) fail('Provide a name and supported capacity of 2–20 clubs',400);
    const scope=identity({...d,season_number:1});
    for(const row of rows) { try { if(leagueKey(unpack(row))===scope.key)blockers.push('This permanent regional division already exists; use its season workflow.'); } catch { /* Admin identity review retains unknown records */ } }
    if (d.trophy_item_id) {
      const [item]=await query('SELECT * FROM trophy_items WHERE id=?',[d.trophy_item_id]);
      if (!item || item.tournament_id || item.linked_source_id) blockers.push('The selected trophy is unavailable or explicitly assigned elsewhere.');
    }
    if (Number(d.division)>2 && !Array.isArray(d.reward_defaults?.rows)) blockers.push('Future divisions require an explicit reward-default schedule; no Division 1 prizes will be inferred.');
    if (Array.isArray(d.reward_defaults?.rows)) require('../lib/rewardPolicy').validateConfiguration('regional_league',d.reward_defaults.rows,Number(d.max_clubs));
    const revision=hash([body.action,d,rows]);
    return { action:body.action,revision,blockers,consequences:['Create one permanent league with an initial Season 1 edition','No matches, qualifications, awards or payments are generated'],definition:{...d,...scope,season_number:1,status:'draft'},financial_mutations:false };
  }
  const stored=rows.find(r=>r.id===body.league_id);
  if(!stored)fail('Permanent league not found',404);
  const root=unpack(stored);
  if(permanentId(root)!==root.id)fail('Select the permanent league, not a season edition',400);
  const family=rows.filter(r=>permanentId(unpack(r))===root.id);
  const inventory=await require('./regionalEditionReviewService').inventory(stored,query);
  if(body.action==='delete') {
    blockers.push(...inventory.blockers);
    if(root.status!=='draft' || family.length!==1)blockers.push('Only an unused draft without other editions may be deleted. Retire a league with history.');
    if(rows.some(r=>r.id!==root.id && (unpack(r).linked_league_id===root.id || (root.slug && unpack(r).linked_league_slug===root.slug))))blockers.push('Another division links to this permanent league.');
  }
  if(body.action==='retire' && family.some(r=>['in_progress','league_phase','active','knockout','playoff_round'].includes(unpack(r).status)))blockers.push('Complete or explicitly abandon the active edition before retirement.');
  return { action:body.action,league_id:root.id,revision:hash([body.action,stored,family,inventory]),blockers,dependency_inventory:inventory,editions:family.map(unpack),consequences:body.action==='delete'?['Delete only the proven unused draft','Keep audit history']:['Preserve all editions, results, honours and financial history','Prevent rollover and reseeding of this permanent identity'],financial_mutations:false };
}
async function action(body,actor,transaction=withTransaction) {
  if(body.apply!==true)return preview(body,actor);
  if(!String(body.reason || '').trim())fail('An administrative reason is required',400);
  return transaction(async query=>{
    const admin=await editions.admin(actor,query);
    await editions.model.lock(query);
    const report=await preview(body,actor,query);
    if(report.revision!==body.expected_revision)fail('League state changed; preview again',409);
    if(report.blockers.length)fail('Permanent league operation has unresolved blockers',409,report);
    if(body.action==='review')return report;
    if(body.action==='create') {
      const d=report.definition;
      const result=await editions.createInside({...d,rules:typeof d.rules==='string'?d.rules:JSON.stringify(d.rules || {}),reason:body.reason},query,admin);
      if(d.reward_defaults?.rows) {
        const rewards=require('./rewardConfigurationService');
        const old=await rewards.read('regional_league',result.record.id,query,true);
        await rewards.save('regional_league',result.record.id,{...d.reward_defaults,rows:d.reward_defaults.rows,participant_count:Number(d.max_clubs),revision:old.revision,version:old.version,reason:body.reason},admin,query);
      }
      return {applied:true,record:result.record};
    }
    const before=report.editions.find(r=>r.id===body.league_id);
    if(body.action==='delete')await editions.model.delete(body.league_id,query);
    else await editions.model.update({...before,retired:true,retired_at:new Date().toISOString(),is_active:0},identity(before).key,query);
    await editions.audit(query,admin,body.action==='delete'?'delete_unused_permanent_league':'retire_permanent_league',{id:body.league_id,action:body.action},report,body.reason);
    return {applied:true,league_id:body.league_id,financial_mutations:false};
  });
}
module.exports={preview,action};

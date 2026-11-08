'use strict';
const {withTransaction}=require('../db/database');
const {v4:uuid,v5}=require('uuid');
const {unpack}=require('../models/competitionScopeModel');
const fail=(message,status=422)=>{throw Object.assign(Error(message),{status});};
async function action(body,actor) {
 return withTransaction(async q=>{
  const admin=await require('./regionalEditionService').admin(actor,q);
  if(body.action==='resolve_review') {
   if(!String(body.reason||'').trim())fail('Provide the review decision reason.');
   const [row]=await q("SELECT * FROM league_entities WHERE id=? AND entity_type='official_absence_decision' FOR UPDATE",[body.decision_id]);
   if(!row)fail('Absence review not found.',404);
   const before=unpack(row);if(before.status==='reviewed')return {already_applied:true,decision:before};
   const after={...before,status:'reviewed',review_reason:body.reason,reviewed_by:admin.id,reviewed_at:new Date().toISOString()};
   await q("UPDATE league_entities SET status='reviewed',data_json=?,updated_date=NOW() WHERE id=? AND entity_type='official_absence_decision'",[JSON.stringify(after),after.id]);
   await q('INSERT INTO admin_audit_log (id,admin_user_id,admin_email,action,entity_type,entity_id,old_value,new_value,reason) VALUES (?,?,?,?,?,?,?,?,?)',[uuid(),admin.id,admin.email,'resolve_absence_review','official_absence_decision',after.id,JSON.stringify(before),JSON.stringify(after),body.reason]);
   return {decision:after,result_awarded:false,exclusion_applied:false};
  }
  if(!['home','away','both'].includes(body.absent_side))fail('Choose the absent home club, away club or both.');
  if(!String(body.reason||'').trim()||!String(body.evidence_url||'').trim()||!/^(\/uploads\/|https?:\/\/)/i.test(body.evidence_url))fail('Provide the reviewed absence evidence link and reason.');
  const ctx=await require('./officialMatchEligibilityService').context(body.match_id,q);
  if(!ctx.official || !ctx.match)fail('Use an exact official match.',409);
  const id=v5(`official_absence:${ctx.match.id}`,v5.URL);
  const [prior]=await q("SELECT * FROM league_entities WHERE id=? AND entity_type='official_absence_decision' FOR UPDATE",[id]);
  if(prior){const record=unpack(prior);if(record.absent_side!==body.absent_side)fail('An absence decision already exists. Review its evidence before changing it.',409);return {already_applied:true,decision:record};}
  if(['completed','forfeit','cancelled'].includes(ctx.match.status)||Number(ctx.match.stats_processed)||Number(ctx.match.report_finalized))fail('A final result exists. Use the existing result correction review.',409);
  const clubs=(body.absent_side==='both'?['home','away']:[body.absent_side]).map(s=>ctx.match[`${s}_club_id`]);
  const previous=(await q("SELECT * FROM league_entities WHERE entity_type='official_absence_decision' AND league_id=? FOR UPDATE",[ctx.root.id])).map(unpack);
  const counts=Object.fromEntries(clubs.map(club=>[club,new Set(previous.filter(r=>r.club_ids.includes(club)).map(r=>r.match_id)).size+1]));
  const record={id,edition_id:ctx.root.id,match_id:ctx.match.id,absent_side:body.absent_side,club_ids:clubs,confirmed_absences:counts,review_club_ids:clubs.filter(c=>counts[c]>=3),status:'review_required',reason:body.reason,evidence_url:body.evidence_url,decided_by:admin.id,decided_at:new Date().toISOString(),original_match:ctx.match};
  await q("INSERT INTO league_entities (id,entity_type,league_id,status,data_json) VALUES (?,'official_absence_decision',?,'review_required',?)",[id,ctx.root.id,JSON.stringify(record)]);
  await q("UPDATE matches SET status='disputed',result_state='ADMIN_REVIEW',updated_date=NOW() WHERE id=?",[ctx.match.id]);
  await q('INSERT INTO admin_audit_log (id,admin_user_id,admin_email,action,entity_type,entity_id,old_value,new_value,reason) VALUES (?,?,?,?,?,?,?,?,?)',[uuid(),admin.id,admin.email,'record_official_absence','official_absence_decision',id,JSON.stringify(ctx.match),JSON.stringify(record),body.reason]);
  return {decision:record,result_awarded:false,exclusion_applied:false};
 });
}
module.exports={action};

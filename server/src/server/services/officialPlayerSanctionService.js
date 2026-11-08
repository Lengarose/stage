'use strict';
const { withTransaction, EXECUTESQL } = require('../db/database');
const { v4: uuid } = require('uuid');
const { unpack } = require('../models/competitionScopeModel');
const fail = (message,status=422) => { throw Object.assign(Error(message),{status}); };
async function admin(actor,q) {
  const [user]=await q('SELECT id,email,role_id FROM users WHERE id=? LIMIT 1',[actor?.id]);
  if(!user || user.role_id==null || ![0,2].includes(Number(user.role_id)))fail('Admin permission is required.',403);
  return user;
}
async function list(actor) {
  await admin(actor,EXECUTESQL);
  return (await EXECUTESQL("SELECT * FROM league_entities WHERE entity_type='official_player_sanction' ORDER BY created_date DESC,id")).map(unpack);
}
async function action(body,actor) {
 return withTransaction(async q=>{
  const user=await admin(actor,q);
  if(!String(body.reason || '').trim())fail('A decision reason is required.');
  if(body.action==='revoke') {
   const [row]=await q("SELECT * FROM league_entities WHERE id=? AND entity_type='official_player_sanction' FOR UPDATE",[body.id]);
   if(!row)fail('Sanction not found.',404);
   const before=unpack(row);if(before.status==='revoked')return {sanction:before,already_applied:true};
   const after={...before,status:'revoked',revoked_by:user.id,revoked_at:new Date().toISOString(),revocation_reason:body.reason};
   await save(after,q);await audit(user,before,after,body.reason,q);return {sanction:after};
  }
  if(body.action!=='impose')fail('Choose impose or revoke.');
  const start=Date.parse(body.starts_at),end=Date.parse(body.ends_at);
  if(!Number.isFinite(start)||!Number.isFinite(end)||start>=end)fail('Provide an explicit start and later end with a timezone.');
  if(!/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(String(body.starts_at))||!/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(String(body.ends_at)))fail('Sanction timestamps must include a timezone.');
  if(!['all_official','region','edition'].includes(body.scope))fail('Choose all official competitions, a region or an exact edition.');
  if(body.scope!=='all_official' && !String(body.scope_id || '').trim())fail('Provide the exact scope identifier.');
  const [player]=await q('SELECT id FROM players WHERE id=? FOR UPDATE',[body.player_id]);if(!player)fail('Player not found.',404);
  if(body.scope==='edition') {const [edition]=await q("SELECT id FROM league_entities WHERE id=? AND entity_type IN ('regional_league','regional_cycle','regional_cup_edition')",[body.scope_id]);if(!edition)fail('Official edition not found.',404);}
  if(body.scope==='region'){const [region]=await q("SELECT id FROM league_entities WHERE entity_type='regional_league' AND JSON_UNQUOTE(JSON_EXTRACT(data_json,'$.region_slug'))=? LIMIT 1",[body.scope_id]);if(!region)fail('Regional system not found.',404);}
  // The caller retains a UUID across retries; payload changes cannot reuse it.
  if(!/^[a-f0-9-]{36}$/i.test(String(body.decision_id || '')))fail('A stable decision ID is required.');
  const after={id:body.decision_id,player_id:player.id,scope:body.scope,scope_id:body.scope==='all_official'?null:body.scope_id,starts_at:new Date(start).toISOString(),ends_at:new Date(end).toISOString(),reason:body.reason,status:'active',imposed_by:user.id};
  const [old]=await q("SELECT * FROM league_entities WHERE id=? FOR UPDATE",[after.id]);
  if(old){const prior=unpack(old);if(old.entity_type!=='official_player_sanction' || ['player_id','scope','scope_id','starts_at','ends_at','reason','imposed_by'].some(k=>prior[k]!==after[k]))fail('This decision ID is already used for another decision.',409);return {sanction:prior,already_applied:true};}
  await save(after,q);await audit(user,null,after,body.reason,q);return {sanction:after};
 });
}
async function save(record,q) {await q("INSERT INTO league_entities (id,entity_type,status,data_json) VALUES (?,'official_player_sanction',?,?) ON DUPLICATE KEY UPDATE status=VALUES(status),data_json=VALUES(data_json),updated_date=NOW()",[record.id,record.status,JSON.stringify(record)]);}
async function audit(user,before,after,reason,q){await q('INSERT INTO admin_audit_log (id,admin_user_id,admin_email,action,entity_type,entity_id,old_value,new_value,reason) VALUES (?,?,?,?,?,?,?,?,?)',[uuid(),user.id,user.email,before?'revoke_player_sanction':'impose_player_sanction','official_player_sanction',after.id,JSON.stringify(before),JSON.stringify(after),reason]);}
async function assertSelection(ctx,selection,q,now=new Date()) {
 if(!ctx.official || !selection.ids.length)return;
 // Player identity, never current club identity, owns the sanction.
 const rows=await q(`SELECT * FROM league_entities WHERE entity_type='official_player_sanction' AND JSON_UNQUOTE(JSON_EXTRACT(data_json,'$.player_id')) IN (${selection.ids.map(()=>'?').join(',')}) AND status='active' ORDER BY id FOR UPDATE`,selection.ids);
 const when=new Date(now).getTime();
 const blocked=rows.map(unpack).filter(s=>Date.parse(s.starts_at)<=when && when<Date.parse(s.ends_at) && (s.scope==='all_official'||s.scope==='edition'&&s.scope_id===ctx.root.id||s.scope==='region'&&s.scope_id===ctx.root.region_slug));
 if(blocked.length)throw Object.assign(Error('A selected player has an active Admin suspension for this official competition.'),{status:422,details:{player_ids:[...new Set(blocked.map(s=>s.player_id))],sanction_ids:blocked.map(s=>s.id)}});
}
module.exports={action,list,assertSelection};

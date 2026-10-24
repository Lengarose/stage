'use strict';
const crypto=require('crypto');
const {EXECUTESQL,withTransaction}=require('../db/database');
const {regionalRows,validateConfiguration,diagnoseLegacy}=require('../lib/rewardPolicy');
const parse=v=>{try{return typeof v==='string'?JSON.parse(v):v||{};}catch{return {};}};
const key=(type,id)=>crypto.createHash('sha256').update(`reward-config:${type}:${id}`).digest('hex').slice(0,32);
const revision=rows=>crypto.createHash('sha256').update(JSON.stringify(rows.map(r=>[r.id,r.position,r.component_key,String(r.stc_amount),r.config_version,r.position_label]).sort())).digest('hex');
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
async function read(type,id,query=EXECUTESQL,lock=false) {
  if(!['regional_league','competition'].includes(type)||!id)throw fail('Valid competition or regional league source required');
  const [record]=await query(`SELECT * FROM league_entities WHERE id=? AND entity_type=?${lock?' FOR UPDATE':''}`,[id,type]);
  if(!record)throw fail('Reward source not found',404);
  const source={...parse(record.data_json),id:record.id};
  const [meta]=await query("SELECT * FROM league_entities WHERE id=? AND entity_type='reward_configuration'",[key(type,id)]);
  const settings=meta?parse(meta.data_json):{};
  const all=await query('SELECT * FROM reward_configs WHERE source_type=? AND source_id=? ORDER BY config_version,position,id',[type,id]);
  const version=Number(settings.version||0);
  const rows=all.filter(r=>version?Number(r.config_version)===version:!r.config_version);
  const count=Number(settings.participant_count || source.max_clubs || source.target_clubs || (type==='regional_league'?20:36));
  const issues=diagnoseLegacy(rows,type,count);
  if(version) {
    try {
      const validated=validateConfiguration(type,rows,count);
      if(validated.budget!==settings.budget)issues.push('Stored budget differs from the complete configured schedule');
    }catch(error){issues.push(error.message);}
  }
  const proposed=type==='regional_league'?regionalRows(count):['participation','winner_bonus','runner_up_bonus'].map(component_key=>({component_key,stc_amount:''}));
  return {source_type:type,source_id:id,source_name:source.name,source,version,revision:revision(rows),participant_count:count,rows,proposed,issues,settings};
}
async function audit(query,admin,action,type,id,before,after,reason) {
  await query('INSERT INTO admin_audit_log (id,admin_user_id,admin_email,action,entity_type,entity_id,old_value,new_value,reason) VALUES (?,?,?,?,?,?,?,?,?)',[crypto.randomUUID(),admin.id,admin.email,action,type,id,JSON.stringify(before),JSON.stringify(after),reason]);
}
async function save(type,id,input,admin) {
  if(!admin?.id || !String(input.reason||'').trim())throw fail('Admin identity and change reason required',403);
  return withTransaction(async query=>{
    const old=await read(type,id,query,true);
    if(Number(input.version)!==old.version || input.revision!==old.revision)throw fail('Reward configuration changed. Reload before saving.',409);
    const config=validateConfiguration(type,input.rows,Number(input.participant_count));
    if(input.trophy_item_id) {
      const [item]=await query('SELECT * FROM trophy_items WHERE id = ? LIMIT 1',[input.trophy_item_id]);
      if(!item || item.tournament_id || item.linked_source_id && (item.linked_source_id!==id||item.linked_source_type!==type))throw fail('Selected trophy explicitly belongs to another event or is unavailable');
    }
    if(input.trophy_image_url && !/^(\/uploads\/|https?:\/\/)/.test(String(input.trophy_image_url)))throw fail('Invalid trophy image URL');
    const version=old.version+1;
    for(const r of config.rows)await query('INSERT INTO reward_configs (id,source_id,source_type,source_name,position,position_label,badge_type,stc_amount,config_version,component_key) VALUES (?,?,?,?,?,?,?,?,?,?)',[crypto.randomUUID(),id,type,old.source_name,r.position,r.position_label,r.badge_type,r.stc_amount,version,r.component_key]);
    const settings={...config,rows:undefined,version,trophy_item_id:input.trophy_item_id===undefined?old.settings.trophy_item_id||old.source.trophy_item_id||null:input.trophy_item_id,trophy_image_url:input.trophy_image_url===undefined?old.settings.trophy_image_url||old.source.trophy_image_url||null:input.trophy_image_url,updated_at:new Date().toISOString()};
    await query("INSERT INTO league_entities (id,entity_type,data_json,status,created_date,updated_date) VALUES (?,'reward_configuration',?,'active',NOW(),NOW()) ON DUPLICATE KEY UPDATE data_json=VALUES(data_json),updated_date=NOW()",[key(type,id),JSON.stringify(settings)]);
    await audit(query,admin,'replace_reward_configuration',type,id,{version:old.version,rows:old.rows},{...settings,rows:config.rows},input.reason);
    return read(type,id,query);
  });
}
async function cleanup(type,id,input,admin) {
  if(!admin?.id || !String(input.reason||'').trim())throw fail('Admin identity and change reason required',403);
  return withTransaction(async query=>{
    const old=await read(type,id,query,true);
    if(old.revision!==input.revision)throw fail('Configuration changed; reload the review',409);
    const groups=new Map();
    for(const r of old.rows){const k=r.component_key||`position:${r.position}`;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);}
    const removed=[];
    for(const rows of groups.values()) {
      if(new Set(rows.map(r=>JSON.stringify([String(r.stc_amount),r.position_label,r.badge_type]))).size>1)throw fail('Conflicting duplicates require an explicitly reviewed replacement configuration',409);
      for(const r of rows.slice(1)){await query('DELETE FROM reward_configs WHERE id=?',[r.id]);removed.push(r.id);}
    }
    if(removed.length)await audit(query,admin,'cleanup_identical_reward_duplicates',type,id,old.rows,{removed},input.reason);
    return read(type,id,query);
  });
}
module.exports={read,save,cleanup,key,revision,audit};

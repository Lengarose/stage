'use strict';
const crypto=require('crypto');
const {EXECUTESQL,withTransaction}=require('../db/database');
const {regionalRows,regionalPreset,validateConfiguration,diagnoseLegacy}=require('../lib/rewardPolicy');
const parse=v=>{try{return typeof v==='string'?JSON.parse(v):v||{};}catch{return {};}};
const key=(type,id)=>crypto.createHash('sha256').update(`reward-config:${type}:${id}`).digest('hex').slice(0,32);
const revision=rows=>crypto.createHash('sha256').update(JSON.stringify(rows.map(r=>[r.id,r.position,r.component_key,String(r.stc_amount),r.config_version,r.position_label]).sort())).digest('hex');
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
async function read(type,id,query=EXECUTESQL,lock=false) {
  if(!['regional_league','competition'].includes(type)||!id)throw fail('Valid competition or regional league source required');
  const [record]=await query(`SELECT * FROM league_entities WHERE id=? AND entity_type=?${lock?' FOR UPDATE':''}`,[id,type]);
  if(!record)throw fail('Reward source not found',404);
  const source={...parse(record.data_json),id:record.id};
  if(type==='regional_league'&&source.permanent_league_id&&source.permanent_league_id!==id)return read(type,source.permanent_league_id,query,lock);
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
  const proposed=type==='regional_league'?([1,2].includes(Number(source.division || 1))?regionalRows(count,source):rows):['participation','winner_bonus','runner_up_bonus'].map(component_key=>({component_key,stc_amount:''}));
  if(type==='regional_league'&&Number(source.division)===2&&version&&rows.some((r,i)=>String(r.stc_amount)!==proposed[i]?.stc_amount))issues.push('Division 2 saved configuration differs from the shared schedule. Review before applying; captured editions remain unchanged.');
  return {source_type:type,source_id:id,source_name:source.name,source,version,revision:revision(rows),participant_count:count,rows,proposed,issues,settings};
}
async function audit(query,admin,action,type,id,before,after,reason) {
  await query('INSERT INTO admin_audit_log (id,admin_user_id,admin_email,action,entity_type,entity_id,old_value,new_value,reason) VALUES (?,?,?,?,?,?,?,?,?)',[crypto.randomUUID(),admin.id,admin.email,action,type,id,JSON.stringify(before),JSON.stringify(after),reason]);
}
async function save(type,id,input,admin,transactionQuery) {
  if(!admin?.id || !String(input.reason||'').trim())throw fail('Admin identity and change reason required',403);
  const replace=async query=>{
    const old=await read(type,id,query,true);
    id=old.source.id;
    if(Number(input.version)!==old.version || input.revision!==old.revision)throw fail('Reward configuration changed. Reload before saving.',409);
    const config=validateConfiguration(type,input.rows,Number(input.participant_count));
    if(input.trophy_item_id) {
      const [item]=await query('SELECT * FROM trophy_items WHERE id = ? LIMIT 1',[input.trophy_item_id]);
      if(!item || item.tournament_id || item.linked_source_id && (item.linked_source_id!==id||item.linked_source_type!==type))throw fail('Selected trophy explicitly belongs to another event or is unavailable');
    }
    if(input.trophy_image_url && !/^(\/uploads\/|https?:\/\/)/.test(String(input.trophy_image_url)))throw fail('Invalid trophy image URL');
    const version=old.version+1;
    for(const r of config.rows)await query('INSERT INTO reward_configs (id,source_id,source_type,source_name,position,position_label,badge_type,stc_amount,config_version,component_key) VALUES (?,?,?,?,?,?,?,?,?,?)',[crypto.randomUUID(),id,type,old.source_name,r.position,r.position_label,r.badge_type,r.stc_amount,version,r.component_key]);
    const settings={...config,rows:undefined,version,...(type==='regional_league'?{division:old.source.division??null,template_version:regionalPreset(old.source).version}:{}),trophy_item_id:input.trophy_item_id===undefined?old.settings.trophy_item_id||old.source.trophy_item_id||null:input.trophy_item_id,trophy_image_url:input.trophy_image_url===undefined?old.settings.trophy_image_url||old.source.trophy_image_url||null:input.trophy_image_url,updated_at:new Date().toISOString()};
    await query("INSERT INTO league_entities (id,entity_type,data_json,status,created_date,updated_date) VALUES (?,'reward_configuration',?,'active',NOW(),NOW()) ON DUPLICATE KEY UPDATE data_json=VALUES(data_json),updated_date=NOW()",[key(type,id),JSON.stringify(settings)]);
    await audit(query,admin,'replace_reward_configuration',type,id,{version:old.version,rows:old.rows},{...settings,rows:config.rows},input.reason);
    return read(type,id,query);
  };
  return transactionQuery?replace(transactionQuery):withTransaction(replace);
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
function matchesTemplate(config) {
  const budget=validateConfiguration('regional_league',config.proposed,config.participant_count).budget;
  return config.version>0 && config.settings.budget===budget && config.rows.length===config.proposed.length && config.proposed.every(expected=>config.rows.filter(row=>Number(row.position)===expected.position&&String(row.stc_amount)===expected.stc_amount).length===1);
}
async function reviewDivisionTwo(query=EXECUTESQL) {
  const sources=await query("SELECT * FROM league_entities WHERE entity_type='regional_league' ORDER BY id");
  const snapshots=await query("SELECT * FROM league_entities WHERE entity_type='competition_settlement'");
  const result=[];
  for(const record of sources) {
    const source=parse(record.data_json);
    if(source.permanent_league_id && source.permanent_league_id!==record.id)continue;
    if(Number(source.division)!==2)continue;
    const config=await read('regional_league',record.id,query);
    const snapshot=snapshots.map(r=>parse(r.data_json)).find(s=>s.source_type==='regional_league'&&s.source_id===record.id&&s.config);
    result.push({id:record.id,name:source.name,division:2,region:source.region,platform:source.platform,status:source.status,version:config.version,revision:config.revision,participant_count:config.participant_count,current_budget:config.settings.budget||null,proposed_budget:validateConfiguration('regional_league',config.proposed,config.participant_count).budget,needs_update:!matchesTemplate(config),snapshot:snapshot?{edition_id:snapshot.edition_id,state:snapshot.state,budget:snapshot.config.budget??null,requires_review:true}:null});
  }
  return result;
}
async function divisionTwo(input,admin) {
  if(!admin?.id)throw fail('Admin identity required',403);
  if(input.apply!==true)return {dry_run:true,sources:await reviewDivisionTwo()};
  if(!String(input.reason||'').trim()||!Array.isArray(input.sources)||!input.sources.length)throw fail('Reviewed sources and a reason are required');
  if(input.sources.length>500||new Set(input.sources.map(s=>s.id)).size!==input.sources.length)throw fail('Select at most 500 unique reviewed sources');
  const results=[];
  for(const reviewed of input.sources) {
    try {
      const result=await withTransaction(async query=>{
        const old=await read('regional_league',reviewed.id,query,true);
        if(Number(old.source.division)!==2)throw fail('Source is not explicitly Division 2',409);
        // A repeated application is a no-op, not another configuration version.
        if(matchesTemplate(old))return {id:reviewed.id,changed:false,version:old.version};
        if(reviewed.version!==old.version||reviewed.revision!==old.revision)throw fail('Configuration changed since review; review again',409);
        const current=await save('regional_league',reviewed.id,{version:old.version,revision:old.revision,participant_count:old.participant_count,rows:old.proposed,reason:input.reason},admin,query);
        const snapshots=await query("SELECT * FROM league_entities WHERE entity_type='competition_settlement'");
        const captured=snapshots.some(row=>{const s=parse(row.data_json);return s.source_type==='regional_league'&&s.source_id===reviewed.id&&s.config;});
        if(!captured&&['draft','registration','qualification'].includes(old.source.status)) {
          const next={...old.source,prize_pool_stc:current.settings.budget,effective_prize_budget_stc:current.settings.budget};
          await query('UPDATE league_entities SET data_json=?,updated_date=NOW() WHERE id=? AND entity_type=?',[JSON.stringify(next),reviewed.id,'regional_league']);
          await audit(query,admin,'update_unstarted_division_two_budget','regional_league',reviewed.id,old.source,next,input.reason);
        }
        return {id:reviewed.id,changed:true,version:current.version,budget:current.settings.budget,snapshot_preserved:captured};
      });
      results.push(result);
    }catch(error){results.push({id:reviewed.id,changed:false,error:error.message,status:error.status||500});}
  }
  return {dry_run:false,results,sources:await reviewDivisionTwo()};
}
module.exports={read,save,cleanup,key,revision,audit,divisionTwo};

'use strict';
const template = require('./regionalRewardTemplate.json');
const { cents, stc } = require('./competitionPrizes');
const components = ['participation','winner_bonus','runner_up_bonus'];
function regionalRows(count=20) {
  if (!Number.isInteger(count) || count < 1 || count > template.max_clubs) throw Object.assign(new Error('Regional rewards support 1-20 finishing positions'),{status:400});
  return Array.from({length:count},(_,i)=>{
    const p=i+1, suffix=p>=11&&p<=13?'th':({1:'st',2:'nd',3:'rd'}[p%10]||'th');
    return {position:p,component_key:`position:${p}`,position_label:`${p}${suffix} Place`,badge_type:p===1?'winner':'participant',stc_amount:stc(BigInt(template.first_stc-i*template.step_stc)*100n)};
  });
}
function validateConfiguration(type,rows,count) {
  if (!Array.isArray(rows)) throw Object.assign(new Error('Complete reward rows required'),{status:400});
  const regional=type==='regional_league';
  if (!regional && type!=='competition') throw Object.assign(new Error('Unsupported reward source type'),{status:400});
  if (!Number.isInteger(count) || count<2 || count>(regional?20:36)) throw Object.assign(new Error('Invalid participant count'),{status:400});
  if (rows.length!==(regional?count:3)) throw Object.assign(new Error('Complete unique positions/components required'),{status:400});
  const seen=new Set();
  const canonical=rows.map(r=>{
    const position=regional?Number(r.position):null;
    const key=regional?`position:${position}`:r.component_key;
    if (seen.has(key) || (regional? !Number.isInteger(position)||position<1||position>count : !components.includes(key))) throw Object.assign(new Error('Invalid or duplicate reward position/component'),{status:400});
    seen.add(key);
    if(r.stc_amount==null||String(r.stc_amount).trim()==='')throw Object.assign(new Error('Every STC amount must be explicitly configured, including zero'),{status:400});
    let amount;try{amount=stc(cents(r.stc_amount));}catch(e){throw Object.assign(e,{status:400});}
    const label=regional?regionalRows(count)[position-1].position_label:({participation:'Participation Payment',winner_bonus:"Winner's Additional Prize",runner_up_bonus:"Runner-up's Additional Prize"}[key]);
    return {position,component_key:key,position_label:label,badge_type:regional&&position===1||key==='winner_bonus'?'winner':'participant',stc_amount:amount};
  }).sort((a,b)=>regional?a.position-b.position:components.indexOf(a.component_key)-components.indexOf(b.component_key));
  const budget=canonical.reduce((sum,r)=>sum+cents(r.stc_amount)*BigInt(r.component_key==='participation'?count:1),0n);
  if (budget > 999999999999n) throw Object.assign(new Error('Reward budget exceeds supported STC precision'),{status:400});
  return {model:regional?'regional_positions_v1':'gost_components_v1',funding:'system',participant_count:count,rows:canonical,budget:stc(budget)};
}
function diagnoseLegacy(rows,type,count) {
  const by=new Map(),issues=[];
  for(const r of rows) {const key=r.component_key || `position:${r.position}`;if(!by.has(key))by.set(key,[]);by.get(key).push(r);try{cents(r.stc_amount);}catch{issues.push(`Invalid amount at ${key}`);}}
  for(const [key,values] of by) if(values.length>1) issues.push(`${new Set(values.map(r=>JSON.stringify([String(r.stc_amount),r.position_label,r.badge_type]))).size===1?'Identical':'Conflicting'} duplicate ${key}`);
  if(type==='regional_league') for(const r of regionalRows(count)) {if(!by.has(r.component_key))issues.push(`Missing ${r.position_label}`);if((by.get(r.component_key)||[]).some(x=>x.position_label!==r.position_label))issues.push(`Wrong label at ${r.component_key}`);}
  else if(rows.length && !rows.every(r=>components.includes(r.component_key))) issues.push('Legacy bundled GOST prizes require explicit review; finalist bonuses cannot be inferred');
  return issues;
}
module.exports={regionalRows,validateConfiguration,diagnoseLegacy,components,template};

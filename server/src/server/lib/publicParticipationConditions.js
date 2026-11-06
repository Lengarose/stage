'use strict';
const {identity}=require('./regionalEditionIdentity');
const {VERSION}=require('./regionalRegistrationPolicy');
function publicParticipationConditions(root,window) {
  if(!window && !root.regional_registration_window_id && !root.regional_participation_policy_version)return null;
  const unavailable={state:'unavailable'};
  if(!window || window.policy_version!==VERSION || typeof window.id!=='string' || !window.id || typeof window.rules_text!=='string' || !window.rules_text.trim() || root.regional_registration_window_id && window.id!==root.regional_registration_window_id || root.regional_participation_policy_version && root.regional_participation_policy_version!==window.policy_version)return unavailable;
  try {
    const scope=value=>identity({...value,slug:'',division:1,group_code:'A'});
    const a=scope(root),b=scope(window);
    if(['region_slug','platform','season_number'].some(key=>a[key]!==b[key]) || Number(root.reset_series || 0)!==Number(window.reset_series || 0))return unavailable;
  }catch{return unavailable;}
  return {state:'published',window_id:window.id,policy_version:window.policy_version,
    result_policy_version:typeof window.result_policy_version==='string'?window.result_policy_version:null,
    cup_policy_version:typeof window.cup_policy_version==='string'?window.cup_policy_version:null,
    rules_text:window.rules_text};
}
module.exports={publicParticipationConditions};

'use strict';
const {cents,stc,placements,parse}=require('./competitionPrizes');
function eligibleClubIds(scope) {
  const registered=parse(scope.root.registered_club_ids,null);
  if(!Array.isArray(registered)||registered.some(id=>id==null||!String(id).trim())||new Set(registered.map(String)).size!==registered.length)throw new Error('Authoritative registered clubs are missing or duplicated');
  const excluded=new Set(scope.standings.filter(s=>s.is_excluded).map(s=>String(s.club_id)));
  return registered.map(String).filter(id=>!excluded.has(id)).sort();
}
function planComponentPrizes(scope,config,payments=[],ledgers=[]) {
  const blocked=[];
  let eligible=[];
  try{eligible=eligibleClubIds(scope);}catch(e){blocked.push(e.message);}
  if(!['regional_positions_v1','gost_components_v1'].includes(config.model)||config.funding!=='system')blocked.push('Unrecognized reward model/funding policy');
  if(config.roster && JSON.stringify(config.roster)!==JSON.stringify(eligible))blocked.push('Eligible registrations changed after the edition snapshot; authorised review required');
  const regional=config.model==='regional_positions_v1';
  const sportingRows=regional?config.rows.map(r=>({position:r.position,amount:r.stc_amount})): [{position:1,amount:'0.00'},{position:2,amount:'0.00'}];
  const placed=placements(scope,sportingRows);
  if(placed.blocked)blocked.push(placed.blocked);
  const definitions=regional?config.rows.map(r=>({component_key:`position:${r.position}`,position:r.position,amount:r.stc_amount,recipient:placed.map.get(r.position)})):
    [...eligible.map((id,index)=>({component_key:`participation:${index+1}`,position:null,amount:config.rows.find(r=>r.component_key==='participation')?.stc_amount,recipient:id})),
      ...['winner_bonus','runner_up_bonus'].map((component_key,i)=>({component_key,position:i+1,amount:config.rows.find(r=>r.component_key===component_key)?.stc_amount,recipient:placed.map.get(i+1)}))];
  const obligations=definitions.map(d=>{
    const key=regional?`prize:${scope.source_type}:${scope.root.id}:${scope.edition_id}:${d.position}`:`prize:${scope.source_type}:${scope.root.id}:${scope.edition_id}:${d.component_key}`;
    const reasons=[];
    let expected=0n;try{expected=cents(d.amount);}catch{reasons.push('Invalid captured reward amount');}
    if(!d.recipient || !eligible.includes(String(d.recipient)))reasons.push('Eligible reward recipient is unresolved');
    const payment=payments.find(p=>p.idempotency_key===key);
    if(payment&&(String(payment.club_id)!==String(d.recipient)||cents(payment.amount_stc)!==expected))reasons.push('Established obligation changed; authorised reversal/review required');
    const old=ledgers.filter(l=>String(l.club_id)===String(d.recipient)&&!l.settlement_key&&(scope.legacy_references.includes(l.reference_id)||scope.ambiguous_legacy_references?.includes(l.reference_id)));
    if(!regional && old.length)reasons.push('Legacy GOST payments cannot be safely attributed to participation versus bonuses');
    const proven=ledgers.filter(l=>String(l.club_id)===String(d.recipient)&&(l.settlement_key===key||(regional&&!l.settlement_key&&scope.legacy_references.includes(l.reference_id))));
    let paid=0n;for(const l of proven)try{paid+=cents(l.amount);}catch{reasons.push('Invalid or reversed historical ledger amount');}
    if(paid>expected)reasons.push('Existing payment exceeds the established obligation');
    if(payment?.status==='paid'&&!proven.some(l=>l.id===payment.ledger_transaction_id))reasons.push('Paid obligation has no matching ledger evidence');
    const profile=scope.participants.find(p=>String(p.id)===String(d.recipient));
    return {key,component_key:d.component_key,position:d.position,recipient_id:d.recipient||null,recipient_type:'club',recipient_name:profile?.name||null,expected_amount:stc(expected),proven_payment:stc(paid),missing_amount:stc(paid<expected?expected-paid:0n),ledger_ids:proven.map(l=>l.id),blocking_reasons:reasons};
  });
  const total=obligations.reduce((s,o)=>s+cents(o.expected_amount),0n);
  if(total!==cents(config.budget))blocked.push('Captured budget does not equal the exact obligations');
  if(scope.root.effective_prize_budget_stc!=null&&cents(scope.root.effective_prize_budget_stc)!==cents(config.budget))blocked.push('Edition funding budget differs from the approved snapshot');
  const anyBlocked=blocked.length||obligations.some(o=>o.blocking_reasons.length);
  return {state:anyBlocked?'blocked':total===0n?'zero_prize':obligations.some(o=>cents(o.missing_amount)>0n)?'unpaid':'paid',blocking_reasons:blocked,obligations,budget:stc(total),configuration_version:config.version};
}
module.exports={eligibleClubIds,planComponentPrizes};

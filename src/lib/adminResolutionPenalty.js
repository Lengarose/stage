export const resolutionPenaltyKey=(match,score,side='')=>JSON.stringify([match.id,String(score.home_score),String(score.away_score),side]);

export function adminPenaltyDecision(context,choice,key) {
  if(!context || typeof context.applicable!=='boolean' || typeof context.required!=='boolean' || context.blocked || context.required && !context.applicable)return {key,ready:false};
  if(!context.applicable)return {key,ready:true,decided_on_penalties:0,penalty_winner_side:null};
  if(['home','away'].includes(choice))return {key,ready:true,decided_on_penalties:1,penalty_winner_side:choice};
  if(choice==='none' && !context.required)return {key,ready:true,decided_on_penalties:0,penalty_winner_side:null};
  return {key,ready:false};
}

export function adminPenaltyReady(decision,key) {
  return decision?.key===key && decision.ready===true && (
    decision.decided_on_penalties===0 && decision.penalty_winner_side===null ||
    decision.decided_on_penalties===1 && ['home','away'].includes(decision.penalty_winner_side));
}

export function officialResultNotice(game,policy) {
  if(!policy || policy.match_id!==game.id)return null;
  const versions={regional_result_review_v1:false,regional_result_review_v2:true};
  if(!Object.hasOwn(versions,policy.version) || policy.response_hours!==24 || policy.timeout_action!=='admin_review' || policy.allow_either_initial!==versions[policy.version])return {unsupported:true};
  const waiting=!['completed','forfeit','cancelled','voided','deleted'].includes(game.status) && ['AWAITING_AWAY_CONFIRMATION','AWAITING_HOME_REVIEW'].includes(game.result_state);
  const raw=game.result_state==='AWAITING_AWAY_CONFIRMATION'?game.confirmation_due_at:game.review_due_at;
  // Workflow response deadlines are absolute UTC, unlike local kickoff wall times.
  const parts=typeof raw==='string'?/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/.exec(raw):null;
  const base=parts?`${parts[1]}T${parts[2]}`:null;
  const check=base?new Date(`${base}Z`):null;
  const validParts=check && Number.isFinite(check.getTime()) && check.toISOString().slice(0,19)===base;
  const utc=validParts?`${base}${parts[3] || ''}${parts[4] || 'Z'}`:raw instanceof Date?raw:null;
  const date=waiting && utc?new Date(utc):null;
  const deadline=date && Number.isFinite(date.getTime())?date.toISOString():null;
  return {unsupported:false,version:policy.version,allowEitherInitial:policy.allow_either_initial,waiting,deadline,
    review:game.result_state==='ADMIN_REVIEW',disputed:game.result_state==='DISPUTED'};
}

const terminal=new Set(['completed','confirmed','played','forfeit','cancelled','canceled','deleted','voided','archived','reset','superseded']);
const finalResults=new Set(['CONFIRMED','VOIDED','AUTO_CONFIRMED_TIMEOUT']);
export function isPendingForfeit(match) {
  return Boolean(match && match.forfeit_status==='pending' && match.forfeit_claimed_by && !terminal.has(String(match.status || '').toLowerCase()) && !finalResults.has(String(match.result_state || '').toUpperCase()));
}
const text=value=>value==null?'':String(value);
const score=value=>value==null || value===''?null:Number(value);
export function forfeitSnapshot(match) {
  return {version:1,id:text(match.id),status:text(match.status),result_state:text(match.result_state),forfeit_status:text(match.forfeit_status),forfeit_claimed_by:text(match.forfeit_claimed_by),forfeit_proof_url:text(match.forfeit_proof_url),home_club_id:text(match.home_club_id),away_club_id:text(match.away_club_id),home_score:score(match.home_score),away_score:score(match.away_score)};
}
function validItems(items,max) {
  return Array.isArray(items) && items.length<=max && items.every(m=>typeof m?.id==='string' && m.id && isPendingForfeit(m)) && new Set(items.map(m=>m.id)).size===items.length;
}
export async function loadForfeitReviewSummary(client) {
  const data=await client.http.get('/matches/forfeit-reviews/summary');
  if(!data || !Number.isSafeInteger(data.total) || data.total<0 || !validItems(data.items,10) || data.items.length!==Math.min(10,data.total) || typeof data.as_of!=='string' || !Number.isFinite(Date.parse(data.as_of)))throw Error('The forfeit summary could not be verified. Refresh to try again.');
  return data;
}
export async function loadForfeitReviewPage(client,cursor='') {
  const data=await client.http.get('/matches/forfeit-reviews',{limit:50,...(cursor?{cursor}:{})});
  if(!data || !validItems(data.items,50) || typeof data.has_more!=='boolean' || (data.has_more?(!data.items.length || data.next_cursor!==data.items.at(-1).id || data.next_cursor===cursor):data.next_cursor!==null))throw Error('The forfeit list could not be verified. Refresh to try again.');
  return {...data,request_cursor:cursor};
}
export async function resolveReviewedForfeit(client,reviewed,approve) {
  const fresh=await client.entities.Match.get(reviewed.id);
  if(!fresh || fresh.id!==reviewed.id || !isPendingForfeit(fresh) || JSON.stringify(forfeitSnapshot(fresh))!==JSON.stringify(forfeitSnapshot(reviewed)))throw Error('This forfeit claim changed or is no longer pending. Refresh and review it before deciding.');
  return client.functions.invoke('adminMatchActions',{action:'resolve_forfeit',match_id:fresh.id,approve,expected_forfeit_snapshot:forfeitSnapshot(fresh),reason:approve?'Approved from admin forfeits panel':'Rejected from admin forfeits panel'});
}

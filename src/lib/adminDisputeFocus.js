const finalStates=new Set(['CONFIRMED','VOIDED','AUTO_CONFIRMED_TIMEOUT']);
const finalStatuses=new Set(['completed','forfeit','cancelled','canceled','voided','deleted','archived','reset','superseded']);

export function isPendingDispute(match) {
  return !finalStatuses.has(match.status) && !finalStates.has(match.result_state) && (match.status==='disputed' || ['ADMIN_REVIEW','DISPUTED'].includes(match.result_state));
}
export async function loadFocusedDispute(client,id) {
  if(typeof id!=='string' || !id.trim())throw new Error('Choose an exact match to review.');
  const match=await client.entities.Match.get(id);
  if(!match || match.id!==id)throw new Error('The requested match could not be verified. Refresh before reviewing it.');
  const review=isPendingDispute(match);
  return review?{id,status:'review',match:{...match,_source:'tournament'}}:{id,status:'not_pending',match:null};
}

export async function loadDisputeReviewPage(client,cursor='') {
  const page=await client.http.get('/matches/reviews',{limit:50,...(cursor?{cursor}:{})});
  if(!page || !Array.isArray(page.items) || page.items.length>50 || typeof page.has_more!=='boolean' || page.items.some(m=>!m || typeof m.id!=='string' || !m.id || !isPendingDispute(m)) || new Set(page.items.map(m=>m.id)).size!==page.items.length || (page.has_more?(!page.items.length || page.next_cursor!==page.items.at(-1).id || page.next_cursor===cursor):page.next_cursor!==null))throw new Error('The review list could not be verified. Refresh before choosing a match.');
  return {...page,request_cursor:cursor,items:page.items.map(m=>({...m,_source:'tournament'}))};
}

export async function loadDisputeReviewSummary(client) {
  const summary=await client.http.get('/matches/reviews/summary');
  if(!summary || !Number.isSafeInteger(summary.total) || summary.total<0 || !Array.isArray(summary.items) || summary.items.length!==Math.min(10,summary.total) || summary.items.some(m=>!m || typeof m.id!=='string' || !m.id || !isPendingDispute(m)) || new Set(summary.items.map(m=>m.id)).size!==summary.items.length || typeof summary.as_of!=='string' || !Number.isFinite(Date.parse(summary.as_of)))throw Error('The review summary could not be verified. Refresh to try again.');
  return {...summary,items:summary.items.map(m=>({...m,_source:'tournament'}))};
}

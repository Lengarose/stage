export function evidenceLink(value) {
  if(typeof value!=='string')return null;
  const link=value.trim();
  if(!link || /[\\\u0000-\u001f\u007f]/.test(link))return null;
  if(/^\/(?!\/)/.test(link))return link;
  try {return ['http:','https:'].includes(new URL(link).protocol)?link:null;}catch{return null;}
}
export function restoreEvidenceFocus(event,opener) {
  if(opener?.isConnected && typeof opener.focus==='function') {
    event.preventDefault();opener.focus();
  }
}
function score(value) {
  if(!['string','number'].includes(typeof value) || !/^\d+$/.test(String(value).trim()) || !Number.isSafeInteger(Number(value)))return null;
  return Number(value);
}
export function disputeEvidence(match) {
  const sheets=[];
  for(const kind of ['proposal','dispute'])for(const side of ['home','away']) {
    const key=`${side}_${kind==='proposal'?'submission':'dispute_submission'}`,raw=match[key];
    let value=null,status=raw==null || raw===''?'missing':'recorded';
    if(status==='recorded') {
      try {value=typeof raw==='string'?JSON.parse(raw):raw;if(!value || typeof value!=='object' || Array.isArray(value))throw Error('Invalid submission');}
      catch {status='unreadable';value=null;}
    }
    const home=score(value?.home_score),away=score(value?.away_score),date=['string','number'].includes(typeof value?.submitted_at)?new Date(value.submitted_at):null;
    sheets.push({key,kind,side,status,score:home!==null && away!==null?`${home} – ${away}`:null,
      claim:value,proof:evidenceLink(value?.proof_url),invalidProof:!!value?.proof_url && !evidenceLink(value.proof_url),
      explanation:typeof value?.explanation==='string'?value.explanation.trim():'',
      submittedAt:date && Number.isFinite(date.getTime())?date.toISOString():null});
  }
  return {sheets,attachments:['proof_url','forfeit_proof_url'].filter(key=>match[key]).map(key=>({key,label:key==='proof_url'?'Match attachment':'Forfeit attachment',url:evidenceLink(match[key])}))};
}

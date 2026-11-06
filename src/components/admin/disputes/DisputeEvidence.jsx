import { disputeEvidence } from '@/lib/adminDisputeEvidence';
import { penaltyOutcome } from '@/lib/penaltyOutcome';

export default function DisputeEvidence({match,onPreview}) {
  const {sheets,attachments}=disputeEvidence(match);
  const name=side=>match[`${side}_club_name`] || match[`${side}_player_name`] || (side==='home'?'Home':'Away');
  const penalty=sheet=>penaltyOutcome({status:'disputed',home_club_name:name('home'),away_club_name:name('away'),decided_on_penalties:sheet.claim?.decided_on_penalties,penalty_winner_side:sheet.claim?.penalty_winner_side});
  function proof(url,label) {
    if(!url)return <p className="text-xs text-muted-foreground">Stored attachment link is unavailable.</p>;
    return onPreview?<button type="button" onClick={event=>onPreview({url,label,opener:event.currentTarget})} className="min-h-11 text-left text-sm font-semibold">View screenshot →</button>:<a href={url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-sm font-semibold">Open screenshot →</a>;
  }
  return <section aria-label="Stored result proposals and dispute evidence" className="space-y-3">
    <p className="text-xs text-muted-foreground">Stored claims and evidence are shown separately. They are not an approved result.</p>
    <div className="grid gap-3 sm:grid-cols-2">{sheets.map(sheet=><div key={sheet.key} className="min-w-0 border border-border p-3 text-sm">
      <h4 className="font-semibold">{name(sheet.side)} · {sheet.kind==='proposal'?'Original proposal':'Dispute evidence'}</h4>
      {sheet.status==='missing'?<p className="mt-2 text-muted-foreground">Not submitted.</p>:sheet.status==='unreadable'?<p role="status" className="mt-2 text-muted-foreground">This stored submission could not be read. Review the match record before deciding.</p>:<>
        <p className="mt-2">Claimed score (home – away): <strong>{sheet.score || 'Not recorded or invalid'}</strong></p>
        {penalty(sheet) && <p className="mt-1 text-xs">{penalty(sheet)}</p>}
        {sheet.explanation && <p className="mt-2 whitespace-pre-wrap break-words">{sheet.explanation}</p>}
        <p className="mt-2 text-xs text-muted-foreground">Submitted: {sheet.submittedAt?new Date(sheet.submittedAt).toLocaleString():'Not recorded'}</p>
        {sheet.proof?proof(sheet.proof,`${name(sheet.side)} · ${sheet.kind==='proposal'?'Original proposal':'Dispute evidence'}`):sheet.invalidProof?proof(null,''):<p className="mt-2 text-xs text-muted-foreground">No screenshot attached to this submission.</p>}
      </>}
    </div>)}</div>
    {attachments.length>0 && <div className="space-y-2 border-t border-border pt-3">{attachments.map(item=><div key={item.key}><p className="text-xs text-muted-foreground">{item.label}</p>{proof(item.url,item.label)}</div>)}</div>}
  </section>;
}

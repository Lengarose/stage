import { useEffect, useState } from 'react';
import { stageClient } from '@/api/stageClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function TournamentWithdrawalPanel({ tournament, clubId, onChanged }) {
  const [data, setData] = useState(null), [error, setError] = useState(''), [revision, setRevision] = useState(0), [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState(null), [reason, setReason] = useState('');
  useEffect(() => {
    let active = true; setData(null); setError('');
    stageClient.http.get(`/tournaments/${encodeURIComponent(tournament.id)}/withdrawals?${new URLSearchParams({ club_id: clubId || '' })}`).then(result => { if (active) setData(result); }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [tournament.id, tournament.updated_date, clubId, revision]);
  function open(value) { setDialog(value); setReason(''); setError(''); }
  async function submit() {
    setBusy(true); setError('');
    try {
      const base = `/tournaments/${encodeURIComponent(tournament.id)}/withdrawals`;
      await stageClient.http.post(dialog.request ? `${base}/${encodeURIComponent(dialog.request.id)}/respond` : base, dialog.request ? { action: dialog.action, reason } : { club_id: clubId, reason });
      setDialog(null); setRevision(n => n + 1); onChanged?.();
    } catch(e) { setError(e.message); } finally { setBusy(false); }
  }
  const ownRequest = data?.requests.find(r => r.club_id === clubId && ['pending', 'approved'].includes(r.status));
  const actionable = data?.can_act && !data.withdrawn && (data.registered || data.pending_entry) && data.policy.mode !== 'closed';
  return <section className="mx-auto max-w-7xl border-b border-border px-4 py-4 lg:px-8">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <details className="max-w-3xl"><summary className="min-h-11 cursor-pointer py-2 text-sm font-bold">Withdrawal rules</summary>
        <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          <li>Before the draw and first scheduled kickoff, the Manager can withdraw immediately. Recorded entry charges are refunded to the original payer; uncertain legacy payments require organizer review.</li>
          <li>After fixtures are drawn, send a withdrawal request with a reason. The organizer must approve or decline it. Your entry and fixtures remain in force while the request is pending.</li>
          <li>Once play has started, withdrawal still requires a decision. There is no automatic refund and no deletion of played results. Approved withdrawals require an explicit sporting resolution before qualification resumes.</li>
          <li>Financial exceptions are separate explicit decisions. An approval does not silently create forfeits, replacements or a new draw.</li>
        </ul>
      </details>
      {actionable && !ownRequest && <button type="button" className="min-h-11 border border-red-300/35 px-4 text-sm text-red-200 hover:bg-red-400/10" onClick={() => open({ action: data.policy.mode })}>{data.policy.mode === 'immediate' ? 'Withdraw club' : 'Request withdrawal'}</button>}
      {ownRequest && <p className="text-sm text-muted-foreground">{ownRequest.status === 'pending' ? 'Withdrawal request awaiting organizer decision.' : 'Withdrawal approved — sporting resolution required.'}</p>}
    </div>
    {data?.organizer && data.requests.length > 0 && <details className="border-t border-border"><summary className="min-h-11 cursor-pointer py-2 font-bold">Manage withdrawal requests · {data.requests.length}</summary>
      {data.requests.map(r => <div key={r.id} className="space-y-2 border-t border-border py-3 text-sm"><p className="font-bold">{r.club_name} · {r.status.replaceAll('_', ' ')}</p><p>{r.reason || 'Manager withdrawal before the draw.'}</p>{r.decision_reason && <p>{r.decision_reason}</p>}
        {r.status === 'pending' && ['approve', 'decline'].map(action => <button key={action} type="button" className="mr-4 min-h-11 font-bold text-white" onClick={() => open({ request: r, action })}>{action === 'approve' ? 'Approve withdrawal' : 'Decline request'}</button>)}
        {r.status === 'approved' && <><p className="text-muted-foreground">Before play starts, an approved reserve can inherit this exact fixture slot through Manage reserves. Otherwise resolve affected fixtures and qualification through the existing match/Admin actions. Historical results and payments remain intact.</p><button type="button" className="min-h-11 font-bold text-white" onClick={() => open({ request: r, action: 'resolve' })}>Record sporting resolution</button></>}
      </div>)}
    </details>}
    {error && !dialog && <p role="alert" className="text-sm text-destructive">{error}<button type="button" className="ml-3 min-h-11" onClick={() => setRevision(n => n + 1)}>Retry</button></p>}
    <Dialog open={Boolean(dialog)} onOpenChange={value => { if (!busy && !value) setDialog(null); }}><DialogContent className="rounded-none border-white/20 bg-[#080f1c] text-white"><DialogHeader><DialogTitle>{dialog?.request ? `${dialog.action === 'resolve' ? 'Record resolution' : dialog.action === 'approve' ? 'Approve withdrawal' : 'Decline withdrawal'} — ${dialog.request.club_name}` : data?.policy.mode === 'immediate' ? 'Withdraw your club?' : 'Request tournament withdrawal'}</DialogTitle></DialogHeader>
      <p className="text-sm text-muted-foreground">{dialog?.request ? dialog.action === 'approve' ? 'Approval does not refund money or erase results. Sporting progression pauses until affected fixtures and qualification are explicitly resolved.' : dialog.action === 'resolve' ? 'Record what was decided. All affected fixtures must already be resolved, and the withdrawn club cannot qualify or win.' : 'The club remains entered under the accepted schedule and rules.' : data?.policy.mode === 'immediate' ? 'Your club will leave this tournament. Recorded entry STC returns to the club and entry credits return to the user who paid. This does not delete your club.' : 'Your club remains entered until the organizer decides. There is no automatic refund or change to results.'}</p>
      <label className="text-sm">Reason {dialog?.action === 'immediate' ? '(optional)' : '(required)'}<textarea className="mt-2 min-h-24 w-full border border-border bg-background p-3" maxLength={2000} value={reason} onChange={e => setReason(e.target.value)} /></label>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <button type="button" disabled={busy || (dialog?.action !== 'immediate' && !reason.trim())} onClick={submit} className="min-h-11 bg-cyan-400 px-4 font-bold text-black disabled:opacity-40">{busy ? 'Saving…' : 'Confirm'}</button>
    </DialogContent></Dialog>
  </section>;
}

import { useState } from 'react';
import { stageClient } from '@/api/stageClient';

export default function RegionalCupLifecyclePanel({ editions = [], onChanged }) {
  const [id, setId] = useState('');
  const [preview, setPreview] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const edition = editions.find(e => e.id === id);
  async function run(apply = false) {
    if (!edition || busy) return;
    setBusy(true); setError('');
    try {
      const data = await stageClient.http.post(`/regional-leagues/cups/${encodeURIComponent(id)}/lifecycle`, { action: edition.status === 'draft' ? 'activate' : 'advance', apply, reason, expected_revision: preview?.revision });
      if (apply) { setResult(data); setPreview(null); setConfirmed(false); await onChanged?.(); }
      else { setPreview(data); setConfirmed(false); setResult(null); }
    } catch (err) { setError(err.message); setPreview(null); setConfirmed(false); }
    finally { setBusy(false); }
  }
  return <section className="space-y-3 border-t border-border pt-5 text-sm">
    <h5 className="font-semibold">Cup activation and official progress</h5>
    <p>Activation adds real matches to GameDay and the regional calendar. Each next round is drawn automatically once all results are confirmed. Conflicts or changes to processed results require review. After the final, payment and trophy processing follows; any blockers appear in Cup rewards below.</p>
    <fieldset disabled={busy} className="space-y-3">
      <label className="block">Cup edition<select value={id} onChange={e => { setId(e.target.value); setPreview(null); setConfirmed(false); setResult(null); setError(''); }} className="min-h-11 w-full border border-border bg-background px-3"><option value="">Choose an edition</option>{editions.filter(e => ['draft', 'running', 'completed'].includes(e.status)).map(e => <option key={e.id} value={e.id}>{e.name} · season {e.season_number} · {e.status}</option>)}</select></label>
      <button type="button" disabled={!id} onClick={() => run()} className="min-h-11 font-semibold disabled:opacity-40">{edition?.status === 'draft' ? 'Review activation' : 'Review official results and progress'} →</button>
      {preview && <div className="space-y-3 border-l border-border pl-3">
        <p role="status">{preview.status}{preview.next_round && ` · next round ${preview.next_round}`}{preview.next_kickoff && ` · ${preview.next_kickoff} Europe/Brussels`}</p>
        {preview.blockers?.map(message => <p key={message} role="alert" className="text-warning">{message}</p>)}
        {!!preview.revision && <>
          <label className="block">Reason<input value={reason} onChange={e => { setReason(e.target.value); setConfirmed(false); }} className="min-h-11 w-full border border-border bg-background px-3" /></label>
          <label className="flex gap-2"><input type="checkbox" checked={confirmed} disabled={!!preview.blockers?.length} onChange={e => setConfirmed(e.target.checked)} />I have reviewed the participants, draw, calendar and participation conditions.</label>
          <button type="button" disabled={!confirmed || !reason.trim() || !!preview.blockers?.length} onClick={() => run(true)} className="min-h-11 font-semibold disabled:opacity-40">{edition?.status === 'draft' ? 'Activate Cup' : 'Process progress'} →</button>
        </>}
      </div>}
      {result && <p role="status">Cup edition updated: {result.status}{result.current_round && ` · round ${result.current_round}`}. <a href={`/regional-cups?edition=${encodeURIComponent(id)}`} className="font-semibold underline">Open Cup page</a></p>}
    </fieldset>
    {error && <p role="alert" className="text-destructive">{error}</p>}
  </section>;
}

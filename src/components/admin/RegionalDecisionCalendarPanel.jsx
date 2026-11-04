import { useState } from 'react';
import { stageClient } from '@/api/stageClient';

export default function RegionalDecisionCalendarPanel({ cycleId }) {
  const [dates, setDates] = useState(['', '', '']);
  const [preview, setPreview] = useState(null);
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function run(apply = false) {
    setBusy(true); setError('');
    try {
      const round_slots = dates.flatMap((date, index) => date ? [{ round: index + 1, date }] : []);
      const report = await stageClient.http.post(`/regional-leagues/cycles/${encodeURIComponent(cycleId)}/decision-calendar`, { round_slots, apply, reason, fixture_ids: preview?.fixture_ids, expected_revision: preview?.revision });
      setPreview(report); setConfirmed(false);
    } catch (err) { setError(err.message); setPreview(null); setConfirmed(false); }
    finally { setBusy(false); }
  }
  return <section className="space-y-3 border-t border-border pt-4 text-sm">
    <h5 className="font-semibold">Additional sporting decision calendar</h5>
    <p>Reconcile official results and the recorded draw first. Select only the rounds that still need scheduling: one round for two clubs, up to three for a mini-league. Times below use Europe/Brussels. This does not choose winners or new opponents.</p>
    <fieldset disabled={busy} className="space-y-3">
      <div className="grid gap-3 md:grid-cols-3">{dates.map((date, index) => <label key={index}>Round {index + 1}<input type="datetime-local" value={date} className="min-h-11 w-full border border-border bg-background px-2" onChange={e => { setDates(dates.map((old, i) => i === index ? e.target.value : old)); setPreview(null); setConfirmed(false); }} /></label>)}</div>
      <button type="button" disabled={!dates.some(Boolean)} onClick={() => run()} className="min-h-11 font-semibold disabled:opacity-40">Review schedule →</button>
      {preview && <div className="space-y-3">
        <p role="status">{preview.status === 'published' ? 'Sporting decision matches published.' : 'Preview only; nothing published yet.'}</p>
        <ul>{preview.entries.map(e => <li key={e.id}>{e.ref} · {e.scheduled_date} · {e.minutes} minutes</li>)}</ul>
        {preview.blockers.map(message => <p key={message} role="alert" className="text-warning">{message}</p>)}
        {!preview.already_published && preview.status !== 'published' && <>
          <label className="block">Reason<input value={reason} onChange={e => { setReason(e.target.value); setConfirmed(false); }} className="min-h-11 w-full border border-border bg-background px-3" /></label>
          <label className="flex gap-2"><input type="checkbox" checked={confirmed} disabled={!!preview.blockers.length} onChange={e => setConfirmed(e.target.checked)} />I have reviewed the rounds, kickoffs and conflicts.</label>
          <button type="button" disabled={!confirmed || !reason.trim() || !!preview.blockers.length} onClick={() => run(true)} className="min-h-11 font-semibold disabled:opacity-40">Publish sporting decision calendar →</button>
        </>}
      </div>}
    </fieldset>
    {error && <p role="alert" className="text-destructive">{error}</p>}
  </section>;
}

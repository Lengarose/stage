import { useState } from 'react';
import { stageClient } from '@/api/stageClient';
import { swalConfirm } from '@/lib/swal';

export default function RegionalEditionReview({ onApplied }) {
  const [diagnostic, setDiagnostic] = useState(null);
  const [source, setSource] = useState('');
  const [canonical, setCanonical] = useState('');
  const [preview, setPreview] = useState(null);
  const [reason, setReason] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function run(task) {
    setBusy(true); setError('');
    try { await task(); } catch (err) { setError(err.message || 'Review failed. No repair was confirmed.'); }
    finally { setBusy(false); }
  }
  async function apply() {
    if (!await swalConfirm(`Remove only unused record ${source} and retain ${canonical}? Results, payouts and honours will not be merged.`)) return;
    await run(async () => {
      const result = await stageClient.http.post('/regional-leagues/edition-review', { apply: true, source_id: source, canonical_id: canonical, expected_revision: preview.revision, reason });
      setPreview(result);
      setDiagnostic(await stageClient.http.get('/regional-leagues/edition-review'));
      await onApplied?.(result);
    });
  }
  const label = item => item ? `${item.record.name || item.record.slug} | ${item.identity?.region_slug || 'Unknown region'} | Div ${item.record.division ?? '?'} | Season ${item.record.season_number ?? '?'} | ${item.record.platform || 'Unspecified platform'} | ${item.id}` : 'Record no longer in the current list';
  return <section className="space-y-3 border-y border-border py-5">
    <h4 className="font-heading text-lg">Regional Edition Identity Review</h4>
    <button type="button" disabled={busy} onClick={() => run(async () => { setDiagnostic(await stageClient.http.get('/regional-leagues/edition-review')); setPreview(null); })} className="text-primary font-bold">{busy ? 'Loading...' : 'Review identities (read only)'}</button>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {diagnostic && <>
      <p className="text-sm">{diagnostic.records.length} records; {diagnostic.conflicts.length} unresolved logical identity groups. No records changed.</p>
      <details><summary className="cursor-pointer text-sm">Raw identity comparison</summary><pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(diagnostic, null, 2)}</pre></details>
      <label className="block text-sm">Duplicate source to review<select className="block w-full min-w-0 border bg-background p-2" value={source} disabled={busy} onChange={event => { setSource(event.target.value); setPreview(null); setConfirmation(''); }}><option value="">Select an explicit record</option>{diagnostic.records.map(item => <option key={item.id} value={item.id}>{label(item)}</option>)}</select></label>
      <label className="block text-sm">Canonical record to retain<select className="block w-full min-w-0 border bg-background p-2" value={canonical} disabled={busy} onChange={event => { setCanonical(event.target.value); setPreview(null); setConfirmation(''); }}><option value="">Select after inspecting the records</option>{diagnostic.records.map(item => <option key={item.id} value={item.id}>{label(item)}</option>)}</select></label>
      {source && <p className="break-all text-xs">Source: {label(diagnostic.records.find(item => item.id === source))}</p>}
      {canonical && <p className="break-all text-xs">Retain: {label(diagnostic.records.find(item => item.id === canonical))}</p>}
      <button type="button" className="text-primary font-bold" disabled={busy || !source || !canonical || source === canonical} onClick={() => run(async () => setPreview(await stageClient.http.post('/regional-leagues/edition-review', { source_id: source, canonical_id: canonical })))}>Preview dependencies and proposed repair</button>
    </>}
    {preview && <>
      <p role="status">{preview.applied || preview.already_applied ? 'Repair recorded. No financial or trophy mutations performed.' : preview.blockers.length ? 'Repair blocked: dependent history or incomplete evidence requires manual resolution.' : 'Unused duplicate removal proposed. Nothing has been applied.'}</p>
      <details open><summary>Dependency inventory and exact changes</summary><pre className="max-h-96 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(preview, null, 2)}</pre></details>
      {!preview.blockers.length && !preview.applied && !preview.already_applied && <>
        <label className="block text-sm">Review reason<input className="block w-full border bg-background p-2" disabled={busy} value={reason} onChange={event => setReason(event.target.value)} /></label>
        <label className="block text-sm">Confirm source ID<input className="block w-full border bg-background p-2" disabled={busy} value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label>
        <button type="button" disabled={busy || confirmation !== source || !reason.trim()} onClick={apply} className="border border-destructive p-2 text-destructive disabled:opacity-50">Apply reviewed unused-record removal</button>
      </>}
    </>}
  </section>;
}

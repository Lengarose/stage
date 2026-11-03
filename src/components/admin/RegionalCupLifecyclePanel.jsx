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
    <h5 className="font-semibold">Beker activeren en officiële voortgang</h5>
    <p>Na activering verschijnen echte duels in GameDay en de regionale kalender. Iedere volgende ronde wordt automatisch geloot na alle bevestigde resultaten. Bij conflicten of gewijzigde verwerkte uitslagen is controle nodig. Na de finale volgt de bestaande betalings- en trofeecontrole; eventuele blokkades zijn hieronder bij Bekerprijzen zichtbaar.</p>
    <fieldset disabled={busy} className="space-y-3">
      <label className="block">Bekereditie<select value={id} onChange={e => { setId(e.target.value); setPreview(null); setConfirmed(false); setResult(null); setError(''); }} className="min-h-11 w-full border border-border bg-background px-3"><option value="">Kies een editie</option>{editions.filter(e => ['draft', 'running', 'completed'].includes(e.status)).map(e => <option key={e.id} value={e.id}>{e.name} · seizoen {e.season_number} · {e.status}</option>)}</select></label>
      <button type="button" disabled={!id} onClick={() => run()} className="min-h-11 font-semibold disabled:opacity-40">{edition?.status === 'draft' ? 'Activering controleren' : 'Officiële resultaten en voortgang controleren'} →</button>
      {preview && <div className="space-y-3 border-l border-border pl-3">
        <p role="status">{preview.status}{preview.next_round && ` · volgende ronde ${preview.next_round}`}{preview.next_kickoff && ` · ${preview.next_kickoff} Europe/Brussels`}</p>
        {preview.blockers?.map(message => <p key={message} role="alert" className="text-warning">{message}</p>)}
        {!!preview.revision && <>
          <label className="block">Reden<input value={reason} onChange={e => { setReason(e.target.value); setConfirmed(false); }} className="min-h-11 w-full border border-border bg-background px-3" /></label>
          <label className="flex gap-2"><input type="checkbox" checked={confirmed} disabled={!!preview.blockers?.length} onChange={e => setConfirmed(e.target.checked)} />Ik heb deelnemers, loting, kalender en deelnamevoorwaarden gecontroleerd.</label>
          <button type="button" disabled={!confirmed || !reason.trim() || !!preview.blockers?.length} onClick={() => run(true)} className="min-h-11 font-semibold disabled:opacity-40">{edition?.status === 'draft' ? 'Beker activeren' : 'Voortgang verwerken'} →</button>
        </>}
      </div>}
      {result && <p role="status">Bekereditie bijgewerkt: {result.status}{result.current_round && ` · ronde ${result.current_round}`}. <a href={`/regional-cups?edition=${encodeURIComponent(id)}`} className="font-semibold underline">Bekerpagina openen</a></p>}
    </fieldset>
    {error && <p role="alert" className="text-destructive">{error}</p>}
  </section>;
}

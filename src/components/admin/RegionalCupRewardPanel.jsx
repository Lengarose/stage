import { useEffect, useState } from 'react';
import { stageClient } from '@/api/stageClient';

export default function RegionalCupRewardPanel({ editions = null, onChanged }) {
  const [loaded, setLoaded] = useState([]);
  const [refresh, setRefresh] = useState(0);
  const [id, setId] = useState('');
  const [report, setReport] = useState(null);
  const [reason, setReason] = useState('');
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (editions) return;
    let active = true;
    stageClient.http.get('/regional-leagues/cups').then(data => { if (active) { setLoaded(data.editions); setError(''); } }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [editions, refresh]);
  async function run(action, apply = false) {
    setBusy(true); setError('');
    try {
      const data = await stageClient.http.post(`/regional-leagues/cups/${encodeURIComponent(id)}/rewards`, { action, apply, reason });
      setReport({ action, data }); setChecked(false);
      if (apply) { await onChanged?.(); if (!editions) setRefresh(v => v + 1); }
    } catch (err) { setError(err.message); setReport(null); setChecked(false); }
    finally { setBusy(false); }
  }
  const data = report?.data;
  return <section className="space-y-3 border-t border-border pt-5 text-sm">
    <h5 className="font-semibold">Bekerprijzen en trofee-uitreiking</h5>
    <p>STAGE financiert 7.000.000 STC voor de winnaar en 3.000.000 STC voor de finalist. Geen derdeplaatsprijs of extra bekerinschrijfgeld. Nieuwe edities bewaren de afspraken vooraf; bestaande edities zonder afspraken vereisen expliciete controle.</p>
    <fieldset disabled={busy} className="space-y-3">
      <label className="block">Bekereditie<select value={id} onChange={e => { setId(e.target.value); setReport(null); setChecked(false); setError(''); }} className="min-h-11 w-full border border-border bg-background px-3"><option value="">Kies een editie</option>{(editions || loaded).map(e => <option key={e.id} value={e.id}>{e.name} · seizoen {e.season_number} · {e.status}</option>)}</select></label>
      {!editions && <button type="button" className="min-h-11" onClick={() => setRefresh(v => v + 1)}>Bekeredities opnieuw laden</button>}
      <div className="flex flex-wrap gap-5"><button type="button" disabled={!id} className="min-h-11 font-semibold disabled:opacity-40" onClick={() => run('review')}>Betalingen en trofee controleren →</button><button type="button" disabled={!id} className="min-h-11 disabled:opacity-40" onClick={() => run('adopt')}>Prijsafspraken voor bestaande editie bekijken →</button></div>
      {data && <div className="space-y-3 border-l border-border pl-3">
        {report.action === 'review' ? <>
          <p role="status">Betalingen: {data.state} · trofee: {data.trophy_state || 'pending'}</p>
          {data.blocking_reasons?.map(message => <p key={message} className="text-warning">{message}</p>)}
          {data.obligations?.map(o => <p key={o.key}>{o.recipient_name || 'Nog niet beslist'} · {o.expected_amount} STC · bewezen betaald {o.proven_payment} · ontbreekt {o.missing_amount}{o.blocking_reasons?.length ? ` · ${o.blocking_reasons.join('; ')}` : ''}</p>)}
        </> : <p>Voorgestelde afspraken: {data.proposed?.budget} STC totaal. Dit legt nieuwe, gecontroleerde afspraken vast; het bewijst geen historische belofte. Bestaand betalingsbewijs blokkeert vervanging.</p>}
        {data.trophy_error && <p className="text-warning">{data.trophy_error}</p>}
        <label className="block">Reden<input value={reason} onChange={e => { setReason(e.target.value); setChecked(false); }} className="min-h-11 w-full border border-border bg-background px-3" /></label>
        <label className="flex gap-2"><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} />Ik heb editie, afspraken en bewijs gecontroleerd.</label>
        <button type="button" disabled={!checked || !reason.trim() || !data.dry_run} className="min-h-11 font-semibold disabled:opacity-40" onClick={() => run(report.action, true)}>{report.action === 'adopt' ? 'Gecontroleerde prijsafspraken vastleggen' : 'Bewezen ontbrekende prijzen en trofee verwerken'} →</button>
      </div>}
    </fieldset>
    {error && <p role="alert" className="text-destructive">{error}</p>}
  </section>;
}

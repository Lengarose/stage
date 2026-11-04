import { useState } from 'react';
import { stageClient } from '@/api/stageClient';
import { adminEndpointError } from '@/lib/adminLeagueLifecycle';

export default function RegionalRegistrationPanel({ definitions = [], leagues = [] }) {
  const [form, setForm] = useState({ permanent_league_id: '', season_number: 1, reset_series: 0, opens_at: '', rules_text: '', reason: '', include_cup: true });
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const input = 'min-h-11 w-full border border-border bg-background px-3 text-sm';
  function change(key, value) { setForm(previous => ({ ...previous, [key]: value })); setPreview(null); setSaved(false); setError(''); }
  async function submit(apply = false) {
    setBusy(true); setError('');
    try {
      const result = await stageClient.http.post('/regional-leagues/registration-windows', apply ? { ...preview.request, apply: true, expected_revision: preview.report.revision } : { ...form, opens_at: new Date(form.opens_at).toISOString() });
      if (apply) { setSaved(true); setPreview(null); }
      else setPreview({ request: { ...form, opens_at: new Date(form.opens_at).toISOString() }, report: result });
    } catch (err) { setError(adminEndpointError(err)); }
    finally { setBusy(false); }
  }
  return <section className="space-y-4 border-y border-border py-5">
    <h4 className="font-heading text-lg">Regional registration periods</h4>
    <p className="max-w-3xl text-sm text-muted-foreground">Publish one period per region, platform and edition: four weeks to register, followed by one shared confirmation week. Clubs choose a region; sporting placement determines the division. Started editions keep their current rules. No date opens automatically.</p>
    <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm">Regional system<select className={input} value={form.permanent_league_id} onChange={e => {
        const definition = definitions.find(d => d.id === e.target.value);
        const current = leagues.find(l => (l.permanent_league_id || l.id) === definition?.id && (l.group_code || 'A') === 'A') || definition;
        setForm(previous => ({ ...previous, permanent_league_id: e.target.value, season_number: current?.season_number || 1, reset_series: current?.reset_series || 0 })); setPreview(null); setSaved(false);
      }}><option value="">Choose a regional system</option>{definitions.filter(d => Number(d.division) === 1 && !d.retired).map(d => <option key={d.id} value={d.id}>{d.region_slug} · {d.platform}</option>)}</select></label>
      <label className="text-sm">Target season<input type="number" min="1" className={input} value={form.season_number} onChange={e => change('season_number', Number(e.target.value))} /></label>
      <label className="text-sm">Reset series<input type="number" min="0" className={input} value={form.reset_series} onChange={e => change('reset_series', Number(e.target.value))} /></label>
      <label className="text-sm">Registration opens (your local time)<input type="datetime-local" className={input} value={form.opens_at} onChange={e => change('opens_at', e.target.value)} /></label>
      <label className="flex gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={form.include_cup} onChange={e => change('include_cup', e.target.checked)} />Include Regional Cup entry in these new participation conditions. The server appends the confirmed Cup rules; existing registration periods stay unchanged.</label>
      <label className="text-sm sm:col-span-2">Published edition rules<textarea className={`${input} min-h-28 py-3`} value={form.rules_text} onChange={e => change('rules_text', e.target.value)} /></label>
      <label className="text-sm sm:col-span-2">Administrative reason<input className={input} value={form.reason} onChange={e => change('reason', e.target.value)} /></label>
      <button type="button" disabled={!form.permanent_league_id || !form.opens_at || !form.rules_text.trim() || !form.reason.trim()} className="min-h-11 text-left font-semibold disabled:opacity-40" onClick={() => submit()}>Preview registration dates and conditions →</button>
      {preview && <div className="space-y-2 border-l border-border pl-4 text-sm sm:col-span-2">
        <p>Registration opens: {new Date(preview.report.window.opens_at).toLocaleString()}</p>
        <p>Registration closes / confirmation opens: {new Date(preview.report.window.registration_closes_at).toLocaleString()}</p>
        <p>Shared confirmation deadline: {new Date(preview.report.window.confirmation_closes_at).toLocaleString()}</p>
        <p>Registering president: personal Plus. Confirmation: at least three eligible Plus players. ANY allowed; no goalkeeper requirement. Published conditions cannot be edited through this form.</p>
        <details><summary className="min-h-11 cursor-pointer py-3 font-semibold">Full conditions to be published</summary><p className="whitespace-pre-wrap py-3">{preview.report.window.rules_text}</p></details>
        <button type="button" className="min-h-11 font-semibold" onClick={() => submit(true)}>Confirm and publish these conditions →</button>
      </div>}
    </fieldset>
    {busy && <p role="status" className="text-sm">Checking registration conditions…</p>}
    {saved && <p role="status" className="text-sm">Registration period published. No clubs, groups, fixtures or payments were created.</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>;
}

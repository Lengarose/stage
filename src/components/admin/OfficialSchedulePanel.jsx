import { useState } from 'react';
import { Link } from 'react-router-dom';
import { stageClient } from '@/api/stageClient';
import { useTranslation } from '@/hooks/useTranslation';

export default function OfficialSchedulePanel() {
  const { t } = useTranslation();
  const [ref, setRef] = useState('');
  const [date, setDate] = useState('');
  const [timezone, setTimezone] = useState('Europe/Brussels');
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const input = 'min-h-11 w-full border border-border bg-background px-3 text-sm';
  function edit(setter, value) { setter(value); setConfirmed(false); setResult(null); setError(''); }
  async function save(event) {
    event.preventDefault(); if (!confirmed || busy) return;
    setBusy(true); setError(''); setResult(null);
    try {
      setResult(await stageClient.http.post('/fixture-admin-actions/force-schedule', { fixture_id: ref.trim(), fixture_type: 'regional_league', official_only: true, date, timezone: timezone.trim(), admin_note: reason.trim() }));
      setConfirmed(false);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <section className="space-y-3 border-y border-border py-5">
    <h4 className="font-heading text-lg">{t('commonPages.adminOfficialSchedule', 'Official regional calendar')}</h4>
    <p className="max-w-3xl text-sm text-muted-foreground">{t('commonPages.adminOfficialScheduleInfo', 'Schedule one new official regional or pathway match. The fixture, engine and GameDay time are saved together. A changed time requires fresh selection publication and readiness. This does not generate a complete season calendar.')}</p>
    <form onSubmit={save} className="space-y-3">
      <fieldset disabled={busy} className="grid gap-3 md:grid-cols-2">
        <label className="text-sm">{t('commonPages.adminOfficialReference', 'Fixture or GameDay match ID')}<input required value={ref} onChange={e => edit(setRef, e.target.value)} className={input} /></label>
        <label className="text-sm">{t('commonPages.adminOfficialDate', 'Kickoff in the selected timezone')}<input required type="datetime-local" value={date} onChange={e => edit(setDate, e.target.value)} className={input} /></label>
        <label className="text-sm">{t('commonPages.adminOfficialZone', 'Official IANA timezone')}<input required value={timezone} onChange={e => edit(setTimezone, e.target.value)} className={input} /></label>
        <label className="text-sm">{t('commonPages.adminOfficialReason', 'Reason')}<input required value={reason} onChange={e => edit(setReason, e.target.value)} className={input} /></label>
      </fieldset>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)} />{t('commonPages.adminOfficialConfirm', 'I confirm this kickoff and understand that a changed time clears existing readiness.')}</label>
      <button type="submit" disabled={busy || !confirmed} className="min-h-11 text-sm font-semibold disabled:opacity-40">{t('commonPages.adminOfficialSave', 'Publish official kickoff')}</button>
    </form>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {result && <p role="status" className="text-sm">{result.match.scheduled_date} · {result.match.timezone} · <Link className="underline" to={`/game-day?match=${encodeURIComponent(result.match.id)}`}>{t('commonPages.adminOfficialOpen', 'Open GameDay')}</Link></p>}
  </section>;
}

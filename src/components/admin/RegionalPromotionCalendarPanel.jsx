import { useState } from 'react';
import { stageClient } from '@/api/stageClient';
import { useTranslation } from '@/hooks/useTranslation';

export default function RegionalPromotionCalendarPanel({ cycleId }) {
  const { t } = useTranslation();
  const [stage, setStage] = useState('semifinal');
  const [preview, setPreview] = useState(null);
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function run(apply = false) {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const report = await stageClient.http.post(`/regional-leagues/cycles/${encodeURIComponent(cycleId)}/calendar`, { stage, apply, reason, expected_revision: preview?.revision });
      setPreview(report); setConfirmed(false);
    } catch (err) { setPreview(null); setConfirmed(false); setError(err.message); }
    finally { setBusy(false); }
  }
  return <section className="space-y-3 border-t border-border pt-4">
    <h5 className="font-semibold">{t('commonPages.adminPromotionCalendar', 'Promotion calendar')}</h5>
    <p className="max-w-3xl text-sm text-muted-foreground">New editions with captured season automation can publish the Tuesday semifinals from final standings and the source calendar. Earlier editions retain this reviewed publication action. Once the semifinals are published, the server can schedule their final after all results are confirmed: Thursday of playing week 11 at 20:00 Europe/Brussels. Changed source evidence, calendar conflicts or an expired slot require review; no replacement time is chosen automatically.</p>
    <p className="max-w-3xl text-sm text-muted-foreground">{t('commonPages.adminPromotionCalendarInfo', 'Kickoffs follow week 11 of the published source league calendar. The sporting draw decides opponents. Reconcile official results before previewing finals. Sporting decisions, expansion duels and calendar conflicts require separate review.')}</p>
    <fieldset disabled={busy} className="space-y-3">
      <label className="block text-sm">{t('commonPages.adminPromotionStage', 'Promotion stage')}<select className="min-h-11 w-full border border-border bg-background px-3" value={stage} onChange={e => { setStage(e.target.value); setPreview(null); setConfirmed(false); setError(''); }}><option value="semifinal">{t('commonPages.adminPromotionSemifinals', 'Semifinals')}</option><option value="final">{t('commonPages.adminPromotionFinals', 'Finals')}</option></select></label>
      <button type="button" className="min-h-11 font-semibold" onClick={() => run()}>{t('commonPages.adminPromotionPreview', 'Preview promotion kickoffs')}</button>
      {preview && <div className="space-y-3">
        <p role="status">{preview.status === 'published' ? t('commonPages.adminPromotionPublished', 'Promotion kickoffs published.') : t('commonPages.adminPromotionPreviewOnly', 'Preview only; no kickoffs published.')} · {preview.timezone}</p>
        {preview.blockers?.map(message => <p key={message} role="alert" className="text-warning">{message}</p>)}
        <ul>{preview.entries.map(entry => <li key={entry.id} className="border-b border-border py-2 text-sm">{entry.ref} · {entry.scheduled_date} · {entry.timezone}</li>)}</ul>
        {!preview.already_published && preview.status !== 'published' && <>
          <label className="block text-sm">{t('commonPages.adminOfficialReason', 'Reason')}<input value={reason} onChange={e => { setReason(e.target.value); setConfirmed(false); }} className="min-h-11 w-full border border-border bg-background px-3" /></label>
          <label className="flex gap-2"><input type="checkbox" checked={confirmed} disabled={!!preview.blockers?.length || !preview.entries.length} onChange={e => setConfirmed(e.target.checked)} />{t('commonPages.adminPromotionConfirm', 'I reviewed the sporting draw, all times and calendar checks.')}</label>
          <button type="button" disabled={!confirmed || !reason.trim() || !!preview.blockers?.length || !preview.entries.length} onClick={() => run(true)} className="min-h-11 font-semibold disabled:opacity-40">{t('commonPages.adminPromotionPublish', 'Publish promotion kickoffs')}</button>
        </>}
      </div>}
    </fieldset>
    {error && <p role="alert" className="text-destructive">{error}</p>}
  </section>;
}

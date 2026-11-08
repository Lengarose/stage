import { useEffect, useRef, useState } from 'react';
import RegionalWizardSteps from './RegionalWizardSteps';
import { useSearchParams } from 'react-router-dom';
import { stageClient } from '@/api/stageClient';
import { useTranslation } from '@/hooks/useTranslation';
import { loadCycleDrawInventory, submitEditionLifecycle, adminEndpointError } from '@/lib/adminLeagueLifecycle';

export default function RegionalCalendarPanel({ leagues = [], onRefresh }) {
  const [step, setStep] = useState(0);
  const { t } = useTranslation();
  const [params,setParams]=useSearchParams();
  const cycleId=params.get('regional_calendar_cycle') || '';
  const [cycle,setCycle]=useState(null);
  const [inventory,setInventory]=useState(null);
  const [drawConfirmed,setDrawConfirmed]=useState(false);
  const [drawMessage,setDrawMessage]=useState('');
  const [cycleRefresh,setCycleRefresh]=useState(0);
  const requestVersion=useRef(0);
  const [ids, setIds] = useState([]);
  const [monday, setMonday] = useState('');
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(()=>{
    const version=++requestVersion.current;let active=true;
    setStep(0);setPreview(null);setConfirmed(false);setError('');setIds([]);setCycle(null);setInventory(null);setDrawConfirmed(false);setDrawMessage('');setMonday('');setReason('');setBusy(!!cycleId);
    if(!cycleId)return ()=>{if(requestVersion.current===version)requestVersion.current++;};
    document.getElementById('regional-calendar')?.scrollIntoView({block:'start'});
    stageClient.http.get(`/regional-leagues/cycles/${encodeURIComponent(cycleId)}`).then(async result=>{
      if(!active || requestVersion.current!==version)return;
      const saved=result.cycle,groups=saved?.allocated_groups;
      if(saved?.id!==cycleId || saved.status!=='allocated' || saved.edition_invalidated || saved.invalidated_at || !Array.isArray(groups) || !groups.length || groups.some(g=>typeof g?.id!=='string' || !g.id) || new Set(groups.map(g=>g.id)).size!==groups.length)throw Error('This cycle has no valid saved group allocation. Review the regional cycle first.');
      const checked=await loadCycleDrawInventory(stageClient,saved);
      if(!active || requestVersion.current!==version)return;
      setCycle(saved);setIds(groups.map(g=>g.id));setInventory(checked);
    }).catch(err=>{if(active && requestVersion.current===version)setError(err.message);}).finally(()=>{if(active && requestVersion.current===version)setBusy(false);});
    return ()=>{active=false;if(requestVersion.current===version)requestVersion.current++;};
  },[cycleId,cycleRefresh]);
  const eligible = leagues.filter(l => l.regional_participation_policy_version === 'regional_registration_v1' && ['in_progress', 'registration'].includes(l.status));
  const input = 'min-h-11 w-full border border-border bg-background px-3 text-sm';
  function invalidate() { setPreview(null); setConfirmed(false); setError(''); }
  async function drawGroup(edition) {
    if(busy || !drawConfirmed || !reason.trim() || !cycle)return;
    const version=requestVersion.current;
    setBusy(true);invalidate();setDrawMessage('');setDrawConfirmed(false);
    try {
      const result=await submitEditionLifecycle(stageClient,'regional_league',edition,'draw',reason,true,cycle.id);
      if(requestVersion.current!==version)return;
      setDrawMessage(`${result.fixtures_created} unscheduled fixtures created. No kickoff times were published.`);
      const fresh=await loadCycleDrawInventory(stageClient,cycle);
      if(requestVersion.current===version)setInventory(fresh);
      await onRefresh?.();
    }catch(err){if(requestVersion.current===version){setInventory(null);setError(`${adminEndpointError(err)} Refresh saved allocation before retrying; the draw may already have been saved.`);}}
    finally {if(requestVersion.current===version)setBusy(false);}
  }
  async function run(apply = false) {
    if (busy) return;
    const version=requestVersion.current;
    setBusy(true); setError('');
    try {
      const result = await stageClient.http.post('/regional-leagues/calendar', { ...(cycleId?{cycle_id:cycleId}:{edition_ids:ids}), start_monday: monday, apply, expected_revision: preview?.revision, reason });
      if(requestVersion.current===version){setPreview(result);setConfirmed(false);setStep(result.status === 'published' || result.already_published ? 2 : 1);}
    } catch (err) { if(requestVersion.current===version){setPreview(null);setConfirmed(false);setStep(0);setError(err.message);} }
    finally { if(requestVersion.current===version)setBusy(false); }
  }
  const rounds = preview ? [...new Map(preview.entries.map(e => [e.matchday, e])).values()] : [];
  return <section className="space-y-4 border-y border-border py-5">
    <RegionalWizardSteps steps={['Groups, draws & dates', 'Review & publish', 'Published']} current={step} />
    <h4 className="font-heading text-lg">{t('commonPages.adminSeasonCalendar', 'Complete regional season calendar')}</h4>
    <p className="max-w-3xl text-sm text-muted-foreground">{t('commonPages.adminSeasonCalendarInfo', 'Select every populated current group of one European regional system. Draw fixtures first. Preview 38 rounds across ten playing weeks, with overlap and club load checks. Existing schedules are preserved.')}</p>
    {step === 0 && <>
    {cycleId && <div className="space-y-2 text-sm">
      <p>Saved-cycle calendar preparation: all groups are selected from the stored allocation. Draw fixtures for every group first, then choose the first playing week and review the calendar. Nothing is published by opening this link.</p>
      {inventory && <ul className="space-y-2">{inventory.map(g=><li key={g.id}>Division {g.division} · Group {g.group_code || 'A'} · {g.status} · {g.actual_fixtures_count} fixtures{g.can_draw?<button type="button" disabled={busy || !drawConfirmed || !reason.trim()} onClick={()=>drawGroup(g)} className="ml-4 min-h-11 font-semibold disabled:opacity-40">Draw this group's fixtures →</button>:<span> · {g.actual_fixtures_count===380?'Draw stored; calendar preview checks completeness.':'Review this group before calendar publication.'}</span>}</li>)}</ul>}
      {inventory?.some(g=>g.can_draw) && <label className="flex items-start gap-2"><input type="checkbox" disabled={busy} checked={drawConfirmed} onChange={e=>setDrawConfirmed(e.target.checked)} />I confirm the selected group's home-and-away draw using its existing reward configuration. Enter a reason below. This creates fixtures, not kickoff times or payouts.</label>}
      {drawMessage && <p role="status">{drawMessage}</p>}
      <button type="button" disabled={busy} className="min-h-11 font-semibold disabled:opacity-40" onClick={()=>setCycleRefresh(v=>v+1)}>Refresh saved allocation →</button>
      <button type="button" disabled={busy} className="ml-4 min-h-11 font-semibold disabled:opacity-40" onClick={()=>{const next=new URLSearchParams(params);next.delete('regional_calendar_cycle');setParams(next);}}>Choose groups manually →</button>
    </div>}
    <fieldset disabled={busy || preview?.status === 'published'} className="space-y-3">
      <legend className="text-sm">{t('commonPages.adminSeasonGroups', 'Current official groups')}</legend>
      {!eligible.length && !cycleId && <p className="text-sm text-muted-foreground">{t('commonPages.adminSeasonNone', 'No new official groups are ready. Complete registration and placement first.')}</p>}
      {!cycleId && <div className="grid gap-2 md:grid-cols-2">{eligible.map(l => <label key={l.id} className="flex gap-2 text-sm"><input type="checkbox" checked={ids.includes(l.id)} onChange={() => { invalidate(); setIds(ids.includes(l.id) ? ids.filter(id => id !== l.id) : [...ids, l.id]); }} />{l.name} · D{l.division} {l.group_code || 'A'} · {l.region_slug} · {l.season_number}</label>)}</div>}
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm">{t('commonPages.adminSeasonMonday', 'Monday of the first playing week (Europe/Brussels)')}<input type="date" required value={monday} className={input} onChange={e => { invalidate(); setMonday(e.target.value); }} /></label>
        <label className="text-sm">{t('commonPages.adminOfficialReason', 'Reason')}<input required value={reason} className={input} onChange={e => { setConfirmed(false);setDrawConfirmed(false); setReason(e.target.value); }} /></label>
      </div>
      <button type="button" disabled={!ids.length || !monday || !reason.trim() || (cycleId && !inventory)} onClick={() => run()} className="min-h-11 text-sm font-semibold disabled:opacity-40">{t('commonPages.adminSeasonPreview', 'Preview season calendar')}</button>
    </fieldset>
    </>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {step > 0 && preview && <div className="space-y-3">
      <p role="status" className="text-sm">{preview.status === 'published' || preview.already_published ? t('commonPages.adminSeasonPublished', 'Calendar already published; fixtures and GameDay matches are linked.') : t('commonPages.adminSeasonPreviewOnly', 'Preview only — nothing published yet.')} · {preview.entries.length} {t('commonPages.adminSeasonMatches', 'matches')} · {preview.timezone}</p>
      {preview.notification_summary?.version==='regional_calendar_notice_v1' && <p className="text-sm">Calendar notices: {preview.notification_summary.stored} stored · {preview.notification_summary.muted} muted by existing in-app match notification preferences. These counts do not confirm that users read the calendar.</p>}
      <p className="text-sm text-muted-foreground">{t('commonPages.adminSeasonScope', 'Club schedules are checked across existing competitions. Individual players in several events are not checked here. Weeks 11 and 12 are reserved; promotion, cup and decision fixtures are not generated by this planner. North America needs its own confirmed time profile.')}</p>
      {!!preview.blockers?.length && <ul role="alert" className="space-y-1 text-sm text-destructive">{preview.blockers.map(message => <li key={message}>{message}</li>)}</ul>}
      <details><summary className="cursor-pointer py-2 text-sm">{t('commonPages.adminSeasonRounds', 'Show all 38 round times')}</summary>
        <ol className="grid gap-x-6 gap-y-1 text-sm md:grid-cols-2">{rounds.map(round => <li key={round.matchday}>{round.matchday}. {round.scheduled_date} · {round.timezone}</li>)}</ol>
      </details>
      {!preview.already_published && preview.status !== 'published' && <>
        <button type="button" disabled={busy} className="min-h-11 text-sm font-semibold" onClick={() => { invalidate(); setStep(0); }}>← Back to groups and dates</button>
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={confirmed} disabled={busy || !!preview.blockers?.length} onChange={e => setConfirmed(e.target.checked)} />{t('commonPages.adminSeasonConfirm', 'I reviewed every group, kickoff and conflict. Publish the entire calendar together.')}</label>
        <button type="button" disabled={busy || !confirmed || !reason.trim() || !!preview.blockers?.length} onClick={() => run(true)} className="min-h-11 text-sm font-semibold disabled:opacity-40">{t('commonPages.adminSeasonPublish', 'Publish complete calendar')}</button>
      </>}
      {(preview.status === 'published' || preview.already_published) && <button type="button" onClick={() => { invalidate(); setStep(0); setIds([]); setMonday('');const next=new URLSearchParams(params);next.delete('regional_calendar_cycle');setParams(next); }} className="min-h-11 text-sm font-semibold">{t('commonPages.adminSeasonOther', 'Another regional system')}</button>}
    </div>}
  </section>;
}

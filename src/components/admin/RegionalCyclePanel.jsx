import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { stageClient } from '@/api/stageClient';
import RegionalDecisionCalendarPanel from './RegionalDecisionCalendarPanel';
import RegionalPromotionCalendarPanel from './RegionalPromotionCalendarPanel';
import { adminEndpointError } from '@/lib/adminLeagueLifecycle';

export default function RegionalCyclePanel({ leagues = [], registrations = [], onRefresh }) {
  const [params,setParams]=useSearchParams();
  const fieldWindowId=params.get('regional_field') || '';
  const [fieldRefresh,setFieldRefresh]=useState(0);
  const [mode, setMode] = useState('placement');
  const [sourceIds, setSourceIds] = useState([]);
  const [registrationIds, setRegistrationIds] = useState([]);
  const [count, setCount] = useState(40);
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState(null);
  const [cycle, setCycle] = useState(null);
  const [cycles, setCycles] = useState([]);
  const [allocation, setAllocation] = useState(null);
  const [draw, setDraw] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  useEffect(()=>{
    if(!fieldWindowId)return;
    let active=true;
    setBusy(true);setError('');setPreview(null);setConfirmed(false);setCycle(null);setDraw(null);setAllocation(null);setReason('');
    document.getElementById('regional-cycles')?.scrollIntoView({block:'start'});
    stageClient.http.post('/regional-leagues/cycles',{registration_window_id:fieldWindowId}).then(report=>{
      if(!active)return;
      setMode(report.input.mode);setSourceIds(report.input.source_edition_ids);setRegistrationIds(report.input.registration_ids);setCount(report.input.target_count);
      setPreview({request:report.input,report});
    }).catch(err=>{if(active)setError(adminEndpointError(err));}).finally(()=>{if(active)setBusy(false);});
    return ()=>{active=false;};
  },[fieldWindowId,fieldRefresh]);
  useEffect(() => {
    let active = true;
    stageClient.http.get('/regional-leagues/cycles').then(data => { if (active) setCycles(data.cycles); }).catch(err => { if (active) setError(adminEndpointError(err)); });
    return () => { active = false; };
  }, []);
  const input = 'min-h-11 w-full min-w-0 border border-border bg-background px-3 text-sm';
  const button = 'min-h-11 text-left text-sm font-semibold disabled:opacity-40';
  function invalidate() { setPreview(null); setAllocation(null); setConfirmed(false); }
  function toggle(id, values, setter) { invalidate(); setter(values.includes(id) ? values.filter(v => v !== id) : [...values, id]); }
  async function run(task) {
    setBusy(true); setError('');
    try { await task(); } catch (err) { setError(adminEndpointError(err)); invalidate(); }
    finally { setBusy(false); }
  }
  async function showCycle(record) {
    setCycle(record); setDraw(null); setAllocation(null); setPreview(null); setConfirmed(false);
    const published = await stageClient.http.get(`/regional-leagues/cycles/${encodeURIComponent(record.id)}/draw`);
    setDraw(published);
    const catalogue = await stageClient.http.get('/regional-leagues/cycles'); setCycles(catalogue.cycles);
  }
  return <section className="space-y-4 border-y border-border py-5">
    <h4 className="font-heading text-lg">Regional cycles and sporting allocation</h4>
    <p className="max-w-3xl text-sm text-muted-foreground">Prepare one recorded draw for the whole regional season. Official results decide places. For next-season transitions, finish all 380 league matches per source group first; tied finishing positions are settled before promotion play-offs. Allocation creates draft groups; the season calendar and matches must still be scheduled before play.</p>
    {fieldWindowId && <div className="space-y-2 text-sm"><p>Confirmed-field preview: the server derives the route, sources and complete participant field from the selected registration window. This does not save a draw or publish kickoff times.</p><button type="button" disabled={busy} className="min-h-11 font-semibold disabled:opacity-40" onClick={()=>setFieldRefresh(v=>v+1)}>Refresh confirmed-field preview →</button></div>}
    <fieldset disabled={busy} className="space-y-4 disabled:opacity-60">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">Route<select className={input} value={mode} onChange={e => { invalidate(); setMode(e.target.value); }}><option value="placement">First placement</option><option value="transition">Next season: promotion and growth</option></select></label>
        <label className="text-sm">Confirmed target field<select className={input} value={count} onChange={e => { invalidate(); setCount(Number(e.target.value)); }}>{[20,40,60,80,100,120,180,240].map(n => <option key={n} value={n}>{n} clubs</option>)}</select></label>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <fieldset className="min-w-0"><legend className="mb-2 text-sm font-semibold">Current source groups</legend><div className="max-h-64 overflow-y-auto">{leagues.map(league => <label key={league.id} className="flex min-h-11 items-start gap-3 py-2 text-sm"><input type="checkbox" checked={sourceIds.includes(league.id)} onChange={() => toggle(league.id, sourceIds, setSourceIds)} /><span>{league.name} · D{league.division}{league.group_code || 'A'}<span className="block text-xs text-muted-foreground">{league.region_slug} · {league.platform} · Season {league.season_number} · {league.status}</span></span></label>)}</div></fieldset>
        <fieldset className="min-w-0"><legend className="mb-2 text-sm font-semibold">Additional approved registrations</legend><p className="text-xs text-muted-foreground">Only registrations for the exact target season, region, platform and reset series qualify. Clubs already in a source group must not be selected again.</p><div className="max-h-64 overflow-y-auto">{registrations.filter(r => r.status === 'approved').map(registration => <label key={registration.id} className="flex min-h-11 items-start gap-3 py-2 text-sm"><input type="checkbox" checked={registrationIds.includes(registration.id)} onChange={() => toggle(registration.id, registrationIds, setRegistrationIds)} /><span>{registration.club_name || registration.club_id} · {registration.region_slug || registration.region}<span className="block text-xs text-muted-foreground">Season {registration.season_number || 'not set'} · {registration.platform}</span></span></label>)}</div></fieldset>
      </div>
      <label className="block text-sm">Administrative reason<input className={input} value={reason} onChange={e => { invalidate(); setReason(e.target.value); }} /></label>
      <button type="button" className={button} disabled={!sourceIds.length || !reason.trim()} onClick={() => run(async () => {
        const request = { mode, target_count: count, source_edition_ids: sourceIds, registration_ids: registrationIds, reason };
        const report = await stageClient.http.post('/regional-leagues/cycles', request);
        setPreview({ request, report }); setConfirmed(false);
      })}>Preview structure and source checks →</button>
      {preview && <div className="space-y-3 border-l border-border pl-4 text-sm">
        <p>{preview.report.confirmed_participants} confirmed clubs · {preview.report.initial_fixtures} initial pathway fixtures · Season {preview.report.season_number}</p>
        <p>{preview.report.structure.groups.map(g => g.ref).join(' · ')} · 20 clubs per final group</p>
        {preview.report.automatic_allocation && <p>Once all required sporting results are definitive, the system will allocate the earned places into draft groups automatically. Unresolved or changed evidence requires review. Kickoff times are not published by allocation.</p>}
        {preview.report.blockers.map(message => <p key={message} role="alert" className="text-destructive">{message}</p>)}
        {!preview.report.blockers.length && <><label className="flex gap-2"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />I confirm this regional field and the recorded draw. No prizes or payments are generated.</label><button type="button" className={button} disabled={!confirmed || !reason.trim()} onClick={() => run(async () => {
          const result = await stageClient.http.post('/regional-leagues/cycles', { ...preview.request, reason, apply: true, expected_revision: preview.report.revision });
          await showCycle(result.cycle); await onRefresh?.();
          if(fieldWindowId)setParams(previous=>{const next=new URLSearchParams(previous);next.delete('regional_field');return next;},{replace:true});
        })}>Save draw and create pathway fixtures →</button></>}
      </div>}
      <label className="block text-sm">Saved regional cycle<select className={input} value={cycle?.id || ''} onChange={e => run(async () => { setDraw(null); const result = await stageClient.http.get(`/regional-leagues/cycles/${encodeURIComponent(e.target.value)}`); await showCycle(result.cycle); })}><option value="" disabled>Select a saved cycle</option>{cycles.map(c => <option key={c.id} value={c.id}>{c.region_slug} · {c.platform} · Series {c.reset_series} / Season {c.season_number} · {c.status}</option>)}</select></label>
      {cycle && <div className="space-y-3 border-t border-border pt-4 text-sm">
        <p><strong>{cycle.region_slug}</strong> · {cycle.status} · {cycle.policy_version}{cycle.tie_policy_version && ` · ${cycle.tie_policy_version}`}</p>
        <p>Remaining pathway fixtures: {cycle.plan?.pending?.length || 0}. Groups and sporting rights remain provisional until allocation is confirmed.</p>
        {cycle.plan?.blockers?.map(message => <p key={message} role="status" className="text-warning">{message}</p>)}
        {cycle.plan?.unresolved_ties?.length > 0 && <div className="space-y-2 border-l border-border pl-4">
          <p className="font-semibold">Sporting decisions required</p>
          <p>These clubs remain equal after points, goal difference, goals scored and head-to-head results. No final places have been awarded. This tie requires Admin review; the automatic format cannot settle it.</p>
          <ul className="space-y-2">{cycle.plan.unresolved_ties.map(tie => <li key={`${tie.group_ref}:${tie.from_position}`}>
            <strong>{tie.group_ref}</strong> · positions {tie.from_position}–{tie.to_position} · boundary after position {tie.boundaries.join(' / ')}
            <span className="block text-muted-foreground">{tie.club_ids.map(id => {
              const fixture = draw?.fixtures.find(f => f.home_club_id === id || f.away_club_id === id);
              return (fixture?.home_club_id === id ? fixture.home_club_name : fixture?.away_club_name) || id;
            }).join(' · ')}</span>
          </li>)}</ul>
        </div>}
        {cycle.status !== 'allocated' && <div className="flex flex-wrap gap-6">
          <button type="button" className={button} onClick={() => run(async () => { const result = await stageClient.http.post(`/regional-leagues/cycles/${cycle.id}/progress`, { reason }); await showCycle(result.cycle); })}>Read official results and create the next duels →</button>
          <button type="button" className={button} onClick={() => run(async () => { const result=await stageClient.http.post(`/regional-leagues/cycles/${cycle.id}/allocate`, {}); if(result.already_applied && result.cycle){await showCycle(result.cycle);await onRefresh?.();return;}setAllocation(result);setConfirmed(false); })}>Preview final group allocation →</button>
        </div>}
        {allocation && <div className="space-y-3 border-l border-border pl-4">{allocation.blockers.map(message => <p key={message} role="status">{message}</p>)}{allocation.groups.map(g => <p key={g.ref}>{g.ref}: {g.club_ids.length} clubs</p>)}{allocation.ready && <><label className="flex gap-2"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />I confirm the final sporting rights and draft groups.</label><button type="button" className={button} disabled={!confirmed || !reason.trim()} onClick={() => run(async () => { const result = await stageClient.http.post(`/regional-leagues/cycles/${cycle.id}/allocate`, { apply: true, expected_revision: allocation.revision, reason }); await showCycle(result.cycle); await onRefresh?.(); })}>Apply final draft groups →</button></>}</div>}
        {cycle.status !== 'allocated' && <RegionalDecisionCalendarPanel key={`decisions-${cycle.id}`} cycleId={cycle.id} />}
        {cycle.input?.mode === 'transition' && <RegionalPromotionCalendarPanel key={cycle.id} cycleId={cycle.id} />}
        {draw && <details><summary className="min-h-11 cursor-pointer py-3">Published draw · {draw.fixtures.length} fixtures</summary><div className="max-h-80 overflow-y-auto">{draw.fixtures.map(f => <div key={f.id} className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-border py-3"><span>{f.home_club_name} – {f.away_club_name}<span className="block text-xs text-muted-foreground">{f.ref} · {f.status}</span></span><Link className="min-h-11 py-3 font-semibold" to={`/game-day?match=${encodeURIComponent(f.match_id)}`}>Open GAMEDAY →</Link></div>)}</div></details>}
      </div>}
    </fieldset>
    {busy && <p role="status" className="text-sm">Checking the regional cycle…</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>;
}

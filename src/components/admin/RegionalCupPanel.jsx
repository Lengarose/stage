import { useEffect, useState } from 'react';
import RegionalWizardSteps from './RegionalWizardSteps';
import RegionalCupLifecyclePanel from './RegionalCupLifecyclePanel';
import RegionalCupRewardPanel from './RegionalCupRewardPanel';
import { stageClient } from '@/api/stageClient';

export default function RegionalCupPanel({ definitions = [], initialCupId = '', initialEditionId = '', initialStep = 0 }) {
  const [step, setStep] = useState(initialStep);
  const [data, setData] = useState({ definitions: [], editions: [], calendars: [] });
  const [source, setSource] = useState('');
  const [cupId, setCupId] = useState(initialCupId);
  const [calendarId, setCalendarId] = useState('');
  const [preview, setPreview] = useState(null);
  const [assignment, setAssignment] = useState(null);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [trophyId, setTrophyId] = useState('');
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [record, setRecord] = useState(null);
  const input = 'min-h-11 w-full border border-border bg-background px-3 text-sm';
  useEffect(() => { let active = true; stageClient.http.get('/regional-leagues/cups').then(r => { if (active) setData(r); }).catch(err => { if (active) setError(err.message); }); return () => { active = false; }; }, []);
  useEffect(() => {
    let active = true;
    setAssignment(null); setTrophyId('');
    if (!cupId) { setAssignmentLoading(false); return () => { active = false; }; }
    setAssignmentLoading(true);
    stageClient.http.get(`/regional-leagues/cups/${encodeURIComponent(cupId)}/trophy`).then(result => {
      if (active) { setAssignment(result); setTrophyId(result.trophy?.id || ''); }
    }).catch(err => { if (active) setError(err.message); }).finally(() => { if (active) setAssignmentLoading(false); });
    return () => { active = false; };
  }, [cupId]);
  function reset() { setPreview(null); setRecord(null); setConfirmed(false); setError(''); }
  async function run(task) { setBusy(true); setError(''); try { await task(); } catch (err) { setError(err.message); setPreview(null); setConfirmed(false); } finally { setBusy(false); } }
  async function review(action) { reset(); const request = { action, permanent_league_id: source, cup_id: cupId, source_calendar_id: calendarId, reason }; const result = await stageClient.http.post('/regional-leagues/cups', request); setPreview({ request, report: result }); }
  return <section className="space-y-4 border-y border-border py-5">
    <RegionalWizardSteps steps={['Permanent Cup & trophy', 'Edition & calendar', 'Activation & progress', 'Rewards']} current={step} completed={[]} />
    <div className="flex flex-wrap gap-3 text-sm">{[[0, 'Prepare Cup'], [2, 'Manage existing edition'], [3, 'Review rewards']].map(([index, title]) => <button type="button" key={index} disabled={busy} className="min-h-11 rounded border border-border px-3 disabled:opacity-40" onClick={() => { reset(); setStep(index); }}>{title}</button>)}</div>
    <h4 className="font-heading text-lg">Regional Cups · preparation and progress</h4>
    <p className="max-w-3xl text-sm text-muted-foreground">One permanent Cup per region and platform, with a new draft edition each season. Select an existing catalogue trophy. Participants come from all confirmed groups, provided Cup entry was included in their accepted registration conditions.</p>
    <p className="text-sm text-warning">A draft does not start matches. Review participants and the calendar during preparation before activating the edition. Preparing a Cup does not issue prizes or GOST tickets.</p>
    {step < 2 && <fieldset disabled={busy} className="space-y-3">
      {step === 0 && <>
      <label className="block text-sm">Regional system<select className={input} value={source} onChange={e => { reset(); setSource(e.target.value); }}><option value="">Choose a system</option>{definitions.filter(d => Number(d.division) === 1 && !d.retired).map(d => <option key={d.id} value={d.id}>{d.region_slug} · {d.platform}</option>)}</select></label>
      <button type="button" disabled={!source || !reason.trim()} className="min-h-11 font-semibold disabled:opacity-40" onClick={() => run(() => review('configure'))}>Prepare permanent Cup →</button>
      </>}
      <label className="block text-sm">Cup<select className={input} value={cupId} onChange={e => { reset(); setCupId(e.target.value); setAssignment(null); }}><option value="">Choose a Cup</option>{data.definitions.map(d => <option key={d.id} value={d.id}>{d.name} · {d.platform}</option>)}</select></label>
      {step === 0 && <>
      <button type="button" disabled={!cupId} className="min-h-11 font-semibold disabled:opacity-40" onClick={() => run(async () => { const result = await stageClient.http.get(`/regional-leagues/cups/${encodeURIComponent(cupId)}/trophy`); setAssignment(result); setTrophyId(result.trophy?.id || ''); })}>View / change catalogue trophy →</button>
      {assignmentLoading && <p role="status" className="text-sm">Loading the Cup's linked trophy…</p>}
      {assignment && <div className="space-y-2 border-l border-border pl-3">
        <p className="text-xs text-muted-foreground">The trophy linked in Trophy Library is selected automatically for new Cup editions. Existing edition snapshots are preserved.</p>
        <label className="block text-sm">Trophy from Trophies<select className={input} value={trophyId} onChange={e => setTrophyId(e.target.value)}><option value="">Not assigned</option>{assignment.items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        {assignment.trophy?.image_url && <img src={assignment.trophy.image_url} alt={assignment.trophy.name} className="h-32 object-contain" />}
        <button type="button" disabled={assignmentLoading || !reason.trim()} className="min-h-11 font-semibold disabled:opacity-40" onClick={() => run(async () => { setAssignment(await stageClient.http.post(`/regional-leagues/cups/${encodeURIComponent(cupId)}/trophy`, { trophy_item_id: trophyId || null, revision: assignment.revision, reason })); reset(); })}>Save trophy assignment</button>
      </div>}
      </>}
      {step === 1 && <label className="block text-sm">Published league calendar<select className={input} value={calendarId} onChange={e => { reset(); setCalendarId(e.target.value); }}><option value="">Choose the source calendar</option>{data.calendars.map(c => <option key={c.id} value={c.id}>{c.start_monday} · {c.edition_ids.length} groups · {c.id}</option>)}</select></label>}
      <label className="block text-sm">Reason<input value={reason} className={input} onChange={e => { setReason(e.target.value); setConfirmed(false); }} /></label>
      {step === 1 && <button type="button" disabled={!cupId || !calendarId || !reason.trim()} className="min-h-11 font-semibold disabled:opacity-40" onClick={() => run(() => review('prepare'))}>Review participants and Cup calendar →</button>}
      {preview && <div className="space-y-3 border-l border-border pl-3 text-sm">
        <p>{preview.report.record.name} · {preview.report.record.participant_ids?.length || 0} clubs · {preview.report.record.status}</p>
        <ul>{preview.report.record.round_calendar?.map(r => <li key={r.round}>Round {r.round}: week {r.week} · {r.scheduled_date} · {r.timezone}</li>)}</ul>
        {preview.report.blockers.map(message => <p key={message} role="alert" className="text-warning">{message}</p>)}
        {preview.report.already_applied ? <p>This Cup edition already exists. Its recorded participants and draw are preserved.</p> : <>
          <label className="flex gap-2"><input type="checkbox" checked={confirmed} disabled={!!preview.report.blockers.length} onChange={e => setConfirmed(e.target.checked)} />I have reviewed the preparation. This does not start matches.</label>
          <button type="button" disabled={!confirmed || !reason.trim() || !!preview.report.blockers.length} className="min-h-11 font-semibold disabled:opacity-40" onClick={() => run(async () => { const result = await stageClient.http.post('/regional-leagues/cups', { ...preview.request, reason, apply: true, expected_revision: preview.report.revision }); setRecord(result.record); if (preview.request.action === 'configure') setCupId(result.record.id); setPreview(null); setConfirmed(false); setData(await stageClient.http.get('/regional-leagues/cups')); })}>{preview.request.action === 'configure' ? 'Confirm permanent Cup setup' : 'Save draft and record the first draw'} →</button>
        </>}
      </div>}
      {record && <div role="status" className="space-y-2 text-sm"><p>{record.name} · {record.status || 'setup'} saved</p>{record.first_round && <><p>{record.first_round.byes.length} byes · {record.first_round.fixtures.length} real matches in the first round</p><details><summary className="cursor-pointer py-2">View recorded draw</summary><ul>{record.first_round.byes.map(id => <li key={id}>Bye: {id}</li>)}{record.first_round.fixtures.map(f => <li key={f.home_club_id}>{f.home_club_id} – {f.away_club_id}</li>)}</ul></details></>}</div>}
      <div className="flex flex-wrap gap-5 border-t border-border pt-3">
        {step === 1 && <button type="button" className="min-h-11 text-sm" onClick={() => { reset(); setStep(0); }}>← Back to permanent Cup</button>}
        <button type="button" disabled={!cupId} className="min-h-11 font-semibold disabled:opacity-40" onClick={() => { reset(); setStep(step + 1); }}>{step === 0 ? 'Next: prepare edition and calendar' : 'Next: review activation'} →</button>
      </div>
      <button type="button" className="min-h-11 text-sm" onClick={() => run(async () => setData(await stageClient.http.get('/regional-leagues/cups')))}>Reload Cups</button>
    </fieldset>}
    {step === 2 && <RegionalCupLifecyclePanel initialEditionId={initialEditionId} editions={data.editions} onChanged={async () => setData(await stageClient.http.get('/regional-leagues/cups'))} />}
    {step === 3 && <RegionalCupRewardPanel initialEditionId={initialEditionId} editions={data.editions} onChanged={async () => setData(await stageClient.http.get('/regional-leagues/cups'))} />}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>;
}

import { useState } from 'react';
import { stageClient } from '@/api/stageClient';
import { adminEndpointError } from '@/lib/adminLeagueLifecycle';

const inputClass = 'block w-full min-w-0 border border-border bg-background p-2 text-sm';
export default function OfficialCompetitionDecisions({ definitions = [], onRefresh }) {
  const [transferReview, setTransferReview] = useState({ id: '', status: 'awaiting_club', reason: '' });
  const [absence, setAbsence] = useState({ match_id: '', absent_side: 'both', evidence_url: '', reason: '', decision_id: '' });
  const [absenceResult, setAbsenceResult] = useState(null);
  const [withdrawal, setWithdrawal] = useState({ edition: '', club: '', evidence: '', reason: '' });
  const [preview, setPreview] = useState(null);
  const [sanction, setSanction] = useState({ player_id: '', scope: 'all_official', scope_id: '', starts_at: '', ends_at: '', reason: '' });
  const [decisionId, setDecisionId] = useState(() => crypto.randomUUID());
  const [sanctions, setSanctions] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function run(task) {
    setBusy(true); setError(''); setNotice('');
    try { await task(); } catch (err) { setError(adminEndpointError(err)); } finally { setBusy(false); }
  }
  function editWithdrawal(key, value) { setWithdrawal({ ...withdrawal, [key]: value }); setPreview(null); }
  async function withdraw(apply) {
    await run(async () => {
      const result = await stageClient.http.post(`/regional-leagues/${encodeURIComponent(withdrawal.edition)}/withdraw-club`, {
        club_id: withdrawal.club, evidence_url: withdrawal.evidence, reason: withdrawal.reason,
        apply, ...(apply ? { expected_revision: preview?.revision } : {}),
      });
      if (apply) { setPreview(null); setNotice('Withdrawal applied. Review sporting rights and vacancies before the next cycle.'); await onRefresh?.(); }
      else setPreview(result);
    });
  }
  async function loadSanctions() { setSanctions(await stageClient.http.get('/regional-leagues/player-sanctions')); }
  return <section className="space-y-5 border-y border-border py-4">
    <h4 className="font-heading text-base">Official competition decisions</h4>
    <fieldset disabled={busy} className="space-y-3">
      <legend className="font-bold">Regional transfer review</legend>
      <p className="text-sm text-muted-foreground">A review cannot grant an unearned tier or displace a confirmed club. Resolve the vacancy/calendar issue, then ask the president to retry with current conditions, or reject the request.</p>
      <label className="block text-xs">Transfer request ID<input className={inputClass} value={transferReview.id} onChange={e => setTransferReview({ ...transferReview, id: e.target.value })} /></label>
      <label className="block text-xs">Review outcome<select className={inputClass} value={transferReview.status} onChange={e => setTransferReview({ ...transferReview, status: e.target.value })}><option value="awaiting_club">Return to club for a current request</option><option value="rejected">Reject this request</option></select></label>
      <label className="block text-xs">Decision reason<input className={inputClass} value={transferReview.reason} onChange={e => setTransferReview({ ...transferReview, reason: e.target.value })} /></label>
      <button type="button" disabled={!transferReview.id || !transferReview.reason.trim()} className="min-h-11 text-sm font-bold" onClick={() => run(async () => { await stageClient.http.post(`/regional-leagues/regional-transfers/${encodeURIComponent(transferReview.id)}/review`, transferReview); setNotice('Regional transfer review saved. No sporting place was forced.'); await onRefresh?.(); })}>Record transfer review</button>
    </fieldset>
    <fieldset disabled={busy} className="space-y-3">
      <legend className="font-bold">Absence evidence and review</legend>
      <p className="text-sm text-muted-foreground">Recording an absence does not award a score or exclude a club. Both clubs absent, or three confirmed absences in this edition, require Admin review.</p>
      {['match_id', 'evidence_url', 'reason', 'decision_id'].map(key => <label key={key} className="block text-xs">{({ match_id: 'Official match ID', evidence_url: 'Reviewed evidence link', reason: 'Decision reason', decision_id: 'Existing absence decision ID (to close its review)' })[key]}<input className={inputClass} value={absence[key]} onChange={e => setAbsence({ ...absence, [key]: e.target.value })} /></label>)}
      <label className="block text-xs">Recorded absent<select className={inputClass} value={absence.absent_side} onChange={e => setAbsence({ ...absence, absent_side: e.target.value })}><option value="both">Both clubs</option><option value="home">Home club</option><option value="away">Away club</option></select></label>
      <button type="button" className="min-h-10 text-sm font-bold" onClick={() => run(async () => { const result = await stageClient.http.post('/regional-leagues/absence-decisions', absence); setAbsenceResult(result.decision); setNotice('Absence evidence recorded. No score or exclusion was applied.'); await onRefresh?.(); })}>Record confirmed absence</button>
      <button type="button" className="ml-4 min-h-10 text-sm" disabled={!absence.decision_id || !absence.reason.trim()} onClick={() => run(async () => { const result = await stageClient.http.post('/regional-leagues/absence-decisions', { action: 'resolve_review', decision_id: absence.decision_id, reason: absence.reason }); setAbsenceResult(result.decision); setNotice('Absence review recorded. Match results and suspensions use their separate decision actions.'); await onRefresh?.(); })}>Close reviewed absence case</button>
      {absenceResult && <p className="break-all text-sm">Decision {absenceResult.id} · {absenceResult.status}. {absenceResult.review_club_ids?.length ? 'A club has at least three confirmed absences in this edition.' : ''}</p>}
    </fieldset>
    <fieldset disabled={busy} className="space-y-3">
      <legend className="font-bold">Club withdrawal</legend>
      <p className="text-sm text-muted-foreground">Before nineteen definitive first-half matches, all league results of this club are excluded. Afterward, the first half stays and every return becomes an administrative 3–0. The withdrawn club cannot win the title, prizes or promotion in this edition and has no guaranteed next-season place. Evidence and paid history are preserved.</p>
      <label className="block text-xs">League edition<select className={inputClass} value={withdrawal.edition} onChange={e => editWithdrawal('edition', e.target.value)}><option value="">Select current edition</option>{definitions.map(d => <option key={d.id} value={d.current_edition_id || d.id}>{d.name} · D{d.division}</option>)}</select></label>
      <label className="block text-xs">Participating club ID<input className={inputClass} value={withdrawal.club} onChange={e => editWithdrawal('club', e.target.value)} /></label>
      <label className="block text-xs">Evidence link<input className={inputClass} value={withdrawal.evidence} onChange={e => editWithdrawal('evidence', e.target.value)} /></label>
      <label className="block text-xs">Decision reason<textarea className={inputClass} value={withdrawal.reason} onChange={e => editWithdrawal('reason', e.target.value)} /></label>
      <button type="button" className="min-h-10 text-sm font-bold" disabled={!withdrawal.edition || !withdrawal.club} onClick={() => withdraw(false)}>Preview withdrawal consequences</button>
      {preview && <div className="space-y-2 text-sm"><p>{preview.mode === 'retain_first_half' ? 'Retain the first half; replace all returns with administrative results.' : 'Exclude all league results of this club.'} {preview.changes?.length || 0} fixtures affected. No individual goals or payments are generated.</p><button type="button" className="min-h-10 font-bold text-destructive" disabled={!preview.revision || !withdrawal.reason.trim() || !withdrawal.evidence.trim()} onClick={() => withdraw(true)}>Confirm this withdrawal decision</button></div>}
    </fieldset>
    <fieldset disabled={busy} className="space-y-3">
      <legend className="font-bold">Player suspensions</legend>
      <p className="text-sm text-muted-foreground">Only explicit Admin decisions apply. A suspension follows the player after a permanent transfer. No automatic card or no-show penalties are added.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs">Player ID<input className={inputClass} value={sanction.player_id} onChange={e => { setDecisionId(crypto.randomUUID()); setSanction({ ...sanction, player_id: e.target.value }); }} /></label>
        <label className="text-xs">Competition scope<select className={inputClass} value={sanction.scope} onChange={e => { setDecisionId(crypto.randomUUID()); setSanction({ ...sanction, scope: e.target.value }); }}><option value="all_official">All official competitions</option><option value="region">Regional system</option><option value="edition">Exact competition edition</option></select></label>
        {sanction.scope !== 'all_official' && <label className="text-xs">{sanction.scope === 'region' ? 'Regional system slug' : 'Edition ID'}<input className={inputClass} value={sanction.scope_id} onChange={e => { setDecisionId(crypto.randomUUID()); setSanction({ ...sanction, scope_id: e.target.value }); }} /></label>}
        {['starts_at', 'ends_at', 'reason'].map(key => <label key={key} className="text-xs">{key === 'starts_at' ? 'Starts at (ISO date with timezone)' : key === 'ends_at' ? 'Ends at (ISO date with timezone)' : 'Decision reason'}<input className={inputClass} value={sanction[key]} placeholder={key === 'reason' ? '' : '2026-11-10T20:00:00+01:00'} onChange={e => { setDecisionId(crypto.randomUUID()); setSanction({ ...sanction, [key]: e.target.value }); }} /></label>)}
      </div>
      <button type="button" className="min-h-10 text-sm font-bold" onClick={() => run(async () => { await stageClient.http.post('/regional-leagues/player-sanctions', { ...sanction, action: 'impose', decision_id: decisionId }); setNotice('Suspension decision saved.'); await loadSanctions(); })}>Save explicit suspension</button>
      <button type="button" className="ml-4 min-h-10 text-sm" onClick={() => run(loadSanctions)}>View suspension decisions</button>
      {sanctions?.map(s => <div key={s.id} className="border-t border-border py-2 text-sm"><p>{s.player_id} · {s.scope_id || 'All official competitions'} · {s.status}</p><p>{s.starts_at} – {s.ends_at}</p><p>{s.reason}</p>{s.status === 'active' && <button type="button" className="min-h-10 font-bold" disabled={!sanction.reason.trim()} onClick={() => run(async () => { await stageClient.http.post('/regional-leagues/player-sanctions', { action: 'revoke', id: s.id, reason: sanction.reason }); await loadSanctions(); setNotice('Suspension revoked. The original decision is preserved.'); })}>Revoke using the entered decision reason</button>}</div>)}
    </fieldset>
    {notice && <p role="status" className="text-sm">{notice}</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>;
}

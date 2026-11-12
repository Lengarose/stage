import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { stageClient } from '@/api/stageClient';

const statusText = { eligible: 'Eligible', plus_required: 'Plus needed', plus_expired: 'Plus expired', subscription_review: 'Subscription needs review', registered_elsewhere: 'Registered to another playing club' };
const date = value => new Date(value).toLocaleString();

export default function RegionalRegistrationPanel({ clubId, region = '' }) {
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState([]);
  const [accepted, setAccepted] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true; setData(null); setError(''); setSelected([]); setAccepted('');
    Promise.all([stageClient.http.get('/regional-leagues/registration-windows'), clubId ? stageClient.http.get(`/regional-leagues/registration-readiness/${encodeURIComponent(clubId)}`).catch(err => { if (err.status === 403) return { forbidden: true, message: err.message }; throw err; }) : Promise.resolve(null)])
      .then(([windows, readiness]) => {
        if (!Array.isArray(windows.windows) || (readiness && !readiness.forbidden && (!Array.isArray(readiness.players) || !Array.isArray(readiness.registrations)))) throw new Error('Published registration data is incomplete. Please retry.');
        if (active) setData({ windows: windows.windows, readiness: readiness?.forbidden ? null : readiness, accessNote: readiness?.forbidden ? readiness.message : '' });
      })
      .catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [clubId, revision]);
  async function action(path, body) {
    setBusy(true); setError('');
    try { await stageClient.http.post(path, body); setRevision(value => value + 1); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  if (!data) return <div className="py-6">{error ? <p role="alert">{error}<button type="button" className="ml-3 min-h-11 font-semibold" onClick={() => setRevision(value => value + 1)}>Retry</button></p> : <p role="status">Loading published registration conditions…</p>}</div>;
  const readiness = data.readiness;
  const windows = data.windows.filter(w => !region || w.region_slug === region);
  return <section className="space-y-6 py-6">
    <div><h2 className="font-heading text-2xl uppercase">Regional participation</h2><p className="mt-3 text-sm text-muted-foreground">Register for a region. Your division and group follow sporting placement. Registration lasts four weeks, followed by one shared confirmation week, including clubs registering on the last day. All dates below are shown in your local time.</p></div>
    {!readiness ? <p>{data.accessNote || 'Create or manage a club to register.'} You can follow competitions and read the published rules without Plus.</p> : <div className="space-y-3 border-y border-border py-4">
      <p><strong>{readiness.club.name}</strong> · {readiness.can_manage_registration ? `Registering president: ${statusText[readiness.registrar_status]}` : "Admin eligibility review — registration actions remain with the club manager"}</p>
      <p>{readiness.eligible_count} eligible players · minimum {readiness.minimum_players} to confirm participation. Only participating players need Plus; other club members may stay. ANY is allowed; a goalkeeper is optional.</p>
      <div className="flex flex-wrap gap-6"><Link to="/store" className="inline-flex min-h-11 items-center font-semibold">Manage your personal STAGE Plus →</Link><button type="button" disabled={busy} className="min-h-11 font-semibold" onClick={() => setRevision(value => value + 1)}>Refresh eligibility and dates</button></div>
      <fieldset disabled={busy || !readiness.can_manage_registration}><legend className="text-sm font-semibold">{readiness.can_manage_registration ? 'Choose players for participation confirmation' : 'Player eligibility for participation confirmation'}</legend>{readiness.players.map(player => <label key={player.id} className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" disabled={player.status !== 'eligible'} checked={selected.includes(player.id)} onChange={e => setSelected(previous => e.target.checked ? [...previous, player.id] : previous.filter(id => id !== player.id))} /><span>{player.gamertag} · {statusText[player.status]}</span></label>)}</fieldset>
    </div>}
    {!windows.length && <p className="text-muted-foreground">No registration dates have been published for this region yet. No place is reserved automatically.</p>}
    {windows.map(window => {
      const application = readiness?.registrations.find(r => r.registration_window_id === window.id);
      const confirmed = application?.participation_status === 'confirmed';
      const canRegister = (!application || application.status === 'withdrawn') && window.phase === 'registration';
      const canConfirm = application?.status === 'pending' && window.phase === 'confirmation';
      const canReserve = application?.status === 'pending' && application?.reserve_invitation && !application.reserve_response && window.phase==='closed' && Date.now()<Date.parse(application.reserve_invitation.deadline);
      return <article key={window.id} className="space-y-3 border-b border-border py-5">
        <h3 className="font-heading text-xl">{window.region_slug} · {window.platform} · Season {window.season_number}</h3>
        <p className="text-sm">{application?.status === 'withdrawn' ? 'Previous application withdrawn — apply again during registration; no place is reserved' : confirmed ? application.assigned_league_id ? `Participation confirmed · Division ${application.assigned_division} · Group ${application.assigned_group_code}` : 'Participation confirmed — group allocation pending' : application ? window.phase === 'closed' ? 'Confirmation period closed — participation requires review' : 'Registered — confirm during the shared confirmation week' : window.phase === 'closed' ? 'Registration and confirmation closed' : window.phase === 'upcoming' ? 'Registration opens soon' : window.phase === 'confirmation' ? 'Confirmation for existing applications only' : 'Registration open'}</p>
        {application?.assigned_league_id && <Link to={`/leagues/${encodeURIComponent(application.assigned_league_id)}?season=${encodeURIComponent(application.assigned_league_id)}`} className="inline-flex min-h-11 items-center font-semibold">Open your assigned group →</Link>}<p className="text-sm text-muted-foreground">Register: {date(window.opens_at)} – {date(window.registration_closes_at)}<br />Confirm: {date(window.registration_closes_at)} – {date(window.confirmation_closes_at)}</p>
        {window.league_start_monday && <p className="text-sm">First league playing week: {window.league_start_monday}. Kickoff times appear in the published calendar.</p>}
        {application?.reserve_invitation && <p className="text-sm">Reserve response: {application.reserve_response?.decision || 'awaiting response'} · common deadline {date(application.reserve_invitation.deadline)}. Reserve willingness does not guarantee a place or Division 1. Final vacancies follow the promotion results.</p>}
        {window.season_orchestration_policy_version && <p className="text-xs text-muted-foreground">After confirmation closes, the server prepares the supported season field. Missing places, unresolved sporting rights or calendar conflicts require Admin review; no deadline is extended automatically.</p>}
        {window.confirmation_notice_policy_version==='regional_confirmation_notice_v1' && <p className="text-sm text-muted-foreground">Check these dates even if club notifications are muted. An in-app confirmation-week notice is a reminder; you must still confirm before the shared deadline.</p>}
        <details><summary className="min-h-11 cursor-pointer py-3 font-semibold">Edition rules and participation conditions</summary><p className="whitespace-pre-wrap py-3 text-sm">{window.rules_text}</p><p className="text-sm">Policy: {window.policy_version}. Personal Plus is required for the registering manager and every participating player. Minimum three eligible players at confirmation; confirmation does not replace the official match selection and eligibility requirements. GOST qualification is not open.</p></details>
        {readiness?.can_manage_registration && (canRegister || canConfirm || canReserve) && <fieldset disabled={busy} className="space-y-2">
          <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={accepted === window.id} onChange={e => setAccepted(e.target.checked ? window.id : '')} />I accept the published dates, rules and personal Plus requirements.</label>
          <button type="button" disabled={accepted !== window.id || readiness.registrar_status !== 'eligible' || ((canConfirm || canReserve) && selected.length < 3)} className="min-h-11 font-semibold disabled:opacity-40" onClick={() => action(canRegister ? `/regional-leagues/registration-windows/${window.id}/apply` : `/regional-leagues/registrations/${application.id}/${canReserve?'reserve':'confirm'}`, { club_id: clubId, policy_version: window.policy_version, ...(canReserve?{decision:'accept'}:{}), ...((canConfirm || canReserve) ? { player_ids: selected } : {}) })}>{canRegister ? 'Register your club for this region' : canReserve?'Confirm reserve willingness':'Confirm participation with the selected players'} →</button>
          {canReserve && <button type="button" disabled={busy} className="ml-4 min-h-11 font-semibold" onClick={()=>action(`/regional-leagues/registrations/${application.id}/reserve`,{decision:'decline'})}>Decline reserve invitation</button>}
        </fieldset>}
      </article>;
    })}
    {readiness?.registrations.some(r => !r.registration_window_id) && <details><summary className="min-h-11 cursor-pointer py-3 font-semibold">Earlier registrations</summary>{readiness.registrations.filter(r => !r.registration_window_id).map(r => <p key={r.id} className="py-2 text-sm">{r.region_slug} · Season {r.season_number || 'not recorded'} · {r.status} · Existing participation conditions apply.</p>)}</details>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {busy && <p role="status">Checking eligibility and saving participation…</p>}
  </section>;
}

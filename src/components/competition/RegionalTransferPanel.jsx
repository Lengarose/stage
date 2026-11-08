import { useEffect, useState } from 'react';
import { stageClient } from '@/api/stageClient';
export default function RegionalTransferPanel({ clubId }) {
 const [windows, setWindows] = useState([]), [selected, setSelected] = useState(''), [accepted, setAccepted] = useState(false), [error, setError] = useState(''), [result, setResult] = useState(null), [busy, setBusy] = useState(false);
 useEffect(() => { let active = true; stageClient.http.get('/regional-leagues/registration-windows').then(data => { if (active) setWindows(data.windows); }).catch(err => { if (active) setError(err.message); }); return () => { active = false; }; }, []);
 const window = windows.find(w => w.id === selected);
 async function request() { setBusy(true); setError(''); try { const response = await stageClient.http.post('/regional-leagues/regional-transfers', { club_id: clubId, target_region_slug: window.region_slug, accepted_conditions_revision: window.transfer_conditions_revision }); setResult(response.transfer); } catch (err) { setError(err.message); } finally { setBusy(false); } }
 if (!clubId) return null;
 return <section className="mt-8 space-y-3 border-t border-border py-5">
  <h2 className="font-heading text-xl">Change regional system</h2>
  <p className="text-sm text-muted-foreground">Move after the current edition and confirmation of your earned tier. Only an available place at that same tier can be used. Confirmed clubs are never displaced. Existing draws, Cups or different season calendars require Admin review.</p>
  <label className="block text-xs">Destination participation conditions<select className="mt-1 block w-full min-w-0 border border-border bg-background p-2 text-sm" value={selected} onChange={e => { setSelected(e.target.value); setAccepted(false); setResult(null); }}><option value="">Choose a regional system and season</option>{windows.map(w => <option key={w.id} value={w.id}>{w.region_slug} · Season {w.season_number}</option>)}</select></label>
  {window && <><p className="whitespace-pre-wrap text-sm">{window.rules_text}</p><label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} />I accept these destination participation conditions. My earned tier and available places will be checked.</label><button type="button" disabled={busy || !accepted} onClick={request} className="min-h-11 text-sm font-bold text-white hover:drop-shadow-[0_0_7px_white] disabled:opacity-50">Request regional transfer</button></>}
  {result && <div role="status" className="text-sm"><p>{result.status === 'applied' ? `Regional transfer applied at Division ${result.earned_division}.` : 'Your existing regional place is unchanged. This request needs Admin review.'}</p>{result.review_reasons?.map(reason => <p key={reason}>{reason}</p>)}</div>}
  {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
 </section>;
}

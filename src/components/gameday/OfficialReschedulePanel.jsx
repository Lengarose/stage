import {useEffect,useRef,useState} from 'react';
import {stageClient} from '@/api/stageClient';

export default function OfficialReschedulePanel({game,clubId,onGameUpdate}) {
 const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[date,setDate]=useState(''),[refresh,setRefresh]=useState(0);
 const mounted=useRef(false),working=useRef(false);
 useEffect(()=>{mounted.current=true;return ()=>{mounted.current=false;};},[]);
 useEffect(()=>{
  let active=true;setData(null);setError('');
  stageClient.http.get(`/game-day/${encodeURIComponent(game.id)}/reschedule`,{club_id:clubId}).then(result=>{
   if(typeof result?.enabled!=='boolean' || !Array.isArray(result.requests))throw Error('The scheduling status could not be verified.');
   if(active)setData(result);
  }).catch(err=>{if(active)setError(err.message);});
  return ()=>{active=false;};
 },[game.id,clubId,game.scheduled_date,game.confirmed_date,refresh]);
 async function act(action,requestId){
  if(working.current)return;working.current=true;setBusy(true);setError('');
  try {
   const result=await stageClient.http.post(`/game-day/${encodeURIComponent(game.id)}/reschedule`,{club_id:clubId,action,date,request_id:requestId});
   const fresh=result.match_updated?await stageClient.entities.Match.get(game.id):null;
   if(mounted.current){setData(result);if(fresh)onGameUpdate?.(fresh);setRefresh(v=>v+1);}
  }catch(err){if(mounted.current)setError(err.message);}
  finally{working.current=false;if(mounted.current)setBusy(false);}
 }
 return <section aria-label="Official rescheduling" className="space-y-3 border-y border-white/15 px-5 py-4 text-sm">
  <h3 className="font-semibold">Official schedule changes</h3>
  {error && <p role="alert" className="text-destructive">{error}<button type="button" disabled={busy} className="ml-3 min-h-11 font-semibold" onClick={()=>setRefresh(v=>v+1)}>Retry →</button></p>}
  {!data && !error && <p role="status">Loading scheduling conditions…</p>}
  {data && !data.enabled && <p>{data.message}</p>}
  {data?.enabled && <>
   <p>{data.used} / {data.limit} approved changes used by your club in this edition. A request uses no allowance until approved. No response keeps the existing kickoff.</p>
   {data.message && <p>{data.message}</p>}
   {data.can_request && <div className="flex flex-wrap items-end gap-3"><label className="space-y-1">Proposed kickoff · Europe/Brussels<input type="datetime-local" value={date} onChange={e=>setDate(e.target.value)} className="block min-h-11 border border-border bg-background px-3" /></label><button type="button" disabled={busy || !date} className="min-h-11 font-semibold disabled:opacity-40" onClick={()=>act('request')}>Request schedule change →</button></div>}
   <p className="text-xs text-muted-foreground">Request at least 48 hours before the current kickoff. Reply within 24 hours and agree at least 24 hours before the proposed kickoff. Stay in the same week: Mon–Fri 20:00/20:40 or Sat 18:00–21:00, Europe/Brussels. Rounds 37–38 require Admin review.</p>
   {data.requests.map(request=><div key={request.id} className="border-l border-border pl-3"><p>{request.status} · {request.proposed_date} (Europe/Brussels)</p><p className="text-xs">Reply by {new Date(request.respond_by).toLocaleString()}. Agreement may close earlier to keep the 24-hour kickoff lead time.</p>{request.can_respond?<div className="flex flex-wrap gap-4"><button type="button" disabled={busy} className="min-h-11 font-semibold disabled:opacity-40" onClick={()=>act('approve',request.id)}>Agree</button><button type="button" disabled={busy} className="min-h-11 font-semibold disabled:opacity-40" onClick={()=>act('decline',request.id)}>Decline</button></div>:request.status==='pending' && request.requester_club_id===clubId?<button type="button" disabled={busy} className="min-h-11 font-semibold disabled:opacity-40" onClick={()=>act('cancel',request.id)}>Withdraw request</button>:null}</div>)}
  </>}
 </section>;
}

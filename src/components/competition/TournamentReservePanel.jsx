import { useEffect, useState } from 'react';
import { stageClient } from '@/api/stageClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function TournamentReservePanel({ tournament, clubId, onChanged, onParticipationChange }) {
  const [data,setData]=useState(null),[error,setError]=useState(''),[revision,setRevision]=useState(0),[busy,setBusy]=useState(false),[dialog,setDialog]=useState(null),[reason,setReason]=useState('');
  useEffect(()=>{
    let active=true;
    stageClient.http.get(`/tournaments/${encodeURIComponent(tournament.id)}/reserves?${new URLSearchParams({club_id:clubId || ''})}`).then(result=>{if(active){setData(result);setError('');onParticipationChange?.(result);}}).catch(e=>{if(active)setError(e.message);});
    const timer=tournament.status==='registration'?setInterval(()=>setRevision(n=>n+1),60000):null;
    return ()=>{active=false;if(timer)clearInterval(timer);};
  },[tournament.id,tournament.updated_date,tournament.status,clubId,revision,onParticipationChange]);
  async function submit(){
    setBusy(true);setError('');
    try{
      const base=`/tournaments/${encodeURIComponent(tournament.id)}/reserves`;
      await stageClient.http.post(dialog.action==='join'?base:`${base}/${encodeURIComponent(dialog.entry.id)}/${dialog.action}`,{club_id:clubId,reason});
      setDialog(null);setRevision(n=>n+1);onChanged?.();
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  const entry=data?.entry;
  const time=value=>new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
  return <section className="mx-auto max-w-7xl border-b border-border px-4 py-4 lg:px-8">
    <details><summary className="min-h-11 cursor-pointer py-2 text-sm font-bold">Reserve waiting list · how it works</summary>
      <ul className="max-w-3xl list-disc space-y-2 pl-5 text-sm text-muted-foreground">
        <li>When the tournament is full, club Managers can join a free waiting list. Places are offered to the next eligible club in joining order.</li>
        <li>An invitation reserves one place exclusively for up to 24 hours, ending sooner if registration closes or the first scheduled kickoff arrives. The exact deadline appears in your inbox and here.</li>
        <li>Accept the current schedule and rules, then complete ordinary registration and payment before that deadline. Joining the list alone does not register your club. A submitted entry awaiting approval holds the place until a decision.</li>
        <li>After the draw, an approved replacement takes the departing club’s exact group/bracket position, opponents and kickoff times. The organizer must confirm this fixture replacement; there is no automatic redraw.</li>
        <li>No reserve replacements are allowed after play starts. Withdrawal decisions and played results follow the published withdrawal rules.</li>
      </ul>
    </details>
    {data?.can_join&&<button type="button" className="min-h-11 border border-cyan-300/40 px-4 font-bold text-white" onClick={()=>{setDialog({action:'join'});setReason('');}}>Join reserve list · free</button>}
    {entry&&<div className="space-y-2 border-t border-border py-3 text-sm">
      <p className="font-bold">Your reserve entry · {entry.status.replaceAll('_',' ')}{data.position?` · position ${data.position}`:''}</p>
      {entry.status==='waiting'&&<p className="text-muted-foreground">We will send your Manager an inbox invitation if your club is next eligible for a vacancy.</p>}
      {entry.status==='invited'&&<><p>Exclusive place held until {time(entry.expires_at)} (your local time). Accept the schedule, then use Register club to complete entry and payment.</p><a className="mr-5 inline-block min-h-11 py-2 font-bold text-cyan-200" href="#tournament-schedule">Review schedule and rules →</a></>}
      {entry.status==='submitted'&&<p className="text-muted-foreground">Your place is held while entry approval is pending.</p>}
      {entry.status==='entered'&&entry.vacated_club_id&&!entry.slot_confirmed_at&&<p>Entry approved. The organizer must confirm your inherited fixture slot before the tournament can start.</p>}
      {['waiting','invited'].includes(entry.status)&&data.can_act&&<button type="button" className="min-h-11 text-red-200" onClick={()=>{setDialog({action:'leave',entry});setReason('');}}>{entry.status==='invited'?'Decline invitation':'Leave waiting list'}</button>}
      {entry.closed_reason&&<p>{entry.closed_reason}</p>}
    </div>}
    {data?.organizer&&data.entries.length>0&&<details className="border-t border-border"><summary className="min-h-11 cursor-pointer py-2 font-bold">Manage reserves · {data.waiting_count} waiting</summary>
      {data.entries.map(r=><div key={r.id} className="space-y-2 border-t border-border py-3 text-sm"><p className="font-bold">#{r.queue_sequence} · {r.club_name} · {r.status}</p>{r.expires_at&&<p className="text-muted-foreground">Invitation deadline: {time(r.expires_at)}</p>}{r.closed_reason&&<p>{r.closed_reason}</p>}
        {r.status==='entered'&&r.vacated_club_id&&!r.slot_confirmed_at&&data.open&&<button type="button" className="min-h-11 font-bold text-cyan-200" onClick={()=>{setDialog({action:'replace-slot',entry:r});setReason('');}}>Review and confirm inherited fixture slot</button>}
      </div>)}
    </details>}
    {error&&!dialog&&<p role="alert" className="text-sm text-destructive">{error}<button type="button" className="ml-3 min-h-11" onClick={()=>setRevision(n=>n+1)}>Retry</button></p>}
    <Dialog open={Boolean(dialog)} onOpenChange={open=>{if(!open&&!busy)setDialog(null);}}><DialogContent className="rounded-none border-white/20 bg-[#080f1c] text-white"><DialogHeader><DialogTitle>{dialog?.action==='join'?'Join the reserve waiting list?':dialog?.action==='leave'?'Leave the reserve waiting list?':'Confirm the same fixture slot'}</DialogTitle></DialogHeader>
      <p className="text-sm text-muted-foreground">{dialog?.action==='join'?'Joining is free and does not guarantee entry. Invitations follow joining order. You will need to accept the current conditions and complete normal payment if invited.':dialog?.action==='leave'?'Your place or exclusive invitation will be released. Rejoining puts your club at the back of the waiting list.':'The replacement inherits the withdrawn club’s existing group/bracket position, opponents and times. Match IDs remain unchanged. No results or money are transferred. Match squads must be selected again.'}</p>
      {dialog?.action==='replace-slot'&&<ul className="max-h-48 space-y-2 overflow-y-auto border-y border-border py-3 text-sm">{(dialog.entry.slot_fixtures || []).map(m=><li key={m.id}>{m.home} vs {m.away} · Round {m.round} · {m.kickoff || 'Unscheduled'}</li>)}</ul>}
      {dialog?.action==='replace-slot'&&<label className="text-sm">Decision reason<textarea className="mt-2 min-h-24 w-full border border-border bg-background p-3" maxLength={2000} value={reason} onChange={e=>setReason(e.target.value)}/></label>}
      {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
      <button type="button" disabled={busy||(dialog?.action==='replace-slot'&&!reason.trim())} className="min-h-11 bg-cyan-400 px-4 font-bold text-black disabled:opacity-40" onClick={submit}>{busy?'Saving…':'Confirm'}</button>
    </DialogContent></Dialog>
  </section>;
}

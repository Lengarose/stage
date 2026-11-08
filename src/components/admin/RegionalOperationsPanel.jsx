import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { stageClient } from '@/api/stageClient';
const targets={sources:'#regional-management',registration:'#regional-registration',cycles:'#regional-cycles',calendar:'#regional-calendar',cups:'#regional-cups'};
export default function RegionalOperationsPanel() {
  const location=useLocation();
  function fieldHref(id) {const params=new URLSearchParams(location.search);params.set('regional_field',id);return {pathname:location.pathname,search:`?${params}`,hash:'#regional-cycles'};}
  function calendarHref(id) {const params=new URLSearchParams(location.search);params.set('regional_calendar_cycle',id);return {pathname:location.pathname,search:`?${params}`,hash:'#regional-calendar'};}
  const [data,setData]=useState(null);
  const [error,setError]=useState('');
  const [refresh,setRefresh]=useState(0);
  const [busy,setBusy]=useState(false);
  useEffect(()=>{
    let active=true;setBusy(true);setError('');
    stageClient.http.get('/regional-leagues/operations').then(result=>{if(active)setData(result);}).catch(err=>{if(active){setError(err.message);setData(null);}}).finally(()=>{if(active)setBusy(false);});
    return ()=>{active=false;};
  },[refresh]);
  return <section className="space-y-4 border-y border-border py-6" aria-label="Regional operations overview">
    <div className="flex flex-wrap items-center justify-between gap-3"><h4 className="font-heading text-xl">Regional action overview</h4><button type="button" disabled={busy} onClick={()=>setRefresh(v=>v+1)} className="min-h-11 font-semibold disabled:opacity-40">{busy?'Checking…':'Refresh overview'}</button></div>
    <p className="max-w-3xl text-sm text-muted-foreground">A snapshot of registration, sporting cycles, result reviews, Cup matches and rewards. This overview makes no changes. Existing actions recheck current evidence; this view does not extend deadlines, choose winners or issue payments.</p>
    {error && <p role="alert" className="text-destructive">The overview could not be loaded: {error}. Select Refresh overview to try again.</p>}
    {busy && <p role="status" className="text-sm">Loading action items…</p>}
    {data && <>
      <p className="text-sm">{data.counts.review} reviews · {data.counts.action} actions · {data.counts.windows} registration periods · {data.counts.cycles} cycles · {data.counts.cups} Cup editions</p>
      <p className="text-xs text-muted-foreground">Updated: {new Date(data.as_of).toLocaleString()}{busy?' · refreshing':''}</p>
      {!data.issues.length && <p role="status">No action items found in this stored snapshot. This is not a complete competition or automation integrity check.</p>}
      <ul className="divide-y divide-border">{data.issues.map(item=><li key={item.key} className="flex flex-wrap justify-between gap-4 py-4">
        <div className="max-w-3xl"><p className="font-semibold">{item.severity==='review'?'Review required':'Action available'} · {item.name}{item.season_number?` · season ${item.season_number}`:''}</p><p className="mt-1 text-sm text-muted-foreground">{item.message}</p>
          {item.confirmation_notices && <p className="mt-3 text-sm">Confirmation notices: {item.confirmation_notices.stored} stored · {item.confirmation_notices.muted} muted · {item.confirmation_notices.pending} pending. These counts do not confirm participation or change the deadline.</p>}
          {item.field_assessment && <div className="mt-3 space-y-2 text-sm">
            <p>{item.field_assessment.registrations} applications · {item.field_assessment.confirmed_registrations} confirmed records · {item.field_assessment.confirmed_clubs} distinct confirmed clubs · {item.field_assessment.unconfirmed_registrations} not confirmed</p>
            {item.field_assessment.structure && <p>Capacity: {item.field_assessment.structure.d1_groups} Division 1 group(s) · {item.field_assessment.structure.d2_groups} Division 2 group(s) · {item.field_assessment.structure.clubs_per_group} clubs per group. This is not a draw or a published season.</p>}
            {item.field_assessment.blockers.length>0 && <ul className="list-disc space-y-1 pl-5">{item.field_assessment.blockers.map(blocker=><li key={blocker.code}>{blocker.message}</li>)}</ul>}
          </div>}
          <p className="mt-1 break-all text-xs text-muted-foreground">Source: {item.source_id}</p></div>
        {item.target==='results' && item.match_id?<div className="flex flex-wrap gap-5"><Link to={`/game-day?match=${encodeURIComponent(item.match_id)}`} className="inline-flex min-h-11 items-center font-semibold">Open match evidence →</Link><Link to={`/admin/disputes?match=${encodeURIComponent(item.match_id)}`} className="inline-flex min-h-11 items-center font-semibold">Open dispute controls →</Link></div>:item.field_assessment?.status==='structure_supported'?<Link to={fieldHref(item.source_id)} className="inline-flex min-h-11 items-center font-semibold">Preview this confirmed field →</Link>:item.code==='league_calendar'?<Link to={calendarHref(item.source_id)} className="inline-flex min-h-11 items-center font-semibold">Prepare this season calendar →</Link>:item.target==='rewards'?<Link to="/admin/rewards" className="inline-flex min-h-11 items-center font-semibold">Open Rewards →</Link>:<a href={item.source_type==='regional_transfer_request'?targets.sources:(targets[item.target] || targets.sources)} className="inline-flex min-h-11 items-center font-semibold">Open review →</a>}
      </li>)}</ul>
    </>}
  </section>;
}

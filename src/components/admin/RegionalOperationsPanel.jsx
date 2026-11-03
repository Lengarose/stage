import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { stageClient } from '@/api/stageClient';
const targets={sources:'#regional-management',registration:'#regional-registration',cycles:'#regional-cycles',calendar:'#regional-calendar',cups:'#regional-cups'};
export default function RegionalOperationsPanel() {
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
    <div className="flex flex-wrap items-center justify-between gap-3"><h4 className="font-heading text-xl">Regionale actiepunten</h4><button type="button" disabled={busy} onClick={()=>setRefresh(v=>v+1)} className="min-h-11 font-semibold disabled:opacity-40">{busy?'Controleren…':'Overzicht vernieuwen'}</button></div>
    <p className="max-w-3xl text-sm text-muted-foreground">Eén momentopname van inschrijving, sportieve cycli, bekerduels en beloningen. Dit overzicht verandert niets. De bestaande acties controleren de actuele bronnen opnieuw; hier worden geen deadlines verlengd, winnaars aangewezen of betalingen uitgevoerd.</p>
    {error && <p role="alert" className="text-destructive">Het overzicht kon niet worden geladen: {error}. Probeer opnieuw via Overzicht vernieuwen.</p>}
    {busy && <p role="status" className="text-sm">Actiepunten worden opgehaald…</p>}
    {data && <>
      <p className="text-sm">{data.counts.review} controles · {data.counts.action} acties · {data.counts.windows} inschrijfperiodes · {data.counts.cycles} cycli · {data.counts.cups} bekeredities</p>
      <p className="text-xs text-muted-foreground">Bijgewerkt: {new Date(data.as_of).toLocaleString()}{busy?' · wordt vernieuwd':''}</p>
      {!data.issues.length && <p role="status">Geen actiepunten gevonden in deze opgeslagen momentopname. Dit is geen volledige controle van de competitie of automatisering.</p>}
      <ul className="divide-y divide-border">{data.issues.map(item=><li key={item.key} className="flex flex-wrap justify-between gap-4 py-4">
        <div className="max-w-3xl"><p className="font-semibold">{item.severity==='review'?'Controle nodig':'Actie beschikbaar'} · {item.name}{item.season_number?` · seizoen ${item.season_number}`:''}</p><p className="mt-1 text-sm text-muted-foreground">{item.message}</p><p className="mt-1 break-all text-xs text-muted-foreground">Bron: {item.source_id}</p></div>
        {item.target==='rewards'?<Link to="/admin/rewards" className="inline-flex min-h-11 items-center font-semibold">Naar Rewards →</Link>:<a href={targets[item.target] || targets.sources} className="inline-flex min-h-11 items-center font-semibold">Naar de controle →</a>}
      </li>)}</ul>
    </>}
  </section>;
}

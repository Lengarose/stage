import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, ArrowRight } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import smoke from '@/assets/regional-smoke.png';

export function TournamentBanner({ tournament }) {
  const [failed,setFailed]=useState(false);
  useEffect(()=>setFailed(false),[tournament.banner_url]);
  return <><div className="pointer-events-none absolute inset-0 bg-secondary" style={{backgroundColor:tournament.banner_color || undefined}}>{tournament.banner_url&&!failed&&<img src={tournament.banner_url} onError={()=>setFailed(true)} alt="" className="h-full w-full object-cover" style={{objectPosition:tournament.banner_position || '50% 50%'}}/>}</div><div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(2,8,16,0.9),rgba(2,8,16,0.45)_50%,rgba(2,8,16,0.15))]"/><div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent"/><img src={smoke} alt="" aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-32 w-full object-cover opacity-15"/></>;
}
const money=value=>`${Number(value).toLocaleString(undefined,{maximumFractionDigits:2})} STC`;
export function TournamentPrizeSummary({ data, error, retry }) {
  const [open,setOpen]=useState(false);
  return <section className="border-y border-border"><div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 lg:px-8"><span className="text-xs uppercase text-muted-foreground">Configured prize pool</span><strong className="font-heading text-2xl text-warning">{data?.prizes.pool != null ? money(data.prizes.pool) : 'Unavailable'}</strong><button type="button" onClick={()=>setOpen(true)} className="inline-flex min-h-11 items-center gap-2 text-primary">View prize breakdown <ArrowRight size={17}/></button>{error&&<p role="alert" className="text-sm text-destructive">{error}<button type="button" onClick={retry} className="ml-3 text-primary">Retry</button></p>}</div><Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[85dvh] overflow-y-auto rounded-none"><DialogTitle>Prize breakdown</DialogTitle><DialogDescription>Configured allocations and recorded settlement status</DialogDescription>{data?.prizes.rows?.length?<dl className="divide-y divide-border">{data.prizes.rows.map(row=><div key={row.position} className="flex justify-between gap-4 py-3 text-sm"><dt>{row.label || `Position ${row.position}`}</dt><dd className="font-bold">{money(row.amount)}</dd></div>)}</dl>:<p>No reliable allocation schedule is available.</p>}<p className="text-sm">Settlement: {data?.prizes.payment_state || 'Not verified'}</p><p className="text-xs text-muted-foreground">Completion or archival alone does not establish payment.</p></DialogContent></Dialog></section>;
}
export function TournamentChampion({ champion }) {
  if(!champion)return null;
  return <section className="border-b border-border"><div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-3 lg:px-8"><Trophy size={20} className="text-warning"/><span className="text-xs uppercase text-muted-foreground">Champion</span><Link to={`/${champion.player?'players':'clubs'}/${encodeURIComponent(champion.id)}`} className="min-h-11 py-2 font-bold">{champion.name || 'View champion'}</Link></div></section>;
}

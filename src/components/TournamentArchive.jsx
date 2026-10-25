import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {stageClient} from '@/api/stageClient';
import {useTranslation} from '@/hooks/useTranslation';
import {ChevronLeft,ChevronRight} from 'lucide-react';
export default function TournamentArchive() {
  const {t}=useTranslation();
  const [search,setSearch]=useState(''),[year,setYear]=useState(''),[format,setFormat]=useState(''),[organizer,setOrganizer]=useState(''),[page,setPage]=useState(0),[data,setData]=useState({items:[],total:0}),[error,setError]=useState(''),[loading,setLoading]=useState(false);
  useEffect(()=>{let stopped=false;setLoading(true);setError('');
    const params=new URLSearchParams({search,year,type:format,organizer_email:organizer,offset:String(page*20),limit:'20'});
    stageClient.http.get(`/tournaments/archive?${params}`).then(result=>{if(!stopped)setData(result);}).catch(e=>{if(!stopped)setError(e.message);}).finally(()=>{if(!stopped)setLoading(false);});
    return()=>{stopped=true;};
  },[search,year,format,organizer,page]);
  return <section aria-label="Tournament Archive" className="space-y-4">
    <h2 className="font-heading text-xl">{t('tournamentArchive.title','Tournament Archive')}</h2>
    <div className="grid gap-3 sm:grid-cols-4">
      <input aria-label="Search archive" placeholder={t('tournamentArchive.search','Search archive')} value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}} className="min-w-0 border border-border bg-background p-2"/>
      <input aria-label="Completion year" placeholder="Year" inputMode="numeric" value={year} onChange={e=>{setYear(e.target.value);setPage(0);}} className="min-w-0 border border-border bg-background p-2"/>
      <select aria-label="Archive format" value={format} onChange={e=>{setFormat(e.target.value);setPage(0);}} className="min-w-0 border border-border bg-background p-2"><option value="">All formats</option>{['knockout','league','group_stage','swiss_ucl','swiss','double_elimination'].map(f=><option key={f} value={f}>{f.replaceAll('_',' ')}</option>)}</select>
      <input aria-label="Organiser email" placeholder="Organiser email" value={organizer} onChange={e=>{setOrganizer(e.target.value);setPage(0);}} className="min-w-0 border border-border bg-background p-2"/>
    </div>
    {error&&<p role="alert" className="text-destructive">{error}</p>}
    {loading?<p role="status">Loading archive...</p>:<div className="divide-y divide-border border-y border-border">{data.items.map(item=>{
      let participants=item[item.participant_type==='player'?'registered_players':'registered_clubs']||[];try{if(typeof participants==='string')participants=JSON.parse(participants);}catch{participants=[];}
      return <Link key={item.id} to={`/tournaments/${item.id}`} className="block space-y-1 py-4 hover:text-primary"><strong>{item.name}</strong><p className="text-xs text-muted-foreground">{item.type?.replaceAll('_',' ')} · {item.participant_type||'club'} · {new Set(participants).size} entrants · {item.completed_at?new Date(item.completed_at).toLocaleDateString():'Completion date unavailable'}</p><p className="text-sm">Winner: {item.winner_player_name||item.winner_club_name||'Unresolved'} · Runner-up: {item.runner_up_player_name||item.runner_up_club_name||'Unavailable'}</p>{item.historical_trophy&&<p className="text-xs">{item.historical_trophy.display_name}</p>}<p className="text-xs text-muted-foreground">Settlement: {item.prize_settlement_state||'Not reviewed'}{item.archive_review_required?' · Historical review required':''}</p></Link>;
    })}{!data.items.length&&<p className="py-4">No archived tournaments found.</p>}</div>}
    <nav aria-label="Archive pages" className="flex items-center gap-4"><button type="button" title="Previous page" aria-label="Previous archive page" disabled={!page||loading} onClick={()=>setPage(p=>p-1)}><ChevronLeft size={18}/></button><span>{page+1} / {Math.max(1,Math.ceil(data.total/20))}</span><button type="button" title="Next page" aria-label="Next archive page" disabled={(page+1)*20>=data.total||loading} onClick={()=>setPage(p=>p+1)}><ChevronRight size={18}/></button></nav>
  </section>;
}

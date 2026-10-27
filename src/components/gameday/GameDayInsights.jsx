import {useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {ImagePlus,ChevronLeft,ChevronRight,Trash2} from 'lucide-react';
import {stageClient} from '@/api/stageClient';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {penaltyOutcome} from '@/lib/penaltyOutcome';
export default function GameDayInsights({game}) {
  const [scope,setScope]=useState('all'),[history,setHistory]=useState(null),[historyError,setHistoryError]=useState('');
  const [media,setMedia]=useState(null),[mediaError,setMediaError]=useState(''),[revision,setRevision]=useState(0),[busy,setBusy]=useState(false),[image,setImage]=useState(0),[viewer,setViewer]=useState(false),[offset,setOffset]=useState(0);
  const input=useRef(null);
  useEffect(()=>{
    let active=true;
    async function load(){
      try{const result=await stageClient.http.get(`/game-day/${encodeURIComponent(game.id)}/history`,{scope,limit:5,offset});if(active){setHistory(result);setHistoryError('');}}catch(e){if(active)setHistoryError(e.message);}
    }
    setHistory(null);void load();
    const refresh=()=>{if(document.visibilityState==='visible')void load();};
    window.addEventListener('focus',refresh);const timer=setInterval(refresh,15000);
    return ()=>{active=false;clearInterval(timer);window.removeEventListener('focus',refresh);};
  },[game.id,game.updated_date,scope,offset]);
  useEffect(()=>{
    let active=true;
    async function load(){try{let result;const all=[];for(let offset=0;;offset+=100){result=await stageClient.http.get('/match-highlights',{match_id:game.id,limit:100,offset,view:'gallery'});if(!active)return;all.push(...result.items);if(result.items.length<100)break;}if(active){setMedia({...result,items:all});setMediaError('');}}catch(e){if(active)setMediaError(e.message);}}
    void load();const refresh=()=>{if(document.visibilityState==='visible')void load();};
    window.addEventListener('focus',refresh);const timer=setInterval(refresh,15000);
    return ()=>{active=false;clearInterval(timer);window.removeEventListener('focus',refresh);};
  },[game.id,revision]);
  async function publish(file){
    if(!file)return;
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>10*1024*1024){setMediaError('Choose a JPG, PNG or WebP image up to 10 MB.');return;}
    setBusy(true);setMediaError('');
    try{const body=new FormData();body.append('file',file);await stageClient.http.upload(`/match-highlights/publish/${encodeURIComponent(game.id)}`,body);setRevision(r=>r+1);}catch(e){setMediaError(e.message);}finally{setBusy(false);if(input.current)input.current.value='';}
  }
  async function remove(item){setBusy(true);try{await stageClient.entities.MatchHighlight.delete(item.id);setImage(0);setRevision(r=>r+1);}catch(e){setMediaError(e.message);}finally{setBusy(false);}}
  const items=media?.items||[],current=items[Math.min(image,Math.max(0,items.length-1))];
  const home=game.home_club_name||game.home_player_name,away=game.away_club_name||game.away_player_name;
  const button='inline-flex min-h-11 items-center justify-center gap-2 px-2 text-xs text-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:opacity-40';
  return <div className="mx-auto grid w-full max-w-[1600px] min-w-0 gap-4 px-4 pb-6 sm:px-6 lg:grid-cols-2 lg:px-8">
    <section className="min-w-0 border border-white/15 bg-black/20 p-4 text-white"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-heading text-xl font-black uppercase">Head-to-Head</h2><select aria-label="Head-to-Head scope" value={scope} onChange={e=>{setScope(e.target.value);setOffset(0);}} className="min-h-11 max-w-full border border-white/15 bg-[#0b1019] px-2 text-xs"><option value="all">All competitions</option><option value="same">Same competition edition</option></select></div>
      {historyError?<p role="alert" className="py-3 text-xs text-red-300">{historyError}</p>:!history?<p role="status" className="py-3 text-xs text-white/55">Loading previous meetings...</p>:<>
        <p className="mt-2 text-[11px] text-white/55">{history.chronology} {scope==='same'?'Same competition edition.':''}</p>
        <div className="my-4 grid grid-cols-3 gap-3 text-center"><div><p className="break-words text-xs">{home}</p><strong className="font-heading text-3xl">{history.homeWins}</strong><p className="text-xs text-white/55">Wins</p></div><div><strong className="font-heading text-3xl">{history.draws}</strong><p className="text-xs text-white/55">Draws</p></div><div><p className="break-words text-xs">{away}</p><strong className="font-heading text-3xl">{history.awayWins}</strong><p className="text-xs text-white/55">Wins</p></div></div>
        {history.total?<><div className="mb-4 flex h-1.5" aria-hidden="true"><span className="bg-cyan-400" style={{width:`${100*history.homeWins/history.total}%`}}/><span className="bg-slate-400" style={{width:`${100*history.draws/history.total}%`}}/><span className="bg-rose-500" style={{width:`${100*history.awayWins/history.total}%`}}/></div><p className="mb-2 text-xs text-white/55">{history.total} previous meetings</p>{history.meetings.map(m=><Link key={m.id} to={`/game-day?match=${encodeURIComponent(m.id)}`} className="block border-t border-white/10 py-2 text-xs focus-visible:ring-2 focus-visible:ring-cyan-400"><span className="flex items-center justify-between gap-3"><span className="min-w-0 truncate">{m.home_club_name||m.home_player_name}</span><strong className="shrink-0">{m.home_score} - {m.away_score}</strong><span className="min-w-0 truncate text-right">{m.away_club_name||m.away_player_name}</span></span><span className="mt-1 block text-[10px] text-white/50">{m.display_date?new Date(m.display_date).toLocaleDateString(): 'Date unavailable'} · {m.competition_name}{m.status==='forfeit'?' · Forfeit':''}</span>{penaltyOutcome(m)&&<span className="block text-cyan-200">{penaltyOutcome(m)}</span>}</Link>)}<div className="mt-2 flex justify-between"><button type="button" className={button} disabled={offset===0} onClick={()=>setOffset(n=>Math.max(0,n-5))}><ChevronLeft size={16}/>Previous</button><button type="button" className={button} disabled={offset+5>=history.total} onClick={()=>setOffset(n=>n+5)}>Next<ChevronRight size={16}/></button></div></>:<p className="py-4 text-sm text-white/60">First meeting between these participants.</p>}
      </>}
    </section>
    <section className="min-w-0 border border-white/15 bg-black/20 p-4 text-white"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-heading text-xl font-black uppercase">Highlights</h2>{media?.can_upload&&<button type="button" className={button} disabled={busy} onClick={()=>input.current?.click()}><ImagePlus size={20}/>{busy?'Uploading...':'Upload screenshot'}</button>}</div><p className="mb-3 text-xs text-white/50">Published match screenshots</p><input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" aria-label="Publish match screenshot" onChange={e=>publish(e.target.files?.[0])}/>
      {mediaError?<p role="alert" className="py-3 text-xs text-red-300">{mediaError}<button type="button" className={button} onClick={()=>setRevision(n=>n+1)}>Retry</button></p>:!media?<p role="status" className="text-xs text-white/55">Loading screenshots...</p>:!current?<p className="py-8 text-sm text-white/60">No published screenshots for this match.</p>:<><button type="button" onClick={()=>setViewer(true)} className="block w-full focus-visible:ring-2 focus-visible:ring-cyan-400" aria-label="View full-size screenshot"><img src={current.image_url} alt={current.caption||'Published match screenshot'} className="aspect-video w-full bg-black/40 object-contain"/></button><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-white/55">{image+1} / {media.total} screenshots</span><div className="flex"><button type="button" aria-label="Previous screenshot" className={button} disabled={image===0} onClick={()=>setImage(n=>n-1)}><ChevronLeft size={18}/></button><button type="button" aria-label="Next screenshot" className={button} disabled={image>=items.length-1} onClick={()=>setImage(n=>n+1)}><ChevronRight size={18}/></button>{current.can_remove&&<button type="button" aria-label="Remove published screenshot" disabled={busy} className={button} onClick={()=>remove(current)}><Trash2 size={16}/></button>}</div></div></>}
      <Dialog open={viewer&&Boolean(current)} onOpenChange={setViewer}><DialogContent className="max-h-[95dvh] max-w-5xl overflow-y-auto rounded-none bg-[#080c14] text-white"><DialogTitle>Match screenshot</DialogTitle><DialogDescription>Published screenshot for {home} vs {away}</DialogDescription>{current&&<img src={current.image_url} alt={current.caption||'Full-size match screenshot'} className="max-h-[70dvh] w-full object-contain"/>}<div className="flex justify-between"><button type="button" className={button} disabled={image===0} onClick={()=>setImage(n=>n-1)}>Previous</button><button type="button" className={button} disabled={image>=items.length-1} onClick={()=>setImage(n=>n+1)}>Next</button></div></DialogContent></Dialog>
    </section>
  </div>;
}

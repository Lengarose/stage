import {useState,useEffect,useRef} from 'react';
import {stageClient} from '@/api/stageClient';
import {swalConfirm} from '@/lib/swal';
import {useTranslation} from '@/hooks/useTranslation';
import toast from 'react-hot-toast';
import {Pencil,Check,Trophy} from 'lucide-react';
import TrophyCabinetCanvas from './TrophyCabinetCanvas';

export default function TrophyCabinetSystem({ownerId,ownerType,canEdit}) {
  const {t}=useTranslation();
  const [report,setReport]=useState({awards:[],placements:[],discrepancies:[],titles:{all_time:0,official_ranking:0}});
  const [editMode,setEditMode]=useState(false),[loading,setLoading]=useState(true),[pending,setPending]=useState(0),[error,setError]=useState('');
  const identity=ownerType+':'+ownerId,active=useRef(identity);active.current=identity;
  useEffect(()=>{let stopped=false;setReport({awards:[],placements:[],discrepancies:[],titles:{all_time:0,official_ranking:0}});setEditMode(false);setLoading(true);setError('');
    stageClient.http.get('/trophy-placements/entitlements?'+new URLSearchParams({owner_id:ownerId,owner_type:ownerType})).then(data=>{if(!stopped)setReport(data);}).catch(e=>{if(!stopped)setError(e.message);}).finally(()=>{if(!stopped)setLoading(false);});
    return()=>{stopped=true;};
  },[ownerId,ownerType]);
  async function mutate(action) {
    setPending(n=>n+1);
    try{await action();if(active.current===identity)setReport(await stageClient.http.get('/trophy-placements/entitlements?'+new URLSearchParams({owner_id:ownerId,owner_type:ownerType})));}
    catch(e){toast.error(e.message||'Cabinet change failed');}
    finally{setPending(n=>Math.max(0,n-1));}
  }
  const awards=report.awards||[];
  const placements=(report.placements||[]).filter(p=>awards.some(a=>p.award_id?a.id===p.award_id:!a.persisted&&a.trophy_item_id===p.trophy_item_id)).map(p=>{
    const award=awards.find(a=>p.award_id?a.id===p.award_id:a.trophy_item_id===p.trophy_item_id);
    return {...p,award,trophy_name:award?.display_name||award?.name||p.trophy_name,trophy_image_url:award?.image_url||p.trophy_image_url,win_count:1};
  });
  const available=awards.filter(a=>a.id&&a.persisted&&a.trophy_item_id&&!placements.some(p=>p.award_id===a.id));
  async function place(award,pos) {
    if(!editMode||!canEdit||!available.some(a=>a.id===award.id))return;
    pos=pos||[40,70].flatMap(y=>[20,40,60,80].map(x=>({x,y}))).find(spot=>placements.every(p=>Math.abs(Number(p.x_percent)-spot.x)>12||Math.abs(Number(p.y_percent)-spot.y)>15))||{x:50,y:50};
    await mutate(()=>stageClient.entities.TrophyPlacement.create({owner_id:ownerId,owner_type:ownerType,award_id:award.id,x_percent:pos.x,y_percent:pos.y,scale:1}));
  }
  async function done() {
    const drafts=placements.filter(p=>p.award_id&&!p.locked_at);
    if(!drafts.length){setEditMode(false);return;}
    const ok=await swalConfirm(t('trophy.confirmPermanent','Permanently place these {count} draft trophies? You will no longer be able to move, resize, remove or replace them. Previously locked trophies are unchanged.',{count:drafts.length}));
    if(!ok)return;
    await mutate(async()=>{await stageClient.http.post('/trophy-placements/confirm/'+ownerType+'/'+ownerId,{placement_ids:drafts.map(p=>p.id)});if(active.current===identity)setEditMode(false);});
  }
  if(loading)return <p role="status">Loading trophy history...</p>;
  return <section className="space-y-4">
    <header className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><Trophy size={18}/><h3 className="font-heading">{t('trophy.cabinet','Trophy Cabinet')}</h3><span className="text-xs text-muted-foreground">{report.titles?.all_time||0} all-time honours · {report.titles?.official_ranking||0} official titles</span></div>
    {canEdit&&<button type="button" disabled={pending>0} onClick={()=>editMode?done():setEditMode(true)} className="inline-flex items-center gap-2 text-primary disabled:opacity-40">{editMode?<Check size={16}/>:<Pencil size={16}/>} {editMode?t('trophy.done','Done'):t('trophy.edit','Edit')}</button>}</header>
    {error&&<p role="alert" className="text-destructive">{error}</p>}
    {!!report.discrepancies?.length&&<p role="status" className="text-xs text-warning">Some legacy records need admin review before permanent placement. Historical evidence is preserved.</p>}
    <TrophyCabinetCanvas placements={placements} editMode={editMode&&canEdit} onDrop={place} onMovePlaced={()=>{}} onMovePlacedSave={(id,changes)=>mutate(()=>stageClient.entities.TrophyPlacement.update(id,changes))} onRemovePlaced={id=>mutate(()=>stageClient.entities.TrophyPlacement.delete(id))} wonTournamentsMap={{}}/>
    <div className="flex flex-wrap gap-4">{available.map(award=><button type="button" key={award.id} disabled={!editMode||pending>0} className="w-32 border border-border p-2 text-left disabled:opacity-60" draggable={editMode} onDragStart={e=>e.dataTransfer.setData('trophy',JSON.stringify(award))} onClick={()=>place(award)} title={award.display_name||award.name}>{award.image_url?<img src={award.image_url} alt="" className="mx-auto h-16 w-16 object-contain"/>:<Trophy size={32}/>}<span className="block break-words text-xs">{award.display_name||award.name}</span></button>)}</div>
  </section>;
}

export function buildUnlockedMap(wonTournaments,allTrophies) {
  const map={};
  for(const win of wonTournaments)for(const trophy of allTrophies)if(win.trophy_item_id===trophy.id&&(!trophy.tournament_id||trophy.tournament_id===win.id)){
    if(!map[trophy.id])map[trophy.id]=[];
    if(!map[trophy.id].some(w=>w.source_id===win.source_id&&w.edition_id===win.edition_id))map[trophy.id].push(win);
  }
  return map;
}

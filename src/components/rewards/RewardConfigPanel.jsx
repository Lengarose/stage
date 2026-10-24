import { useEffect, useState } from 'react';
import { stageClient } from '@/api/stageClient';
import { getRewardConfiguration, saveRewardConfigs } from '@/lib/rewardsEngine';
import { getDefaultRewardRowsForSource } from '@/lib/prizeDefaults';
import { Save, RotateCcw, Upload } from 'lucide-react';
import { swalPrompt } from '@/lib/swal';
import EditionRewardReview from './EditionRewardReview';
import {useTranslation} from '@/hooks/useTranslation';

const labels={participation:'Participation Payment',winner_bonus:"Winner's Additional Prize",runner_up_bonus:"Runner-up's Additional Prize"};
function exact(value) {
  if(!/^\d+(\.\d{1,2})?$/.test(String(value)))throw new Error('Use nonnegative STC amounts with at most two decimal places.');
  const [whole,fraction='']=String(value).split('.');
  return BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'));
}
function money(value) {return `${(value/100n).toLocaleString()}.${String(value%100n).padStart(2,'0')} STC`;}
export default function RewardConfigPanel({sourceId,sourceType,sourceName,maxPositions=36}) {
  const {t}=useTranslation();
  const [config,setConfig]=useState(null);
  const [rows,setRows]=useState([]);
  const [count,setCount]=useState(maxPositions);
  const [trophyId,setTrophyId]=useState('');
  const [trophyUrl,setTrophyUrl]=useState('');
  const [items,setItems]=useState([]);
  const [dirty,setDirty]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const regional=sourceType==='regional_league';
  function accept(data) {
    setConfig(data);setCount(data.participant_count);
    const canonical=data.version?data.rows:regional?data.proposed:data.proposed.map(r=>({...r,position_label:labels[r.component_key]}));
    setRows(canonical);setTrophyId(data.settings.trophy_item_id||data.source.trophy_item_id||'');setTrophyUrl(data.settings.trophy_image_url||data.source.trophy_image_url||'');setDirty(!data.version);
  }
  useEffect(()=>{
    let stopped=false;setConfig(null);setError('');
    getRewardConfiguration(sourceId,sourceType).then(data=>{if(!stopped)accept(data);}).catch(e=>{if(!stopped)setError(e.message);});
    stageClient.entities.TrophyItem.list('name',500).then(data=>{if(!stopped)setItems(data);}).catch(()=>{});
    return ()=>{stopped=true;};
  },[sourceId,sourceType]);
  let budget=null,validation='';
  try {budget=rows.reduce((sum,r)=>sum+exact(r.stc_amount)*BigInt(!regional&&r.component_key==='participation'?count:1),0n);}
  catch(e){validation=e.message;}
  async function save() {
    const reason=await swalPrompt(t('admin.rewards.changeReason','Reason for changing the current reward configuration'));
    if(!reason)return;
    setBusy(true);setError('');
    try {
      const persisted=await saveRewardConfigs(sourceId,sourceType,sourceName,rows,{version:config.version,revision:config.revision,participant_count:Number(count),trophy_item_id:trophyId||null,trophy_image_url:trophyUrl,reason});
      accept(persisted);setDirty(false);
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  async function upload(event) {
    const file=event.target.files?.[0];if(!file)return;
    setBusy(true);setError('');
    try{const result=await stageClient.integrations.Core.UploadFile({file});setTrophyUrl(result.file_url);setDirty(true);}
    catch(e){setError(e.message);}finally{setBusy(false);}
  }
  if(!config)return <p role={error?'alert':'status'}>{error||t('admin.rewards.loadingConfiguration','Loading reward configuration...')}</p>;
  const field='min-w-0 border border-border bg-background p-2 text-sm';
  return <div className="space-y-5">
    <header className="flex flex-wrap justify-between gap-3 border-b border-border pb-3">
      <div><h4 className="font-bold">{regional?t('admin.rewards.regionalPositions','Regional Finishing Positions'):t('admin.rewards.gostComponents','GOST Participation And Bonuses')}</h4>
        <p className="text-xs text-muted-foreground">{dirty?t('admin.rewards.unsavedChanges','Unsaved changes'):t('admin.rewards.configurationVersion','Current configuration v{version}',{version:config.version})} · {t('admin.rewards.separateSnapshots','Edition snapshots remain separate')}</p></div>
      <button type="button" onClick={save} disabled={busy||!dirty||!!validation} className="inline-flex items-center gap-2 text-primary disabled:opacity-40"><Save size={16}/>{busy?t('admin.rewards.savingConfiguration','Saving...'):t('admin.rewards.saveConfiguration','Save')}</button>
    </header>
    {error&&<p role="alert" className="text-destructive">{error}</p>}
    {config.issues.length>0&&<details className="border-l-2 border-warning pl-3"><summary>Legacy configuration review ({config.issues.length})</summary>
      {config.issues.map((issue,i)=><p key={i} className="text-xs text-warning">{issue}</p>)}
      <p className="text-xs">Legacy rows are retained as evidence. Saving creates an explicit canonical version.</p></details>}
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="grid gap-1 text-xs">Budgeted Clubs<input aria-label="Budgeted Clubs" className={field} type="number" min="2" max={regional?20:36} value={count} onChange={e=>{
        const n=Number(e.target.value);setCount(n);setDirty(true);
        if(regional&&Number.isInteger(n)&&n>=2&&n<=20)setRows(getDefaultRewardRowsForSource('regional_league',{},n));
      }}/></label>
      <div className="self-end"><p className="text-xs text-muted-foreground">System-funded effective budget</p><strong>{budget===null?'Incomplete configuration':money(budget)}</strong></div>
    </div>
    {!regional&&<p className="text-sm">Every eligible club receives participation. Both finalists also receive their additional prize. Legacy bundled amounts require explicit review.</p>}
    {regional&&<div className="flex flex-wrap justify-between gap-2 text-xs"><span>Shared default: 54,000,000 STC to 21,700,000 STC · 757,000,000 STC for 20 clubs</span>
      <button type="button" className="inline-flex items-center gap-1 text-primary" onClick={()=>{try{setRows(getDefaultRewardRowsForSource('regional_league',{},Number(count)));setDirty(true);}catch(e){setError(e.message);}}}><RotateCcw size={14}/>Shared Schedule</button></div>}
    <div className="divide-y divide-border border-y border-border">
      {rows.map((row,i)=><div key={row.component_key||row.position} className="grid grid-cols-[minmax(0,1fr)_minmax(140px,220px)] items-center gap-3 py-2">
        <label htmlFor={`reward-${sourceId}-${i}`} className="text-sm">{regional?row.position_label:t(`admin.rewards.${row.component_key}`,labels[row.component_key])}</label>
        <div className="flex min-w-0 items-center gap-2"><input id={`reward-${sourceId}-${i}`} inputMode="decimal" className={field+' w-full text-right'} value={row.stc_amount} onChange={e=>{setRows(current=>current.map((r,j)=>j===i?{...r,stc_amount:e.target.value}:r));setDirty(true);}}/><span className="text-xs text-muted-foreground">STC</span></div>
      </div>)}
    </div>
    {validation&&<p role="status" className="text-warning">{validation}</p>}
    <section className="grid gap-3 border-b border-border pb-4 sm:grid-cols-2">
      <label className="grid gap-1 text-xs">Cabinet Trophy Design<select aria-label="Cabinet Trophy Design" value={trophyId} className={field} onChange={e=>{setTrophyId(e.target.value);setDirty(true);}}><option value="">Not configured</option>{items.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="grid gap-1 text-xs">Trophy Display Image<input aria-label="Trophy Display Image" className={field} value={trophyUrl} onChange={e=>{setTrophyUrl(e.target.value);setDirty(true);}}/></label>
      <div className="flex items-center gap-3">{trophyUrl&&<img src={trophyUrl} alt="Trophy display" className="h-16 w-16 object-contain"/>}<label className="inline-flex cursor-pointer items-center gap-2 text-xs text-primary"><Upload size={16}/>Upload Image<input type="file" accept="image/*" className="sr-only" onChange={upload} disabled={busy}/></label></div>
    </section>
    <EditionRewardReview sourceId={sourceId} sourceType={sourceType} configurationVersion={config.version}/>
  </div>;
}

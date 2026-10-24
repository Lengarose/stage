import {useEffect,useState} from 'react';
import {stageClient} from '@/api/stageClient';
import {swalPrompt} from '@/lib/swal';
import {RefreshCw} from 'lucide-react';
import {useTranslation} from '@/hooks/useTranslation';

export default function EditionRewardReview({sourceId,sourceType,configurationVersion}) {
  const {t}=useTranslation();
  const [editions,setEditions]=useState([]),[edition,setEdition]=useState(sourceType==='regional_league'?sourceId:'');
  const [report,setReport]=useState(null),[adoption,setAdoption]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const kind=sourceType==='regional_league'?'regional_league':'competition_season';
  useEffect(()=>{let active=true;setReport(null);setAdoption(null);setError('');setEdition(sourceType==='regional_league'?sourceId:'');
    if(sourceType==='competition')stageClient.entities.CompetitionSeason.filter({competition_id:sourceId},'-season_number',500).then(rows=>{if(active)setEditions(rows.sort((a,b)=>Number(b.season_number)-Number(a.season_number)));}).catch(e=>{if(active)setError(e.message);});
    return ()=>{active=false;};
  },[sourceId,sourceType]);
  async function action(name,apply=false) {
    if(!edition)return;
    const reason=apply||name==='adopt_reward_configuration'?await swalPrompt('Reason for the reviewed edition reward action'):'Read-only reward review';
    if(!reason)return;
    setBusy(true);setError('');
    try {
      const result=await stageClient.http.post(`/competition-views/${kind}/${encodeURIComponent(edition)}/reconcile`,{action:name,apply,reason,version:configurationVersion});
      if(name==='adopt_reward_configuration') {setAdoption(result);if(apply)setReport(null);}
      else setReport(result.settlement||result);
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  return <section className="space-y-3" aria-label="Edition reward review">
    <h4 className="font-bold">{t('admin.rewards.editionSettlement','Edition Snapshot And Settlement')}</h4>
    {sourceType==='competition'&&<label className="grid gap-1 text-xs">Edition<select aria-label="Reward Edition" value={edition} onChange={e=>{setEdition(e.target.value);setReport(null);setAdoption(null);}} className="border border-border bg-background p-2"><option value="">Select edition</option>{editions.map(e=><option key={e.id} value={e.id}>{e.season_label||`Season ${e.season_number}`} · {e.status}</option>)}</select></label>}
    <div className="flex flex-wrap gap-4 text-sm">
      <button type="button" className="inline-flex items-center gap-1 text-primary disabled:opacity-40" disabled={!edition||busy} onClick={()=>action('prizes')}><RefreshCw size={14}/>{t('admin.rewards.reviewPayments','Review Payments')}</button>
      <button type="button" className="text-primary disabled:opacity-40" disabled={!edition||busy||!configurationVersion} onClick={()=>action('adopt_reward_configuration')}>Preview Current Schedule For This Edition</button>
      {report&&<button type="button" className="text-primary disabled:opacity-40" disabled={busy} onClick={()=>action('prizes',true)}>Settle Proven Unpaid Amounts</button>}
      {report&&['paid','zero_prize'].includes(report.state)&&<button type="button" className="text-primary disabled:opacity-40" disabled={busy} onClick={()=>action('archive',true)}>Archive Settled Edition</button>}
    </div>
    {error&&<p role="alert" className="text-destructive">{error}</p>}
    {adoption&&<div className="border-l-2 border-warning pl-3 text-sm"><p>Proposed budget: {adoption.proposed?.budget} STC · version {adoption.proposed?.version}</p><p>This is a new reviewed promise, not evidence of the original historical schedule. Existing payment evidence blocks replacement.</p>
      <p>{adoption.differs?'The proposed configuration differs from the original snapshot.':'The proposed configuration matches the original snapshot.'}</p>
      <details><summary>Original And Proposed Configuration</summary><pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify({original:adoption.original,proposed:adoption.proposed},null,2)}</pre></details>
      <button type="button" className="mt-2 text-primary disabled:opacity-40" disabled={busy||!adoption.dry_run} onClick={()=>action('adopt_reward_configuration',true)}>Apply Reviewed Configuration To Unpaid Edition</button></div>}
    {report&&<><p role="status" className="text-sm">Settlement: {report.state} · Trophy: {report.trophy_state||'Not reviewed'}</p>
      <details><summary className="text-xs">Captured Edition Configuration</summary><pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(report.config||null,null,2)}</pre></details>
      {report.blocking_reasons?.map((r,i)=><p key={i} className="text-xs text-warning">{r}</p>)}
      <div className="max-h-96 overflow-auto"><table className="w-full text-xs"><thead><tr>{['Club','Component / Position','Expected STC','Proven Paid','Missing','Status'].map(h=><th key={h} className="p-2 text-left">{h}</th>)}</tr></thead><tbody>
        {report.obligations?.map(o=><tr key={o.key} className="border-t border-border"><td className="p-2">{o.recipient_name||o.recipient_id||'Unresolved'}</td><td className="p-2">{o.component_key||o.position}</td><td className="p-2">{o.expected_amount}</td><td className="p-2">{o.proven_payment}</td><td className="p-2">{o.missing_amount}</td><td className="p-2">{o.blocking_reasons?.join('; ')||'Verified'}</td></tr>)}
      </tbody></table></div></>}
  </section>;
}

import {useState} from 'react';
import {stageClient} from '@/api/stageClient';
import {swalPrompt} from '@/lib/swal';
import {useTranslation} from '@/hooks/useTranslation';
import {RefreshCw,Check} from 'lucide-react';

export default function DivisionTwoRewardReview({onApplied}) {
  const {t}=useTranslation();
  const [review,setReview]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function run(apply=false) {
    const sources=review?.sources.filter(s=>s.needs_update)||[];
    const reason=apply?await swalPrompt(t('admin.rewards.divisionTwoReason','Reason for applying the reviewed Division 2 schedule')):null;
    if(apply&&!reason)return;
    setBusy(true);setError('');
    try {
      const response=await stageClient.http.post('/reward-configs/regional-division-two',{apply,reason,sources:sources.map(s=>({id:s.id,version:s.version,revision:s.revision}))});
      setReview(response);
      if(apply)onApplied();
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  return <section className="space-y-3 border-y border-border py-4">
    <h4 className="font-bold">{t('admin.rewards.divisionTwoReview','Division 2 Source Configuration Review')}</h4>
    <p className="text-xs text-muted-foreground">{t('admin.rewards.divisionTwoReviewHint','Updates source settings only. Captured editions, paid history and trophies remain unchanged; no payouts run here.')}</p>
    <div className="flex flex-wrap gap-4 text-sm">
      <button type="button" disabled={busy} className="inline-flex items-center gap-2 text-primary disabled:opacity-40" onClick={()=>run()}><RefreshCw size={14}/>{t('admin.rewards.reviewDivisionTwo','Review Division 2 Sources')}</button>
      {review&&<button type="button" disabled={busy||!review.sources.some(s=>s.needs_update)} className="inline-flex items-center gap-2 text-primary disabled:opacity-40" onClick={()=>run(true)}><Check size={14}/>{t('admin.rewards.applyDivisionTwo','Apply Reviewed Source Schedules')}</button>}
    </div>
    {error&&<p role="alert" className="text-destructive text-sm">{error}</p>}
    {review&&<div className="max-h-80 overflow-auto text-xs">
      {!review.sources.length&&<p>No explicitly identified Division 2 sources found.</p>}
      {review.sources.map(source=><div key={source.id} className="border-t border-border py-2 break-words"><strong>{source.name}</strong> · Division 2 · {source.region} · {source.platform}<br/>
        v{source.version} · {source.participant_count} clubs · Current {source.current_budget==null?'unversioned':`${Number(source.current_budget).toLocaleString()} STC`} · Proposed {Number(source.proposed_budget).toLocaleString()} STC · {source.needs_update?'Update available':'Schedule current'}
        {source.snapshot&&<p className="text-warning">Captured edition {source.snapshot.edition_id} ({source.snapshot.state}) preserved. Review any snapshot amendment separately.</p>}
      </div>)}
      {review.results?.map(result=><p key={result.id} className={result.error?'text-destructive':'text-muted-foreground'}>{result.id}: {result.error||(result.changed?'New source version saved':'Already current')}</p>)}
    </div>}
  </section>;
}

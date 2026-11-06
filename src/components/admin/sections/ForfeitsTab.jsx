import {useEffect,useRef,useState} from 'react';
import {stageClient} from '@/api/stageClient';
import {loadForfeitReviewPage} from '@/lib/adminForfeitReview';
import {evidenceLink} from '@/lib/adminDisputeEvidence';
import EmptyState from '@/components/admin/shared/EmptyState';
import {Button} from '@/components/ui/button';
import {useTranslation} from '@/hooks/useTranslation';
import {Flag,Check,X} from 'lucide-react';

export default function ForfeitsTab({resolveForfeit,feed}) {
  const {t}=useTranslation();
  const [page,setPage]=useState(null),[error,setError]=useState(''),[refresh,setRefresh]=useState(0),[cursors,setCursors]=useState(['']);
  const [busy,setBusy]=useState(''),[actionError,setActionError]=useState('');
  const busyRef=useRef(false),mounted=useRef(false);
  const cursor=cursors.at(-1),current=page?.request_cursor===cursor?page:null;
  useEffect(()=>{mounted.current=true;return ()=>{mounted.current=false;};},[]);
  useEffect(()=>{
    let active=true;setPage(null);setError('');setActionError('');
    loadForfeitReviewPage(stageClient,cursor).then(result=>{if(active)setPage(result);}).catch(err=>{if(active)setError(err.message);});
    return ()=>{active=false;};
  },[cursor,refresh,feed]);
  async function decide(match,approve) {
    if(busyRef.current)return;
    busyRef.current=true;setBusy(match.id);setActionError('');
    try {
      const success=await resolveForfeit(match,approve);
      if(mounted.current && success)setRefresh(value=>value+1);
    }catch{if(mounted.current)setActionError('The claim could not be processed. Refresh and review it before retrying.');}
    finally {busyRef.current=false;if(mounted.current)setBusy('');}
  }
  return <>
    <section aria-label="Forfeit review list controls" className="mb-4 space-y-2 border-b border-border pb-4 text-sm">
      <p>Up to 50 pending forfeit claims per page. Each selected claim is checked again before a decision is submitted.</p>
      <div className="flex flex-wrap items-center gap-5">
        <button type="button" disabled={!!busy} className="min-h-11 font-semibold disabled:opacity-40" onClick={()=>{setCursors(['']);setRefresh(v=>v+1);}}>Refresh from first page →</button>
        <button type="button" disabled={!!busy || !current || cursors.length===1} className="min-h-11 font-semibold disabled:opacity-40" onClick={()=>setCursors(v=>v.slice(0,-1))}>Previous page</button>
        <button type="button" disabled={!!busy || !current?.has_more} className="min-h-11 font-semibold disabled:opacity-40" onClick={()=>setCursors(v=>[...v,current.next_cursor])}>Next page →</button>
        <span>Page {cursors.length}</span>
      </div>
      {error?<p role="alert" className="text-destructive">Could not load forfeit claims: {error}</p>:!current?<p role="status">Loading forfeit claims…</p>:!current.items.length && cursors.length>1?<p>No pending claims remain on this page. Go back or refresh from the first page.</p>:null}
      {actionError && <p role="alert" className="text-destructive">{actionError}</p>}
    </section>
    {current && !error && !current.items.length && cursors.length===1?<EmptyState icon={Flag} text={t('admin.forfeits.noPendingRequests')}/>:<div className="space-y-3">
      {(current?.items || []).map(match=>{
        const claimer=match.forfeit_claimed_by===match.home_club_id?match.home_club_name:match.away_club_name;
        const proof=evidenceLink(match.forfeit_proof_url);
        return <div key={match.id} className="flex flex-col gap-4 rounded border border-warning/20 bg-card p-5 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="font-bold text-foreground">{match.home_club_name || match.home_player_name || 'Home'} vs {match.away_club_name || match.away_player_name || 'Away'}</p>
            {match.home_score!=null && match.away_score!=null && <p className="text-sm">{match.home_score} – {match.away_score}</p>}
            <p className="mt-1 text-xs text-muted-foreground">{t('admin.forfeits.claimedBy',{name:claimer || 'Unknown club'})}</p>
            {proof?<a href={proof} target="_blank" rel="noreferrer" className="mt-1 block text-xs text-primary underline">{t('admin.forfeits.viewProof')}</a>:match.forfeit_proof_url?<p className="text-xs text-destructive">The proof link is unavailable.</p>:null}
          </div>
          <div className="flex shrink-0 gap-2">
            <Button type="button" size="sm" disabled={!!busy} onClick={()=>decide(match,true)} className="gap-1 border-0 bg-success/20 text-success hover:bg-success/30"><Check className="h-4 w-4"/>{t('admin.actions.approve')}</Button>
            <Button type="button" size="sm" variant="outline" disabled={!!busy} onClick={()=>decide(match,false)} className="gap-1 border-destructive/30 text-destructive hover:bg-destructive/10"><X className="h-4 w-4"/>{t('admin.actions.reject')}</Button>
          </div>
        </div>;
      })}
    </div>}
  </>;
}

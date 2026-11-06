import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from 'react-router-dom';
import { stageClient } from '@/api/stageClient';
import { loadFocusedDispute,loadDisputeReviewPage } from '@/lib/adminDisputeFocus';
import AdminEconomyTestPanel from "@/components/admin/economy/AdminEconomyTestPanel";
import AdminEconomyPanel from "@/components/admin/economy/AdminEconomyPanel";
import AdminWagersPanel from "@/components/admin/economy/AdminWagersPanel";
import EmptyState from "@/components/admin/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { AlertTriangle, Gavel } from "lucide-react";
import DisputeEvidence from '@/components/admin/disputes/DisputeEvidence';
import DisputeProofDialog from '@/components/admin/disputes/DisputeProofDialog';

export default function DisputesTab({ disputes, setResolveDialog, setSelectedWinner, showEconomyPanels = true }) {
  const { t } = useTranslation();
  const [previewProof, setPreviewProof] = useState(null);
  const [params,setParams]=useSearchParams();
  const matchId=params.get('match') || '';
  const [focused,setFocused]=useState(null);
  const [focusError,setFocusError]=useState('');
  const [focusRefresh,setFocusRefresh]=useState(0);
  const [opening,setOpening]=useState(false);
  const focusVersion=useRef(0);
  const [page,setPage]=useState(null),[pageError,setPageError]=useState(''),[pageRefresh,setPageRefresh]=useState(0),[cursors,setCursors]=useState(['']);
  const cursor=cursors.at(-1);
  const currentPage=page?.request_cursor===cursor?page:null;
  useEffect(()=>{
    let active=true;setPage(null);setPageError('');setPreviewProof(null);
    if(!matchId)loadDisputeReviewPage(stageClient,cursor).then(result=>{if(active)setPage(result);}).catch(err=>{if(active)setPageError(err.message);});
    return ()=>{active=false;};
  },[matchId,cursor,pageRefresh,disputes]);
  useEffect(()=>{
    const version=++focusVersion.current;let active=true;setFocused(null);setFocusError('');setPreviewProof(null);setOpening(false);
    if(matchId)loadFocusedDispute(stageClient,matchId).then(result=>{if(active)setFocused(result);}).catch(err=>{if(active)setFocusError(err.message);});
    return ()=>{active=false;if(focusVersion.current===version)focusVersion.current++;};
  },[matchId,focusRefresh,disputes]);
  const current=focused?.id===matchId?focused:null;
  const visible=matchId?(current?.status==='review'?[current.match]:[]):currentPage?.items || [];
  const focusPending=matchId && !current && !focusError;
  async function openResolution(match) {
    if(!matchId){const next=new URLSearchParams(params);next.set('match',match.id);setParams(next);return;}
    if(opening)return;
    const version=focusVersion.current;
    setOpening(true);setFocusError('');
    try {
      const fresh=await loadFocusedDispute(stageClient,matchId);
      if(focusVersion.current!==version)return;
      setFocused(fresh);
      if(fresh.status==='review'){setResolveDialog({match:fresh.match,type:fresh.match._source});setSelectedWinner('');}
    }catch(err){if(focusVersion.current===version){setFocused(null);setFocusError(err.message);}}
    finally {if(focusVersion.current===version)setOpening(false);}
  }

  return (
    <>
      {showEconomyPanels && !matchId && (
        <>
          <AdminEconomyTestPanel />
          <AdminEconomyPanel />
          <AdminWagersPanel />
        </>
      )}
      {matchId && <div className="mb-4 space-y-2 border-b border-border pb-4 text-sm">
        <p className="break-all font-semibold">Focused result review · {matchId}</p>
        <p>The selected match is loaded directly, independently of the general dispute list. Opening this view does not decide a result.</p>
        <div className="flex flex-wrap gap-5"><button type="button" disabled={opening} onClick={()=>setFocusRefresh(v=>v+1)} className="min-h-11 font-semibold disabled:opacity-40">Refresh selected match →</button><button type="button" disabled={opening} onClick={()=>{const next=new URLSearchParams(params);next.delete('match');setParams(next);}} className="min-h-11 font-semibold disabled:opacity-40">Show general dispute list →</button><Link to={`/game-day?match=${encodeURIComponent(matchId)}`} className="inline-flex min-h-11 items-center font-semibold">Open match evidence →</Link></div>
        {focusPending && <p role="status">Loading the selected match…</p>}
        {focusError && <p role="alert" className="text-destructive">Could not load the selected review: {focusError}. Refresh to try again.</p>}
        {current?.status==='not_pending' && <p role="status">This match no longer has a pending dispute or Admin-review state. No resolution action is offered. Refresh the regional overview for its latest status.</p>}
      </div>}
      {!matchId && <section className="mb-4 space-y-2 border-b border-border pb-4 text-sm" aria-label="Result review list controls">
        <p>Up to 50 pending result reviews per page. Open a match to read its latest evidence before deciding.</p>
        <div className="flex flex-wrap items-center gap-5"><button type="button" disabled={opening} onClick={()=>{setCursors(['']);setPageRefresh(v=>v+1);}} className="min-h-11 font-semibold disabled:opacity-40">Refresh from first page →</button><button type="button" disabled={opening || !currentPage || cursors.length===1} onClick={()=>setCursors(v=>v.slice(0,-1))} className="min-h-11 font-semibold disabled:opacity-40">Previous page</button><button type="button" disabled={opening || !currentPage?.has_more} onClick={()=>setCursors(v=>[...v,currentPage.next_cursor])} className="min-h-11 font-semibold disabled:opacity-40">Next page →</button><span>Page {cursors.length}</span></div>
        {pageError?<p role="alert" className="text-destructive">Could not load result reviews: {pageError}. Refresh to try again.</p>:!currentPage?<p role="status">Loading result reviews…</p>:!currentPage.items.length && cursors.length>1?<p role="status">No pending reviews remain on this page. Go back or refresh from the first page.</p>:null}
      </section>}
      {!matchId && currentPage && !pageError && visible.length === 0 && cursors.length===1 ? (
        <EmptyState icon={AlertTriangle} text={t("admin.disputes.noDisputedMatches")} />
      ) : (
        <div className="space-y-3">
          {visible.map(m => {
            const homeLbl = (m.home_club_name || m.home_player_name) ?? t("admin.disputes.home");
            const awayLbl = (m.away_club_name || m.away_player_name) ?? t("admin.disputes.away");
            return (
              <div key={m.id} className="bg-card border border-destructive/20 rounded p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] px-2 py-0.5 rounded border border-destructive/30 bg-destructive/10 text-destructive font-bold uppercase tracking-wider">{m.result_state==='ADMIN_REVIEW'?'Admin review':t("admin.disputes.disputed")}</span>
                  </div>
                  <p className="font-bold text-foreground">{homeLbl} vs {awayLbl}</p>
                  <div className="mt-3"><DisputeEvidence match={m} onPreview={setPreviewProof} /></div>
                </div>
                <Button type="button" disabled={opening} onClick={() => openResolution(m)} className="bg-primary text-primary-foreground shrink-0 gap-2" size="sm">
                  <Gavel className="w-4 h-4" /> {matchId?t("admin.disputes.resolve"):'Review this match'}
                </Button>
              </div>
            );
          })}
        </div>
      )}
      {previewProof && <DisputeProofDialog key={`${previewProof.url}:${previewProof.label}`} proof={previewProof} onClose={()=>setPreviewProof(null)} />}
    </>
  );
}

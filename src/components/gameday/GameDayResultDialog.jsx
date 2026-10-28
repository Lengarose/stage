import {useState} from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {X} from 'lucide-react';
import {stageClient} from '@/api/stageClient';
import {penaltyOutcome} from '@/lib/penaltyOutcome';
import {sameResultSnapshot} from '@/lib/gameDayResultFlow';
import GameDayMatchResult from './GameDayMatchResult';
export default function GameDayResultDialog({report,onClose}) {
  const [dirty,setDirty]=useState(false),[busy,setBusy]=useState(false),[discard,setDiscard]=useState(false);
  const [game,setGame]=useState(report.game);
  const [formRevision,setFormRevision]=useState(0);
  const [conflict,setConflict]=useState(null);
  const readOnly=report.readOnly||game.status==='completed';
  function requestClose(){if(busy)return;if(dirty)setDiscard(true);else onClose();}
  async function beforeSubmit(){
    const fresh=await stageClient.entities.Match.get(game.id);
    if(!fresh||!sameResultSnapshot(game,fresh)){
      setConflict(fresh?`${fresh.status} · ${fresh.result_state || 'Awaiting result'}`:'Match no longer available');
      const error=new Error('A newer result proposal is available. Your input is retained until you choose Refresh and review.');
      error.code='RESULT_CHANGED';
      throw error;
    }
  }
  async function refreshReview(){
    if(busy)return;
    setBusy(true);
    try{
      const fresh=await stageClient.entities.Match.get(game.id);
      if(!fresh||fresh.id!==game.id)throw new Error('Match no longer available.');
      setGame(fresh);setFormRevision(n=>n+1);setDirty(false);setDiscard(false);setConflict(null);
    }catch(error){setConflict(error.message);}finally{setBusy(false);}
  }
  return <Dialog.Root open onOpenChange={open=>{if(!open)requestClose();}}><Dialog.Portal>
    <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/75 backdrop-blur-sm"/>
    <Dialog.Content aria-describedby="gameday-result-description" style={{width:'min(48rem, calc(100vw - 1rem))'}} className="fixed left-1/2 top-1/2 z-[81] flex max-h-[96dvh] min-w-0 max-w-full -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden border border-border bg-background text-foreground shadow-2xl sm:max-h-[90dvh]" onEscapeKeyDown={e=>{e.preventDefault();requestClose();}} onPointerDownOutside={e=>{e.preventDefault();requestClose();}}>
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border p-4"><div className="min-w-0"><Dialog.Title className="font-heading text-xl font-black uppercase">{report.readOnly?'Match Report':'Report / Review Result'}</Dialog.Title><Dialog.Description id="gameday-result-description" className="mt-1 break-words text-xs text-muted-foreground">{game.home_club_name||game.home_player_name} vs {game.away_club_name||game.away_player_name} · {game.competition_name||game.competition_context||'Match'}</Dialog.Description></div><button type="button" aria-label="Close match report" disabled={busy} onClick={requestClose} className="flex h-11 w-11 shrink-0 items-center justify-center focus-visible:ring-2 focus-visible:ring-cyan-400"><X size={20}/></button></header>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6" onChangeCapture={()=>setDirty(true)} onClickCapture={e=>{if(e.target.closest('button'))setDirty(true);}}>
        {conflict&&<div role="alert" className="mb-4 border border-destructive p-3 text-sm"><p>{conflict}</p><p className="mt-2 text-xs text-muted-foreground">Refresh replaces unsent inputs with the latest report. Review its score and penalty decision before confirming.</p><button type="button" onClick={refreshReview} disabled={busy} className="mt-2 min-h-11 text-primary">Refresh and review</button></div>}
        {readOnly?<div className="space-y-3"><p className="font-heading text-3xl font-bold">{game.home_score} - {game.away_score}</p><p>{penaltyOutcome(game)}</p><p className="text-sm text-muted-foreground">Official match result. Result changes require the existing authorised correction/review workflow.</p>
          {report.stats?.length>0?<div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="py-3 text-left font-bold">Recorded player statistics</caption><thead><tr>{['Player','Club','Position','Goals','Assists','Rating','Player of the Match'].map(label=><th key={label} className="border-b border-border p-2">{label}</th>)}</tr></thead><tbody>{report.stats.map(stat=><tr key={stat.id||`${stat.club_id}:${stat.player_id}`}><td className="p-2">{stat.player_gamertag||stat.player_name||stat.player_id}</td><td className="p-2">{stat.club_name||stat.club_id||'—'}</td><td className="p-2">{stat.position||'—'}</td><td className="p-2">{stat.goals??'—'}</td><td className="p-2">{stat.assists??'—'}</td><td className="p-2">{stat.rating??'—'}</td><td className="p-2">{Number(stat.man_of_match||stat.is_motm)===1?'Yes':'—'}</td></tr>)}</tbody></table></div>:<p className="text-sm text-muted-foreground">No individual player statistics recorded.</p>}
        </div>:<GameDayMatchResult key={formRevision} game={game} myClub={report.myClub} myPlayer={report.myPlayer} isHomeTeam={report.isHomeTeam} onBeforeSubmit={beforeSubmit} onConflict={setConflict} onBusyChange={setBusy} onSubmitted={async(...args)=>{await report.onSubmitted?.(...args);onClose();}}/>}
      </div>
      <footer className="shrink-0 border-t border-border p-3">{discard?<div role="alert" className="flex flex-wrap items-center gap-3 text-sm"><span>Discard unsaved report changes?</span><button type="button" autoFocus onClick={onClose} className="min-h-11 px-3 text-destructive">Discard changes</button><button type="button" onClick={()=>setDiscard(false)} className="min-h-11 px-3 text-primary">Keep editing</button></div>:<button type="button" disabled={busy} onClick={requestClose} className="min-h-11 px-3 text-sm focus-visible:ring-2 focus-visible:ring-cyan-400">{report.readOnly?'Close':'Cancel'}</button>}</footer>
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>;
}

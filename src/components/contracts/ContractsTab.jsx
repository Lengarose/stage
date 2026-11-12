import {useEffect,useState} from 'react';
import {stageClient} from '@/api/stageClient';
import ClubBoardPanel from '@/components/board/ClubBoardPanel';
import OfferContractDialog from './OfferContractDialog';
import {formatSTC} from '@/lib/playerValue';
export default function ContractsTab({club,players=[],myPlayer,canManage,onPlayerReleased}){
 const [target,setTarget]=useState(null),[history,setHistory]=useState([]),[error,setError]=useState('');
 useEffect(()=>{stageClient.entities.PlayerContract.filter({team_id:club.id}).then(rows=>setHistory(rows)).catch(e=>setError(e.message));},[club.id,target]);
 async function released(playerId) {
   const releasedPlayer=await stageClient.entities.Player.get(playerId);
   if(String(releasedPlayer?.club_id || "") !== String(club.id || "")) onPlayerReleased?.(playerId, releasedPlayer);
   setHistory(await stageClient.entities.PlayerContract.filter({team_id:club.id}));
 }
 return <div className="space-y-6">{canManage?<><ClubBoardPanel club={club} players={players} onPlayerReleased={released} onOffer={(agreement,purpose)=>setTarget({...players.find(p=>p.id===agreement.player_id),id:agreement.player_id,purpose,existingContract:{id:agreement.player_contract_id,contract_type:agreement.squad_role,weekly_salary_stc:agreement.weekly_salary_stc,performance_targets:agreement.performance_targets}})}/><section className="border border-white/15 p-4"><h3 className="font-heading uppercase text-white">Propose player terms</h3><p className="mt-2 text-xs text-white/50">Importance, duration and compensation are separate. Your own pay is reviewed by the Club Board.</p><div className="mt-3 flex flex-wrap gap-2">{players.map(player=><button type="button" key={player.id} className="border border-white/20 px-3 py-2 text-sm text-white hover:bg-blue-200/10" onClick={()=>setTarget({...player,existingContract:history.find(c=>c.user_id===player.id&&c.status==='active'&&c.contract_type!=='ownership')})}>{player.gamertag}</button>)}</div></section></>:<p className="text-sm text-muted-foreground">Your club agreements are listed below. Personal offers and responses are available in Inbox.</p>}
 {error&&<p role="alert" className="text-red-200">{error}</p>}
 <details className="border border-white/15 p-4 text-white"><summary className="font-heading uppercase">Historical and ownership documents</summary><p className="mt-2 text-xs text-white/50">Historical compensation promises and payment evidence are retained. An old displayed bonus is not proof that it was paid.</p>{history.filter(c=>canManage||c.user_id===myPlayer?.id).map(c=><div key={c.id} className="border-t border-white/10 py-3 text-sm"><p>{c.contract_type==='ownership'?'Club ownership — separate from paid management':c.compensation_policy_version?'Player agreement':c.contract_type?.startsWith('founder')?'Historical founder player document':'Historical player document'} · {c.status}</p><p className="mt-1 text-xs text-white/50">Recorded weekly pay {formatSTC(c.weekly_salary_stc||0)} · recorded bonus promise {formatSTC(c.signing_bonus_stc||0)}</p>{canManage&&!c.compensation_policy_version&&c.contract_type!=='ownership'&&c.status==='active'&&<button type="button" className="mt-2 border border-white/20 px-3 py-2 text-xs" onClick={()=>setTarget({...players.find(p=>p.id===c.user_id),id:c.user_id,existingContract:c})}>Propose amended terms</button>}</div>)}</details>
 <OfferContractDialog open={Boolean(target)} player={target} club={club} purpose={target?.purpose} existingContract={target?.existingContract} isNegotiation={Boolean(target?.existingContract)} onClose={()=>setTarget(null)}/>
 </div>;
}

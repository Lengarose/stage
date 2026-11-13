import { useEffect,useState } from 'react';
import { resolveMyPlayerAndClub,stageClient } from '@/api/stageClient';
import OfferContractDialog from '@/components/contracts/OfferContractDialog';
export default function CreateContract(){
 const [club,setClub]=useState(null),[players,setPlayers]=useState([]),[target,setTarget]=useState(null),[error,setError]=useState('');
 useEffect(()=>{let active=true;Promise.all([resolveMyPlayerAndClub(),stageClient.entities.Player.list('-created_date',200)]).then(([identity,rows])=>{if(active){setClub(identity.club);setPlayers(rows);}}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[]);
 return <div className="mx-auto max-w-3xl space-y-5 p-6 text-white"><h1 className="font-heading text-3xl uppercase">Player agreements</h1><p className="text-sm text-white/60">Choose a player, then review Card Level limits, duration and affordability before sending a proposal.</p>{error&&<p role="alert">{error}</p>}{!club?<p>A club with contract permissions is required.</p>:players.map(player=><button type="button" key={player.id} onClick={()=>setTarget(player)} className="flex w-full justify-between border-b border-white/15 px-3 py-4 text-left hover:bg-blue-200/5"><span>{player.gamertag}</span><span className="text-white/50">{player.position}</span></button>)}<OfferContractDialog open={Boolean(target)} onClose={()=>setTarget(null)} player={target} club={club}/></div>;
}

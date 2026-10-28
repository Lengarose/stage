import { useEffect, useState } from 'react';
import { stageClient } from '@/api/stageClient';
import ParticipantDirectory from '@/components/competition/ParticipantDirectory';
export default function PlayerRegistrantList({ playerIds = [], myId }) {
  const [players,setPlayers]=useState(null),[error,setError]=useState(''),[revision,setRevision]=useState(0);
  const key=[...new Set(playerIds.map(String))].sort().join(',');
  useEffect(()=>{let active=true;setPlayers(null);Promise.all(key?key.split(',').map(id=>stageClient.entities.Player.get(id)):[]).then(rows=>{if(active){setPlayers(rows.filter(Boolean));setError('');}}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[key,revision]);
  if(error)return <p role="alert">{error}<button type="button" className="ml-3 min-h-11 text-primary" onClick={()=>setRevision(n=>n+1)}>Retry</button></p>;
  if(!players)return <p role="status">Loading participants...</p>;
  return <ParticipantDirectory participants={players} player myId={myId}/>;
}

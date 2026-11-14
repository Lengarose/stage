import { useEffect, useState } from 'react';
import { ArrowUpRight, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import IdentityAvatar from '@/components/profile/IdentityAvatar';
import { CardLevelBadge } from '@/components/card/CardProgression';
import { getCountryShortName } from '@/lib/countryDisplay';
const PAGE_SIZE=12;
export default function TransferTalentBoard({entries,viewMode,selected,onSelect}) {
  const [page,setPage]=useState(0);
  useEffect(()=>setPage(0),[entries]);
  const pages=Math.max(1,Math.ceil(entries.length/PAGE_SIZE)),current=Math.min(page,pages-1);
  if(!entries.length)return <div className="tr-empty"><Search size={32}/><h3>No players found</h3><p>Try another name, position or platform.</p></div>;
  return <div><div className={viewMode==='cards'?'tr-player-grid':'tr-player-list'}>{entries.slice(current*PAGE_SIZE,(current+1)*PAGE_SIZE).map(entry=>{
    const {player,badgeType,days_left}=entry;
    const free=badgeType==='free_agent';
    return <button type="button" key={player.id} className={`tr-player-card ${selected?.player.id===player.id?'is-selected':''}`} aria-pressed={selected?.player.id===player.id} onClick={()=>onSelect(entry)}>
      <div className="tr-player-art" aria-hidden="true" style={player.avatar_url?{backgroundImage:`url(${JSON.stringify(player.avatar_url)})`}:undefined}/>
      <div className="tr-player-card-top"><span className={`tr-player-status ${free?'is-free':''}`}>{free?'Free agent':days_left!=null?`${days_left} days left`:'Expiring'}</span><ArrowUpRight size={18}/></div>
      <div className="tr-player-identity"><IdentityAvatar src={player.avatar_url} name={player.gamertag} position={player.avatar_position} zoom={player.avatar_zoom} className="tr-player-avatar"/><span className="tr-position">{player.position || 'PLAYER'}</span></div>
      <div className="tr-player-copy"><p className="tr-player-country">{getCountryShortName(player.country_code,player.country) || 'Global'} · {player.platform || 'Platform not set'}</p><h3>{player.gamertag || 'Player'}</h3><div className="tr-player-facts"><span>{player.matches_played ?? 0}<small>Matches</small></span><span>{player.goals ?? 0}<small>Goals</small></span><span>{player.assists ?? 0}<small>Assists</small></span></div><div className="tr-player-value"><CardLevelBadge playerId={player.id}/><span>{badgeType==='free_agent'?'Free agent':'Final 14 days'}<small>Contract-only recruitment</small></span></div></div>
    </button>;
  })}</div><div className="tr-pagination"><p>{entries.length} {entries.length===1?'player':'players'} · page {current+1} of {pages}</p><div><button type="button" aria-label="Previous player page" disabled={current===0} onClick={()=>setPage(n=>n-1)}><ChevronLeft size={18}/></button><button type="button" aria-label="Next player page" disabled={current>=pages-1} onClick={()=>setPage(n=>n+1)}><ChevronRight size={18}/></button></div></div></div>;
}

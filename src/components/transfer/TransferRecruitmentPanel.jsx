import { ArrowUpRight, FileText, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import IdentityAvatar from '@/components/profile/IdentityAvatar';
import { getCountryShortName } from '@/lib/countryDisplay';
export default function TransferRecruitmentPanel({entry,canManage,canOffer,getOfferBlockReason,onOffer,officialRecruitment,windowOpen}){
  if(!entry)return <div className="tr-detail"><p className="tr-detail-kicker">Player dossier</p><UserRound size={35}/><h3 className="mt-5">Your next signing</h3><p className="tr-detail-meta">Select a player to explore their profile and recruitment options.</p></div>;
  const {player,contract,badgeType,days_left}=entry,blocked=getOfferBlockReason(player,contract),allowed=canOffer(player,contract);
  return <div className="tr-detail"><p className="tr-detail-kicker">Player dossier / {player.position || 'Talent'}</p><IdentityAvatar src={player.avatar_url} name={player.gamertag} position={player.avatar_position} zoom={player.avatar_zoom} className="tr-detail-avatar"/><h3>{player.gamertag}</h3><p className="tr-detail-meta">{[player.position,player.secondary_position].filter(Boolean).join(' / ')}<br/>{getCountryShortName(player.country_code,player.country) || 'Global'} · {player.platform || 'Platform not set'}</p>
    <div className="tr-detail-stats">{[['Matches',player.matches_played],['Goals',player.goals],['Assists',player.assists]].map(([label,value])=><div key={label}><b>{value ?? 0}</b><span>{label}</span></div>)}</div>
    <div className="tr-detail-terms"><span>Status</span><strong>{badgeType==='free_agent'?'Free agent':days_left!=null?`Contract ends in ${days_left} days`:'Expiring contract'}</strong></div><p className="tr-detail-note">No transfer fee. Expiring players remain at their current club until their agreement ends; a future agreement starts afterward.</p>
    {contract?.current_club_name&&<div className="tr-detail-terms"><span>Current club</span><strong>{contract.current_club_name}</strong></div>}
    {player.bio&&<p className="tr-detail-note">{player.bio}</p>}
    <p className="tr-detail-note">{!canManage?'Club Managers can make offers. Everyone can explore players and view their profiles.':blocked==='signed'?'Your club already has an active contract with this player.':blocked?'You already have a live offer for this player.':badgeType!=='free_agent'?'Offer a future agreement. The current contract stays in force until expiry, and official eligibility is checked again before activation.':officialRecruitment?'Official transfer and free-player eligibility rules apply. Final terms are agreed in the contract offer.':windowOpen?'Explore their profile, then make an offer on behalf of your club.':'Transfer-window rules apply. Review the current window before sending an offer.'}</p>
    {canManage&&<button type="button" className="tr-primary" disabled={!allowed} onClick={()=>onOffer(entry)}><FileText size={16}/>{blocked?'Offer unavailable':badgeType==='free_agent'?'Make an offer':'Offer future agreement'}<ArrowUpRight size={17}/></button>}
    <Link className="tr-profile-link" to={`/players/${player.id}`}>View full player profile <ArrowUpRight size={16}/></Link>
  </div>;
}

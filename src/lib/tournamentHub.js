import {isGostOfficialTournament, isTournamentOwner} from './tournamentOwnership.js';
import {transferRoomPresentation} from './transferRoomPresentation.js';
export const TOURNAMENT_HUB_DEFAULTS = {hero_title:'Tournaments',hero_description:'One stage. Your next challenge. Discover club and player competitions, find your next tournament and play for something worth lifting.',accent:'blue',banner_interval_seconds:6,banner_slides:[]};
export const TOURNAMENT_HUB_ACCENTS = {blue:'#4d8dff',cyan:'#00d4ff',gold:'#f5c542',red:'#ff6575'};
export function tournamentHubPresentation(raw={}) {
 const base=transferRoomPresentation({...TOURNAMENT_HUB_DEFAULTS,...raw});
 return {hero_title:base.hero_title,hero_description:base.hero_description,accent:Object.hasOwn(TOURNAMENT_HUB_ACCENTS,raw.accent)?raw.accent:'blue',banner_interval_seconds:base.banner_interval_seconds,banner_slides:base.banner_slides};
}
export function tournamentParticipants(tournament) {
 let value=tournament.participant_type==='player'?tournament.registered_players:tournament.registered_clubs;
 try {if(typeof value==='string')value=JSON.parse(value);}catch{return [];}
 return Array.isArray(value)?[...new Set(value.map(v=>String(v?.id||v?.club_id||v?.player_id||v)).filter(Boolean))]:[];
}
export function tournamentHubStatus(tournament) {
 if(tournament.status==='completed')return 'Completed';
 if(['in_progress','active'].includes(tournament.status))return 'Live';
 if(tournament.status==='registration')return tournamentParticipants(tournament).length>=Number(tournament.max_teams||Infinity)?'Full · waiting list':'Open';
 return String(tournament.status||'Draft').replaceAll('_',' ');
}
export function tournamentIsMine(tournament,{user,player,club,presidentClub}={}) {
 if(isTournamentOwner(tournament,user,player))return true;
 const ids=tournamentParticipants(tournament);
 return tournament.participant_type==='player'?ids.includes(String(player?.id)):[club?.id,presidentClub?.id].filter(Boolean).some(id=>ids.includes(String(id)));
}
export function filterTournamentHub(tournaments,{view='all',search='',participant='all',organizer='all',format='all',identity={}}={}) {
 const needle=search.trim().toLowerCase();
 return tournaments.filter(t=>{
  if(['cancelled','canceled','archived'].includes(t.status))return false;
  if(view==='open'&&t.status!=='registration')return false;
  if(view==='live'&&!['in_progress','active'].includes(t.status))return false;
  if(view==='completed'&&t.status!=='completed')return false;
  if(view==='mine'&&!tournamentIsMine(t,identity))return false;
  if(participant!=='all'&&(t.participant_type||'club')!==participant)return false;
  if(format!=='all'&&t.type!==format)return false;
  if(organizer!=='all'&&isGostOfficialTournament(t)!==(organizer==='stage'))return false;
  return !needle||[t.name,t.creator_gamertag,t.region,t.platform].filter(Boolean).join(' ').toLowerCase().includes(needle);
 });
}

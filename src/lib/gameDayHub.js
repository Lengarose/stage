import {isActiveGameDayMatch} from './gameDayPresentation.js';
import {isStageResult} from './tournamentStages.js';
export function isOfficialGameDayResult(game){return Boolean(game)&&['completed','forfeit'].includes(game.status)&&isStageResult(game);}
export function isHubMatch(game){if(['voided','deleted','cancelled','canceled','bye'].includes(game?.status)||game?.result_state==='VOIDED')return false;return isOfficialGameDayResult(game)||isActiveGameDayMatch(game);}
export function gameCategory(game){if(game.category)return game.category;if(['regional_league','regional_league_fixture'].includes(game.source_fixture_type))return 'regional';if(game.tournament_id&&game.tournament_id!=='ranked')return 'tournament';if(game.type==='friendly')return 'friendly';return 'match';}
export function filterGameDayMatches(games,{scope='general',status='all',search=''}){
  const needle=search.trim().toLowerCase();
  return games.filter(game=>{
    const category=gameCategory(game);
    if(scope==='gost'&&!['gost','supreme','elite','challenger'].includes(category))return false;
    if(!['general','gost'].includes(scope)&&category!==scope)return false;
    if(status==='completed'&&!isOfficialGameDayResult(game))return false;
    if(status==='live'&&game.status!=='in_progress')return false;
    if(status==='upcoming'&&game.status!=='scheduled')return false;
    return !needle||[game.home_club_name,game.away_club_name,game.home_player_name,game.away_player_name,game.competition_name,game.competition_context].filter(Boolean).join(' ').toLowerCase().includes(needle);
  });
}

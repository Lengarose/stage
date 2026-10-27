'use strict';
const {isConfirmedResult}=require('../lib/tournamentStatistics');
const {categoryFor}=require('./scheduleCalendarService');
const {wallClockToOffsetIso}=require('../utils/datetime');
const parse=v=>{try{return typeof v==='string'?JSON.parse(v):v||{};}catch{return {};}};
const fail=(message,status)=>Object.assign(new Error(message),{status});
function identityClubs(identity) {return [...new Set([identity.club?.id,identity.memberClub?.id,identity.ownedClub?.id,identity.presidentClub?.id].filter(Boolean).map(String))];}
function canReadMatch(match,identity) {
  if([0,2].includes(Number(identity.user?.role_id)))return true;
  const clubs=identityClubs(identity), player=String(identity.player?.id||'');
  return [match.home_player_id,match.away_player_id].some(id=>id&&String(id)===player)||[match.home_club_id,match.away_club_id].some(id=>id&&clubs.includes(String(id)));
}
async function matchAccess(userId,id,query,resolveIdentity) {
  const identity=await resolveIdentity(userId);
  const [match]=await query('SELECT * FROM matches WHERE id=? LIMIT 1',[id]);
  if(!match)throw fail('Match not found.',404);
  if(!canReadMatch(match,identity))throw fail('You do not have access to this match.',403);
  return {match,identity};
}
const select=`SELECT m.*, cf.id AS engine_fixture_id, ci.product_type, ci.slug AS competition_slug,
 ci.name AS engine_competition_name, ci.legacy_source_id, t.name AS tournament_name,
 f.id AS legacy_event_id, f.data_json AS fixture_json, f.entity_type AS fixture_entity_type, f.season_id, f.league_id
 FROM matches m LEFT JOIN competition_fixtures cf ON cf.match_id=m.id
 LEFT JOIN competition_instances ci ON ci.id=cf.competition_instance_id
 LEFT JOIN league_entities f ON f.id=COALESCE(cf.legacy_fixture_id,m.source_fixture_id)
 AND f.entity_type IN ('competition_fixture','regional_league_fixture')
 LEFT JOIN tournaments t ON t.id=m.tournament_id`;
function presentMatch(row) {
  const fixture=parse(row.fixture_json);
  const category=categoryFor({...row,competition_slug:fixture.competition_slug||row.competition_slug},row.fixture_entity_type||row.source_fixture_type,row);
  const stamp=row.confirmed_date||row.scheduled_date;
  const date=stamp?wallClockToOffsetIso(stamp,row.timezone):row.first_submission_at?`${String(row.first_submission_at).replace(' ','T').slice(0,19)}Z`:null;
  const competitionKey=row.tournament_id&&row.tournament_id!=='ranked'?`tournament:${row.tournament_id}`:row.season_id||row.league_id||row.legacy_source_id?`${category}:${row.season_id||row.league_id||row.legacy_source_id}`:`arranged:${row.type||'unknown'}`;
  const fields=['id','home_player_id','away_player_id','home_club_id','away_club_id','home_player_name','away_player_name','home_club_name','away_club_name','home_score','away_score','winner_club_id','winner_player_id','mode','type','round','group_number','leg','tournament_id','scheduled_date','confirmed_date','scheduling_status','status','result_state','stats_processed','report_finalized','updated_date','source_fixture_id','source_fixture_type','decided_on_penalties','penalty_winner_side','result_home_submitted','result_away_submitted','allow_penalties'];
  return {...Object.fromEntries(fields.filter(k=>row[k]!==undefined).map(k=>[k,row[k]])),aggregate_home_score:row.aggregate_home_score,aggregate_away_score:row.aggregate_away_score,logical_event_id:row.legacy_event_id?`legacy:${row.legacy_event_id}`:row.engine_fixture_id?`engine:${row.engine_fixture_id}`:null,category,competition_key:competitionKey,competition_name:row.tournament_name||fixture.competition_name||fixture.league_name||row.engine_competition_name||'Match',competition_href:row.tournament_id&&row.tournament_id!=='ranked'?`/tournaments/${row.tournament_id}`:['supreme','elite','challenger'].includes(category)?`/competitions/${category}`:null,competition_context:row.competition_context,display_date:date,leg:row.leg||fixture.leg,matchday:fixture.matchday,stage:fixture.phase||row.type};
}
function previousMeetings(selected,rows,sameCompetition=false) {
  const kind=selected.home_club_id?'club':'player',home=String(selected[`home_${kind}_id`]),away=String(selected[`away_${kind}_id`]);
  const cutoff=selected.display_date?Date.parse(selected.display_date):null;
  const seen=new Set(),meetings=[];
  for(const row of rows) {
    if(String(row.id)===String(selected.id)||(row.logical_event_id&&row.logical_event_id===selected.logical_event_id)||!isConfirmedResult(row))continue;
    const a=String(row[`home_${kind}_id`]),b=String(row[`away_${kind}_id`]);
    if(!((a===home&&b===away)||(a===away&&b===home)))continue;
    if(sameCompetition&&row.competition_key!==selected.competition_key)continue;
    if(cutoff!=null&&(!row.display_date||Date.parse(row.display_date)>=cutoff))continue;
    const key=row.logical_event_id||row.engine_fixture_id||row.source_fixture_id&&`${row.source_fixture_type}:${row.source_fixture_id}`||row.id;
    if(seen.has(key))continue;seen.add(key);
    const winner=Number(row.decided_on_penalties)===1?row[`${row.penalty_winner_side}_${kind}_id`]:row.status==='forfeit'&&row[`winner_${kind}_id`]?row[`winner_${kind}_id`]:row.home_score>row.away_score?row[`home_${kind}_id`]:row.home_score<row.away_score?row[`away_${kind}_id`]:null;
    meetings.push({...row,winner_id:winner||null});
  }
  meetings.sort((a,b)=>(Date.parse(b.display_date)||0)-(Date.parse(a.display_date)||0)||String(a.id).localeCompare(String(b.id)));
  return {total:meetings.length,homeWins:meetings.filter(m=>String(m.winner_id)===home).length,awayWins:meetings.filter(m=>String(m.winner_id)===away).length,draws:meetings.filter(m=>!m.winner_id).length,chronology:cutoff==null?'Chronology unavailable: all accessible confirmed meetings, excluding this match.':'Confirmed meetings before this match.',meetings};
}
module.exports={identityClubs,canReadMatch,matchAccess,select,presentMatch,previousMeetings,fail};

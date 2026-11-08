'use strict';
const crypto=require('node:crypto');
const {isConfirmedResult}=require('./tournamentStatistics');
const VERSION='withdrawal_exclusion_v1';
const RULES='Club absence and withdrawal require an explicit Admin decision supported by evidence. Before all nineteen first-half league matches are definitive, all league results of a withdrawing club are excluded from standings and derived player statistics. Afterward the first half is retained and every return is an administrative 3–0 for the opponent, without individual goals. The withdrawing club is ineligible for the title, prizes and promotion in that edition, with no guaranteed next-season place; a new application follows normal admission and vacancy rules. Original evidence and paid history are preserved; financial corrections require a separate Admin decision.';
const fail=message=>{throw Object.assign(Error(message),{status:409});};
function plan(scope,clubId) {
 const fixtures=scope.matches.filter(m=>[m.home_club_id,m.away_club_id].includes(clubId));
 if(fixtures.length!==38 || fixtures.some(m=>!Number.isInteger(Number(m.round))||Number(m.round)<1||Number(m.round)>38) || new Set(fixtures.map(m=>Number(m.round))).size!==38)fail('Withdrawal requires the complete, unambiguous 38-match league schedule for this club.');
 const first=fixtures.filter(m=>Number(m.round)<=19);
 const retain=first.length===19&&first.every(isConfirmedResult);
 const affected=retain?fixtures.filter(m=>Number(m.round)>19):fixtures;
 const changes=affected.map(m=>({fixture_id:m.fixture_id,match_id:m.match_id,home_club_id:m.home_club_id,away_club_id:m.away_club_id,
  status:retain?'forfeit':'cancelled',result_state:retain?'CONFIRMED':'VOIDED',administrative_result:1,
  home_score:retain?(m.home_club_id===clubId?0:3):null,away_score:retain?(m.away_club_id===clubId?0:3):null,
  winner_club_id:retain?(m.home_club_id===clubId?m.away_club_id:m.home_club_id):null,
  excluded_from_standings:!retain}));
 return {club_id:clubId,mode:retain?'retain_first_half':'exclude_all',definitive_first_half:first.filter(isConfirmedResult).length,changes,
  revision:crypto.createHash('sha256').update(JSON.stringify({root:scope.root,fixtures:scope.fixtures,matches:scope.matches,standings:scope.standings,clubId})).digest('hex')};
}
function standings(rows,matches) {
 const next=new Map(rows.map(r=>[r.club_id,{...r,played:0,wins:0,draws:0,losses:0,goals_for:0,goals_against:0,goal_difference:0,points:0,form:[]} ]));
 for(const m of [...matches].sort((a,b)=>Number(a.round)-Number(b.round)||String(a.id).localeCompare(String(b.id)))) {
  if(m.excluded_from_standings || !isConfirmedResult(m))continue;
  for(const side of ['home','away']) {
   const r=next.get(m[`${side}_club_id`]);if(!r)fail('The league standings are incomplete.');
   const gf=Number(m[`${side}_score`]),ga=Number(m[`${side==='home'?'away':'home'}_score`]);
   if(!Number.isFinite(gf)||!Number.isFinite(ga))fail('A definitive league score is missing.');
   const result=gf>ga?'W':gf===ga?'D':'L';r.played++;r.wins+=result==='W'?1:0;r.draws+=result==='D'?1:0;r.losses+=result==='L'?1:0;r.goals_for+=gf;r.goals_against+=ga;r.goal_difference=r.goals_for-r.goals_against;r.points+=result==='W'?3:result==='D'?1:0;r.form=[result,...r.form].slice(0,5);
  }
 }
 // Tied display rows share their position. Sporting tie decisions remain with
 // the established final-ranking engine; no alphabetical winner is invented.
 const sorted=[...next.values()].sort((a,b)=>b.points-a.points||b.goal_difference-a.goal_difference||b.goals_for-a.goals_for);
 let previousPosition=0;
 return sorted.map((r,i)=>{const tied=i&&r.points===sorted[i-1].points&&r.goal_difference===sorted[i-1].goal_difference&&r.goals_for===sorted[i-1].goals_for;const position=tied?previousPosition:i+1;previousPosition=position;return {...r,position};});
}
module.exports={VERSION,RULES,plan,standings};

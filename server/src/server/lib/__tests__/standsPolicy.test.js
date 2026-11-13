const test=require('node:test'),assert=require('node:assert/strict');
const p=require('../standsPolicy');
const {affiliation}=require('../../services/standsService');
const match={id:'match',type:'league',status:'scheduled',scheduled_date:'2027-03-01 19:00:00',timezone:'UTC',home_club_id:'home',away_club_id:'away'};
test('scheduled kickoff, an early start and an earlier stored cutoff all close predictions',()=>{
 assert.equal(p.lockState(match,null,false,Date.parse('2027-03-01T18:59:59Z')).locked,false);
 assert.equal(p.lockState(match,null,false,Date.parse('2027-03-01T19:00:00Z')).locked,true);
 assert.equal(p.lockState(match,null,true,0).locked,true);
 assert.equal(p.lockState({...match,scheduled_date:'2027-03-02 19:00:00'},{closes_at:'2027-03-01T19:00:00Z'},false,Date.parse('2027-03-01T19:00:00Z')).locked,true);
});
test('competition editions remain separate; a raw edition UUID is retained',()=>{
 assert.equal(p.competition({...match,tournament_id:'t1'}),'tournament:t1');
 assert.equal(p.competition({...match,source_fixture_type:'regional_league',competition_context:'edition-1'}),'regional_league:edition-1');
 assert.equal(p.competition({...match,source_fixture_type:'regional_cup',competition_context:JSON.stringify({edition_id:'e2'})}),'regional_cup:e2');
});
test('only a confirmed played result settles; corrections recalculate and administrative results are excluded',()=>{
 const pred={home_score:2,away_score:1},confirmed={...match,status:'completed',result_state:'CONFIRMED',home_score:2,away_score:1};
 assert.equal(p.outcome(confirmed,pred).exact,true);
 assert.equal(p.outcome({...confirmed,home_score:3},pred).exact,false);
 assert.equal(p.outcome({...confirmed,result_state:'DISPUTED'},pred).status,'pending');
 assert.equal(p.outcome({...confirmed,status:'forfeit'},pred).status,'excluded');
 assert.equal(p.outcome({...confirmed,status:'voided'},pred).status,'excluded');
});
test('knockout predictions use verified normal time, never extra time; corrected results invalidate stale verification',()=>{
 const m={...match,type:'final',status:'completed',result_state:'CONFIRMED',home_score:3,away_score:2},pred={home_score:1,away_score:1};
 assert.equal(p.outcome(m,pred).status,'awaiting_normal_time_score');
 const reg={home_score:1,away_score:1,result_fingerprint:p.fingerprint(m)};
 assert.equal(p.outcome(m,pred,reg).exact,true);
 assert.equal(p.outcome({...m,home_score:4},pred,reg).status,'awaiting_normal_time_score');
});
test('leaderboards rank accuracy with a participation minimum and equal records share a position',()=>{
 const row=(user_id,exact)=>({user_id,name:user_id,outcome:{status:'settled',exact}});
 const records=[...Array.from({length:5},(_,i)=>row('A',i<3)),...Array.from({length:5},(_,i)=>row('B',i<3)),row('new',true),...Array.from({length:10},(_,i)=>row('C',i<6))];
 const ranks=p.leaderboard(records);assert.deepEqual(ranks.map(r=>[r.user_id,r.rank]),[['C',1],['A',2],['B',2],['new',null]]);
 assert.equal(ranks[0].accuracy,60);
});
const user={id:'u',email:'player@stage.test'};
const ownPlayer={id:'p',club_id:null};
function query(records={}){return async sql=>{for(const [table,rows] of Object.entries(records))if(sql.includes(`FROM ${table}`))return rows;return [];};}
test('own player matches, current roster, contracts, managers, memberships, staff and captured squads all block predictions',async()=>{
 assert(await affiliation(user,{...match,home_player_id:'p'},query({players:[ownPlayer]})));
 assert(await affiliation(user,match,query({players:[{...ownPlayer,club_id:'home'}]})));
 assert(await affiliation(user,match,query({players:[ownPlayer],player_contracts:[{user_id:'p'}]})));
 assert(await affiliation(user,match,query({players:[ownPlayer],clubs:[{president_user_id:'u'}]})));
 assert(await affiliation(user,match,query({players:[ownPlayer],club_memberships:[{player_id:'p'}]})));
 assert(await affiliation(user,match,query({players:[ownPlayer],club_staff_roles:[{user_id:'u'}]})));
 assert(await affiliation(user,match,query({players:[ownPlayer],club_fixture_lineups:[{starting_players:'["p"]',bench_players:'[]'}]})));
 assert(await affiliation(user,match,query({players:[ownPlayer],league_entities:[{data_json:JSON.stringify({player_id:'p'})}]})));
 assert.equal(await affiliation(user,match,query({players:[ownPlayer]})),null);
});
test('scores reject non-integers and out-of-range inputs',()=>{for(const v of [-1,100,1.5,'2',NaN])assert.throws(()=>p.score(v));assert.equal(p.score(2),2);});

'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {plan,standings}=require('../regionalWithdrawal');
function scope(first) {const matches=Array.from({length:38},(_,i)=>({id:`m${i}`,match_id:`m${i}`,fixture_id:`f${i}`,round:i+1,home_club_id:i<19?'club':`opponent${i%19}`,away_club_id:i<19?`opponent${i%19}`:'club',status:i<first||i===20?'completed':'scheduled',result_state:i<first||i===20?'CONFIRMED':null,home_score:2,away_score:1}));return {root:{id:'edition'},fixtures:[],matches,standings:[]};}
test('eighteen definitive first-half games exclude all 38, including played returns',()=>{const p=plan(scope(18),'club');assert.equal(p.mode,'exclude_all');assert.equal(p.changes.length,38);assert.ok(p.changes.every(c=>c.status==='cancelled'&&c.excluded_from_standings&&c.home_score===null));});
test('nineteen definitive first-half games preserve those 19 and replace all returns',()=>{const p=plan(scope(19),'club');assert.equal(p.mode,'retain_first_half');assert.equal(p.changes.length,19);assert.ok(p.changes.every(c=>c.status==='forfeit'&&c.home_score===3&&c.away_score===0));assert.equal(p.changes[1].match_id,'m20');});
test('a disputed first-half game does not satisfy the threshold, and missing schedule cannot be guessed',()=>{const s=scope(19);s.matches[3].result_state='DISPUTED';assert.equal(plan(s,'club').mode,'exclude_all');s.matches.pop();assert.throws(()=>plan(s,'club'),/38-match/);});
test('recomputed tables ignore excluded matches, count administrative club goals and share tied display positions',()=>{const rows=['a','b','c'].map(club_id=>({club_id}));const table=standings(rows,[{status:'cancelled',excluded_from_standings:true,home_club_id:'a',away_club_id:'b',home_score:9,away_score:0},{status:'forfeit',result_state:'CONFIRMED',home_club_id:'a',away_club_id:'b',home_score:3,away_score:0}]);assert.equal(table[0].points,3);assert.equal(table[0].goals_for,3);assert.equal(table.find(r=>r.club_id==='b').goals_against,3);assert.equal(standings(rows,[]).every(r=>r.position===1),true);});

test('withdrawn league leader cannot receive title or prize placement; eligible clubs move up',()=>{
 const participants=Array.from({length:20},(_,i)=>({id:`c${i}`,name:`Club ${i}`}));
 const matches=[];for(let h=0;h<20;h++)for(let a=0;a<20;a++)if(h!==a)matches.push({id:`m${h}-${a}`,fixture_id:`f${h}-${a}`,type:'league',tournament_id:'league',home_club_id:`c${h}`,away_club_id:`c${a}`,home_score:h<a?2:0,away_score:h<a?0:2,status:'completed',result_state:'CONFIRMED',stats_processed:1});
 const rows=standings(participants.map(p=>({club_id:p.id})),matches);
 const s={source_type:'regional_league',root:{id:'league',status:'completed',registered_club_ids:participants.map(p=>p.id),withdrawn_club_ids:['c0']},participants,matches,standings:rows};
 const result=require('../competitionPrizes').placements(s,[{position:1,amount:'10.00'},{position:2,amount:'5.00'}]);assert.equal(result.blocked,undefined);assert.equal(result.map.get(1),'c1');assert.equal(result.map.get(2),'c2');assert.ok(![...result.map.values()].includes('c0'));
});

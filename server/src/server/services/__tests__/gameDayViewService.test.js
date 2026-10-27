const test=require('node:test'),assert=require('node:assert/strict');
const {previousMeetings,canReadMatch,presentMatch}=require('../gameDayViewService');
const m={id:'selected',home_club_id:'a',away_club_id:'b',status:'completed',result_state:'CONFIRMED',competition_key:'tournament:edition',display_date:'2026-10-27T20:00:00Z'};
test('H2H excludes selected/later/unconfirmed/voided, reverses identities and keeps separate legs',()=>{
  const first={...m,id:'first',display_date:'2026-10-20T20:00:00Z',home_score:2,away_score:1};
  const second={...first,id:'second',home_club_id:'b',away_club_id:'a',home_score:2,away_score:1,decided_on_penalties:1,penalty_winner_side:'away'};
  const rows=[m,first,first,second,{...first,id:'later',display_date:'2026-11-01T20:00:00Z'},{...first,id:'dispute',result_state:'DISPUTED'},{...first,id:'void',status:'voided'}];
  const result=previousMeetings(m,rows);assert.equal(result.total,2);assert.equal(result.homeWins,2);assert.equal(result.awayWins,0);
  assert.equal(previousMeetings(m,[{...first,competition_key:'tournament:other'}],true).total,0);
  assert.equal(previousMeetings({...m,display_date:null},[first]).total,1);
});
test('club membership/owned clubs and player matches are visible, unrelated identities are not',()=>{
  assert.equal(canReadMatch(m,{user:{role_id:1},memberClub:{id:'a'}}),true);
  assert.equal(canReadMatch(m,{user:{role_id:1},club:{id:'unrelated'}}),false);
  assert.equal(canReadMatch({home_player_id:'p',away_player_id:'q'},{user:{role_id:1},player:{id:'q'}}),true);
});
test('display adapter excludes proof/email and uses edition IDs rather than names',()=>{
  const view=presentMatch({...m,tournament_id:'edition',home_owner_email:'private@example.test',proof_url:'/private-proof',tournament_name:'Named cup'});
  assert.equal(view.competition_key,'tournament:edition');assert.equal(view.proof_url,undefined);assert.equal(view.home_owner_email,undefined);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const { configuredPrizes,planPrizes,cents,stc } = require('../competitionPrizes');
const { roundReadiness } = require('../leagueRoundReadiness');
const { validateSchedulePatch } = require('../leagueSchedulingPermission');
function cup(player = false) {
  const kind = player ? 'player' : 'club';
  return {source_type:'tournament',edition_id:'cup',legacy_references:['cup'],root:{id:'cup',name:'Test Cup',type:'knockout',participant_type:kind,status:'completed',prize_winner_stc:'10.01',prize_runner_up_stc:'2.50',prize_semi_final_stc:0},participants:[{id:'a'},{id:'b'}],matches:[{id:'f',type:'final',status:'completed',result_state:'CONFIRMED',home_score:2,away_score:0,[`home_${kind}_id`]:'a',[`away_${kind}_id`]:'b'}]};
}
test('exact cents, explicit prizes and zero-prize do not invent default percentages',()=>{
  assert.equal(stc(cents('10.01')+cents('0.02')),'10.03');
  assert.throws(()=>cents('1.001'));
  assert.equal(configuredPrizes({prize_pool_stc:100}),null);
  assert.equal(planPrizes(cup(),[]).state,'zero_prize');
});
test('club and player placement prizes resolve to the right account type',()=>{
  for (const player of [false,true]) { const s=cup(player);const p=planPrizes(s,configuredPrizes(s.root));assert.equal(p.state,'unpaid');assert.deepEqual(p.obligations.map(o=>o.recipient_id),['a','b']);assert(p.obligations.every(o=>o.recipient_type === (player ? 'player' : 'club'))); }
});
test('partial legacy payment pays only the proven difference; ambiguous descriptions do not prove payment',()=>{
  const s=cup(); const config=configuredPrizes(s.root);
  const p=planPrizes(s,config,[],[{id:'old',club_id:'a',reference_id:'cup',amount:'4.00'}]);
  assert.equal(p.state,'partially_paid');assert.equal(p.obligations[0].missing_amount,'6.01');
  const unknown=planPrizes(s,config,[],[{id:'unknown',club_id:'a',reference_id:'unknown',description:'Test Cup prize',amount:'10.01'}]);
  assert.equal(unknown.state,'blocked');assert.equal(unknown.obligations[0].proven_payment,'0.00');
});
test('paid obligation recipient changes and unresolved placements block settlement',()=>{
  const s=cup(),config=configuredPrizes(s.root);
  const p=planPrizes(s,config,[{idempotency_key:'prize:tournament:cup:cup:1',club_id:'b',amount_stc:'10.01',status:'paid'}]);assert.equal(p.state,'blocked');
  s.matches[0].result_state='DISPUTED';assert.equal(planPrizes(s,config).state,'blocked');
});
test('legacy parent-competition references cannot prove a specific season payment',()=>{
  const s=cup();s.ambiguous_legacy_references=['parent'];
  const p=planPrizes(s,configuredPrizes(s.root),[],[{id:'legacy-parent',club_id:'a',reference_id:'parent',description:'Older season award',amount:'10.01'}]);
  assert.equal(p.state,'blocked');assert.equal(p.obligations[0].proven_payment,'0.00');
});
test('an intermediate round and missing historical config never trigger prize payment',()=>{
  const s=cup();s.root.status='in_progress';assert.equal(planPrizes(s,configuredPrizes(s.root)).state,'blocked');assert.equal(planPrizes(s,null).state,'blocked');
});
function league() {return {source_type:'regional_league',root:{},participants:[{id:'a'},{id:'b'}],matches:[{id:'one',type:'league',status:'completed',result_state:'CONFIRMED',home_club_id:'a',away_club_id:'b',home_score:1,away_score:0},{id:'two',type:'league',status:'completed',result_state:'CONFIRMED',home_club_id:'b',away_club_id:'a',home_score:0,away_score:1}]};}
test('whole league waits for every expected confirmed fixture, not just existing records',()=>{
  const s=league();assert.equal(roundReadiness(s).ready,true);s.matches.pop();assert.equal(roundReadiness(s).ready,false);
  s.matches.push({...s.matches[0],id:'two'});assert.equal(roundReadiness(s).ready,false);
});
test('two-legged aggregate uses both legs and does not advance the second-leg winner',()=>{
  const s={source_type:'competition_season',root:{},participants:[],matches:[{id:'a',type:'knockout_sf',tie_id:'one',round:1,status:'completed',result_state:'CONFIRMED',home_club_id:'a',away_club_id:'b',home_score:4,away_score:0},{id:'b',type:'knockout_sf',tie_id:'one',round:2,status:'completed',result_state:'CONFIRMED',home_club_id:'b',away_club_id:'a',home_score:1,away_score:0,winner_club_id:'b'}]};
  const {resolvedTie}=require('../tournamentProgression');assert.equal(resolvedTie(s.matches,{participant_type:'club'},2).winner.id,'a');assert.equal(roundReadiness(s,'knockout_sf').ready,false);
  s.matches.push(...s.matches.map(m=>({...m,id:m.id+'2',tie_id:'two',home_club_id:m.home_club_id === 'a' ? 'c' : 'd',away_club_id:m.away_club_id === 'b' ? 'd' : 'c'})));assert.equal(roundReadiness(s,'knockout_sf').ready,true);s.matches[3].result_state='DISPUTED';assert.equal(roundReadiness(s,'knockout_sf').ready,false);
});
test('home president proposes, away president confirms; ordinary member and unknown opponents fail',()=>{
  const current={home_club_id:'a',away_club_id:'b',status:'scheduled',scheduling_status:'open'};
  const clubs=[{id:'a',president_user_id:'home'},{id:'b',president_user_id:'away'}];
  const patch={scheduling_status:'home_proposed',last_proposed_by:'home',home_proposed_date:'2026-12-01T19:00:00Z'};
  validateSchedulePatch(current,patch,{id:'home'},clubs);
  assert.throws(()=>validateSchedulePatch(current,patch,{id:'member'},clubs));assert.throws(()=>validateSchedulePatch(current,patch,{id:'away'},clubs));
  assert.throws(()=>validateSchedulePatch({...current,away_club_id:null},patch,{id:'home'},clubs));
  validateSchedulePatch({...current,...patch},{scheduling_status:'confirmed',confirmed_date:patch.home_proposed_date,scheduled_date:patch.home_proposed_date,status:'scheduled'},{id:'away'},clubs);
});

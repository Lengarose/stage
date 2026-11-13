'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const p=require('../../lib/clubBoardPolicy');
const tournament=require('../../lib/clubTournamentParticipation');
const review=require('../clubBoardReviewService');
test('approved Card curve, every boundary and maximum preserve total earned XP',()=>{
 for(const [xp,level] of [[0,1],[199,1],[200,2],[2300,10],[29800,50],[99800,100],[150000,100]])assert.equal(p.progression(xp).level,level);
 let total=0;for(let level=2;level<=100;level++){total+=p.xpForLevel(level);assert.equal(p.progression(total-1).level,level-1);assert.equal(p.progression(total).level,level);}
 assert.equal(total,99800);assert.throws(()=>p.progression(-1));
});
test('player bands are independent of role/EA OVR; signing caps and no amendment bonus',()=>{
 assert.deepEqual(p.salaryBand(0),{from:1,to:5,min:5000,max:15000,level:1});
 for(const squad_role of ['trial','academy','squad','important','star']) {
  assert.equal(p.playerTerms({squad_role,weekly_salary_stc:10000,signing_bonus_stc:40000},0).weekly_salary_stc,10000);
  assert.throws(()=>p.playerTerms({squad_role,weekly_salary_stc:15001},0));
 }
 assert.throws(()=>p.playerTerms({weekly_salary_stc:10000,signing_bonus_stc:40001},0));
 assert.throws(()=>p.playerTerms({weekly_salary_stc:10000,signing_bonus_stc:1},0,'renewal'));
 assert.throws(()=>p.money(NaN));assert.throws(()=>p.money(-1));assert.equal(p.money(0.29),0.29);
});
test('management opening offers respect approved percentages and the 10 percent ceiling',()=>{
 assert.equal(p.managementOffer({wageBudget:250000}).opening_weekly_salary_stc,5000);
 assert.equal(p.managementOffer({wageBudget:250000}).maximum_weekly_salary_stc,6000);
 for(const [grade,expected] of [['below',5000],['meets',5000],['exceeds',5500],['exceptional',6000]])assert.equal(p.managementOffer({current:5000,grade,wageBudget:250000}).opening_weekly_salary_stc,expected);
 assert.equal(p.managementOffer({current:25000,grade:'exceptional',wageBudget:250000}).opening_weekly_salary_stc,25000);
});
test('Board objectives use confirmed season evidence, relative targets and appointment dates',()=>{
 const objective=review.objectiveFor({previousPosition:8});
 assert.equal(review.gradeObjective(objective,{final:false,position:1,within_appointment:true}),'unassessed');
 assert.equal(review.gradeObjective(objective,{final:true,position:5,within_appointment:true}),'exceeds');
 assert.equal(review.gradeObjective(objective,{final:true,position:7,within_appointment:true}),'meets');
 assert.equal(review.gradeObjective(objective,{final:true,position:19,within_appointment:true}),'below');
 assert.equal(review.gradeObjective(objective,{final:true,confirmed_title:true,within_appointment:true}),'exceptional');
 assert.equal(review.gradeObjective(objective,{final:true,confirmed_title:true,within_appointment:false}),'unassessed');
 assert.equal(review.objectiveFor({promoted:true,fieldSize:20,relegatedSlots:2}).target_position,18);
});
test('club rules support 2–11 humans, GK/ANY requirements and exclude nonmembers',()=>{
 assert.throws(()=>tournament.rules({minimum_human_players:1}));assert.throws(()=>tournament.rules({minimum_human_players:12}));
 const settings=tournament.rules({minimum_human_players:2,goalkeeper_required:true,any_allowed:false}),roster=[{id:'a'},{id:'b'}],selection={starting_players:['a','b'],bench_players:[],goalkeeper_player_id:'a'};
 assert.equal(tournament.validateSelection(selection,roster,settings,{publish:true}).starters.length,2);
 assert.throws(()=>tournament.validateSelection({...selection,uses_any:true},roster,settings,{publish:true}));
 assert.throws(()=>tournament.validateSelection({...selection,goalkeeper_player_id:null},roster,settings,{publish:true}));
 assert.throws(()=>tournament.validateSelection({...selection,starting_players:['a','outsider']},roster,settings,{publish:true}));
});
test('AI, human and own goals affect totals without assigning AI work to humans',()=>{
 const events=[{scorer_kind:'human',scorer_player_id:'a',assist_kind:'ai'},{scorer_kind:'ai',assist_kind:'human',assist_player_id:'b'},{scorer_kind:'own_goal',assist_kind:'none'}];
 assert.deepEqual(tournament.goalEvents(events,['a','b'],3),{a:{goals:1,assists:0},b:{goals:0,assists:1}});
 assert.throws(()=>tournament.goalEvents(events,['a'],3));assert.throws(()=>tournament.goalEvents(events,['a','b'],2));
 assert.throws(()=>tournament.goalEvents([{scorer_kind:'ai',scorer_player_id:'a'}],['a'],1));
});

test('weekly accrual has no advance pay and prorates a final partial week',async()=>{
 const receipts=new Map(),query=async()=>({affectedRows:1});
 const model={selectOne:async(_type,id)=>receipts.get(id),save:async(_type,row)=>receipts.set(row.id,row),update:async()=>{}};
 const service=require('../clubAgreementService').createService({model,query,transaction:work=>work(query)});
 const starts=Date.parse('2026-11-01T00:00:00Z'),agreement={id:'agreement',club_id:'club',player_id:'player',starts_at:new Date(starts).toISOString(),ends_at:new Date(starts+8*86400000).toISOString(),weekly_salary_stc:7000,status:'active',payroll_generation:'proposal'};
 const club={id:'club',name:'Club',stc:40000},player={id:'player',email:'player@test',stc:0};
 await service.accrue(agreement,club,player,query,new Date(starts+6*86400000));assert.equal(player.stc,0);
 await service.accrue(agreement,club,player,query,new Date(starts+8*86400000));assert.equal(player.stc,8000);assert.equal(club.stc,32000);assert.deepEqual([...receipts.values()].map(r=>r.amount_stc),[7000,1000]);
 await service.accrue(agreement,club,player,query,new Date(starts+9*86400000));assert.equal(player.stc,8000);
});

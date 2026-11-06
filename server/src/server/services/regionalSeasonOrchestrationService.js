'use strict';
const {RegionalSeasonProgressModel}=require('../models/regionalSeasonProgressModel');
const {createService:createWorker}=require('./regionalProgressWorker');
const fail=message=>{throw Object.assign(Error(message),{status:409});};
async function step(name,run){try{return await run();}catch(error){if(Number(error.status)>=400 && Number(error.status)<500){const detail=Array.isArray(error.details)?error.details.filter(v=>typeof v==='string').slice(0,3).join(' '):'';error.message=`${name}: ${error.message}${detail?' '+detail:''}`;}throw error;}}
function createReconciler({prepare=id=>require('./regionalCycleService').reconcilePreparation(id),progress=id=>require('./regionalCycleRecoveryService').reconcileCycle(id),draw=(id,cycle)=>require('./leagueLifecycleService').reconcileRegionalDraw(id,cycle),calendar=id=>require('./regionalCalendarService').reconcileCalendar(id),nextWindow=(id,monday)=>require('./regionalRegistrationService').reconcileNextWindow(id,monday),cup=async id=>{const prepared=await require('./regionalCupService').reconcileForCalendar(id);return require('./regionalCupLifecycleService').reconcileActivation(prepared.record.id);}}={}) {
  return async windowId=>{
    const prepared=await step('Confirmed field',()=>prepare(windowId));
    if(prepared.waiting_source_results)return {stage:'waiting_source_results'};
    let {cycle}=prepared;
    if(!cycle?.id)fail('The published field has no canonical regional cycle.');
    if(cycle.status!=='allocated')({cycle}=await step('Sporting progression',()=>progress(cycle.id)));
    if(!cycle || !['running','review','ready','allocated'].includes(cycle.status))fail('Automatic season progression requires review.');
    if(cycle.status!=='allocated')return {stage:'waiting_pathway_results',cycle_id:cycle.id};
    if(!cycle.allocated_groups?.length)fail('The regional allocation has no saved groups.');
    for(const group of cycle.allocated_groups)await step('Group fixtures',()=>draw(group.id,cycle.id));
    const published=await step('Season calendar',()=>calendar(cycle.id));
    if(published.status==='awaiting_date')return {stage:'calendar_date_required',cycle_id:cycle.id};
    if(published.status!=='published')fail('The regional calendar could not be published.');
    let nextId=null;
    if(cycle.participation_window_snapshot?.recurring_schedule_policy_version){const next=await step('Next registration period',()=>nextWindow(windowId,published.start_monday));nextId=next.window.id;}
    let cupId=null;
    if(cycle.participation_window_snapshot?.cup_policy_version){const active=await step('Regional Cup',()=>cup(published.id));if(!['running','completed'].includes(active.status))fail('The accepted Regional Cup could not be activated.');cupId=active.edition_id;}
    return {stage:'league_calendar_published',cycle_id:cycle.id,calendar_id:published.id,...(cupId?{cup_id:cupId}:{}),...(nextId?{next_registration_window_id:nextId}:{})};
  };
}
function project(result) {
  if(!['waiting_source_results','waiting_pathway_results','calendar_date_required','league_calendar_published'].includes(result?.stage))fail('Automatic season preparation requires review.');
  return {status:result.stage==='league_calendar_published'?'completed':'waiting_results',stage:result.stage,cycle_id:result.cycle_id || null,...(result.calendar_id?{calendar_id:result.calendar_id}:{}),...(result.cup_id?{cup_id:result.cup_id}:{}),...(result.next_registration_window_id?{next_registration_window_id:result.next_registration_window_id}:{})};
}
function createService(options={}) {
  return createWorker({model:new RegionalSeasonProgressModel(),reconcile:createReconciler(),project,label:'Regional season orchestration',...options});
}
module.exports={createService,createReconciler,project,...createService()};

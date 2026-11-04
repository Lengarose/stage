'use strict';
const {RegionalCycleRecoveryModel}=require('../models/regionalCycleRecoveryModel');
const {createService:createWorker}=require('./regionalProgressWorker');
function project(result) {
  const cycle=result?.cycle;
  if(!cycle || !['running','review','ready','allocated'].includes(cycle.status))throw Object.assign(Error('Regional cycle progression requires review.'),{status:409});
  if(cycle.status!=='allocated' && (!cycle.plan || !Array.isArray(cycle.plan.fixtures) || !Array.isArray(cycle.plan.pending) || cycle.status==='ready' && cycle.plan.ready!==true))throw Object.assign(Error('The captured regional sporting plan is incomplete.'),{status:409});
  if(cycle.plan?.blockers?.length)throw Object.assign(Error('The regional sporting plan contains unresolved blockers. Review the captured cycle.'),{status:409});
  return {status:cycle.status==='allocated'?'completed':cycle.status==='ready'?'ready_for_allocation':cycle.plan?.pending?.length?'waiting_results':'progressed',...(result.promotion_calendar_status?{promotion_calendar_status:result.promotion_calendar_status}:{})};
}
async function reconcile(id) {
  const result=await require('./regionalCycleService').progress(id),cycle=result.cycle;
  if(cycle?.input?.mode==='transition' && cycle.status!=='allocated' && cycle.plan?.ready!==true && !cycle.plan?.blockers?.length && cycle.plan?.fixtures?.some(f=>f.ref.startsWith('promotion:')) && !cycle.plan.fixtures.some(f=>f.ref.startsWith('growth:'))) {
    const calendar=await require('./regionalPromotionCalendarService').reconcileFinal(id);
    result.promotion_calendar_status=calendar.status;
  }
  if(cycle?.status==='ready' && cycle.plan?.ready===true && !cycle.plan.blockers?.length && cycle.automatic_allocation_policy_version) {
    const allocation=await require('./regionalCycleService').reconcileAllocation(id);
    result.cycle=allocation.cycle;
  }
  return result;
}
function createService(options={}) {return createWorker({model:new RegionalCycleRecoveryModel(),reconcile,project,label:'Regional cycle recovery',...options});}
module.exports={createService,project,...createService()};

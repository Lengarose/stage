'use strict';
const {RegionalCupRecoveryModel}=require('../models/regionalCupRecoveryModel');
const {createService:createWorker}=require('./regionalProgressWorker');
function project(progress) {
  if(!['running','completed','waiting_results'].includes(progress.status))throw Object.assign(Error('Cup progression returned an unsupported state; review is required.'),{status:409});
  return {status:progress.status==='waiting_results'?'waiting_results':progress.status==='completed'?'completed':'progressed',current_round:progress.current_round || null};
}
function createService(options={}) {return createWorker({model:new RegionalCupRecoveryModel(),reconcile:id=>require('./regionalCupLifecycleService').reconcile(id),project,label:'Regional Cup recovery',...options});}
module.exports={createService,...createService()};

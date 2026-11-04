'use strict';
const crypto=require('crypto');
const {EXECUTESQL,withTransaction}=require('../db/database');
function createService({model,query=EXECUTESQL,transaction=withTransaction,reconcile,project,label='Regional progress',clock=()=>new Date(),attemptId=()=>crypto.randomUUID(),logger=console}={}) {
  let ticking=false;
  async function tick() {
    if(ticking)return {skipped:true};
    ticking=true;
    try {
      const candidates=await model.candidates(clock().toISOString(),query),results=[];
      for(const source of candidates) {
        try {
        const now=clock(),job=await transaction(q=>model.claim(source.id,now.toISOString(),new Date(now.getTime()+120000).toISOString(),attemptId(),q));
        if(!job)continue;
        let result;
        try {
          const progress=await reconcile(source.id);
          result={...project(progress),last_error:null,next_attempt_at:new Date(clock().getTime()+60000).toISOString()};
          if(!['waiting_results','completed','progressed','ready_for_allocation'].includes(result.status))throw Object.assign(Error(`${label} returned an unsupported progress state; review is required.`),{status:409});
        }catch(error) {
          result={status:'review_required',last_error:Number(error.status)>=400 && Number(error.status)<500?String(error.message).slice(0,500):`${label} could not be completed. Retry or review the source.`,next_attempt_at:new Date(clock().getTime()+900000).toISOString()};
        }
        const saved=await transaction(q=>model.finish(job,{...result,finished_at:clock().toISOString()},q));
        results.push({source_id:source.id,status:saved?result.status:'lease_replaced'});
        }catch {logger.error(`[${label}] A progress checkpoint could not be stored.`);results.push({source_id:source.id,status:'checkpoint_failed'});}
      }
      return {results};
    }finally{ticking=false;}
  }
  function start() {
    const timer=setInterval(()=>{tick().catch(()=>logger.error(`[${label}] Progress check failed; the next tick will retry.`));},60000);
    timer.unref();return timer;
  }
  return {tick,start};
}
module.exports={createService};

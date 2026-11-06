'use strict';
const crypto=require('crypto');
const {EXECUTESQL,withTransaction}=require('../db/database');
const {RegionalRegistrationModel}=require('../models/regionalRegistrationModel');
const {RegionalProgressModel}=require('../models/regionalProgressModel');

function createService({model=new RegionalRegistrationModel(),progress=new RegionalProgressModel('confirmation_notice'),query=EXECUTESQL,transaction=withTransaction,attemptId=()=>crypto.randomUUID(),windows=()=>require('./regionalRegistrationService').windows(),remind=id=>require('./regionalRegistrationService').remindConfirmation(id),clock=()=>new Date(),logger=console}={}) {
  let running=false,cursor='',timer;
  async function tick() {
    if(running)return {skipped:true};
    running=true;
    try {
      const published=await windows();
      const windowIds=published.windows.filter(w=>w.phase==='confirmation' && w.policy_version==='regional_registration_v1' && w.confirmation_notice_policy_version==='regional_confirmation_notice_v1').map(w=>w.id);
      const rows=await model.reminderCandidates(cursor,clock().toISOString(),query,windowIds),counts={stored:0,muted:0};
      for(const row of rows) {
        try {
          const now=clock(),job=await transaction(q=>progress.claim(row.id,now.toISOString(),new Date(now.getTime()+120000).toISOString(),attemptId(),q));
          if(!job)continue;
          let checkpoint;
          try {
            const result=await remind(row.id);
            if(!['stored','muted','already_checked','not_needed'].includes(result.status))throw Error('Unsupported reminder result');
            if(['stored','muted'].includes(result.status))counts[result.status]++;
            checkpoint={status:'completed',notice_status:result.status,last_error:null,next_attempt_at:clock().toISOString()};
          }catch {
            checkpoint={status:'review_required',last_error:'The confirmation notice could not be completed. Review the application and president contact.',next_attempt_at:new Date(clock().getTime()+900000).toISOString()};
            logger.error('[regional confirmation reminder] Registration requires review:',row.id);
          }
          await transaction(q=>progress.finish(job,{...checkpoint,finished_at:clock().toISOString()},q));
        }catch {logger.error('[regional confirmation reminder] A progress checkpoint could not be stored:',row.id);}
      }
      cursor=rows.length===80?rows.at(-1).id:'';
      return counts;
    }catch {logger.error('[regional confirmation reminder] Scan failed; it will retry.');return {failed:true};}
    finally {running=false;}
  }
  function start() {if(!timer){timer=setInterval(tick,60000);timer.unref();}return timer;}
  return {tick,start};
}
module.exports={createService,...createService()};

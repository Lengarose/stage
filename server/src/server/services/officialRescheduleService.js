'use strict';
const crypto=require('crypto');
const {withTransaction}=require('../db/database');
const {OfficialRescheduleModel}=require('../models/officialRescheduleModel');
const {RegionalRegistrationModel}=require('../models/regionalRegistrationModel');
const {fail}=require('../lib/regionalEditionIdentity');
const policy=require('../lib/officialReschedulePolicy');
const {busyEvents}=require('../lib/officialCalendarLoad');
const {loadViolations}=require('../lib/regionalCalendarPlan');
const regions=require('../lib/regionalCalendarPolicy.json').regions;
function createService({model=new OfficialRescheduleModel(),windows=new RegionalRegistrationModel(),transaction=withTransaction,context=(id,q)=>require('./officialMatchEligibilityService').context(id,q),permission=(actor,club)=>require('./clubOperationsService').requireClubPermission({user:actor},club,'manage_lineup'),clock=()=>new Date(),id=()=>crypto.randomUUID()}={}) {
 async function act(matchId,body,actor){
  if(!['read','request','approve','decline','cancel'].includes(body.action) || !body.club_id)fail('Choose a club and a supported rescheduling action.',400);
  const {user}=await permission(actor,body.club_id);
  return transaction(async q=>{
   await model.lock(q);const ctx=await context(matchId,q),match=ctx.match;
   if(!ctx.official || !match || ![match.home_club_id,match.away_club_id].includes(body.club_id))fail('Only a participating official club may manage this schedule.',403);
   const window=ctx.root.participation_window_snapshot || (ctx.root.regional_registration_window_id?await windows.selectOne(ctx.root.regional_registration_window_id,q):null);
   if(window?.reschedule_policy_version!==policy.VERSION || !regions.includes(ctx.root.region_slug) || match.timezone!=='Europe/Brussels'){
    if(body.action==='read')return {enabled:false,requests:[],message:'This edition retains its existing scheduling rules. Contact Admin for an official exception.'};
    fail('This edition has no captured European rescheduling policy.');
   }
   const canChange=['scheduled','confirmed'].includes(match.status) && !match.first_submission_at && !match.home_submission && !match.away_submission && !await model.hasKickoff(match.id,q);
   const lastRounds=Number(ctx.sourceFixture?.matchday)>=37;
   const requests=await model.requests(match.id,q),now=clock();
   for(const request of requests.filter(r=>r.status==='pending')){
    const state=policy.scheduleKey(match)!==request.schedule_key?'superseded':now.getTime()>=Date.parse(request.respond_by)?'expired':null;
    if(state){request.status=state;await model.save(request,q);}
   }
   const used=await model.approved(ctx.root.id,body.club_id,q);
   const report=()=>({enabled:true,can_request:canChange && !lastRounds && used<2 && !requests.some(r=>r.status==='pending'),used,limit:2,club_id:body.club_id,requests:requests.map(r=>({...r,can_respond:canChange && !lastRounds && r.status==='pending' && r.requester_club_id!==body.club_id})),message:lastRounds?'Rounds 37–38 require Admin review; no normal change is offered.':!canChange?'This match can no longer be rescheduled.':null});
   if(body.action==='read')return report();
   if(!canChange || lastRounds)fail('Use Admin review for this match; ordinary rescheduling is unavailable.');
   if(body.action==='request'){
    const times=policy.proposal(match,body.date,now),pending=requests.find(r=>r.status==='pending');
    if(pending){if(pending.requester_club_id===body.club_id && pending.proposed_date===times.new_time.wall)return {...report(),already_applied:true};fail('A pending proposal already exists for this match.');}
    if(used>=2)fail('This club has used its two approved changes for this edition.');
    const request={id:id(),match_id:match.id,edition_id:ctx.root.id,policy_version:policy.VERSION,requester_club_id:body.club_id,requester_user_id:user.id,opponent_club_id:body.club_id===match.home_club_id?match.away_club_id:match.home_club_id,status:'pending',schedule_key:policy.scheduleKey(match),original_date:times.original.wall,proposed_date:times.new_time.wall,proposed_instant:times.new_time.instant,respond_by:times.respond_by,requested_at:now.toISOString()};
    await model.save(request,q);await model.operation(user,body.club_id,null,request,'Requested an official schedule change',q);await model.notice([request.opponent_club_id],request,'requested',q);requests.push(request);return report();
   }
   const request=requests.find(r=>r.id===body.request_id);if(!request)fail('The selected schedule proposal is unavailable.',404);
   if(request.status!=='pending'){
    if(request.status===({approve:'approved',decline:'declined',cancel:'cancelled'}[body.action]))return {...report(),already_applied:true};
    fail('This proposal expired, changed or has already been decided. The current kickoff is unchanged.');
   }
   if(body.action==='cancel'?request.requester_club_id!==body.club_id:request.opponent_club_id!==body.club_id)fail('Only the appropriate requesting or opposing club may perform this action.',403);
   const before=structuredClone(request);
   if(body.action==='approve'){
    if(now.getTime()>request.proposed_instant-24*3600000)fail('Agreement must be at least 24 hours before the proposed kickoff.');
    if(await model.approved(ctx.root.id,request.requester_club_id,q)>=2)fail('The requesting club has already used its two approved changes.');
    const excluded=new Set(ctx.aliases),bookings=busyEvents(await model.events([match.home_club_id,match.away_club_id],q),excluded);
    const entry={id:match.id,home_club_id:match.home_club_id,away_club_id:match.away_club_id,instant:request.proposed_instant,minutes:['league','league_phase'].includes(match.type)?40:60};
    const conflicts=loadViolations([...bookings,entry]);if(conflicts.length)fail('The proposed kickoff conflicts with official scheduling limits.',409,conflicts);
    const patch={...match,scheduled_date:request.proposed_date,confirmed_date:request.proposed_date,timezone:'Europe/Brussels',status:'scheduled',scheduling_status:'confirmed'};
    await model.updateMatch(patch,q);
    if(ctx.sourceFixture)await model.saveFixture({...ctx.sourceFixture,scheduled_date:patch.scheduled_date,confirmed_date:patch.confirmed_date,timezone:patch.timezone,status:'scheduled',scheduling_status:'confirmed'},q);
    if(ctx.engine)await model.saveEngine({...ctx.engine,match_id:match.id,scheduled_at:patch.scheduled_date,confirmed_at:patch.confirmed_date,status:'scheduled',scheduling_status:'confirmed'},q);
    request.status='approved';request.decided_by_user_id=user.id;request.decided_at=now.toISOString();
   }else{request.status=body.action==='cancel'?'cancelled':'declined';request.decided_by_user_id=user.id;request.decided_at=now.toISOString();}
   await model.save(request,q);await model.operation(user,body.club_id,before,request,'Responded to an official schedule change',q);
   await model.notice([match.home_club_id,match.away_club_id],request,request.status==='approved'?'approved':request.status==='cancelled'?'cancelled':'declined',q);
   return {...report(),match_updated:request.status==='approved'};
  });
 }
 return {act};
}
module.exports={createService,...createService()};

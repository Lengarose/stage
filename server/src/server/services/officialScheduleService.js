'use strict';
const {EXECUTESQL,withTransaction}=require('../db/database');
const {v4:uuid}=require('uuid');
const {fail}=require('../lib/regionalEditionIdentity');
const {scheduleTime}=require('../lib/officialScheduleTime');
const {matchWindows}=require('../lib/officialMatchWindows');
const {busyEvents}=require('../lib/officialCalendarLoad');
const {loadViolations,policy}=require('../lib/regionalCalendarPlan');
const eligibility=require('./officialMatchEligibilityService');
const {OfficialMatchPreparationModel}=require('../models/officialMatchPreparationModel');
const {OfficialScheduleModel}=require('../models/officialScheduleModel');
function createService({query=EXECUTESQL,transaction=withTransaction,context=eligibility.context,model=new OfficialScheduleModel(),preparations=new OfficialMatchPreparationModel(),clock=()=>new Date()}={}) {
  async function force(ref,body,actor) {
    return transaction(async q=>{
      await model.lock(q);
      const ctx=await context(ref,q,{allowMissingMatch:true});
      if(!ctx.official)return null;
      const user=await model.actor(actor?.id,q);
      if(!user || user.role_id==null || ![0,2].includes(Number(user.role_id)))fail('Admin scheduling access required',403);
      if(ctx.match && await model.hasKickoff(ctx.match.id,q))fail('Kickoff evidence exists; an official match cannot be rescheduled');
      if(ctx.match && (!['unscheduled','pending_schedule','scheduled','confirmed'].includes(ctx.match.status) || ctx.match.first_submission_at || ctx.match.home_submission || ctx.match.away_submission || Number(ctx.match.report_finalized) || Number(ctx.match.stats_processed)))fail('A started or reported match cannot be rescheduled');
      if(!ctx.match && (!ctx.sourceFixture || ctx.sourceFixture.match_id || ctx.engine?.match_id))fail('Missing official match link requires Admin review');
      const zone=body.timezone || ctx.match?.timezone || ctx.sourceFixture?.timezone || user.timezone;
      const time=scheduleTime(body.date,zone);
      if(time.instant<=clock().getTime())fail('Official kickoff must be in the future',400);
      const reason=String(body.admin_note || '').trim();if(!reason)fail('Explain this official scheduling action',400);
      const base=ctx.match || {...ctx.sourceFixture,id:uuid(),mode:'club',type:ctx.sourceFixture.phase || 'league',tournament_id:null,source_fixture_type:'regional_league',source_fixture_id:ctx.sourceFixture.id,competition_context:ctx.root.id,stats_processed:0};
      if(!base.home_club_id || !base.away_club_id || base.home_club_id===base.away_club_id)fail('Both official opponents must be known');
      if(ctx.sourceFixture && (ctx.sourceFixture.home_club_id!==base.home_club_id || ctx.sourceFixture.away_club_id!==base.away_club_id))fail('Fixture opponents disagree; review fixture identity');
      if(ctx.engine && (ctx.engine.home_club_id!==base.home_club_id || ctx.engine.away_club_id!==base.away_club_id))fail('Engine opponents disagree; review fixture identity');
      let previous=null;
      if(ctx.match?.scheduled_date)previous=matchWindows(ctx.match,clock()).schedule_key;
      const updated={...base,scheduled_date:time.wall,confirmed_date:time.wall,timezone:zone,status:'scheduled',scheduling_status:'confirmed'};
      const before={fixture:ctx.sourceFixture || null,engine:ctx.engine || null,match:ctx.match || null};
      for(const other of await model.clashes(updated,q)) {
        if(other.scheduled_date && matchWindows(other,clock()).schedule_key===new Date(time.instant).toISOString())fail('This club already has a match at that kickoff time');
      }
      if(policy.regions.includes(ctx.root.region_slug)) {
        const excluded=new Set([updated.id,ctx.sourceFixture?.id,ctx.engine?.id].filter(Boolean));
        const existing=busyEvents(await model.events([base.home_club_id,base.away_club_id],q),excluded);
        const candidate={id:updated.id,home_club_id:base.home_club_id,away_club_id:base.away_club_id,instant:time.instant,minutes:['league','league_phase'].includes(base.type)?policy.league_minutes:policy.knockout_minutes};
        const conflicts=loadViolations([...existing.filter(e=>Math.abs(e.instant-time.instant)<8*86400000),candidate]);
        if(conflicts.length)fail('Official calendar load limits or match blocks would be violated',409,conflicts);
      }
      const changed=!ctx.match || previous!==new Date(time.instant).toISOString();
      if(changed && time.instant<=clock().getTime()+5*60000)fail('Allow more than five minutes to republish the official selection before its lock deadline');
      if(ctx.match)await model.updateMatch(updated,q);else await model.createMatch(updated,q);
      const fixture=ctx.sourceFixture?{...ctx.sourceFixture,match_id:updated.id,scheduled_date:time.wall,confirmed_date:time.wall,timezone:zone,status:'scheduled',scheduling_status:'confirmed'}:null;
      if(fixture)await model.saveFixture(fixture,q);
      const engine=ctx.engine?{...ctx.engine,match_id:updated.id,scheduled_at:time.wall,confirmed_at:time.wall,status:'scheduled',scheduling_status:'confirmed'}:null;
      if(engine)await model.saveEngine(engine,q);
      const prep=await preparations.selectOne(updated.id,q);
      if(changed)await preparations.save({match_id:updated.id,edition_id:ctx.root.id,schedule_key:new Date(time.instant).toISOString(),sides:{},history:prep?[...(prep.history || []),{schedule_key:prep.schedule_key,sides:prep.sides}]:[]},q);
      const after={fixture,engine,match:updated};
      const audit=await model.audit(ctx,user,before,after,reason,q);
      if(changed)await model.notify(updated,audit.id,q);
      return {success:true,managed_official:true,fixture:fixture || {...engine,id:engine?.legacy_fixture_id || engine?.id},match:updated,audit,preparation_invalidated:changed};
    });
  }
  async function reuse(ref,q=query) {
    const ctx=await context(ref,q,{allowMissingMatch:true});
    if(!ctx.official)return null;
    if(!ctx.match)fail('Publish the official schedule through Admin before opening GameDay');
    return {data:{success:true,match:ctx.match,reused:true,managed_official:true}};
  }
  async function assertLegacyWrite(ref,q=query) {
    const ctx=await context(ref,q,{allowMissingMatch:true});
    if(ctx.official)fail('This edition uses the official calendar; use the protected Admin schedule action');
  }
  async function assertLegacyMatchWrite(ref,q=query) {
    const [match]=await q('SELECT * FROM matches WHERE id = ? LIMIT 1',[ref]);
    if(match && ['competition_engine','regional_league','regional_league_fixture','regional_pathway'].includes(match.source_fixture_type))await assertLegacyWrite(ref,q);
  }
  return {force,reuse,assertLegacyWrite,assertLegacyMatchWrite};
}
module.exports={createService,scheduleTime,...createService()};

'use strict';
const crypto=require('crypto');
const {withTransaction}=require('../db/database');
const {fail}=require('../lib/regionalEditionIdentity');
const {RegionalPromotionCalendarModel}=require('../models/regionalPromotionCalendarModel');
const {dateAt,loadViolations,policy:leaguePolicy,weekOf,localDate}=require('../lib/regionalCalendarPlan');
const {scheduleTime}=require('../lib/officialScheduleTime');
const {busyEvents}=require('../lib/officialCalendarLoad');
const sporting=require('../lib/regionalStructure');
const participation=require('../lib/regionalRegistrationPolicy');
const promotionPolicy=require('../lib/regionalPromotionCalendarPolicy.json');
const cycles=require('./regionalCycleService');
const {isConfirmedResult}=require('../lib/tournamentStatistics');
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const policyRevision=value=>hash(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)));
const stableId=value=>{const h=hash(value);return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`;};
function createService({model=new RegionalPromotionCalendarModel(),transaction=withTransaction,evaluate=cycles.evaluate,policy=promotionPolicy,clock=()=>new Date()}={}) {
  async function operate(cycleId,body,actor,automatic=false) {
    return transaction(async q=>{
      const user=automatic?{id:null,email:null}:await model.actor(actor?.id,q);
      if(!automatic && (!user || user.role_id==null || ![0,2].includes(Number(user.role_id))))fail('Admin pathway calendar access required',403);
      if(!['semifinal','final'].includes(body.stage))fail('Choose the promotion semifinal or final stage',400);
      if(['date','start_monday','fixture_ids','winners'].some(k=>Object.hasOwn(body,k)))fail('Dates and participants follow the recorded source calendar and sporting results',400);
      await model.lock(q);
      const cycle=await model.cycle(cycleId,q);if(!cycle)fail('Regional cycle not found',404);
      const captured=require('../lib/regionalSeasonOrchestrationPolicy').enabled({...cycle.participation_window_snapshot,status:'published'});
      if(automatic && body.stage==='semifinal' && !captured)fail('Automatic promotion semifinals require captured season orchestration',403);
      const id=stableId(['regional_promotion_calendar',cycleId,body.stage]),published=await model.published(id,q);
      if(published)return {...published,already_published:true};
      const parent=automatic && body.stage==='final'?await model.published(stableId(['regional_promotion_calendar',cycleId,'semifinal']),q):null;
      if(automatic && body.stage==='final' && !parent)return {status:'not_enabled'};
      if(cycle.input?.mode!=='transition' || cycle.policy_version!==sporting.VERSION || cycle.source_ranking_policy_version!==sporting.SOURCE_RANKING_VERSION || cycle.participation_window_snapshot?.policy_version!==participation.VERSION || !leaguePolicy.regions.includes(cycle.region_slug) || !['running','review','ready'].includes(cycle.status) || cycle.edition_invalidated)fail('Choose a current official European transition with supported sporting and participation policies');
      if(cycle.input.target_count===240 && cycle.source_snapshot?.reduce((n,s)=>n+(s.club_ids?.length || 0),0)===180)fail('The extra five-match expansion route has no approved complete calendar');
      const anchors=(await model.calendars(q)).filter(c=>c.status==='published' && c.policy_version===leaguePolicy.version && cycle.source_edition_ids?.length && cycle.source_edition_ids.every(id=>c.edition_ids?.includes(id)));
      if(anchors.length!==1)fail('One published league calendar must anchor all source groups before promotion can be planned');
      const anchor=anchors[0];
      if(anchor.timezone!==policy.timezone || !/^\d{4}-\d{2}-\d{2}$/.test(anchor.start_monday || '') || weekOf(anchor.start_monday)!==anchor.start_monday)fail('The source calendar has no valid first-playing-week Monday');
      const fresh=await evaluate(cycle,q),plan=fresh.plan,stored=fresh.stored,matches=await model.cycleMatches(cycle.id,q);
      const blockers=[...(plan.blockers || [])];
      if(policy.status!=='confirmed')blockers.push('Promotion kickoff days and hours still require explicit policy confirmation');
      if(plan.unresolved_ties?.length || plan.pending?.some(f=>!f.ref.startsWith('promotion:')))blockers.push('Resolve the source sporting decisions before planning promotion');
      if(plan.fixtures.some(f=>f.ref.startsWith('growth:')))blockers.push('Expansion decision fixtures need their own approved calendar; this planner handles normal promotion only');
      const groups=(cycle.source_snapshot || []).filter(s=>s.identity?.division===2).map(s=>`D2${s.identity.group_code || 'A'}`);
      if(!groups.length || new Set(groups).size!==groups.length)fail('The captured source Division 2 groups are unavailable or ambiguous');
      const refs=groups.flatMap(g=>body.stage==='semifinal'?[`promotion:${g}:sf:2-5`,`promotion:${g}:sf:3-4`]:[`promotion:${g}:final`]);
      const date=dateAt(anchor.start_monday,(policy.week-1)*7+(body.stage==='semifinal'?policy.semifinal_day:policy.final_day));
      const time=scheduleTime(`${date}T${policy.time}`,policy.timezone);
      if(time.instant<=clock().getTime()+5*60000)blockers.push('The reserved kickoff is too close or has passed; Admin calendar review is required');
      // The final's Thursday slot is already published in the semifinal policy
      // snapshot. Resolving its opponents after Tuesday play is progression,
      // rather than a new initial calendar with another 48-hour lead period.
      if(captured && body.stage==='semifinal' && time.instant<clock().getTime()+48*3600000)blockers.push('Publish the definitive promotion calendar at least 48 hours before kickoff');
      if(automatic && body.stage==='final') {
        const semifinalRefs=groups.flatMap(g=>[`promotion:${g}:sf:2-5`,`promotion:${g}:sf:3-4`]);
        if(parent.status!=='published' || parent.stage!=='semifinal' || parent.cycle_id!==cycleId || parent.source_calendar_id!==anchor.id || parent.policy_version!==policy.version || !parent.policy_snapshot || policyRevision(parent.policy_snapshot)!==policyRevision(policy) || parent.entries?.length!==semifinalRefs.length || new Set(parent.entries.map(e=>e.ref)).size!==semifinalRefs.length || semifinalRefs.some(ref=>!parent.entries.some(e=>e.ref===ref)))fail('The published semifinal calendar no longer matches the approved promotion policy');
        const semifinalMatches=parent.entries.map(entry=>{
          const fixture=stored.find(f=>f.id===entry.id),linked=matches.filter(m=>m.id===entry.match_id || m.source_fixture_id===entry.id);
          if(cycle.fixture_refs?.[entry.ref]!==entry.id || !fixture || fixture.match_id!==entry.match_id || fixture.legacy_fixture_type!=='regional_pathway' || fixture.competition_instance_id!==cycleId || linked.length!==1 || linked[0].id!==entry.match_id || linked[0].source_fixture_id!==entry.id || linked[0].competition_context!==cycleId || linked[0].source_fixture_type!=='competition_engine' || !Number(linked[0].allow_penalties) || linked[0].home_club_id!==entry.home_club_id || linked[0].away_club_id!==entry.away_club_id || (linked[0].confirmed_date || linked[0].scheduled_date)!==entry.scheduled_date || linked[0].timezone!==entry.timezone)fail('A published semifinal Match or kickoff changed; review automatic final planning');
          return linked[0];
        });
        if(blockers.length)fail('Resolve promotion calendar blockers before automatic final publication',409,blockers);
        if(semifinalMatches.some(m=>!isConfirmedResult(m) || String(m.result_state || '').toLowerCase()==='auto_confirmed_timeout'))return {status:'waiting_semifinals'};
      }
      const entries=[],bindings=[];
      for(const ref of refs) {
        const proposed=plan.fixtures.find(f=>f.ref===ref),fixture=stored.find(f=>f.id===cycle.fixture_refs?.[ref]);
        if(!proposed || !fixture){blockers.push(`Recorded draw is not ready for ${ref}; reconcile official results first`);continue;}
        const linked=matches.filter(m=>m.id===fixture.match_id || m.source_fixture_id===fixture.id);
        if(linked.length!==1 || linked[0].id!==fixture.match_id)fail('Missing or ambiguous canonical pathway Match');
        const match=linked[0];
        if(fixture.legacy_fixture_type!=='regional_pathway' || fixture.legacy_fixture_id!==fixture.id || fixture.competition_instance_id!==cycle.id || match.source_fixture_type!=='competition_engine' || match.source_fixture_id!==fixture.id || match.competition_context!==cycle.id || !Number(match.allow_penalties) || !proposed.allow_penalties)fail('Pathway source identity or knockout rules disagree');
        for(const row of [fixture,match]) {
          if(!proposed.home || proposed.home===proposed.away || row.home_club_id!==proposed.home || row.away_club_id!==proposed.away)fail('Published promotion opponents no longer follow the sporting draw');
          if(!['unscheduled','pending_schedule'].includes(row.status) || row.scheduled_at || row.confirmed_at || row.scheduled_date || row.confirmed_date || row.first_submission_at || row.home_submission || row.away_submission || Number(row.stats_processed) || Number(row.report_finalized))fail('Initial pathway publication cannot overwrite scheduled, played or reported matches');
        }
        entries.push({id:fixture.id,ref,match_id:match.id,home_club_id:proposed.home,away_club_id:proposed.away,scheduled_date:time.wall,timezone:policy.timezone,instant:time.instant,minutes:policy.minutes});
        bindings.push({fixture,match});
      }
      if(new Set(entries.flatMap(e=>[e.home_club_id,e.away_club_id])).size!==entries.length*2)fail('A club occurs twice in the same promotion stage');
      const selections=await model.selections(bindings.map(b=>b.match.id),q);if(selections.length)fail('Official preparation evidence prevents initial pathway publication');
      const clubs=[...new Set(entries.flatMap(e=>[e.home_club_id,e.away_club_id]))];
      const events=clubs.length?await model.events(clubs,q):{matches:[],engines:[],fixtures:[]};
      const excluded=new Set(bindings.flatMap(b=>[b.fixture.id,b.match.id]));
      const busy=busyEvents(events,excluded).filter(e=>weekOf(localDate(e.instant))===weekOf(date));
      blockers.push(...loadViolations([...busy,...entries]));
      const revision=hash([policy,anchor,cycle,plan,stored,matches,selections,events]);
      const result={id,cycle_id:cycle.id,stage:body.stage,policy_version:policy.version,policy_status:policy.status,source_calendar_id:anchor.id,start_monday:anchor.start_monday,timezone:policy.timezone,entries,blockers:[...new Set(blockers)],revision,already_published:false};
      if(body.apply!==true)return result;
      if(policy.status!=='confirmed')fail('Promotion calendar policy confirmation is still required');
      if(!String(body.reason || '').trim())fail('Explain this pathway calendar publication',400);
      if(!automatic && body.expected_revision!==revision)fail('Pathway calendar sources changed; review a fresh preview');
      if(result.blockers.length || entries.length!==refs.length)fail('Resolve pathway calendar blockers before publication',409,result.blockers);
      for(const {fixture,match} of bindings) {
        const updatedMatch={...match,scheduled_date:time.wall,confirmed_date:time.wall,timezone:policy.timezone,status:'scheduled',scheduling_status:'confirmed'};
        const engine={...fixture,scheduled_at:time.wall,confirmed_at:time.wall,status:'scheduled',scheduling_status:'confirmed'};
        await model.updateMatch(updatedMatch,q);await model.saveEngine(engine,q);
        const audit=await model.audit({engine:fixture,calendar:true},user,{engine:fixture,match},{engine,match:updatedMatch},body.reason,q);
        await model.notify(updatedMatch,audit.id,q);
      }
      const record={...result,status:'published',published_at:clock().toISOString(),policy_snapshot:policy,...(automatic?{publication_mode:'automatic_followup',...(parent?{parent_calendar_id:parent.id}:{})}:{})};
      await model.save(record,user,body.reason,q);return record;
    });
  }
  async function action(cycleId,body,actor) {return operate(cycleId,body,actor,false);}
  async function reconcileFinal(cycleId) {return operate(cycleId,{stage:'final',apply:true,reason:'Automatic promotion final after published semifinals and confirmed sporting results'},null,true);}
  async function reconcilePromotion(cycleId) {
    await operate(cycleId,{stage:'semifinal',apply:true,reason:'Automatic promotion semifinals from final source standings and the published week-eleven calendar'},null,true);
    return reconcileFinal(cycleId);
  }
  return {action,reconcileFinal,reconcilePromotion};
}
module.exports={createService,...createService()};

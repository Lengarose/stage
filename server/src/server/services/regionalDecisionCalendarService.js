'use strict';
const crypto=require('crypto');
const {withTransaction}=require('../db/database');
const {fail}=require('../lib/regionalEditionIdentity');
const {RegionalPromotionCalendarModel}=require('../models/regionalPromotionCalendarModel');
const {policy:calendarPolicy,loadViolations,dateAt}=require('../lib/regionalCalendarPlan');
const {scheduleTime}=require('../lib/officialScheduleTime');
const {busyEvents}=require('../lib/officialCalendarLoad');
const sporting=require('../lib/regionalStructure');
const cycles=require('./regionalCycleService');
const hash=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const stableId=v=>{const h=hash(v);return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`;};
function createService({model=new RegionalPromotionCalendarModel(),transaction=withTransaction,evaluate=cycles.evaluate,clock=()=>new Date()}={}) {
  async function action(cycleId,body,actor) {
    return transaction(async q=>{
      const user=await model.actor(actor?.id,q);if(!user || user.role_id==null || ![0,2].includes(Number(user.role_id)))fail('Admin decision calendar access required',403);
      await model.lock(q);
      const cycle=await model.cycle(cycleId,q);if(!cycle)fail('Regional cycle not found',404);
      if(!Array.isArray(body.round_slots) || !body.round_slots.length || body.round_slots.length>3 || body.round_slots.some(s=>!Number.isInteger(s.round)||s.round<1||s.round>3) || new Set(body.round_slots.map(s=>s.round)).size!==body.round_slots.length)fail('Provide one valid kickoff for each decision round, up to three rounds',400);
      const slots=body.round_slots.slice().sort((a,b)=>a.round-b.round).map(s=>({round:s.round,...scheduleTime(s.date,calendarPolicy.timezone)}));
      if(body.apply===true) {
        if(!Array.isArray(body.fixture_ids) || !body.fixture_ids.length || body.fixture_ids.some(id=>typeof id!=='string') || new Set(body.fixture_ids).size!==body.fixture_ids.length)fail('Provide the reviewed decision fixture IDs',400);
        const published=await model.published(stableId(['regional_decision_calendar',cycle.id,body.fixture_ids.slice().sort()]),q);
        if(published){if(hash(published.round_slots)!==hash(slots.map(s=>({round:s.round,date:s.wall}))))fail('A published decision calendar cannot be overwritten');return {...published,already_published:true};}
      }
      if(!calendarPolicy.regions.includes(cycle.region_slug) || cycle.edition_invalidated || !['running','review','ready'].includes(cycle.status) || cycle.policy_version!==sporting.VERSION || cycle.tie_policy_version!==sporting.TIE_VERSION || cycle.participation_window_snapshot?.policy_version!=='regional_registration_v1')fail('Choose a current official European cycle with the recorded sporting-decision policy');
      const fresh=await evaluate(cycle,q),plan=fresh.plan,stored=fresh.stored,matches=await model.cycleMatches(cycle.id,q);
      const pending=plan.pending.filter(f=>f.ref.includes(':tie:'));
      if(!pending.length)fail('There are no pending supplementary decision fixtures to schedule');
      const rounds=[...new Set(pending.map(f=>f.round))].sort((a,b)=>a-b);
      if(hash(rounds)!==hash(slots.map(s=>s.round)))fail('Choose exactly the rounds of the current pending sporting decisions',400);
      const blockers=[...(plan.blockers || [])];
      let sourceCalendars=[];
      if(cycle.input?.mode==='transition' && cycle.source_snapshot?.some(s=>Number(s.identity?.division)===2)) {
        const anchors=(await model.calendars(q)).filter(c=>c.status==='published' && c.policy_version===calendarPolicy.version && cycle.source_edition_ids?.length && cycle.source_edition_ids.every(id=>c.edition_ids?.includes(id)));
        sourceCalendars=anchors;
        if(anchors.length!==1)fail('The published source league calendar is required to protect the promotion deadline');
        const promotion=require('../lib/regionalPromotionCalendarPolicy.json');
        const deadline=scheduleTime(`${dateAt(anchors[0].start_monday,(promotion.week-1)*7+promotion.semifinal_day)}T${promotion.time}`,promotion.timezone).instant;
        if(slots.some(s=>s.instant+(pending.some(f=>f.round===s.round && f.allow_penalties)?60:40)*60000>deadline))blockers.push('Decision rounds must finish before the reserved promotion semifinals; unresolved result deadlines still require Admin review');
      }
      const entries=[],bindings=[];
      for(const fixture of pending) {
        const engine=stored.find(f=>f.id===cycle.fixture_refs?.[fixture.ref]),linked=matches.filter(m=>m.id===engine?.match_id || m.source_fixture_id===engine?.id);
        if(!engine || linked.length!==1 || linked[0].id!==engine.match_id)fail('Reconcile the recorded decision draw before planning its calendar');
        const match=linked[0],time=slots.find(s=>s.round===fixture.round);
        if(engine.competition_instance_id!==cycle.id || engine.legacy_fixture_type!=='regional_pathway' || engine.legacy_fixture_id!==engine.id || match.source_fixture_type!=='competition_engine' || match.source_fixture_id!==engine.id || match.competition_context!==cycle.id || Boolean(Number(match.allow_penalties))!==Boolean(fixture.allow_penalties))fail('Decision Match identity or knockout policy disagrees with the recorded draw');
        for(const row of [engine,match]) {
          if(row.home_club_id!==fixture.home || row.away_club_id!==fixture.away || !fixture.home || fixture.home===fixture.away)fail('Decision opponents disagree with the captured sporting draw');
          if(!['unscheduled','pending_schedule'].includes(row.status) || row.scheduled_date || row.confirmed_date || row.scheduled_at || row.confirmed_at || row.home_submission || row.away_submission || row.first_submission_at || Number(row.stats_processed) || Number(row.report_finalized))fail('Initial decision publication cannot overwrite an existing schedule or report');
        }
        if(time.instant<=clock().getTime()+5*60000)blockers.push('Decision kickoffs must allow more than five minutes before selection locks');
        entries.push({id:engine.id,ref:fixture.ref,round:fixture.round,match_id:match.id,home_club_id:fixture.home,away_club_id:fixture.away,scheduled_date:time.wall,timezone:calendarPolicy.timezone,instant:time.instant,minutes:fixture.allow_penalties?60:40});bindings.push({engine,match});
      }
      for(let i=1;i<slots.length;i++)if(slots[i].instant<=slots[i-1].instant)blockers.push('Decision rounds must be scheduled in chronological order');
      const ids=entries.map(e=>e.id).sort(),id=stableId(['regional_decision_calendar',cycle.id,ids]);
      if(body.apply===true && hash(body.fixture_ids.slice().sort())!==hash(ids))fail('The pending decision draw changed; review again');
      const selections=await model.selections(bindings.map(b=>b.match.id),q);if(selections.length)fail('Official preparation evidence prevents initial decision publication');
      const clubs=[...new Set(entries.flatMap(e=>[e.home_club_id,e.away_club_id]))],events=await model.events(clubs,q),excluded=new Set(bindings.flatMap(b=>[b.engine.id,b.match.id]));
      const busy=busyEvents(events,excluded),from=Math.min(...entries.map(e=>e.instant))-7*86400000,to=Math.max(...entries.map(e=>e.instant))+7*86400000;
      blockers.push(...loadViolations([...busy.filter(e=>e.instant>=from && e.instant<=to),...entries]));
      const revision=hash([cycle,plan,stored,matches,selections,events,slots,sourceCalendars]);
      const report={id,cycle_id:cycle.id,stage:'decisions',timezone:calendarPolicy.timezone,round_slots:slots.map(s=>({round:s.round,date:s.wall})),fixture_ids:ids,entries,revision,blockers:[...new Set(blockers)],already_published:false};
      if(body.apply!==true)return report;
      if(!String(body.reason || '').trim())fail('Explain this decision calendar publication',400);
      if(body.expected_revision!==revision)fail('Decision calendar sources changed; review a fresh preview');
      if(report.blockers.length)fail('Resolve decision calendar blockers before publication',409,report.blockers);
      for(const {engine,match} of bindings) {
        const entry=entries.find(e=>e.id===engine.id),updated={...match,scheduled_date:entry.scheduled_date,confirmed_date:entry.scheduled_date,timezone:entry.timezone,status:'scheduled',scheduling_status:'confirmed'},next={...engine,scheduled_at:entry.scheduled_date,confirmed_at:entry.scheduled_date,status:'scheduled',scheduling_status:'confirmed'};
        await model.updateMatch(updated,q);await model.saveEngine(next,q);const audit=await model.audit({engine,calendar:true},user,{engine,match},{engine:next,match:updated},body.reason,q);await model.notify(updated,audit.id,q);
      }
      const record={...report,status:'published',published_at:clock().toISOString()};await model.save(record,user,body.reason,q);return record;
    });
  }
  return {action};
}
module.exports={createService,...createService()};

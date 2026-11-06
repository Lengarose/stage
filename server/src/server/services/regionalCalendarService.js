'use strict';
const crypto=require('crypto');
const {EXECUTESQL,withTransaction}=require('../db/database');
const {RegionalCalendarModel}=require('../models/regionalCalendarModel');
const {buildCatalogue}=require('../lib/regionalLeagueHierarchy');
const {identity,fail}=require('../lib/regionalEditionIdentity');
const {VERSION}=require('../lib/regionalRegistrationPolicy');
const {planCalendar,policy}=require('../lib/regionalCalendarPlan');
const {busyEvents}=require('../lib/officialCalendarLoad');
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const stableId=value=>{const h=hash(value);return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`;};
function createService({model=new RegionalCalendarModel(),transaction=withTransaction,query=EXECUTESQL,clock=()=>new Date()}={}) {
  async function runAction(body,actor,automatic=false) {
    return transaction(async q=>{
      const user=automatic?{id:null,email:null}:await model.actor(actor?.id,q);
      if(!automatic && (!user || user.role_id==null || ![0,2].includes(Number(user.role_id))))fail('Admin calendar access required',403);
      await model.lock(q);
      let selected=body.edition_ids,cycle=null;
      if(Object.hasOwn(body,'cycle_id')) {
        if(typeof body.cycle_id!=='string' || !body.cycle_id.trim() || Object.hasOwn(body,'edition_ids'))fail('Select a stored cycle or explicit edition IDs, not both',400);
        cycle=await model.cycle(body.cycle_id,q);
        if(!cycle || cycle.status!=='allocated' || cycle.edition_invalidated || cycle.invalidated_at || !Array.isArray(cycle.allocated_groups) || !cycle.allocated_groups.length)fail('Choose a valid allocated regional cycle before preparing its calendar');
        selected=cycle.allocated_groups.map(g=>g?.id);
      }
      if(automatic && (!cycle || !require('../lib/regionalSeasonOrchestrationPolicy').enabled({...cycle.participation_window_snapshot,status:'published'}) || body.start_monday!==cycle.participation_window_snapshot.league_start_monday))fail('Automatic calendar publication requires an explicitly captured first playing Monday');
      if(!Array.isArray(selected) || !selected.length || selected.length>12 || selected.some(id=>typeof id!=='string' || !id.trim()) || new Set(selected).size!==selected.length)fail('Select unique regional edition IDs',400);
      const ids=selected.slice().sort(),all=await model.editions(q),catalogue=buildCatalogue(all);
      const editions=ids.map(id=>{
        const group=catalogue.groups.find(g=>g.current_edition_id===id);
        if(!group || group.retired || group.identity_conflict || group.identity_unverified)fail('Choose current, unambiguous and active league groups');
        const edition=all.find(e=>e.id===id);
        if(!edition || edition.edition_invalidated || ![1,2].includes(Number(edition.division)) || edition.regional_participation_policy_version!==VERSION || !['in_progress','registration'].includes(edition.status))fail('Only new official D1/D2 editions with a completed draw can receive a season calendar');
        return edition;
      });
      const scope=identity(editions[0]);
      if(editions.some(e=>{const i=identity(e);return i.region_slug!==scope.region_slug || i.platform!==scope.platform || i.season_number!==scope.season_number || Number(i.reset_series || 0)!==Number(scope.reset_series || 0);}))fail('Publish one regional system and season at a time');
      if(cycle) {
        if(cycle.region_slug!==scope.region_slug || cycle.platform!==scope.platform || Number(cycle.season_number)!==scope.season_number || Number(cycle.reset_series || 0)!==Number(scope.reset_series || 0))fail('The allocated cycle and current group identities disagree');
        if(editions.some(e=>{const g=cycle.allocated_groups.find(g=>g.id===e.id);return e.regional_cycle_id!==cycle.id || Number(g.division)!==Number(e.division) || g.group_code!==identity(e).group_code || g.permanent_league_id!==(e.permanent_league_id || e.id);}))fail('The stored cycle allocation no longer matches its current groups');
      }
      const required=catalogue.groups.filter(g=>!g.retired && !g.identity_conflict && g.region_slug===scope.region_slug && identity(g).platform===scope.platform && Number(g.season_number)===scope.season_number && Number(g.reset_series || 0)===Number(scope.reset_series || 0) && g.regional_participation_policy_version===VERSION && ['in_progress','registration'].includes(g.status) && (Array.isArray(g.registered_club_ids)?g.registered_club_ids:JSON.parse(g.registered_club_ids || '[]')).length>0);
      if(required.some(g=>!ids.includes(g.current_edition_id)))fail('Include all populated current groups of this regional system in the calendar preview');
      const id=stableId(['regional_calendar',scope.region_slug,scope.platform,scope.season_number,scope.reset_series || 0]);
      const published=await model.published(id,q);
      if(published) {
        if(published.start_monday!==body.start_monday || JSON.stringify(published.edition_ids)!==JSON.stringify(ids))fail('This season already has a published calendar; use controlled individual rescheduling');
        return {...published,already_published:true};
      }
      const fixtures=await model.fixtures(ids,q);
      const clubs=[...new Set(editions.flatMap(e=>typeof e.registered_club_ids==='string'?JSON.parse(e.registered_club_ids):e.registered_club_ids || []))].sort();
      if(clubs.length<20)fail('Every calendar group requires twenty confirmed clubs');
      const events=await model.events(clubs,q),excluded=new Set(fixtures.map(f=>f.id));
      const bindings=new Map(),usedMatches=new Set();
      for(const f of fixtures) {
        const engines=events.engines.filter(e=>e.legacy_fixture_id===f.id || e.id===f.id);
        if(engines.length>1)fail('Ambiguous engine mapping requires Admin review');
        const engine=engines[0];
        const matches=events.matches.filter(m=>m.id===f.match_id || m.id===engine?.match_id || m.source_fixture_id===f.id || (engine && m.source_fixture_id===engine.id));
        if(matches.length>1 || ((f.match_id || engine?.match_id) && !matches.length))fail('Ambiguous or missing GameDay mapping requires Admin review');
        const match=matches[0];
        if([f.match_id,engine?.match_id].filter(Boolean).some(id=>id!==match?.id))fail('Stored GameDay pointers disagree; review fixture identity');
        if(engine && engine.legacy_fixture_type!=='regional_league')fail('Engine source type disagrees with the regional fixture');
        if(match && !((['regional_league','regional_league_fixture'].includes(match.source_fixture_type) && match.source_fixture_id===f.id) || (match.source_fixture_type==='competition_engine' && engine && match.source_fixture_id===engine.id)))fail('GameDay source identity disagrees with the fixture');
        if(match && usedMatches.has(match.id))fail('Several fixtures point to the same GameDay match');
        if(match)usedMatches.add(match.id);
        for(const row of [f,engine,match].filter(Boolean)) {
          if(row.home_club_id!==f.home_club_id || row.away_club_id!==f.away_club_id)fail('Fixture opponents disagree; review fixture identity');
          if(!['unscheduled','pending_schedule','open'].includes(row.status || 'unscheduled') || row.scheduled_date || row.confirmed_date || row.scheduled_at || row.confirmed_at || (row.scheduling_status && !['open','pending_schedule'].includes(row.scheduling_status)) || row.first_submission_at || row.home_submission || row.away_submission || Number(row.stats_processed) || Number(row.report_finalized))fail('Season publication only accepts unscheduled and unplayed fixtures; existing schedules must be reviewed separately');
          excluded.add(row.id);
        }
        bindings.set(f.id,{fixture:f,engine,match});
      }
      const selections=await model.selections([...usedMatches],q);
      if(selections.length)fail('Existing official selection/preparation evidence prevents initial season publication');
      const busy=busyEvents(events,excluded);
      const plan=planCalendar({editions,fixtures,start_monday:body.start_monday,busy,now:clock()});
      const capturedCycle=cycle || (editions[0].regional_cycle_id?await model.cycle(editions[0].regional_cycle_id,q):null);
      if(require('../lib/regionalSeasonOrchestrationPolicy').enabled({...capturedCycle?.participation_window_snapshot,status:'published'}) && Math.min(...plan.entries.map(e=>e.instant))-clock().getTime()<48*3600000)plan.blockers.push('Publish the definitive season calendar at least 48 hours before the first kickoff.');
      const revision=hash([policy,ids,body.start_monday,editions,fixtures,events,selections,...(cycle?[{id:cycle.id,allocated_groups:cycle.allocated_groups,region_slug:cycle.region_slug,platform:cycle.platform,season_number:cycle.season_number,reset_series:cycle.reset_series || 0}]:[])]);
      const result={...plan,id,edition_ids:ids,region_slug:scope.region_slug,season_number:scope.season_number,reset_series:scope.reset_series || 0,...(cycle?{source_cycle_id:cycle.id}:{}),revision,already_published:false,coverage:'Club schedules only; player-level multi-event conflicts and future pathway/cup draws are not generated.'};
      if(body.apply!==true)return result;
      const reason=String(body.reason || '').trim();if(!reason)fail('Explain the calendar publication',400);
      if(body.expected_revision!==revision)fail('The calendar source changed; generate and review a fresh preview');
      if(plan.blockers.length)fail('Calendar conflicts must be resolved before publication',409,plan.blockers);
      for(const entry of plan.entries) {
        const before=bindings.get(entry.id),base=before.match || {...before.fixture,id:stableId(['official_calendar_match',entry.id]),mode:'club',type:'league',round:entry.matchday,source_fixture_type:'regional_league',source_fixture_id:entry.id,competition_context:entry.edition_id,stats_processed:0};
        if(!before.match && events.matches.some(m=>m.id===base.id))fail('Reserved GameDay identity is already occupied');
        const match={...base,scheduled_date:entry.scheduled_date,confirmed_date:entry.scheduled_date,timezone:entry.timezone,status:'scheduled',scheduling_status:'confirmed'};
        if(before.match)await model.updateMatch(match,q);else await model.createMatch(match,q);
        const fixture={...before.fixture,match_id:match.id,scheduled_date:entry.scheduled_date,confirmed_date:entry.scheduled_date,timezone:entry.timezone,status:'scheduled',scheduling_status:'confirmed'};
        await model.saveFixture(fixture,q);
        const engine=before.engine?{...before.engine,match_id:match.id,scheduled_at:entry.scheduled_date,confirmed_at:entry.scheduled_date,status:'scheduled',scheduling_status:'confirmed'}:null;
        if(engine)await model.saveEngine(engine,q);
        await model.audit({sourceFixture:before.fixture,engine:before.engine,calendar:true},user,before,{fixture,engine,match},reason,q);
      }
      const record={...result,status:'published',published_at:clock().toISOString(),published_by:user.id,policy_snapshot:policy};
      record.notification_summary=await model.summary(clubs,record,q);
      await model.save(record,user,reason,q);
      return record;
    });
  }
  async function action(body,actor){return runAction(body,actor,false);}
  async function reconcileCalendar(cycleId){
    const cycle=await transaction(q=>model.cycle(cycleId,q));
    if(!cycle || cycle.status!=='allocated' || cycle.edition_invalidated || !require('../lib/regionalSeasonOrchestrationPolicy').enabled({...cycle.participation_window_snapshot,status:'published'}))fail('Automatic calendar publication requires a captured allocated cycle.');
    const calendarId=stableId(['regional_calendar',cycle.region_slug,cycle.platform,Number(cycle.season_number),Number(cycle.reset_series || 0)]);
    const saved=await transaction(q=>model.published(calendarId,q));
    if(saved){
      if(saved.status!=='published')fail('The stored season calendar requires review.');
      if(JSON.stringify([...saved.edition_ids].sort())!==JSON.stringify(cycle.allocated_groups.map(g=>g.id).sort()))fail('The published calendar no longer matches this regional allocation.');
      return {...saved,already_published:true};
    }
    const start=cycle.participation_window_snapshot.league_start_monday;
    if(!start)return {status:'awaiting_date',cycle_id:cycleId};
    const body={cycle_id:cycleId,start_monday:start};
    const report=await runAction(body,null,true);
    if(report.already_published)return report;
    return runAction({...body,apply:true,expected_revision:report.revision,reason:'Automatic publication of the captured regional season calendar'},null,true);
  }
  return {action,reconcileCalendar,model,query};
}
module.exports={createService,busyEvents,...createService()};

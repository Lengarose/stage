'use strict';
const crypto=require('crypto');
const {withTransaction}=require('../db/database');
const {RegionalCupModel}=require('../models/regionalCupModel');
const {buildCatalogue}=require('../lib/regionalLeagueHierarchy');
const {identity,fail}=require('../lib/regionalEditionIdentity');
const plan=require('../lib/regionalCupPlan');
const {loadViolations}=require('../lib/regionalCalendarPlan');
const {busyEvents}=require('../lib/officialCalendarLoad');
const art=require('./gostOverviewService');
const registration=require('./regionalRegistrationService');
const hash=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const stableId=v=>{const h=hash(v);return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`;};
function createService({model=new RegionalCupModel(),transaction=withTransaction,assignment=art.assignment,assign=art.assign,confirmedField=registration.capturedField,clock=()=>new Date()}={}) {
  async function admin(actor,q) {const user=await model.actor(actor?.id,q);if(!user || user.role_id==null || ![0,2].includes(Number(user.role_id)))fail('Admin Cup access required',403);return user;}
  async function catalogue(actor) {return transaction(async q=>{await admin(actor,q);const rows=await model.records(q);return {definitions:rows.filter(r=>r.entity_type==='regional_cup'),editions:rows.filter(r=>r.entity_type==='regional_cup_edition'),calendars:rows.filter(r=>r.entity_type==='regional_calendar' && r.status==='published').map(c=>({id:c.id,edition_ids:c.edition_ids,start_monday:c.start_monday}))};});}
  async function trophy(id,body,actor) {return transaction(async q=>{const user=await admin(actor,q);await model.lock(q);return body?assign(id,body,user,fn=>fn(q),'regional_cup'):assignment(id,q,true,'regional_cup');});}
  async function action(body,actor) {
    return transaction(async q=>{
      const user=await admin(actor,q);await model.lock(q);
      if(!['configure','prepare'].includes(body.action))fail('Choose configure or prepare for the Regional Cup',400);
      if(['club_ids','fixtures','seed','name','winners'].some(k=>Object.hasOwn(body,k)))fail('Cup names, participants and draws follow the approved regional policy',400);
      const rows=await model.records(q),all=await model.editions(q),catalogue=buildCatalogue(all),blockers=[];
      let record,revision;
      if(body.action==='configure') {
        const root=catalogue.definitions.find(d=>d.id===body.permanent_league_id && Number(d.division)===1 && !d.retired && !d.retired_at);
        if(!root || catalogue.groups.some(g=>g.permanent_league_id===root.id && (g.identity_conflict || g.identity_unverified)))fail('Choose an active, unambiguous permanent Division 1 regional system');
        const scope=identity(root),name=plan.policy.names[scope.region_slug];if(!name)fail('This region has no approved Cup identity');
        const id=stableId(['regional_cup',scope.region_slug,scope.platform]),old=rows.find(r=>r.entity_type==='regional_cup' && r.id===id);
        if(old)return {record:old,already_applied:true,blockers:[],draft_only:true};
        record={id,name,region_slug:scope.region_slug,platform:scope.platform,status:'draft',policy_version:plan.policy.version};
        revision=hash([record,root]);
      } else {
        const definition=rows.find(r=>r.entity_type==='regional_cup' && r.id===body.cup_id),anchor=rows.find(r=>r.entity_type==='regional_calendar' && r.id===body.source_calendar_id && r.status==='published');
        if(!definition || !anchor)fail('Choose a configured Cup and a published source league calendar');
        const sources=(anchor.edition_ids || []).map(id=>all.find(e=>e.id===id));
        if(!sources.length || sources.some(s=>!s))fail('Source calendar editions are unavailable');
        const scope=identity(sources[0]);
        for(const source of sources) {
          const current=catalogue.groups.find(g=>g.current_edition_id===source.id),i=identity(source);
          if(!current || current.retired || current.identity_conflict || current.identity_unverified || source.edition_invalidated || !['registration','in_progress'].includes(source.status) || source.regional_participation_policy_version!=='regional_registration_v1' || i.region_slug!==definition.region_slug || i.platform!==definition.platform || i.season_number!==scope.season_number || Number(i.reset_series || 0)!==Number(scope.reset_series || 0))fail('Cup entry requires all current official groups of one regional season');
        }
        if(catalogue.groups.some(g=>g.region_slug===scope.region_slug && g.platform===scope.platform && Number(g.season_number)===scope.season_number && !g.retired && (Array.isArray(g.registered_club_ids)?g.registered_club_ids:JSON.parse(g.registered_club_ids || '[]')).length && !anchor.edition_ids.includes(g.current_edition_id)))fail('The source calendar omits a populated current group');
        const clubs=sources.flatMap(s=>typeof s.registered_club_ids==='string'?JSON.parse(s.registered_club_ids):s.registered_club_ids || []).sort();
        if(new Set(clubs).size!==clubs.length || sources.some(s=>(typeof s.registered_club_ids==='string'?JSON.parse(s.registered_club_ids):s.registered_club_ids || []).length!==20))fail('The confirmed Cup field must contain complete groups without duplicate clubs');
        const dates=plan.calendar(clubs.length,anchor.start_monday,scope.region_slug);
        const id=stableId(['regional_cup_edition',definition.id,scope.season_number,scope.reset_series || 0]),old=rows.find(r=>r.entity_type==='regional_cup_edition' && r.id===id);
        if(old){if(old.source_calendar_id!==anchor.id || JSON.stringify(old.participant_ids)!==JSON.stringify(clubs))fail('An existing Cup edition preserves its captured participants');return {record:old,already_applied:true,blockers:[],draft_only:old.status==='draft'};}
        const field=await confirmedField(scope.region_slug,scope.platform,scope.season_number,Number(scope.reset_series || 0),clubs,q);
        if(!field || field.window.cup_policy_version!==plan.policy.version)blockers.push('Regional Cup entry was not included in the accepted registration conditions; keep this edition unchanged and publish Cup entry for a future season');
        const trophy=await assignment(definition.id,q,true,'regional_cup');
        if(trophy.state!=='assigned' || !trophy.trophy?.image_url)blockers.push('Assign a valid catalogue trophy image to this Cup before preparing its edition');
        if(dates[0].instant<=clock().getTime()+5*60000)blockers.push('The first Cup round has passed or is too close; review the season instead of backdating entry');
        // Every entrant could play on each round date. Reserve all of their Cup
        // slots conservatively; this does not invent future opponents or Matches.
        const events=await model.events(clubs,q),busy=busyEvents(events),reservations=clubs.flatMap(club=>dates.map(d=>({id:`cup:${id}:${d.round}:${club}`,home_club_id:club,instant:d.instant,minutes:d.minutes})));
        const from=dates[0].instant-7*86400000,to=dates.at(-1).instant+7*86400000;
        blockers.push(...loadViolations([...busy.filter(e=>e.instant>=from && e.instant<=to),...reservations]));
        record={id,permanent_cup_id:definition.id,name:definition.name,region_slug:definition.region_slug,platform:definition.platform,season_number:scope.season_number,reset_series:Number(scope.reset_series || 0),status:'draft',policy_version:plan.policy.version,source_calendar_id:anchor.id,source_edition_ids:anchor.edition_ids,participant_ids:clubs,round_calendar:dates,trophy_snapshot:trophy.trophy,participation_window_snapshot:field?.window || null,rules:plan.rules,no_gost_ticket:true,play_enabled:false};
        revision=hash([record,sources,field,trophy.revision,events]);
      }
      const report={record,revision,blockers:[...new Set(blockers)],draft_only:true};
      if(body.apply!==true)return report;
      if(!String(body.reason || '').trim())fail('Explain this Cup preparation',400);
      if(body.expected_revision!==revision)fail('Cup sources changed; review a fresh preview');
      if(blockers.length)fail('Resolve Cup preparation blockers first',409,report.blockers);
      if(body.action==='prepare') {
        record.cup_reward_snapshot=require('../lib/regionalCupRewards').configuration(record);
        record.effective_prize_budget_stc=record.cup_reward_snapshot.budget;
        const seed=crypto.randomBytes(32).toString('hex');record={...record,draw_seed:seed,first_round:plan.drawRound(record.participant_ids,seed),prepared_at:clock().toISOString()};
      }
      await model.create(body.action==='configure'?'regional_cup':'regional_cup_edition',record,user,body.reason,q);
      return {record,applied:true,draft_only:true,blockers:[]};
    });
  }
  return {catalogue,trophy,action};
}
module.exports={createService,...createService()};

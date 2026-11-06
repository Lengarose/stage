'use strict';
const {withTransaction}=require('../db/database');
const {RegionalOperationsModel}=require('../models/regionalOperationsModel');
const {phase}=require('../lib/regionalRegistrationPolicy');
const {assessField}=require('../lib/regionalFieldAssessment');
const {isConfirmedResult}=require('../lib/tournamentStatistics');
const {winner,resultRevision}=require('./regionalCupLifecycleService');
const closed=new Set(['reset','superseded','cancelled','abandoned','retired','archived']);
function report(rows,fixtures,now=new Date()) {
  const issues=[],records=[],counts={windows:0,cycles:0,cups:0,review:0,action:0};
  let registrationSourcesComplete=true;
  const add=(r,code,severity,message,target,details={})=>issues.push({key:`${r.entity_type}:${r.id}:${code}`,source_id:r.id,source_type:r.entity_type,name:r.name || r.region_slug || r.id,region_slug:r.region_slug || null,season_number:r.season_number || null,code,severity,message,target,...details});
  for(const row of rows) {
    try {
      const data=typeof row.data_json==='string'?JSON.parse(row.data_json):row.data_json;
      if(!data || typeof data!=='object' || Array.isArray(data))throw Error('Invalid record');
      records.push({...data,id:row.id,entity_type:row.entity_type,status:row.status ?? data.status});
    }catch {if(row.entity_type==='season_registration')registrationSourcesComplete=false;add(row,'unreadable_source','review','Source data cannot be read. Review the stored edition.','sources');}
  }
  const active=records.filter(r=>!r.edition_invalidated && !r.invalidated_at && !closed.has(r.status));
  const resultSources=new Map();
  for(const match of fixtures) {
    if(!match.id || !(match.status==='disputed' || ['ADMIN_REVIEW','DISPUTED'].includes(match.result_state)))continue;
    const source=active.find(r=>r.id===match.competition_instance_id && (
      r.entity_type==='regional_league' && ['in_progress','active'].includes(r.status) ||
      r.entity_type==='regional_cycle' && ['running','review','ready'].includes(r.status) ||
      r.entity_type==='regional_cup_edition' && r.status==='running' && r.play_enabled));
    if(!source)continue;
    const parent=source.permanent_league_id?records.find(r=>r.entity_type==='regional_league' && r.id===source.permanent_league_id):null;
    if(source.retired || source.retired_at || parent && (parent.retired || parent.retired_at || closed.has(parent.status) || Number(parent.active_reset_series || parent.reset_series || 0)>Number(source.reset_series || 0)))continue;
    if(!resultSources.has(match.id))resultSources.set(match.id,new Map());
    resultSources.get(match.id).set(source.id,source);
  }
  for(const [matchId,sources] of resultSources) {
    if(sources.size!==1) {
      for(const source of sources.values())add(source,`result_mapping:${matchId}`,'review','A result-review match maps to multiple active regional sources. Review fixture identity before deciding a result.','sources');
    }else {
      const source=[...sources.values()][0];
      add(source,`result_review:${matchId}`,'review','A stored result is disputed or awaiting Admin review. Open the match evidence and use the existing dispute controls; this overview does not approve scores or award a winner.','results',{match_id:matchId});
    }
  }
  for(const r of active) {
    if(r.entity_type==='regional_cycle_progress' && r.status==='review_required') {
      const source=active.find(s=>s.entity_type==='regional_cycle' && s.id===r.source_id);
      if(source && ['running','review','ready'].includes(source.status))add({...source,entity_type:r.entity_type},'cycle_recovery_review','review','Automatic regional cycle progression requires review. Check the captured field, official results and sporting decisions.','cycles');
    }
    if(r.entity_type==='regional_cup_progress' && r.status==='review_required') {
      const source=active.find(s=>s.entity_type==='regional_cup_edition' && s.id===r.source_id);
      if(source && source.status==='running')add({...source,entity_type:r.entity_type},'cup_recovery_review','review','Automatic Cup progression requires review. Check the recorded results and calendar; recovery never changes opponents or kickoff windows.','cups');
    }
    if(r.entity_type==='regional_registration_window' && r.status==='published') {
      const root=records.find(s=>s.id===r.permanent_league_id),current=records.find(s=>s.id===root?.current_edition_id) || root;
      if(!root) {add(r,'window_source','review','The permanent league for this registration window is missing. Review the source identity.','registration');continue;}
      if(root.retired || root.retired_at || current.edition_invalidated || Number(current.reset_series || 0)!==Number(r.reset_series || 0))continue;
      counts.windows++;
      const times=[r.opens_at,r.registration_closes_at,r.confirmation_closes_at].map(Date.parse);
      if(times.some(t=>!Number.isFinite(t)) || !(times[0]<times[1] && times[1]<times[2])) {add(r,'invalid_deadline','review','Registration or confirmation dates require review.','registration');continue;}
      const state=phase(r,now),apps=active.filter(a=>a.entity_type==='season_registration' && a.registration_window_id===r.id);
      const confirmed=apps.filter(a=>a.participation_status==='confirmed' && a.status==='approved');
      if(active.some(s=>s.entity_type==='regional_league' && s.region_slug===r.region_slug && s.platform===r.platform && Number(s.season_number)===Number(r.season_number) && Number(s.reset_series || 0)===Number(r.reset_series || 0) && !['draft','registration'].includes(s.status)))continue;
      if(state==='confirmation') {
        const notices=r.confirmation_notice_policy_version==='regional_confirmation_notice_v1'?{
          stored:apps.filter(a=>a.confirmation_notice?.version==='regional_confirmation_notice_v1' && a.confirmation_notice.status==='stored').length,
          muted:apps.filter(a=>a.confirmation_notice?.version==='regional_confirmation_notice_v1' && a.confirmation_notice.status==='muted').length,
          pending:apps.filter(a=>a.status==='pending' && a.participation_status==='registered' && !(a.confirmation_notice?.version==='regional_confirmation_notice_v1' && ['stored','muted'].includes(a.confirmation_notice.status))).length,
        }:null;
        add(r,'confirmation_open','action',`Confirmation week is open: ${confirmed.length} of ${apps.length} registrations confirmed. No deadline extensions are granted here.`,'registration',notices?{confirmation_notices:notices}:{});
        if(notices) {
          const failed=apps.filter(a=>a.status==='pending' && a.participation_status==='registered' && !(a.confirmation_notice?.version==='regional_confirmation_notice_v1' && ['stored','muted'].includes(a.confirmation_notice.status)) && active.some(j=>j.entity_type==='regional_confirmation_notice_progress' && j.source_id===a.id && j.status==='review_required'));
          if(failed.length)add(r,'confirmation_notice_review','review',`${failed.length} confirmation notice(s) require review. Check the pending applications and president contacts. Automatic retries do not extend the confirmation deadline.`,'registration');
        }
      }
      if(state==='closed' && !active.some(c=>c.entity_type==='regional_cycle' && c.participation_window_snapshot?.id===r.id)) {
        if(r.policy_version) {
          const assessment=assessField(r,apps,now,{sourceComplete:registrationSourcesComplete});
          const supported=assessment.status==='structure_supported';
          add(r,'field_review',supported?'action':'review',supported
            ? `Confirmation has closed: ${assessment.confirmed_clubs} confirmed clubs fit an approved capacity. Review sporting rights, placement and the calendar before starting.`
            : `Confirmation has closed: ${assessment.confirmed_clubs} confirmed clubs. Resolve the field blockers before preparing a sporting cycle; no clubs have been dropped.`,'cycles',{field_assessment:assessment});
        }else add(r,'field_review','action',`Confirmation has closed: ${confirmed.length} confirmed registrations. Review the field and regional cycle; this view does not automatically remove unconfirmed clubs.`,'cycles');
      }
    }
    if(r.entity_type==='regional_cycle') {
      counts.cycles++;
      if(r.status==='allocated') {
        const ids=r.allocated_groups?.map(g=>g.id) || [];
        if(ids.length && !ids.every(id=>active.some(c=>c.entity_type==='regional_calendar' && c.status==='published' && c.edition_ids?.includes(id))))add(r,'league_calendar','action','Group allocation is saved. Review and publish the missing league calendar.','calendar');
      }else {
        for(const message of r.plan?.blockers || [])add(r,`blocker:${message}`,'review',String(message),'cycles');
        const matches=fixtures.filter(f=>f.competition_instance_id===r.id);
        if(Object.keys(r.fixture_refs || {}).length>matches.length || matches.some(f=>!f.id || !f.scheduled_date && !f.confirmed_date))add(r,'pathway_schedule','action','Placement or promotion matches are missing an official Match or schedule.','cycles');
        if(r.status==='ready' && r.plan?.ready===true) {
          if(r.automatic_allocation_policy_version && r.automatic_allocation_policy_version!==require('../lib/regionalAutoAllocationPolicy').VERSION)add(r,'cycle_allocation_policy','review','The captured automatic allocation policy is unsupported. Review the cycle instead of inferring new sporting rights.','cycles');
          else add(r,'cycle_allocation','action',r.automatic_allocation_policy_version?'Sporting rights are ready. Automatic draft-group allocation is pending; check recovery review items if it remains blocked.':'Sporting rights are ready. Review and apply the final group allocation through the existing controlled action.','cycles');
        }
        else if(matches.length && matches.every(isConfirmedResult))add(r,'cycle_progress','action','All stored cycle matches are final. Reconcile sporting progress and review group allocation.','cycles');
      }
    }
    if(r.entity_type==='regional_cup_edition') {
      counts.cups++;
      if(!r.cup_reward_snapshot)add(r,'reward_promise','review','This Cup edition has no captured reward terms. Explicit review is required.','cups');
      if(r.status==='draft') {add(r,'cup_activation','action','The Cup draft awaits participant/calendar review and explicit activation.','cups');continue;}
      if(!r.play_enabled) {add(r,'cup_disabled','review','The Cup status and play activation disagree.','cups');continue;}
      const matches=fixtures.filter(f=>f.competition_instance_id===r.id),round=r.rounds?.at(-1);
      if(!round || !Array.isArray(round.fixture_ids) || !round.fixture_ids.length) {add(r,'cup_mapping','review','The current Cup draw is missing.','cups');continue;}
      let changed=false;
      for(const played of r.rounds) {
        if(!Array.isArray(played.fixture_ids)) {changed=true;break;}
        const source=played.fixture_ids.map(id=>matches.find(m=>m.fixture_id===id));
        if(source.some(m=>!m?.id) || played.results_revision && resultRevision(source)!==played.results_revision) {changed=true;break;}
      }
      if(changed) {add(r,'cup_source_changed','review','A published Match is missing or a processed result has changed.','cups');continue;}
      if(r.status==='completed') {
        if(r.prize_settlement_state!=='paid' || r.honours_state!=='awarded')add(r,'cup_settlement','review','The Cup is completed; payment and/or trophy processing is not final. Review the reward evidence.','cups');
      } else {
        const current=round.fixture_ids.map(id=>matches.find(m=>m.fixture_id===id));
        try {if(current.every(m=>winner(m)))add(r,'cup_progress','action','All current-round results are confirmed. Review why the next round has not been processed.','cups');}
        catch {add(r,'cup_result_conflict','review','The score, penalty decision and Cup winner disagree.','cups');}
        const slot=r.round_calendar?.find(s=>s.round===round.number);
        if(!slot || !Number.isFinite(slot.instant) || !Number.isFinite(slot.minutes) || slot.minutes<=0)add(r,'cup_calendar','review','The recorded round window is missing or invalid.','cups');
        else if(slot.instant+slot.minutes*60000<now.getTime() && current.some(m=>!isConfirmedResult(m)))add(r,'cup_results_due','review','The round window has passed and final results are missing. This overview does not award forfeits or automatic results.','cups');
      }
    }
    if(r.entity_type==='competition_settlement' && ['regional_league','regional_cup_edition'].includes(r.source_type) && ['failed','blocked','partially_paid'].includes(r.status)) {
      const source=records.find(s=>s.id===r.source_id);
      if(source && (source.edition_invalidated || closed.has(source.status)))continue;
      add(r,'settlement_review','review','Reward processing is blocked, failed or partially paid. Review existing ledger evidence before recovery.',r.source_type==='regional_cup_edition'?'cups':'rewards');
    }
  }
  issues.sort((a,b)=>Number(b.severity==='review')-Number(a.severity==='review') || a.key.localeCompare(b.key));
  counts.review=issues.filter(i=>i.severity==='review').length;counts.action=issues.filter(i=>i.severity==='action').length;
  return {as_of:now.toISOString(),read_only:true,counts,issues};
}
function createService({model=new RegionalOperationsModel(),transaction=withTransaction,clock=()=>new Date()}={}) {
  async function overview(actor) {
    return transaction(async q=>{
      const user=actor?.id?await model.actor(actor.id,q):null;
      if(!user || user.role_id==null || ![0,2].includes(Number(user.role_id)))throw Object.assign(Error('Admin regional operations access required'),{status:403});
      return report(await model.records(q),await model.fixtures(q),clock());
    });
  }
  return {overview};
}
module.exports={report,createService,...createService()};

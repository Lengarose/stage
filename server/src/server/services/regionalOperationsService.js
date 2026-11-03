'use strict';
const {withTransaction}=require('../db/database');
const {RegionalOperationsModel}=require('../models/regionalOperationsModel');
const {phase}=require('../lib/regionalRegistrationPolicy');
const {isConfirmedResult}=require('../lib/tournamentStatistics');
const {winner,resultRevision}=require('./regionalCupLifecycleService');
const closed=new Set(['reset','superseded','cancelled','abandoned','retired','archived']);
function report(rows,fixtures,now=new Date()) {
  const issues=[],records=[],counts={windows:0,cycles:0,cups:0,review:0,action:0};
  const add=(r,code,severity,message,target)=>issues.push({key:`${r.entity_type}:${r.id}:${code}`,source_id:r.id,source_type:r.entity_type,name:r.name || r.region_slug || r.id,region_slug:r.region_slug || null,season_number:r.season_number || null,code,severity,message,target});
  for(const row of rows) {
    try {
      const data=typeof row.data_json==='string'?JSON.parse(row.data_json):row.data_json;
      if(!data || typeof data!=='object' || Array.isArray(data))throw Error('Invalid record');
      records.push({...data,id:row.id,entity_type:row.entity_type,status:row.status ?? data.status});
    }catch {add(row,'unreadable_source','review','Brongegevens kunnen niet worden gelezen. Controleer de opgeslagen editie.','sources');}
  }
  const active=records.filter(r=>!r.edition_invalidated && !r.invalidated_at && !closed.has(r.status));
  for(const r of active) {
    if(r.entity_type==='regional_registration_window' && r.status==='published') {
      const root=records.find(s=>s.id===r.permanent_league_id),current=records.find(s=>s.id===root?.current_edition_id) || root;
      if(!root) {add(r,'window_source','review','De vaste league van deze inschrijfperiode ontbreekt. Controleer de bronidentiteit.','registration');continue;}
      if(root.retired || root.retired_at || current.edition_invalidated || Number(current.reset_series || 0)!==Number(r.reset_series || 0))continue;
      counts.windows++;
      const times=[r.opens_at,r.registration_closes_at,r.confirmation_closes_at].map(Date.parse);
      if(times.some(t=>!Number.isFinite(t)) || !(times[0]<times[1] && times[1]<times[2])) {add(r,'invalid_deadline','review','Inschrijf- of bevestigingsdatums vereisen controle.','registration');continue;}
      const state=phase(r,now),apps=active.filter(a=>a.entity_type==='season_registration' && a.registration_window_id===r.id);
      const confirmed=apps.filter(a=>a.participation_status==='confirmed' && a.status==='approved');
      if(active.some(s=>s.entity_type==='regional_league' && s.region_slug===r.region_slug && s.platform===r.platform && Number(s.season_number)===Number(r.season_number) && Number(s.reset_series || 0)===Number(r.reset_series || 0) && !['draft','registration'].includes(s.status)))continue;
      if(state==='confirmation')add(r,'confirmation_open','action',`Bevestigingsweek loopt: ${confirmed.length} van ${apps.length} inschrijvingen bevestigd. Er worden geen extra termijnen toegekend.`,'registration');
      if(state==='closed' && !active.some(c=>c.entity_type==='regional_cycle' && c.participation_window_snapshot?.id===r.id))add(r,'field_review','action',`Bevestiging gesloten: ${confirmed.length} bevestigde inschrijvingen. Controleer het veld en de regionale cyclus; onbevestigde clubs worden hier niet automatisch verwijderd.`,'cycles');
    }
    if(r.entity_type==='regional_cycle') {
      counts.cycles++;
      if(r.status==='allocated') {
        const ids=r.allocated_groups?.map(g=>g.id) || [];
        if(ids.length && !ids.every(id=>active.some(c=>c.entity_type==='regional_calendar' && c.status==='published' && c.edition_ids?.includes(id))))add(r,'league_calendar','action','Groepsindeling is opgeslagen. Controleer en publiceer de ontbrekende leaguekalender.','calendar');
      }else {
        for(const message of r.plan?.blockers || [])add(r,`blocker:${message}`,'review',String(message),'cycles');
        const matches=fixtures.filter(f=>f.competition_instance_id===r.id);
        if(Object.keys(r.fixture_refs || {}).length>matches.length || matches.some(f=>!f.id || !f.scheduled_date && !f.confirmed_date))add(r,'pathway_schedule','action','Plaatsings- of promotieduels missen een officiële Match of planning.','cycles');
        if(matches.length && matches.every(isConfirmedResult))add(r,'cycle_progress','action','Alle opgeslagen cyclusduels zijn definitief. Herlees de sportieve voortgang en controleer de groepsindeling.','cycles');
      }
    }
    if(r.entity_type==='regional_cup_edition') {
      counts.cups++;
      if(!r.cup_reward_snapshot)add(r,'reward_promise','review','Deze bekereditie heeft nog geen vastgelegde prijsafspraken. Expliciete controle is vereist.','cups');
      if(r.status==='draft') {add(r,'cup_activation','action','Bekerontwerp wacht op deelnemers-/kalendercontrole en expliciete activering.','cups');continue;}
      if(!r.play_enabled) {add(r,'cup_disabled','review','De bekerstatus en speelactivatie spreken elkaar tegen.','cups');continue;}
      const matches=fixtures.filter(f=>f.competition_instance_id===r.id),round=r.rounds?.at(-1);
      if(!round || !Array.isArray(round.fixture_ids) || !round.fixture_ids.length) {add(r,'cup_mapping','review','De actuele bekerloting ontbreekt.','cups');continue;}
      let changed=false;
      for(const played of r.rounds) {
        if(!Array.isArray(played.fixture_ids)) {changed=true;break;}
        const source=played.fixture_ids.map(id=>matches.find(m=>m.fixture_id===id));
        if(source.some(m=>!m?.id) || played.results_revision && resultRevision(source)!==played.results_revision) {changed=true;break;}
      }
      if(changed) {add(r,'cup_source_changed','review','Een gepubliceerde Match ontbreekt of een verwerkte uitslag is gewijzigd.','cups');continue;}
      if(r.status==='completed') {
        if(r.prize_settlement_state!=='paid' || r.honours_state!=='awarded')add(r,'cup_settlement','review','Beker afgerond; betalings- en/of trofeeverwerking is nog niet definitief. Controleer het beloningsbewijs.','cups');
      } else {
        const current=round.fixture_ids.map(id=>matches.find(m=>m.fixture_id===id));
        try {if(current.every(m=>winner(m)))add(r,'cup_progress','action','Alle uitslagen van de huidige ronde zijn bevestigd. Controleer waarom de volgende ronde nog niet verwerkt is.','cups');}
        catch {add(r,'cup_result_conflict','review','Score, penaltybeslissing en bekerwinnaar spreken elkaar tegen.','cups');}
        const slot=r.round_calendar?.find(s=>s.round===round.number);
        if(!slot || !Number.isFinite(slot.instant) || !Number.isFinite(slot.minutes) || slot.minutes<=0)add(r,'cup_calendar','review','Het opgeslagen rondevenster ontbreekt of is ongeldig.','cups');
        else if(slot.instant+slot.minutes*60000<now.getTime() && current.some(m=>!isConfirmedResult(m)))add(r,'cup_results_due','review','Het rondevenster is voorbij en er ontbreken definitieve uitslagen. Dit overzicht kent geen forfait of automatische uitslag toe.','cups');
      }
    }
    if(r.entity_type==='competition_settlement' && ['regional_league','regional_cup_edition'].includes(r.source_type) && ['failed','blocked','partially_paid'].includes(r.status)) {
      const source=records.find(s=>s.id===r.source_id);
      if(source && (source.edition_invalidated || closed.has(source.status)))continue;
      add(r,'settlement_review','review','Een beloningsverwerking is geblokkeerd, mislukt of gedeeltelijk betaald. Controleer bestaande ledgerbewijzen vóór herstel.',r.source_type==='regional_cup_edition'?'cups':'rewards');
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

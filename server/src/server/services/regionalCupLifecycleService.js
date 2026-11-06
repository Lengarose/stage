'use strict';
const crypto=require('crypto');
const {EXECUTESQL,withTransaction}=require('../db/database');
const {RegionalCupModel}=require('../models/regionalCupModel');
const {fail}=require('../lib/regionalEditionIdentity');
const {busyEvents}=require('../lib/officialCalendarLoad');
const {loadViolations}=require('../lib/regionalCalendarPlan');
const cup=require('../lib/regionalCupPlan');
const {isConfirmedResult}=require('../lib/tournamentStatistics');
const registration=require('./regionalRegistrationService');
const hash=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const stableId=v=>{const h=hash(v);return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`;};
function winner(match) {
  if(!isConfirmedResult(match) || String(match.result_state || '').toLowerCase()==='auto_confirmed_timeout')return null;
  if([match.home_score,match.away_score].some(v=>v==null || String(v).trim()==='' || !Number.isSafeInteger(Number(v)) || Number(v)<0))return null;
  const h=Number(match.home_score),a=Number(match.away_score);
  let id;
  if(h===a) {
    if(Number(match.decided_on_penalties)!==1 || !['home','away'].includes(match.penalty_winner_side))return null;
    id=match.penalty_winner_side==='home'?match.home_club_id:match.away_club_id;
  } else {if(Number(match.decided_on_penalties)===1)fail('Cup score and penalty evidence disagree');id=h>a?match.home_club_id:match.away_club_id;}
  if(match.winner_club_id && match.winner_club_id!==id)fail('The recorded Cup winner disagrees with the confirmed score');
  return id;
}
function resultRevision(matches) {return hash(matches.map(m=>({id:m.id,home:m.home_club_id,away:m.away_club_id,status:m.status,state:m.result_state,home_score:m.home_score,away_score:m.away_score,penalties:m.decided_on_penalties,side:m.penalty_winner_side})).sort((a,b)=>a.id.localeCompare(b.id)));}
function createService({model=new RegionalCupModel(),transaction=withTransaction,query=EXECUTESQL,confirmedField=registration.capturedField,clock=()=>new Date(),seed=()=>crypto.randomBytes(32).toString('hex')}={}) {
  async function evaluate(edition,q,activation=false) {
    if(edition.policy_version!==cup.policy.version || edition.edition_invalidated || !edition.participant_ids?.length || new Set(edition.participant_ids).size!==edition.participant_ids.length || edition.participation_window_snapshot?.policy_version!=='regional_registration_v1' || edition.participation_window_snapshot?.cup_policy_version!==cup.policy.version)fail('Cup policy, participants or accepted conditions require review');
    const records=await model.records(q),source=await model.editions(q),anchor=records.find(r=>r.id===edition.source_calendar_id && r.entity_type==='regional_calendar' && r.status==='published');
    if(!anchor || hash(anchor.edition_ids?.slice().sort())!==hash(edition.source_edition_ids?.slice().sort()))fail('Cup source calendar identity is unavailable');
    const roots=edition.source_edition_ids.map(id=>source.find(r=>r.id===id));
    if(roots.some(r=>!r || r.edition_invalidated || ['reset','cancelled','abandoned','superseded'].includes(r.status)))fail('Cup source edition was invalidated; review the Cup before continuing');
    const roster=roots.flatMap(r=>typeof r.registered_club_ids==='string'?JSON.parse(r.registered_club_ids):r.registered_club_ids || []).sort();
    if(hash(roster)!==hash(edition.participant_ids.slice().sort()))fail('Cup source participants changed after preparation');
    const dates=cup.calendar(edition.participant_ids.length,anchor.start_monday,edition.region_slug);
    if(hash(dates)!==hash(edition.round_calendar))fail('The captured Cup round calendar changed; review the edition');
    const expected=cup.drawRound(edition.participant_ids,edition.draw_seed);
    if(hash(expected)!==hash(edition.first_round))fail('The saved first Cup draw is inconsistent');
    const clubs=await model.clubs(edition.participant_ids,q);if(clubs.length!==edition.participant_ids.length)fail('A captured Cup club is unavailable; review withdrawals');
    if(activation) {
      const field=await confirmedField(edition.region_slug,edition.platform,edition.season_number,edition.reset_series,edition.participant_ids,q);
      if(!field || hash(field.window)!==hash(edition.participation_window_snapshot))fail('Accepted Cup participation conditions changed');
    }
    const fixtures=await model.fixtures(edition.id,q),matches=await model.matches(edition.id,q);
    const rounds=edition.rounds || [],used=new Set();
    for(const [index,round] of rounds.entries()) {
      if(round.number!==index+1 || (index===0 && (round.seed!==edition.draw_seed || hash(round.participant_ids)!==hash(edition.participant_ids) || hash(round.draw)!==hash(edition.first_round))))fail('The Cup round sequence no longer follows the captured first draw');
      const drawn=cup.drawRound(round.participant_ids,round.seed);
      if(hash(drawn)!==hash(round.draw))fail('A saved Cup round no longer matches its recorded open draw');
      const linked=round.fixture_ids.map((id,index)=>{
        const f=fixtures.find(f=>f.id===id),m=matches.filter(m=>m.source_fixture_id===id || m.id===f?.match_id),pair=round.draw.fixtures[index];
        if(!f || !pair || m.length!==1 || m[0].id!==f.match_id || f.competition_instance_id!==edition.id || f.legacy_fixture_type!=='regional_cup' || f.legacy_fixture_id!==f.id || m[0].source_fixture_type!=='competition_engine' || m[0].competition_context!==edition.id || m[0].source_fixture_id!==f.id || !Number(m[0].allow_penalties))fail('Cup GameDay mapping is missing or ambiguous');
        if(f.home_club_id!==pair.home_club_id || f.away_club_id!==pair.away_club_id || m[0].home_club_id!==pair.home_club_id || m[0].away_club_id!==pair.away_club_id)fail('Cup opponents disagree with the stored draw');
        used.add(f.id);return m[0];
      });
      if(round.fixture_ids.length!==drawn.fixtures.length)fail('Cup round fixture count is incomplete');
      if(round.results_revision && (round.results_revision!==resultRevision(linked) || linked.some(m=>!winner(m)) || hash(round.advancers)!==hash([...round.draw.byes,...linked.map(winner)])))fail('An already consumed Cup result changed; authorised review is required');
      if(round.number>1) {
        const previous=rounds.find(r=>r.number===round.number-1);
        if(!previous?.advancers || hash(previous.advancers.slice().sort())!==hash(round.participant_ids.slice().sort()))fail('A downstream Cup draw no longer follows the recorded winners');
      }
    }
    if(fixtures.some(f=>!used.has(f.id)) || matches.length!==fixtures.length)fail('Cup has unexpected or missing engine/Match records');
    return {roots,clubs,fixtures,matches,dates};
  }
  async function schedule(edition,number,draw,evidence,q) {
    const slot=evidence.dates[number-1];if(!slot)fail('The next Cup round has no captured calendar slot');
    const entries=draw.fixtures.map((pair,i)=>({...pair,id:stableId(['regional_cup_fixture',edition.id,number,i]),instant:slot.instant,minutes:slot.minutes,scheduled_date:slot.scheduled_date,timezone:slot.timezone}));
    const blockers=[];if(slot.instant<=clock().getTime()+5*60000)blockers.push('The Cup round kickoff is too close or has passed; calendar review is required');
    const clubs=[...new Set(entries.flatMap(e=>[e.home_club_id,e.away_club_id]))],events=clubs.length?await model.events(clubs,q):{matches:[],engines:[],fixtures:[]};
    const busy=busyEvents(events).filter(e=>Math.abs(e.instant-slot.instant)<8*86400000);
    blockers.push(...loadViolations([...busy,...entries]));
    return {entries,blockers,events};
  }
  async function materialize(edition,round,evidence,user,reason,q) {
    const planned=await schedule(edition,round.number,round.draw,evidence,q);if(planned.blockers.length)fail('Cup calendar needs review before publishing the round',409,planned.blockers);
    round.fixture_ids=[];
    for(const entry of planned.entries) {
      const home=evidence.clubs.find(c=>c.id===entry.home_club_id),away=evidence.clubs.find(c=>c.id===entry.away_club_id),matchId=stableId([entry.id,'match']);
      const match={id:matchId,mode:'club',type:'knockout',home_club_id:home.id,away_club_id:away.id,home_club_name:home.name,away_club_name:away.name,home_owner_email:home.owner_email,away_owner_email:away.owner_email,round:round.number,status:'scheduled',scheduling_status:'confirmed',scheduled_date:entry.scheduled_date,confirmed_date:entry.scheduled_date,timezone:entry.timezone,source_fixture_type:'competition_engine',source_fixture_id:entry.id,competition_context:edition.id,allow_penalties:1,stats_processed:0};
      const fixture={id:entry.id,competition_instance_id:edition.id,legacy_fixture_type:'regional_cup',legacy_fixture_id:entry.id,match_id:matchId,participant_type:'club',format:'knockout',phase:'knockout_final',round:round.number,leg:1,home_participant_id:stableId([edition.id,home.id]),away_participant_id:stableId([edition.id,away.id]),home_club_id:home.id,away_club_id:away.id,home_club_name:home.name,away_club_name:away.name,status:'scheduled',scheduling_status:'confirmed',scheduled_at:entry.scheduled_date,confirmed_at:entry.scheduled_date,idempotency_key:`cup:${edition.id}:${round.number}:${entry.id}`};
      await model.createMatch(match,q);await model.insert('competition_fixtures',fixture,q);
      const audit=await model.audit({engine:fixture,calendar:true},user || {id:null,email:null},{engine:null,match:null},{engine:fixture,match},reason,q);await model.notify(match,audit.id,q);round.fixture_ids.push(entry.id);
    }
  }
  async function operate(id,body,actor,automatic=false) {
    return transaction(async q=>{
      const user=actor?.id?await model.actor(actor.id,q):null;
      if(actor && (!user || user.role_id==null || ![0,2].includes(Number(user.role_id))))fail('Admin Cup lifecycle access required',403);
      if(automatic && !['advance','activate'].includes(body.action))fail('Unsupported automatic Cup lifecycle action',403);
      await model.lock(q);const edition=await model.edition(id,q);if(!edition)fail('Cup edition not found',404);
      if(automatic && body.action==='activate' && !require('../lib/regionalSeasonOrchestrationPolicy').enabled({...edition.participation_window_snapshot,status:'published'}))fail('This Cup has no captured automatic season policy.');
      if(!['activate','advance'].includes(body.action))fail('Choose activate or advance',400);
      if(['seed','winners','clubs','date'].some(k=>Object.hasOwn(body,k)))fail('Cup dates, winners and draws are assigned from captured policy and results',400);
      if(body.action==='activate' && edition.play_enabled && ['running','completed'].includes(edition.status))return {already_applied:true,status:edition.status,edition_id:edition.id};
      if(body.action==='activate' && edition.status!=='draft' || body.action==='advance' && (!edition.play_enabled || !['running','completed'].includes(edition.status)))fail('This Cup edition is not in a playable lifecycle state');
      const evidence=await evaluate(edition,q,body.action==='activate'),before=structuredClone(edition),blockers=[];
      let draw,number,consumed=null,champion=null;
      if(body.action==='activate') {if(evidence.fixtures.length || evidence.matches.length || edition.rounds?.length)fail('An unused Cup draft is required for activation');draw=edition.first_round;number=1;}
      else {
        if(edition.status==='completed')return {already_applied:true,status:'completed',edition_id:edition.id,winner_club_id:edition.winner_club_id};
        const last=edition.rounds?.at(-1);if(!last)fail('Cup has no recorded current round');
        const rows=last.fixture_ids.map(id=>evidence.matches.find(m=>m.source_fixture_id===id));
        const winners=rows.map(winner);if(winners.some(id=>!id))return {edition_id:edition.id,status:'waiting_results',pending_matches:rows.filter(m=>!winner(m)).map(m=>m.id),blockers:['Every current round result needs a confirmed sporting winner']};
        const advancers=[...last.draw.byes,...winners];if(new Set(advancers).size!==advancers.length || advancers.length!==last.draw.next_field_count)fail('Cup advancement contains duplicate or missing clubs');
        consumed={round:last,advancers,revision:resultRevision(rows)};
        if(advancers.length===1)champion=advancers[0];else {draw=cup.drawRound(advancers,'preview-only-open-draw-seed');number=last.number+1;}
      }
      // Reserve the next slot for every possible advancing club before drawing.
      // This avoids silently redrawing in response to an inconvenient pairing.
      let planned=null;
      if(!champion) {
        planned=await schedule(edition,number,draw,evidence,q);blockers.push(...planned.blockers);
      }
      const revision=hash([edition,evidence,planned,consumed?.advancers,champion]);
      const report={edition_id:edition.id,status:edition.status,next_round:number || null,next_kickoff:number?evidence.dates[number-1]?.scheduled_date:null,blockers,revision,champion_pending:champion};
      if(body.action==='activate' && require('../lib/regionalSeasonOrchestrationPolicy').enabled({...edition.participation_window_snapshot,status:'published'}) && evidence.dates[0].instant-clock().getTime()<48*3600000)blockers.push('Publish the definitive Cup calendar at least 48 hours before the first kickoff.');
      if(body.apply!==true)return report;
      const reason=automatic?(body.action==='activate'?'Automatic activation of the captured Regional Cup':'Confirmed Regional Cup result reconciliation'):String(body.reason || '').trim();if(!reason)fail('Explain this Cup lifecycle action',400);
      if(!automatic && revision!==body.expected_revision)fail('Cup lifecycle sources changed; review again');
      if(blockers.length)fail('Resolve Cup lifecycle blockers before continuing',409,blockers);
      if(consumed) {consumed.round.results_revision=consumed.revision;consumed.round.advancers=consumed.advancers;}
      if(champion) {edition.status='completed';edition.winner_club_id=champion;edition.winner_club_name=evidence.clubs.find(c=>c.id===champion)?.name;edition.completed_at=clock().toISOString();edition.honours_state='pending_review';await model.complete(edition.id,q);}
      else {
        if(body.action==='activate') {
          await model.insert('competition_instances',{id:edition.id,product_type:'regional_cup',legacy_source_type:'regional_cup_edition',legacy_source_id:edition.id,name:edition.name,region:edition.region_slug,platform:edition.platform,status:'in_progress',created_by_user_id:user?.id || null},q);
          for(const club of evidence.clubs)await model.insert('competition_participants',{id:stableId([edition.id,club.id]),competition_instance_id:edition.id,participant_type:'club',club_id:club.id,status:'approved'},q);
        }
        const participants=consumed?.advancers || edition.participant_ids,roundSeed=number===1?edition.draw_seed:seed(),actualDraw=cup.drawRound(participants,roundSeed),round={number,seed:roundSeed,participant_ids:participants,draw:actualDraw};
        await materialize(edition,round,evidence,user,reason,q);edition.rounds=[...(edition.rounds || []),round];edition.status='running';edition.play_enabled=true;
      }
      await model.saveEdition(before,edition,user,reason,q);
      return {edition_id:edition.id,status:edition.status,current_round:edition.rounds?.at(-1)?.number,winner_club_id:edition.winner_club_id || null,applied:true};
    });
  }
  async function assertWritableFixture(fixture,q=query) {
    if(fixture?.legacy_fixture_type!=='regional_cup')return;
    const edition=await model.edition(fixture.competition_instance_id,q);
    if(!edition || edition.edition_invalidated || !edition.play_enabled || !['running','completed'].includes(edition.status))fail('This Cup edition is closed or unavailable');
  }
  async function action(id,body,actor) {if(!actor?.id)fail('Authentication required',401);return operate(id,body,actor,false);}
  async function reconcile(id) {return operate(id,{action:'advance',apply:true},null,true);}
  async function reconcileActivation(id){return operate(id,{action:'activate',apply:true},null,true);}
  return {action,reconcile,reconcileActivation,assertWritableFixture,evaluate};
}
module.exports={createService,winner,resultRevision,...createService()};

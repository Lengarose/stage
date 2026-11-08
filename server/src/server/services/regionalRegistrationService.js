'use strict';
const crypto=require('node:crypto');
const {v4:uuid}=require('uuid');
const {EXECUTESQL,withTransaction}=require('../db/database');
const {RegionalRegistrationModel}=require('../models/regionalRegistrationModel');
const {identity,unpack,fail}=require('../lib/regionalEditionIdentity');
const {permanentId}=require('../lib/regionalLeagueHierarchy');
const editions=require('./regionalEditionService');
const policy=require('../lib/regionalRegistrationPolicy');
const reserves=require('../lib/regionalReservePolicy');
const {resolveClubPresidentContact}=require('./clubContactService');
const {parseMaybeJson,resolveDelivery}=require('./notificationPreferenceService');
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const stableId=value=>{const h=hash(value).slice(0,32);return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;};
const {publicWindow}=policy;
const isAdmin=user=>user?.role_id!=null && [0,2].includes(Number(user.role_id));
function belongs(row,scope) {
  try {const i=identity(row);return i.region_slug===scope.region_slug && i.platform===scope.platform && Number(i.reset_series || 0)===Number(scope.reset_series || 0);}
  catch {return false;} // Unrelated legacy identity problems stay in edition review.
}
function unavailable(all,window) {
  const root=all.find(r=>r.id===window.permanent_league_id),current=all.find(r=>r.id===root?.current_edition_id) || root;
  return !root || root.retired || root.retired_at || current.edition_invalidated || Number(current.reset_series || 0)!==window.reset_series ||
    all.some(r=>belongs(r,window) && Number(r.season_number)===window.season_number && !['draft','registration'].includes(r.status));
}
function createService({model=new RegionalRegistrationModel(),transaction=withTransaction,query=EXECUTESQL,clock=()=>new Date(),editionService=editions}={}) {
  const editions=editionService;
  async function clubAccess(clubId,actor,q,allowAdminRead=false) {
    const user=actor?.id?await model.actor(actor.id,q):null;
    if(!user)fail('Authentication required',401);
    const club=await model.club(clubId,q);
    if(!club)fail('Club not found',404);
    const owns=[club.president_user_id,club.user_id].filter(Boolean).includes(user.id) || (club.owner_email && String(club.owner_email).toLowerCase()===String(user.email).toLowerCase());
    if(!owns && !(allowAdminRead && isAdmin(user)))fail('Only the current club president or owner can register or confirm this club',403);
    return {user,club,owns:!!owns};
  }
  async function audit(q,user,action,before,after,reason,automatic=false) {
    if(!automatic && !isAdmin(user))return;
    await q('INSERT INTO admin_audit_log (id,admin_user_id,admin_email,action,entity_type,entity_id,old_value,new_value,reason) VALUES (?,?,?,?,?,?,?,?,?)',[uuid(),user.id,user.email,action,'regional_registration',after.id,JSON.stringify(before || null),JSON.stringify(after),reason || action]);
  }
  async function windows() {
    const all=(await editions.model.selectAll(query)).map(unpack);
    return {windows:(await model.selectAll(query)).filter(w=>w.status==='published').map(w=>{
      return {...publicWindow(w),transfer_conditions_revision:hash(publicWindow(w)),phase:unavailable(all,w)?'closed':policy.phase(w,clock())};
    })};
  }
  async function runPublish(body,actor,automatic=false,automaticTiming=null) {
    return transaction(async q=>{
      const user=automatic?{id:null,email:null}:await editions.admin(actor,q);if(!automatic && !isAdmin(user))fail('Admin access required',403);await editions.model.lock(q);
      const all=(await editions.model.selectAll(q,true)).map(unpack);
      const definition=all.find(r=>r.id===body.permanent_league_id && permanentId(r)===r.id);
      const current=all.find(r=>r.id===definition?.current_edition_id) || definition;
      if(!definition || Number(definition.division)!==1 || definition.retired || definition.retired_at || current.edition_invalidated)fail('Select an active permanent Division 1 identity for this regional system');
      const i=identity({...current,slug:'',season_number:Number(body.season_number),reset_series:Number(body.reset_series)});
      if(Number(i.reset_series || 0)!==Number(current.reset_series || 0))fail('Use the current reset series of this regional system');
      const rows=all.filter(r=>belongs(r,i));
      const timing=automatic && automaticTiming?automaticTiming:policy.schedule(body.opens_at);
      const cup=require('../lib/regionalCupPlan');
      if(body.include_cup===true && (!cup.policy.names[i.region_slug] || i.region_slug==='north-america'))fail('Confirm this region’s Cup time profile before including mandatory Cup entry');
      const id=stableId(['regional_registration_window',i.region_slug,i.platform,i.reset_series || 0,i.season_number]);
      const existing=await model.selectOne(id,q,true);
      const reschedule=require('../lib/officialReschedulePolicy');
      const rescheduleVersion=existing?existing.reschedule_policy_version:require('../lib/regionalCalendarPolicy.json').regions.includes(i.region_slug)?reschedule.VERSION:null;
      const base_rules_text=String(body.rules_text || '').trim();
      const reserveVersion=existing?existing.reserve_policy_version:reserves.VERSION;
      const cupTied=require('./officialCupTiedService'),cupTiedVersion=existing?existing.cup_tied_policy_version:body.include_cup===true?cupTied.VERSION:null;
      const transfers=require('./officialPlayerTransferService'),transferVersion=existing?existing.player_transfer_policy_version:transfers.VERSION;
      let rules_text=base_rules_text;
      const withdrawalPolicy=require('../lib/regionalWithdrawal');
      if(!rules_text || rules_text.length>12000)fail('Provide the published edition rules before opening registration',400);
      if(body.include_cup===true)rules_text+=`\n\n${cup.rules}`;
      const resultPolicy=require('../lib/regionalResultPolicy');
      rules_text+=`\n\n${resultPolicy.RULES}`;
      if(rescheduleVersion)rules_text+=`\n\n${reschedule.RULES}`;
      if(reserveVersion)rules_text+=`\n\n${reserves.RULES}`;
      if(transferVersion)rules_text+=`\n\n${transfers.RULES}`;
      if(cupTiedVersion)rules_text+=`\n\n${cupTied.RULES}`;
      rules_text+=`\n\n${withdrawalPolicy.RULES}`;
      if(rules_text.length>12000)fail('Published rules including Cup terms exceed the supported length',400);
      const orchestration=require('../lib/regionalSeasonOrchestrationPolicy');
      const orchestrationVersion=existing?existing.season_orchestration_policy_version:orchestration.VERSION;
      const startMonday=String(body.league_start_monday || '').trim();
      if(startMonday && (!/^\d{4}-\d{2}-\d{2}$/.test(startMonday) || !Number.isFinite(Date.parse(startMonday+'T00:00:00Z')) || new Date(startMonday+'T00:00:00Z').toISOString().slice(0,10)!==startMonday || new Date(startMonday+'T00:00:00Z').getUTCDay()!==1))fail('Choose a valid Monday for the first league playing week',400);
      const recurringVersion=existing?existing.recurring_schedule_policy_version:orchestration.RECURRING_VERSION;
      const window={base_rules_text,withdrawal_policy_version:withdrawalPolicy.VERSION,...(rescheduleVersion?{reschedule_policy_version:rescheduleVersion}:{}),...(recurringVersion?{recurring_schedule_policy_version:recurringVersion}:{}),...(orchestrationVersion?{season_orchestration_policy_version:orchestrationVersion}:{}),...(startMonday?{league_start_monday:startMonday}:{}),id,region_slug:i.region_slug,platform:i.platform,season_number:i.season_number,reset_series:i.reset_series || 0,permanent_league_id:definition.id,...timing,policy_version:policy.VERSION,result_policy_version:resultPolicy.VERSION,confirmation_notice_policy_version:'regional_confirmation_notice_v1',...(body.include_cup===true?{cup_policy_version:cup.policy.version}:{}),rules_text,status:'published'};
      if(reserveVersion)window.reserve_policy_version=reserveVersion;
      if(cupTiedVersion)window.cup_tied_policy_version=cupTiedVersion;
      if(transferVersion)window.player_transfer_policy_version=transferVersion;
      if(existing && hash(publicWindow(existing))!==hash(publicWindow(window)))fail('A published registration period is immutable; review its existing conditions instead of previewing a replacement.');
      if(!existing) {
        if(rows.some(r=>r.pending_regional_cycle_id && [Number(r.season_number),Number(r.season_number)+1].includes(i.season_number)))fail('An existing captured regional cycle keeps its participation conditions');
        if(rows.some(r=>Number(r.season_number)===i.season_number && r.regional_cycle_id))fail('An already allocated edition keeps its original participation conditions; publish for a future new edition');
        if(rows.some(r=>Number(r.season_number)>i.season_number))fail('The requested registration season is older than this regional system');
        if(rows.some(r=>Number(r.season_number)===i.season_number && !['draft','registration'].includes(r.status)))fail('A started or completed edition keeps its existing participation conditions');
        if(Date.parse(timing.opens_at)<=clock().getTime())fail('Publish the opening date in the future; no backdated participation conditions');
      }
      const revision=hash([window,existing || null,definition]);
      if(body.apply!==true)return {window,revision,already_published:!!existing,financial_mutations:false};
      if(!String(body.reason || '').trim())fail('An administrative reason is required',400);
      if(existing) {
        if(hash(publicWindow(existing))!==hash(publicWindow(window)))fail('A published registration period is immutable; review the edition instead of changing accepted conditions');
        return {already_applied:true,window:publicWindow(existing)};
      }
      if(body.expected_revision!==revision)fail('Registration settings changed since preview');
      await model.create({...window,published_at:clock().toISOString(),published_by:user.id},q);
      await audit(q,user,'publish_regional_registration',null,window,body.reason,automatic);
      return {applied:true,window:publicWindow(window)};
    });
  }
  async function publish(body,actor){return runPublish(body,actor,false);}
  async function reconcileNextWindow(sourceId,startMonday) {
    const source=await model.selectOne(sourceId,query);
    const orchestration=require('../lib/regionalSeasonOrchestrationPolicy');
    if(!orchestration.enabled(source) || source.recurring_schedule_policy_version!==orchestration.RECURRING_VERSION || !source.base_rules_text)fail('The current edition has no captured recurring registration plan.');
    const {dateAt}=require('../lib/regionalCalendarPlan');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(startMonday || '') || new Date(startMonday+'T00:00:00Z').getUTCDay()!==1)fail('The recurring season needs its explicitly published playing Monday.');
    const at=days=>new Date(require('../lib/officialScheduleTime').scheduleTime(dateAt(startMonday,days)+' 00:00:00','Europe/Brussels').instant).toISOString();
    const timing={opens_at:at(28),registration_closes_at:at(56),confirmation_closes_at:at(63)};
    const opens=timing.opens_at;
    const existing=(await model.selectAll(query)).filter(w=>w.region_slug===source.region_slug && w.platform===source.platform && Number(w.reset_series || 0)===Number(source.reset_series || 0) && Number(w.season_number)===Number(source.season_number)+1);
    if(existing.length){
      if(existing.length!==1 || existing[0].status!=='published' || existing[0].edition_invalidated || existing[0].permanent_league_id!==source.permanent_league_id)fail('The next registration period has conflicting edition identity.');
      return {already_applied:true,window:publicWindow(existing[0])};
    }
    const body={permanent_league_id:source.permanent_league_id,season_number:Number(source.season_number)+1,reset_series:Number(source.reset_series || 0),opens_at:opens,league_start_monday:dateAt(startMonday,91),include_cup:source.cup_policy_version==='regional_cup_v1',rules_text:source.base_rules_text,reason:'Automatic next-edition registration: weeks 5–8, confirmation week 9, next league after twelve playing weeks and one transition week'};
    const preview=await runPublish(body,null,true,timing);
    return runPublish({...body,apply:true,expected_revision:preview.revision},null,true,timing);
  }
  async function readiness(clubId,actor) {
    return transaction(async q=>{
      const {user,club,owns}=await clubAccess(clubId,actor,q,true);
      const players=await model.players(club.id,q);
      const report=policy.rosterReport(players,club.id,clock());
      const ownPlus=policy.plusStatus(await model.actorPlayer(user,q),clock());
      const registrations=await model.registrations(club.id,q);
      return {club:{id:club.id,name:club.name},can_manage_registration:owns,registrar_status:ownPlus,...report,
        registrations:registrations.map(r=>({id:r.id,registration_window_id:r.registration_window_id || null,registration_policy_version:r.registration_policy_version || null,region_slug:r.region_slug,platform:r.platform,season_number:r.season_number,status:r.status,participation_status:r.participation_status,confirmed_player_ids:r.confirmed_player_ids || [],confirmed_at:r.confirmed_at || null,
          reserve_invitation:r.reserve_invitation || null,reserve_response:r.reserve_response || null,
          assigned_league_id:r.assigned_league_id || null,assigned_division:r.assigned_division || null,assigned_group_code:r.assigned_group_code || null}))};
    });
  }
  async function getWindow(id,q,{captured=false}={}) {
    const window=await model.selectOne(id,q,true);
    if(!window || window.status!=='published')fail('Published registration period not found',404);
    if(window.policy_version!==policy.VERSION)fail('Unknown participation policy; Admin review required');
    const all=(await editions.model.selectAll(q,true)).map(unpack);
    if(captured) {
      const root=all.find(r=>r.id===window.permanent_league_id),current=all.find(r=>r.id===root?.current_edition_id) || root;
      if(!root || root.retired || root.retired_at || current.edition_invalidated || Number(current.reset_series || 0)!==Number(window.reset_series || 0))fail('The captured registration period belongs to an invalidated regional series');
    } else if(unavailable(all,window))fail('This registration period is no longer current or its target edition has started');
    return window;
  }
  async function apply(windowId,body,actor) {
    return transaction(async q=>{
      await editions.model.lock(q);
      const {user,club}=await clubAccess(body.club_id,actor,q);
      const registrations=await model.registrations(club.id,q);
      const old=registrations.find(r=>r.registration_window_id===windowId);
      if(old)return {already_applied:true,registration:old};
      const window=await getWindow(windowId,q);
      if(body.policy_version!==window.policy_version)fail('Review the current participation conditions before registering');
      if(policy.phase(window,clock())!=='registration')fail('Registration is not open; the common confirmation week does not extend registration');
      if(policy.plusStatus(await model.actorPlayer(user,q),clock())!=='eligible')fail('The registering president needs active personal STAGE Plus',403);
      const clubPlatform=identity({...window,slug:'',division:1,platform:club.platform}).platform;
      if(window.platform!=='cross-platform' && clubPlatform!==window.platform)fail('Club platform does not match this regional edition');
      if(registrations.some(r=>r.registration_policy_version===policy.VERSION && Number(r.season_number)===window.season_number && Number(r.reset_series || 0)===window.reset_series && !['withdrawn','rejected','removed','cancelled'].includes(r.status)))fail('The club already has a regional application for this cycle; region transfer requires review');
      const record={id:stableId(['regional_registration',window.id,club.id]),club_id:club.id,club_name:club.name,club_tag:club.tag || '',club_logo_url:club.logo_url || '',owner_email:user.email,
        target_type:'regional_league',region_slug:window.region_slug,region:window.region_slug,platform:window.platform,season_number:window.season_number,reset_series:window.reset_series,
        registration_window_id:window.id,registration_policy_version:policy.VERSION,status:'pending',participation_status:'registered',applied_at:clock().toISOString(),applied_by_user_id:user.id,
        accepted_rules_revision:hash(publicWindow(window)),note_from_club:String(body.note || '').slice(0,2000)};
      if(policy.phase(window,clock())!=='registration')fail('Registration closed while processing this request; no application was saved');
      await model.saveRegistration(record,q,true);await audit(q,user,'apply_regional_registration',null,record);
      return {applied:true,registration:record};
    });
  }
  async function confirm(id,body,actor) {
    return transaction(async q=>{
      await editions.model.lock(q);
      const record=await model.registration(id,q);
      if(!record || record.registration_policy_version!==policy.VERSION)fail('Regional application not found',404);
      const {user,club}=await clubAccess(record.club_id,actor,q);
      if(record.participation_status==='confirmed')return {already_applied:true,registration:record};
      const window=await getWindow(record.registration_window_id,q);
      if(record.status!=='pending' || policy.phase(window,clock())!=='confirmation')fail('Confirm during the published common confirmation week');
      if(body.policy_version!==window.policy_version || record.accepted_rules_revision!==hash(publicWindow(window)))fail('Published participation conditions require review');
      const registrar=await model.actorPlayer(user,q);
      const selected=body.player_ids;
      if(!Array.isArray(selected) || selected.length<3 || selected.some(id=>typeof id!=='string') || new Set(selected).size!==selected.length)fail('Select at least three different eligible Plus players',400);
      const players=await model.players(club.id,q),confirmedAt=clock();
      if(policy.phase(window,confirmedAt)!=='confirmation')fail('The common confirmation deadline passed; no confirmation was saved');
      if(policy.plusStatus(registrar,confirmedAt)!=='eligible')fail('The confirming president needs active personal STAGE Plus',403);
      const report=policy.rosterReport(players,club.id,confirmedAt);
      if(selected.some(id=>!report.players.some(p=>p.id===id&&p.status==='eligible')))fail('A selected player needs active Plus or is registered to another playing club');
      const next={...record,status:'approved',participation_status:'confirmed',confirmed_at:confirmedAt.toISOString(),confirmed_by_user_id:user.id,confirmed_player_ids:selected.slice().sort(),...(window.player_transfer_policy_version?{club_roster_player_ids:players.map(p=>p.id).sort()}:{})};
      await model.saveRegistration(next,q);await audit(q,user,'confirm_regional_participation',record,next);
      return {applied:true,registration:next};
    });
  }
  async function confirmedField(region,platform,season,series,clubIds,q=query,{captured=false}={}) {
    const matches=(await model.selectAll(q)).filter(w=>w.status==='published' && w.region_slug===region && w.platform===platform && w.season_number===season && w.reset_series===series);
    if(!matches.length)return null; // Existing editions keep their old conditions.
    if(matches.length!==1)fail('Ambiguous published participation conditions require review');
    const window=await getWindow(matches[0].id,q,{captured});
    if(policy.phase(window,clock())!=='closed')fail('Wait until the common participation confirmation deadline before drawing the regional field');
    const records=await model.confirmedField(window.id,q);
    const confirmed=records.filter(r=>r.status==='approved'&&r.participation_status==='confirmed');
    if(confirmed.some(r=>!clubIds.includes(r.club_id)))fail('The selected field omits confirmed clubs; review the unsupported count or waiting-list policy instead of silently dropping clubs');
    for(const id of clubIds) {
      const entries=records.filter(r=>r.club_id===id);
      if(entries.length!==1 || entries[0].registration_policy_version!==policy.VERSION || entries[0].status!=='approved' || entries[0].participation_status!=='confirmed' ||
        entries[0].accepted_rules_revision!==hash(publicWindow(window)) || !Array.isArray(entries[0].confirmed_player_ids) || new Set(entries[0].confirmed_player_ids).size<3)fail('Every participant needs a valid confirmation for this regional edition; missing confirmations require review',409,{club_id:id});
    }
    if(window.reserve_policy_version===reserves.VERSION && clock().getTime()<Date.parse(reserves.deadline(window)))fail('Wait until the common reserve deadline before finalizing the regional field.');
    return {window:publicWindow(window),registrations:records.filter(r=>clubIds.includes(r.club_id))};
  }
  async function remindConfirmation(id) {
    return transaction(async q=>{
      await editions.model.lock(q);
      const record=await model.registration(id,q);
      if(!record || record.status!=='pending' || record.participation_status!=='registered' || record.registration_policy_version!==policy.VERSION || !record.registration_window_id)return {status:'not_needed'};
      const window=await getWindow(record.registration_window_id,q);
      if(window.edition_invalidated || window.invalidated_at)return {status:'not_needed'};
      const times=[window.opens_at,window.registration_closes_at,window.confirmation_closes_at].map(Date.parse);
      if(times.some(t=>!Number.isFinite(t)) || !(times[0]<times[1] && times[1]<times[2]))fail('Published registration dates need review before sending a confirmation notice.');
      if(window.confirmation_notice_policy_version!=='regional_confirmation_notice_v1' || policy.phase(window,clock())!=='confirmation')return {status:'not_needed'};
      if(record.region_slug!==window.region_slug || record.platform!==window.platform || Number(record.season_number)!==Number(window.season_number) || Number(record.reset_series || 0)!==Number(window.reset_series || 0) || record.accepted_rules_revision!==hash(publicWindow(window)))fail('Participation conditions changed; review the confirmation reminder.');
      if(record.confirmation_notice) {
        if(record.confirmation_notice.version==='regional_confirmation_notice_v1' && ['stored','muted'].includes(record.confirmation_notice.status))return {status:'already_checked'};
        fail('An unsupported confirmation notice receipt requires review.');
      }
      const contact=await resolveClubPresidentContact({clubId:record.club_id,query:q,forUpdate:true});
      if(!contact.email)fail('A reachable club president contact is required for the confirmation notice.');
      const delivery=resolveDelivery(parseMaybeJson(await model.notificationSettings(contact.email,q),{}),'club_updates');
      // Contact/settings reads can cross the absolute shared deadline. Recheck
      // before storing anything; a reminder cannot extend or reopen the window.
      if(policy.phase(window,clock())!=='confirmation')return {status:'not_needed'};
      const notification_id=delivery.inApp?stableId(['regional_confirmation_notice',window.id,record.id]):null;
      if(notification_id)await model.saveConfirmationNotice({id:notification_id,email:contact.email,registration_id:record.id,
        body:`${record.club_name || 'Your club'} · ${window.region_slug} · ${window.reset_series?`Series ${window.reset_series} · `:''}Season ${window.season_number}: the shared regional confirmation week is open. Confirm participation with at least three eligible personal STAGE Plus players before ${new Date(window.confirmation_closes_at).toISOString()} (UTC). Open participation to see local dates and current status. Registration alone does not confirm entry.`,
        link:`/register-league?club=${encodeURIComponent(record.club_id)}&region=${encodeURIComponent(window.region_slug)}`,
        key:`regional_confirmation:${window.id}:${record.id}`},q);
      const status=delivery.inApp?'stored':'muted';
      await model.saveRegistration({...record,confirmation_notice:{version:'regional_confirmation_notice_v1',status,checked_at:clock().toISOString(),notification_id}},q);
      return {status};
    });
  }
  async function reconcileReserves(windowId) {
    return transaction(async q=>{
      await editions.model.lock(q);
      const window=await getWindow(windowId,q,{captured:true});
      if(window.reserve_policy_version!==reserves.VERSION)return {status:'not_enabled'};
      const now=clock();
      if(now.getTime()<Date.parse(window.confirmation_closes_at))return {status:'awaiting_confirmation'};
      if(!reserves.active(window,now))return {status:'closed',deadline:reserves.deadline(window)};
      const records=await model.confirmedField(window.id,q);
      for(const record of records) {
        if(!['pending','approved'].includes(record.status) || record.reserve_invitation)continue;
        if(record.registration_policy_version!==policy.VERSION || record.accepted_rules_revision!==policy.windowRevision(window) || record.region_slug!==window.region_slug || record.platform!==window.platform || Number(record.season_number)!==Number(window.season_number) || Number(record.reset_series || 0)!==Number(window.reset_series || 0))fail('Reserve invitations require unchanged original participation evidence.');
        const contact=await resolveClubPresidentContact({clubId:record.club_id,query:q,forUpdate:true});
        if(!contact.email)fail('A reachable club president is required for reserve invitations.');
        const inApp=resolveDelivery(parseMaybeJson(await model.notificationSettings(contact.email,q),{}),'club_updates').inApp;
        const invitation={version:reserves.VERSION,offered_at:clock().toISOString(),deadline:reserves.deadline(window),notification_status:inApp?'stored':'muted'};
        if(!reserves.active(window,clock()))return {status:'closed',deadline:invitation.deadline};
        if(inApp)await model.saveReserveNotice({id:stableId(['regional_reserve_notice',window.id,record.id]),email:contact.email,registration_id:record.id,body:`Respond before ${invitation.deadline} (UTC). Existing applicants only; active personal Plus and at least three eligible players are required. Reserve willingness does not guarantee entry or Division 1. Final sporting allocation follows the published rules.`,link:`/register-league?club=${encodeURIComponent(record.club_id)}&region=${encodeURIComponent(window.region_slug)}`,key:`regional_reserve:${window.id}:${record.id}`},q);
        const next={...record,reserve_invitation:invitation};
        await model.saveRegistration(next,q);await audit(q,{id:null,email:null},'invite_regional_reserve',record,next,'Shared reserve supplementation period',true);
      }
      return {status:'awaiting_reserves',deadline:reserves.deadline(window)};
    });
  }
  async function respondReserve(id,body,actor) {
    return transaction(async q=>{
      await editions.model.lock(q);
      const record=await model.registration(id,q);
      if(!record || !record.reserve_invitation)fail('Reserve invitation not found',404);
      const {user,club}=await clubAccess(record.club_id,actor,q);
      const window=await getWindow(record.registration_window_id,q);
      if(!['accept','decline'].includes(body.decision))fail('Accept or decline the reserve invitation.',400);
      if(record.reserve_response){if(record.reserve_response.decision===body.decision)return {already_applied:true,registration:record};fail('This reserve response is already final.');}
      if(!['pending','approved'].includes(record.status) || !reserves.active(window,clock()) || record.reserve_invitation.version!==reserves.VERSION || record.reserve_invitation.deadline!==reserves.deadline(window) || record.accepted_rules_revision!==policy.windowRevision(window))fail('The shared reserve deadline passed or the invitation requires review.');
      let selected=[],players=[];
      if(body.decision==='accept'){
        if(policy.plusStatus(await model.actorPlayer(user,q),clock())!=='eligible')fail('The responding president needs active personal STAGE Plus',403);
        selected=body.player_ids;
        if(!Array.isArray(selected) || selected.length<3 || selected.some(id=>typeof id!=='string') || new Set(selected).size!==selected.length)fail('Select at least three different eligible Plus players',400);
        players=await model.players(club.id,q);
        const report=policy.rosterReport(players,club.id,clock());
        if(selected.some(id=>!report.players.some(p=>p.id===id && p.status==='eligible')))fail('Every selected reserve participant needs active Plus and playing registration for this club.');
      }
      const now=clock();if(!reserves.active(window,now))fail('The common reserve deadline passed; no response was saved.');
      const next={...record,reserve_response:{decision:body.decision,responded_at:now.toISOString(),by_user_id:user.id}};
      if(body.decision==='accept' && record.participation_status!=='confirmed')Object.assign(next,{status:'approved',participation_status:'confirmed',confirmed_at:now.toISOString(),confirmed_by_user_id:user.id,confirmed_player_ids:selected.slice().sort(),...(window.player_transfer_policy_version?{club_roster_player_ids:players.map(p=>p.id).sort()}:{})});
      await model.saveRegistration(next,q);await audit(q,user,'respond_regional_reserve',record,next);
      await q('INSERT INTO club_operation_audit_logs (id,club_id,actor_user_id,actor_email,action,entity_type,entity_id,old_value,new_value,reason,created_date) VALUES (?,?,?,?,?,?,?,?,?,?,NOW())',[uuid(),club.id,user.id,user.email,'respond_regional_reserve','season_registration',id,JSON.stringify(record),JSON.stringify(next),'Shared reserve invitation response']);
      return {applied:true,registration:next};
    });
  }
  const capturedField=(region,platform,season,series,clubIds,q=query)=>confirmedField(region,platform,season,series,clubIds,q,{captured:true});
  return {windows,publish,reconcileNextWindow,readiness,apply,confirm,confirmedField,capturedField,remindConfirmation,reconcileReserves,respondReserve};
}
module.exports={createService,...createService()};

'use strict';
const crypto=require('node:crypto');
const {v4:uuid}=require('uuid');
const {EXECUTESQL,withTransaction}=require('../db/database');
const {RegionalRegistrationModel}=require('../models/regionalRegistrationModel');
const {identity,unpack,fail}=require('../lib/regionalEditionIdentity');
const {permanentId}=require('../lib/regionalLeagueHierarchy');
const editions=require('./regionalEditionService');
const policy=require('../lib/regionalRegistrationPolicy');
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const stableId=value=>{const h=hash(value).slice(0,32);return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;};
const publicWindow=window=>Object.fromEntries(['id','region_slug','platform','season_number','reset_series','opens_at','registration_closes_at','confirmation_closes_at','policy_version','rules_text'].map(key=>[key,window[key]]));
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
  async function audit(q,user,action,before,after,reason) {
    if(!isAdmin(user))return;
    await q('INSERT INTO admin_audit_log (id,admin_user_id,admin_email,action,entity_type,entity_id,old_value,new_value,reason) VALUES (?,?,?,?,?,?,?,?,?)',[uuid(),user.id,user.email,action,'regional_registration',after.id,JSON.stringify(before || null),JSON.stringify(after),reason || action]);
  }
  async function windows() {
    const all=(await editions.model.selectAll(query)).map(unpack);
    return {windows:(await model.selectAll(query)).filter(w=>w.status==='published').map(w=>{
      return {...publicWindow(w),phase:unavailable(all,w)?'closed':policy.phase(w,clock())};
    })};
  }
  async function publish(body,actor) {
    return transaction(async q=>{
      const user=await editions.admin(actor,q);if(!isAdmin(user))fail('Admin access required',403);await editions.model.lock(q);
      const all=(await editions.model.selectAll(q,true)).map(unpack);
      const definition=all.find(r=>r.id===body.permanent_league_id && permanentId(r)===r.id);
      const current=all.find(r=>r.id===definition?.current_edition_id) || definition;
      if(!definition || Number(definition.division)!==1 || definition.retired || definition.retired_at || current.edition_invalidated)fail('Select an active permanent Division 1 identity for this regional system');
      const i=identity({...current,slug:'',season_number:Number(body.season_number),reset_series:Number(body.reset_series)});
      if(Number(i.reset_series || 0)!==Number(current.reset_series || 0))fail('Use the current reset series of this regional system');
      const rows=all.filter(r=>belongs(r,i));
      const timing=policy.schedule(body.opens_at);
      const rules_text=String(body.rules_text || '').trim();
      if(!rules_text || rules_text.length>12000)fail('Provide the published edition rules before opening registration',400);
      const id=stableId(['regional_registration_window',i.region_slug,i.platform,i.reset_series || 0,i.season_number]);
      const existing=await model.selectOne(id,q,true);
      const window={id,region_slug:i.region_slug,platform:i.platform,season_number:i.season_number,reset_series:i.reset_series || 0,permanent_league_id:definition.id,...timing,policy_version:policy.VERSION,rules_text,status:'published'};
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
      await audit(q,user,'publish_regional_registration',null,window,body.reason);
      return {applied:true,window:publicWindow(window)};
    });
  }
  async function readiness(clubId,actor) {
    return transaction(async q=>{
      const {user,club,owns}=await clubAccess(clubId,actor,q,true);
      const report=policy.rosterReport(await model.players(club.id,q),club.id,clock());
      const ownPlus=policy.plusStatus(await model.actorPlayer(user,q),clock());
      const registrations=await model.registrations(club.id,q);
      return {club:{id:club.id,name:club.name},can_manage_registration:owns,registrar_status:ownPlus,...report,
        registrations:registrations.map(r=>({id:r.id,registration_window_id:r.registration_window_id || null,registration_policy_version:r.registration_policy_version || null,region_slug:r.region_slug,platform:r.platform,season_number:r.season_number,status:r.status,participation_status:r.participation_status,confirmed_player_ids:r.confirmed_player_ids || [],confirmed_at:r.confirmed_at || null,
          assigned_league_id:r.assigned_league_id || null,assigned_division:r.assigned_division || null,assigned_group_code:r.assigned_group_code || null}))};
    });
  }
  async function getWindow(id,q) {
    const window=await model.selectOne(id,q,true);
    if(!window || window.status!=='published')fail('Published registration period not found',404);
    if(window.policy_version!==policy.VERSION)fail('Unknown participation policy; Admin review required');
    const all=(await editions.model.selectAll(q,true)).map(unpack);
    if(unavailable(all,window))fail('This registration period is no longer current or its target edition has started');
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
      const next={...record,status:'approved',participation_status:'confirmed',confirmed_at:confirmedAt.toISOString(),confirmed_by_user_id:user.id,confirmed_player_ids:selected.slice().sort()};
      await model.saveRegistration(next,q);await audit(q,user,'confirm_regional_participation',record,next);
      return {applied:true,registration:next};
    });
  }
  async function confirmedField(region,platform,season,series,clubIds,q=query) {
    const matches=(await model.selectAll(q)).filter(w=>w.status==='published' && w.region_slug===region && w.platform===platform && w.season_number===season && w.reset_series===series);
    if(!matches.length)return null; // Existing editions keep their old conditions.
    if(matches.length!==1)fail('Ambiguous published participation conditions require review');
    const window=await getWindow(matches[0].id,q);
    if(policy.phase(window,clock())!=='closed')fail('Wait until the common participation confirmation deadline before drawing the regional field');
    const records=await model.confirmedField(window.id,q);
    const confirmed=records.filter(r=>r.status==='approved'&&r.participation_status==='confirmed');
    if(confirmed.some(r=>!clubIds.includes(r.club_id)))fail('The selected field omits confirmed clubs; review the unsupported count or waiting-list policy instead of silently dropping clubs');
    for(const id of clubIds) {
      const entries=records.filter(r=>r.club_id===id);
      if(entries.length!==1 || entries[0].registration_policy_version!==policy.VERSION || entries[0].status!=='approved' || entries[0].participation_status!=='confirmed' ||
        entries[0].accepted_rules_revision!==hash(publicWindow(window)) || !Array.isArray(entries[0].confirmed_player_ids) || new Set(entries[0].confirmed_player_ids).size<3)fail('Every participant needs a valid confirmation for this regional edition; missing confirmations require review',409,{club_id:id});
    }
    return {window:publicWindow(window),registrations:records.filter(r=>clubIds.includes(r.club_id))};
  }
  return {windows,publish,readiness,apply,confirm,confirmedField};
}
module.exports={createService,...createService()};

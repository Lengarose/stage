'use strict';
const crypto=require('node:crypto');
const {v5:uuid,v4}=require('uuid');
const {withTransaction}=require('../db/database');
const {unpack}=require('../models/competitionScopeModel');
const {RegionalRegistrationModel}=require('../models/regionalRegistrationModel');
const {buildCatalogue}=require('../lib/regionalLeagueHierarchy');
const {identity}=require('../lib/regionalEditionIdentity');
const registration=require('../lib/regionalRegistrationPolicy');
const fail=(message,status=409)=>{throw Object.assign(Error(message),{status});};
const list=value=>typeof value==='string'?JSON.parse(value):value||[];
const revision=w=>crypto.createHash('sha256').update(JSON.stringify(registration.publicWindow(w))).digest('hex');
const model=new RegionalRegistrationModel();
async function request(body,actor){return withTransaction(async q=>{
 const editions=require('./regionalEditionService');await editions.model.lock(q);
 const user=await model.actor(actor?.id,q),club=await model.club(body.club_id,q);
 if(!user||!club||![club.president_user_id,club.user_id].includes(user.id)&&String(club.owner_email||'').toLowerCase()!==String(user.email||'').toLowerCase())fail('Only the current club president can request a regional transfer.',403);
 if(registration.plusStatus(await model.actorPlayer(user,q),new Date())!=='eligible')fail('The registering president needs active personal STAGE Plus.',403);
 const players=await model.players(club.id,q);if(players.filter(p=>registration.plusStatus(p,new Date())==='eligible').length<3)fail('At least three currently eligible Plus players are required.',422);
 const rows=await editions.model.selectAll(q,true),all=rows.map(unpack),catalogue=buildCatalogue(rows);
 const cycles=(await q("SELECT * FROM league_entities WHERE entity_type='regional_cycle' AND status='allocated' ORDER BY created_date DESC,id FOR UPDATE")).map(unpack).filter(c=>c.policy_version==='regional_structure_v1'&&(c.original_plan||c.plan)?.rights?.some(r=>r.club_id===club.id));
 cycles.sort((a,b)=>Date.parse(b.allocated_at)-Date.parse(a.allocated_at));
 const cycle=cycles[0],right=(cycle?.original_plan||cycle?.plan)?.rights?.find(r=>r.club_id===club.id);
 const target=String(body.target_region_slug||'').trim();if(!target)fail('Choose the destination regional system.',422);
 const id=uuid(`regional_transfer:${club.id}:${cycle?.id||'pending'}:${target}`,uuid.URL);
 const [stored]=await q("SELECT * FROM league_entities WHERE id=? AND entity_type='regional_transfer_request' FOR UPDATE",[id]);
 const before=stored?unpack(stored):null;if(before?.status==='applied')return {already_applied:true,transfer:before};
 const reasons=[];
 if(!cycle||!cycle.plan?.ready||![1,2].includes(Number(right?.division))||cycle.edition_invalidated||cycle.input?.mode!=='transition')reasons.push('The completed edition and final earned tier are not yet available.');
 const sources=(cycle?.input?.source_edition_ids||[]).map(id=>all.find(r=>r.id===id)).filter(Boolean);
 if(!sources.length||sources.length!==(cycle?.input?.source_edition_ids||[]).length||!sources.some(r=>list(r.registered_club_ids).includes(club.id))||sources.some(r=>!['completed','archived'].includes(r.status)||r.regional_final_ranking_cycle_id!==cycle.id||r.edition_invalidated||r.withdrawal_review_required))reasons.push('The source regional edition has not completed its required sporting review.');
 const current=catalogue.groups.map(g=>all.find(r=>r.id===g.current_edition_id)).filter(Boolean);
 const future=current.filter(r=>list(r.registered_club_ids).includes(club.id)&&!['completed','archived','cancelled','abandoned','reset','superseded'].includes(r.status));
 if(future.length===1 && identity(future[0]).region_slug===target)fail('The club already belongs to this regional system.',422);
 if(future.length>1)reasons.push('The club has more than one current regional assignment; identity review is required.');
 if(future.some(r=>!['draft','registration'].includes(r.status)||Number(r.season_number)!==Number(cycle?.season_number)))reasons.push('A current assigned edition is already running or does not match the earned-rights cycle.');
 const eligible=current.filter(r=>{try {const i=identity(r),group=catalogue.groups.find(g=>g.current_edition_id===r.id);return i.region_slug===target&&i.platform===cycle?.platform&&Number(i.division)===Number(right?.division)&&Number(i.season_number)===Number(cycle?.season_number)&&['draft','registration'].includes(r.status)&&!r.edition_invalidated&&!group?.identity_conflict&&!group?.retired&&Number(r.max_clubs||20)===20&&list(r.registered_club_ids).length<20;}catch{return false;}}).sort((a,b)=>list(b.registered_club_ids).length-list(a.registered_club_ids).length||String(a.group_code||'A').localeCompare(String(b.group_code||'A')));
 const destination=eligible[0];if(!destination)reasons.push('No unfilled current place at the earned tier is available in the destination region. No confirmed club can be displaced.');
 if(destination&&future.some(r=>r.id===destination.id))reasons.push('The club is already assigned to this regional place.');
 const affected=[...future,...(destination?[destination]:[])];
 for(const group of affected){const fixtures=await q("SELECT id FROM league_entities WHERE entity_type='regional_league_fixture' AND league_id=? LIMIT 1 FOR UPDATE",[group.id]);if(fixtures.length)reasons.push('An affected group already has drawn fixtures. Reconcile its accepted calendar and sporting dependencies through Admin review.');}
 const cups=(await q("SELECT * FROM league_entities WHERE entity_type='regional_cup_edition' AND status NOT IN ('completed','archived','cancelled','reset','superseded') FOR UPDATE")).map(unpack);
 if(cups.some(c=>c.participant_ids?.includes(club.id)||destination&&c.region_slug===target&&Number(c.season_number)===Number(destination.season_number)))reasons.push('A captured Cup field or active Cup obligation requires review before changing regional participation.');
 const [windowRow]=destination?await q("SELECT * FROM league_entities WHERE id=? AND entity_type='regional_registration_window' FOR UPDATE",[destination.regional_registration_window_id||'']):[];
 const window=windowRow?unpack(windowRow):null;
 if(destination&&(!window||window.status!=='published'||window.policy_version!==registration.VERSION||window.region_slug!==target||window.platform!==cycle.platform||Number(window.reset_series||0)!==Number(destination.reset_series||0)||Number(window.season_number)!==Number(cycle.season_number)))reasons.push('The destination participation conditions are unavailable or belong to another cycle.');
 if(window&&body.accepted_conditions_revision!==revision(window))fail('Read and accept the current destination participation conditions before requesting the move.',422);
 const registrations=(await model.registrations(club.id,q)).filter(r=>r.status==='approved'&&r.participation_status==='confirmed'&&Number(r.season_number)===Number(cycle?.season_number));
 if(registrations.length!==1)reasons.push('One confirmed source application for this next edition is required; late new admissions are not created by regional transfer.');
 const transfer={id,club_id:club.id,source_cycle_id:cycle?.id||null,earned_division:right?.division||null,target_region_slug:target,target_edition_id:destination?.id||null,status:reasons.length?'review_required':'applied',review_reasons:[...new Set(reasons)],requested_by:user.id,requested_at:new Date().toISOString()};
 if(!reasons.length){
  const sourceRegistration=registrations[0],beforeGroups=structuredClone(affected);
  const originalStandings=[];
  for(const group of affected){const stored=await q("SELECT * FROM league_entities WHERE entity_type='regional_league_standing' AND league_id=? FOR UPDATE",[group.id]);const standings=stored.map(unpack);if(standings.some(r=>Number(r.played)>0))fail('An affected group already has played standings. Admin review is required.');originalStandings.push(...standings);}
  for(const group of future){const ids=list(group.registered_club_ids).filter(id=>id!==club.id),next={...group,registered_club_ids:ids,registered_clubs:ids,num_clubs:ids.length,regional_transfer_vacancy:true};await editions.model.update(next,identity(next).key,q);await q("DELETE FROM league_entities WHERE entity_type='regional_league_standing' AND league_id=? AND club_id=?",[group.id,club.id]);}
  const ids=[...list(destination.registered_club_ids),club.id];if(ids.length>20||new Set(ids).size!==ids.length)fail('The destination place is no longer available.');
  const next={...destination,registered_club_ids:ids,registered_clubs:ids,num_clubs:ids.length,regional_transfer_vacancy:ids.length<20};await editions.model.update(next,identity(next).key,q);
  const standing={id:uuid(`regional_transfer_standing:${destination.id}:${club.id}`,uuid.URL),league_id:destination.id,club_id:club.id,club_name:club.name,region_slug:target,status:'active',played:0,wins:0,draws:0,losses:0,goals_for:0,goals_against:0,goal_difference:0,points:0};
  await q("INSERT INTO league_entities (id,entity_type,league_id,club_id,status,data_json) VALUES (?,'regional_league_standing',?,?,'active',?)",[standing.id,destination.id,club.id,JSON.stringify(standing)]);
  await model.saveRegistration({...sourceRegistration,status:'transferred_out',regional_transfer_id:id},q);
  const targetRegistration={...sourceRegistration,id:uuid(`regional_transfer_registration:${id}`,uuid.URL),registration_window_id:window.id,region_slug:target,region:target,league_id:destination.id,assigned_league_id:destination.id,division:right.division,assigned_division:right.division,status:'approved',accepted_rules_revision:revision(window),regional_transfer_id:id,club_roster_player_ids:players.map(p=>p.id)};
  await model.saveRegistration(targetRegistration,q,true);
  for(const group of affected)if(group.regional_cycle_id)await amendCycle(group,group.id===destination.id,club.id,right.division,id,q);
  transfer.original_standings=originalStandings;
  transfer.original_groups=beforeGroups;transfer.original_registration=sourceRegistration;transfer.target_registration_id=targetRegistration.id;transfer.conditions_snapshot=registration.publicWindow(window);transfer.applied_at=new Date().toISOString();
 }
 await q("INSERT INTO league_entities (id,entity_type,club_id,status,data_json) VALUES (?,'regional_transfer_request',?,?,?) ON DUPLICATE KEY UPDATE status=VALUES(status),data_json=VALUES(data_json),updated_date=NOW()",[id,club.id,transfer.status,JSON.stringify(transfer)]);
 await q('INSERT INTO club_operation_audit_logs (id,club_id,actor_user_id,actor_email,action,entity_type,entity_id,old_value,new_value,reason) VALUES (?,?,?,?,?,?,?,?,?,?)',[v4(),club.id,user.id,user.email,'request_regional_transfer','regional_transfer_request',id,JSON.stringify(before),JSON.stringify(transfer),body.note||'Club requested transfer at its confirmed earned tier']);
 if([0,2].includes(Number(user.role_id)))await q('INSERT INTO admin_audit_log (id,admin_user_id,admin_email,action,entity_type,entity_id,old_value,new_value,reason) VALUES (?,?,?,?,?,?,?,?,?)',[v4(),user.id,user.email,'request_regional_transfer','regional_transfer_request',id,JSON.stringify(before),JSON.stringify(transfer),body.note||'Admin acting as the club president']);
 return {transfer,applied:transfer.status==='applied',requires_review:transfer.status==='review_required'};
});}
async function amendCycle(group,incoming,clubId,division,transferId,q) {
 const [row]=await q("SELECT * FROM league_entities WHERE id=? AND entity_type='regional_cycle' FOR UPDATE",[group.regional_cycle_id]);
 if(!row)fail('The assigned regional cycle is missing; allocation review is required.');
 const cycle=unpack(row);if(cycle.status!=='allocated')fail('Sporting allocation must be final before a regional transfer.');
 cycle.original_plan ||= structuredClone(cycle.plan);
 const ref=`D${division}${group.group_code||'A'}`,target=cycle.plan.groups?.find(g=>g.ref===ref);
 if(!target)fail('The saved cycle group does not match this regional place.');
 target.club_ids=incoming?[...target.club_ids.filter(id=>id!==clubId),clubId]:target.club_ids.filter(id=>id!==clubId);
 cycle.plan.rights=cycle.plan.rights.filter(r=>r.club_id!==clubId);
 if(incoming)cycle.plan.rights.push({club_id:clubId,division,route:'regional_transfer_in',regional_transfer_id:transferId});
 cycle.regional_transfer_amendments=[...(cycle.regional_transfer_amendments||[]),{regional_transfer_id:transferId,club_id:clubId,edition_id:group.id,division,direction:incoming?'in':'out',recorded_at:new Date().toISOString()}];
 await q("UPDATE league_entities SET data_json=?,updated_date=NOW() WHERE id=? AND entity_type='regional_cycle'",[JSON.stringify(cycle),cycle.id]);
}
async function review(id,body,actor){return withTransaction(async q=>{
 const admin=await require('./regionalEditionService').admin(actor,q);
 if(!['rejected','awaiting_club'].includes(body.status)||!String(body.reason||'').trim())fail('Choose rejected or awaiting club action and provide the review reason.',422);
 const [row]=await q("SELECT * FROM league_entities WHERE id=? AND entity_type='regional_transfer_request' FOR UPDATE",[id]);
 if(!row)fail('Regional transfer request not found.',404);
 const before=unpack(row);if(before.status==='applied')fail('This transfer is already applied; its sporting and participation history must be preserved.');
 if(before.status===body.status&&before.review_reason===body.reason)return {already_applied:true,transfer:before,affiliation_changed:false};
 const after={...before,status:body.status,review_reason:body.reason,reviewed_by:admin.id,reviewed_at:new Date().toISOString()};
 await q("UPDATE league_entities SET status=?,data_json=?,updated_date=NOW() WHERE id=? AND entity_type='regional_transfer_request'",[after.status,JSON.stringify(after),id]);
 await q('INSERT INTO admin_audit_log (id,admin_user_id,admin_email,action,entity_type,entity_id,old_value,new_value,reason) VALUES (?,?,?,?,?,?,?,?,?)',[v4(),admin.id,admin.email,'review_regional_transfer','regional_transfer_request',id,JSON.stringify(before),JSON.stringify(after),body.reason]);
 const contact=await require('./clubContactService').resolveClubPresidentContact({clubId:before.club_id,query:q,forUpdate:true});
 const {resolveDelivery,parseMaybeJson}=require('./notificationPreferenceService');
 const [preferences]=contact.email?await q('SELECT notification_settings FROM players WHERE LOWER(email)=LOWER(?) LIMIT 1',[contact.email]):[];
 if(contact.email&&resolveDelivery(parseMaybeJson(preferences?.notification_settings,{}),'club_updates').inApp)await q('INSERT INTO notifications (id,recipient_email,type,title,body,link,related_id) VALUES (?,?,?,?,?,?,?)',[v4(),contact.email,'club_update','Regional transfer reviewed',body.reason,`/register-league?club=${encodeURIComponent(before.club_id)}`,id]);
 return {transfer:after,affiliation_changed:false};
});}
module.exports={request,review,conditionsRevision:revision};

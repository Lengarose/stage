'use strict';
const crypto=require('node:crypto'),{v4:uuid,v5}=require('uuid');
const {EXECUTESQL,withTransaction}=require('../db/database');
const {unpack}=require('../models/competitionScopeModel');
const schedules=require('./tournamentScheduleService');
const fail=(message,status=409)=>{throw Object.assign(Error(message),{status});};
const revision=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
function snapshot(m){return Object.fromEntries(['id','tournament_id','type','round','home_club_id','away_club_id','home_player_id','away_player_id','status','result_state','scheduled_date','confirmed_date','timezone','stats_processed','report_finalized','home_submission','away_submission'].map(k=>[k,m[k]??null]));}
async function writable(tid,mid,q){const [t]=await q('SELECT * FROM tournaments WHERE id=? FOR UPDATE',[tid]);if(!t)fail('Tournament not found.',404);if(t.schedule_policy_version!==schedules.VERSION||!['registration','in_progress'].includes(t.status))fail('This tournament is not open for controlled schedule changes.');const [m]=await q('SELECT * FROM matches WHERE id=? AND tournament_id=? FOR UPDATE',[mid,tid]);if(!m)fail('Match not found.',404);if(!['scheduled','unscheduled'].includes(m.status)||Number(m.stats_processed)||Number(m.report_finalized)||m.home_submission||m.away_submission)fail('A started, reported or closed fixture cannot be rescheduled here.');return {t,m};}
async function list(tid,q=EXECUTESQL){return (await q("SELECT * FROM league_entities WHERE entity_type='tournament_schedule_change' AND JSON_UNQUOTE(JSON_EXTRACT(data_json,'$.tournament_id'))=? ORDER BY created_date,id",[tid])).map(unpack).map(c=>({id:c.id,match_id:c.match_id,status:c.status,revision:c.revision,starts_at:c.starts_at,reason:c.reason,participant_type:c.participant_type,participant_ids:c.participant_ids,accepted_ids:Object.keys(c.accepted_by||{})}));}
async function save(c,q){await q("INSERT INTO league_entities (id,entity_type,status,data_json) VALUES (?,'tournament_schedule_change',?,?) ON DUPLICATE KEY UPDATE status=VALUES(status),data_json=VALUES(data_json),updated_date=NOW()",[c.id,c.status,JSON.stringify(c)]);}
async function audit(user,before,after,q){if(user.role_id!=null&&[0,2].includes(Number(user.role_id)))await q('INSERT INTO admin_audit_log (id,admin_user_id,admin_email,action,entity_type,entity_id,old_value,new_value,reason) VALUES (?,?,?,?,?,?,?,?,?)',[uuid(),user.id,user.email,'tournament_schedule_change','match',after.match_id,JSON.stringify(before),JSON.stringify(after),after.reason]);}
async function notify(c,event,q){const {resolveDelivery,parseMaybeJson}=require('./notificationPreferenceService');for(const participant of c.participant_ids){let email;if(c.participant_type==='club')email=(await require('./clubContactService').resolveClubPresidentContact({clubId:participant,query:q,forUpdate:true})).email;else {const [p]=await q('SELECT COALESCE(u.email,p.email) AS email FROM players p LEFT JOIN users u ON u.id=p.user_id WHERE p.id=?',[participant]);email=p?.email;}if(!email)fail('A participating contact is unavailable; the schedule action was not saved.');const [p]=await q('SELECT notification_settings FROM players WHERE LOWER(email)=LOWER(?) LIMIT 1',[email]);if(!resolveDelivery(parseMaybeJson(p?.notification_settings,{}),'match_reminders').inApp)continue;await q('INSERT INTO notifications (id,recipient_email,type,title,body,link,related_id,idempotency_key) VALUES (?,?,?,?,?,?,?,?)',[uuid(),email,'match_scheduled',event==='proposed'?'Tournament schedule change requested':event==='approved'?'Tournament schedule change agreed':'Tournament schedule change closed',`${c.starts_at} (UTC). ${event==='proposed'?'The existing kickoff remains until both participants accept.':event==='approved'?'Review the agreed kickoff on GameDay.':'The existing kickoff is unchanged.'}`,`/tournaments/${encodeURIComponent(c.tournament_id)}`,c.id,`tournament_change:${c.id}:${event}:${participant}`]);}}
async function propose(tid,body,actor){return withTransaction(async q=>{
 const {t,m}=await writable(tid,body.match_id,q),user=await schedules.assertOrganizer(t,actor,q);
 if(!/^[a-f0-9-]{36}$/i.test(String(body.decision_id||''))||!String(body.reason||'').trim())fail('Provide a stable proposal ID and reason.',422);
 const at=Date.parse(body.starts_at);if(!Number.isFinite(at)||at<=Date.now()||!/(Z|[+-]\d{2}:\d{2})$/.test(String(body.starts_at)))fail('Provide a future kickoff with an explicit timezone.',422);
 const kind=t.participant_type==='player'?'player':'club',ids=[m[`home_${kind}_id`],m[`away_${kind}_id`]].filter(Boolean);if(ids.length!==2||ids[0]===ids[1])fail('Both participating sides must be known.');
 const before=snapshot(m),c={id:body.decision_id,tournament_id:tid,match_id:m.id,participant_type:kind,participant_ids:ids,status:'pending',starts_at:new Date(at).toISOString(),reason:body.reason,match_snapshot:before,accepted_by:{},proposed_by:user.id};c.revision=revision({match:before,starts_at:c.starts_at,reason:c.reason});
 const [stored]=await q('SELECT * FROM league_entities WHERE id=? FOR UPDATE',[c.id]);if(stored){const old=unpack(stored);if(stored.entity_type!=='tournament_schedule_change'||old.revision!==c.revision)fail('The proposal ID already refers to another change.');return {change:old,already_applied:true};}
 const pending=await q("SELECT id FROM league_entities WHERE entity_type='tournament_schedule_change' AND status='pending' AND JSON_UNQUOTE(JSON_EXTRACT(data_json,'$.match_id'))=? FOR UPDATE",[m.id]);if(pending.length)fail('A schedule change is already awaiting participant responses.');
 await save(c,q);await notify(c,'proposed',q);await audit(user,null,c,q);return {change:c,kickoff_changed:false};
});}
async function respond(tid,id,body,actor){return withTransaction(async q=>{
 const [source]=await q("SELECT * FROM league_entities WHERE id=? AND entity_type='tournament_schedule_change'",[id]);if(!source||unpack(source).tournament_id!==tid)fail('Schedule change not found.',404);
 const preliminary=unpack(source),{t,m}=await writable(tid,preliminary.match_id,q);
 const [locked]=await q("SELECT * FROM league_entities WHERE id=? AND entity_type='tournament_schedule_change' FOR UPDATE",[id]);const c=unpack(locked),before=structuredClone(c);
 let who;if(body.action==='cancel')who={user:await schedules.assertOrganizer(t,actor,q)};else {who=await schedules.assertParticipant(t,body,actor,q);if(!c.participant_ids.includes(who.participant))fail('Only an affected participant may respond.',403);}
 if(c.status!=='pending'){if(c.status==='approved'&&c.accepted_by[who.participant]&&body.action==='accept')return {already_applied:true,change:c,kickoff_changed:true};if(c.status===({decline:'declined',cancel:'cancelled'}[body.action]))return {already_applied:true,change:c,kickoff_changed:false};fail('This proposal is closed.');}
 if(c.revision!==body.revision||revision(snapshot(m))!==revision(c.match_snapshot))fail('The reviewed match or proposal changed. Reload before responding.');
 if(body.action==='cancel'||body.action==='decline'){c.status=body.action==='cancel'?'cancelled':'declined';await save(c,q);await notify(c,c.status,q);await audit(who.user,before,c,q);return {change:c,kickoff_changed:false};}
 if(body.action!=='accept')fail('Choose accept, decline or cancel.',422);
 if(c.accepted_by[who.participant])return {already_applied:true,change:c,kickoff_changed:false};
 if(Date.parse(c.starts_at)<=Date.now())fail('The proposed kickoff has passed.');
 c.accepted_by[who.participant]={user_id:who.user.id,accepted_at:new Date().toISOString()};
 if(c.participant_ids.every(id=>c.accepted_by[id])){
  const date=c.starts_at.replace('T',' ').slice(0,19),minutes=require('./officialPlayerConflictService').duration(m),plan={tournament_id:tid,mode:'fixed',include_own_matches:true,ignore_match_id:m.id,entries:[{starts_at:c.starts_at,ends_at:new Date(Date.parse(c.starts_at)+minutes*60000).toISOString(),minutes}]};
  for(const participant of [...c.participant_ids].sort())await schedules.checkConflicts(plan,{kind:c.participant_type,participant},q);
  const override={id:v5(`tournament_schedule_override:${m.id}`,v5.URL),match_id:m.id,tournament_id:tid,change_id:c.id,starts_at:c.starts_at,minutes,accepted_by:c.accepted_by,original_match:c.match_snapshot,status:'applied'};
  await q("INSERT INTO league_entities (id,entity_type,status,data_json) VALUES (?,'tournament_schedule_override','applied',?) ON DUPLICATE KEY UPDATE data_json=VALUES(data_json),updated_date=NOW()",[override.id,JSON.stringify(override)]);
  await q("UPDATE matches SET scheduled_date=?,confirmed_date=?,timezone='UTC',scheduling_status='confirmed',status='scheduled',home_proposed_date=NULL,away_proposed_date=NULL,last_proposed_by=NULL,updated_date=NOW() WHERE id=?",[date,date,m.id]);
  await q("UPDATE competition_fixtures SET scheduled_at=?,confirmed_at=?,status='scheduled',scheduling_status='confirmed',updated_date=NOW() WHERE match_id=? AND legacy_fixture_type='tournament_match'",[date,date,m.id]);
  c.status='approved';c.applied_at=new Date().toISOString();await notify(c,'approved',q);
 }
 await save(c,q);await audit(who.user,before,c,q);return {change:c,kickoff_changed:c.status==='approved'};
});}
module.exports={list,propose,respond};

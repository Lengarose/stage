'use strict';
const {EXECUTESQL,withTransaction}=require('../db/database');
const {v5:uuid,v4}=require('uuid');
const crypto=require('node:crypto');
const {unpack}=require('../models/competitionScopeModel');
const {matchWindows}=require('../lib/officialMatchWindows');
const {isValidTimeZone}=require('../utils/datetime');
const VERSION='organizer_schedule_v1';
const fail=(message,status=409)=>{throw Object.assign(Error(message),{status});};
const scheduleId=id=>uuid(`organizer_schedule:${id}`,uuid.URL);
const consentId=(id,kind,participant)=>uuid(`organizer_schedule_consent:${id}:${kind}:${participant}`,uuid.URL);
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const rules=t=>Object.fromEntries(['rules_template_id','custom_rules','rules_file_url','type','participant_type','max_teams','entry_credits','entry_fee_stc','prize_pool_stc','prize_winner_stc','prize_runner_up_stc','prize_semi_final_stc','prize_participation_stc','trophy_item_id'].map(key=>[key,t[key]??null]));
const parse=value=>typeof value==='string'?JSON.parse(value):value||[];
async function stored(id,q=EXECUTESQL){const [row]=await q("SELECT * FROM league_entities WHERE id=? AND entity_type='tournament_schedule'",[scheduleId(id)]);return row?unpack(row):null;}
async function tournament(id,q){const [row]=await q('SELECT * FROM tournaments WHERE id=? FOR UPDATE',[id]);if(!row)fail('Tournament not found.',404);return row;}
async function organizer(t,actor,q){const [user]=await q('SELECT id,email,role_id FROM users WHERE id=? LIMIT 1',[actor?.id]);if(!user)fail('Authentication required.',401);const players=await q('SELECT id FROM players WHERE user_id=?',[user.id]);const admin=user.role_id!=null&&[0,2].includes(Number(user.role_id));if(!admin&&![t.creator_email,t.organizer_email].filter(Boolean).some(e=>e.toLowerCase()===String(user.email).toLowerCase())&&!players.some(p=>p.id===t.creator_id))fail('Only this tournament organizer or Admin can publish its schedule.',403);return {...user,isAdmin:admin};}
function validate(body){
 if(!['fixed','windows'].includes(body.mode)||!isValidTimeZone(body.timezone))fail('Choose fixed times or bounded windows and a valid competition timezone.',422);
 if(!Array.isArray(body.entries)||!body.entries.length||body.entries.length>500)fail('Provide the schedule rounds.',422);
 const keys=new Set();
 const entries=body.entries.map(e=>{const key=`${e.phase}:${e.round}`;if(typeof e.phase!=='string'||!/^[a-z0-9_-]{1,40}$/.test(e.phase)||!Number.isInteger(e.round)||e.round<1||keys.has(key))fail('Use unique phase/round schedule entries.',422);keys.add(key);const start=Date.parse(e.starts_at),end=Date.parse(e.ends_at),minutes=['league','league_phase','group','group_stage','ucl_league','regional_league'].includes(e.phase)?40:60;
 if(!Number.isFinite(start)||!Number.isFinite(end)||end-start<minutes*60000||!/(Z|[+-]\d{2}:\d{2})$/.test(String(e.starts_at))||!/(Z|[+-]\d{2}:\d{2})$/.test(String(e.ends_at)))fail('Every round needs explicit timezone-aware start/end times and room for its match block.',422);
 if(body.mode==='fixed'&&end-start!==minutes*60000)fail('Fixed rounds reserve exactly 40 league minutes or 60 knockout minutes.',422);
 return {phase:e.phase,round:e.round,starts_at:new Date(start).toISOString(),ends_at:new Date(end).toISOString(),minutes};});
 return {mode:body.mode,timezone:body.timezone,entries:entries.sort((a,b)=>a.starts_at.localeCompare(b.starts_at)||a.phase.localeCompare(b.phase)||a.round-b.round)};
}
async function read(id){const [t]=await EXECUTESQL('SELECT * FROM tournaments WHERE id=?',[id]);if(!t)fail('Tournament not found.',404);const plan=await stored(id);return {changes:await require('./tournamentScheduleChangeService').list(id),required:t.schedule_policy_version===VERSION,schedule:plan,rules_current:!plan||hash(rules(t))===plan.rules_revision};}
async function publish(id,body,actor){return withTransaction(async q=>{
 const t=await tournament(id,q),user=await organizer(t,actor,q),before=await stored(id,q);
 if(t.status!=='registration')fail('Publish a tournament schedule before play starts. Started or archived schedules require the existing Admin exception process.');
 const field=[...parse(t.registered_clubs),...parse(t.registered_players)];
 if(field.length)fail('Participants already entered under the published conditions. Do not replace their schedule without an approved change and renewed consent.');
 const spec=validate(body),revision=hash([spec,rules(t)]);
 if(before?.revision===revision)return {schedule:before,already_applied:true};
 if(before && body.expected_revision!==before.revision)fail('The published schedule changed. Reload before replacing it.');
 const plan={id:scheduleId(id),tournament_id:id,version:VERSION,status:'published',...spec,rules_snapshot:rules(t),rules_revision:hash(rules(t)),revision,published_by:user.id,published_at:new Date().toISOString()};
 await q("INSERT INTO league_entities (id,entity_type,status,data_json) VALUES (?,'tournament_schedule','published',?) ON DUPLICATE KEY UPDATE data_json=VALUES(data_json),updated_date=NOW()",[plan.id,JSON.stringify(plan)]);
 await q('UPDATE tournaments SET schedule_policy_version=?,updated_date=NOW() WHERE id=?',[VERSION,id]);
 if(user.isAdmin)await q('INSERT INTO admin_audit_log (id,admin_user_id,admin_email,action,entity_type,entity_id,old_value,new_value,reason) VALUES (?,?,?,?,?,?,?,?,?)',[v4(),user.id,user.email,'publish_tournament_schedule','tournament',id,JSON.stringify(before),JSON.stringify(plan),body.reason||'Published schedule before participation']);
 return {schedule:plan};
});}
async function owner(t,body,actor,q){const player=t.participant_type==='player',participant=player?body.player_id:body.club_id;if(!participant)fail('Choose the participating player or club.',422);const [user]=await q('SELECT id,email FROM users WHERE id=?',[actor?.id]);if(!user)fail('Authentication required.',401);
 const [record]=player?await q('SELECT * FROM players WHERE id=?',[participant]):await q('SELECT * FROM clubs WHERE id=?',[participant]);if(!record)fail('Participant not found.',404);
 const own=player?(record.user_id===user.id||String(record.email||'').toLowerCase()===String(user.email).toLowerCase()):[record.president_user_id,record.user_id].includes(user.id)||String(record.owner_email||'').toLowerCase()===String(user.email).toLowerCase();if(!own)fail('Only the player or club president can accept participation conditions.',403);return {participant,kind:player?'player':'club',user};}
async function accept(id,body,actor){return withTransaction(async q=>{const t=await tournament(id,q);if(t.status!=='registration')fail('Tournament registration is closed.');const plan=await stored(id,q);if(!plan||plan.revision!==body.revision||hash(rules(t))!==plan.rules_revision)fail('Review the current published schedule and rules before accepting.');const who=await owner(t,body,actor,q);await assertConflicts(plan,who,q);const record={id:consentId(id,who.kind,who.participant),tournament_id:id,participant_id:who.participant,participant_type:who.kind,status:'accepted',revision:plan.revision,schedule_snapshot:plan,accepted_by:who.user.id,accepted_at:new Date().toISOString()};const [old]=await q("SELECT * FROM league_entities WHERE id=? AND entity_type='tournament_schedule_consent'",[record.id]);if(old&&unpack(old).revision===plan.revision)return {accepted:true,already_applied:true};await q("INSERT INTO league_entities (id,entity_type,status,data_json) VALUES (?,'tournament_schedule_consent','accepted',?) ON DUPLICATE KEY UPDATE data_json=VALUES(data_json),updated_date=NOW()",[record.id,JSON.stringify(record)]);return {accepted:true,revision:plan.revision};});}
async function assertEntry(t,kind,participant,q){if(t.schedule_policy_version!==VERSION)return;const plan=await stored(t.id,q);if(!plan||hash(rules(t))!==plan.rules_revision)fail('The organizer must publish the current schedule and rules before entry.');const [row]=await q("SELECT * FROM league_entities WHERE id=? AND entity_type='tournament_schedule_consent'",[consentId(t.id,kind,participant)]);if(!row||unpack(row).revision!==plan.revision)fail('Accept the published schedule and rules before entering this tournament.');await assertConflicts(plan,{kind,participant},q);}
async function assertConflicts(plan,who,q){
 await q(`SELECT id FROM ${who.kind==='club'?'clubs':'players'} WHERE id=? FOR UPDATE`,[who.participant]);
 const rows=who.kind==='club'
  ? await q("SELECT * FROM matches WHERE (home_club_id=? OR away_club_id=?) AND status NOT IN ('cancelled','canceled','reset','superseded','abandoned','voided') AND (confirmed_date IS NOT NULL OR scheduled_date IS NOT NULL) ORDER BY id FOR UPDATE",[who.participant,who.participant])
  : await q(`SELECT DISTINCT m.* FROM matches m
      LEFT JOIN competition_fixtures cf ON cf.match_id=m.id
      LEFT JOIN club_fixture_lineups l ON l.status='published' AND l.fixture_id IN (m.id,m.source_fixture_id,cf.id,cf.legacy_fixture_id)
      WHERE (m.home_player_id=? OR m.away_player_id=? OR JSON_CONTAINS(COALESCE(l.starting_players,JSON_ARRAY()),JSON_QUOTE(?)) OR JSON_CONTAINS(COALESCE(l.bench_players,JSON_ARRAY()),JSON_QUOTE(?)))
       AND m.status NOT IN ('cancelled','canceled','reset','superseded','abandoned','voided') AND (m.confirmed_date IS NOT NULL OR m.scheduled_date IS NOT NULL) ORDER BY m.id FOR UPDATE`,[who.participant,who.participant,who.participant,who.participant]);
 let clubBlocks=null;
 if(who.kind==='club'){
  const inventory=await new (require('../models/officialScheduleModel').OfficialScheduleModel)().events([who.participant],q);
  const excluded=new Set([plan.ignore_match_id].filter(Boolean));
  if(!plan.include_own_matches)for(const m of inventory.matches.filter(m=>m.tournament_id===plan.tournament_id)){excluded.add(m.id);if(m.source_fixture_id)excluded.add(m.source_fixture_id);}
  clubBlocks=require('../lib/officialCalendarLoad').busyEvents(inventory,excluded).map(e=>[e.instant,e.instant+e.minutes*60000]);
 }
 for(const e of plan.entries) {
  const start=Date.parse(e.starts_at),end=Date.parse(e.ends_at);
  const busy=(clubBlocks||rows.filter(m=>m.id!==plan.ignore_match_id && (plan.include_own_matches || m.tournament_id!==plan.tournament_id)).map(m=>{const at=Date.parse(matchWindows(m).kickoff_at);return [at,at+require('./officialPlayerConflictService').duration(m)*60000];})).filter(([a,b])=>start<b&&a<end).sort((a,b)=>a[0]-b[0]);
  if(plan.mode==='fixed' && busy.length)fail('The published tournament schedule overlaps an existing match. Resolve participation or scheduling before entry.',422);
  if(plan.mode==='windows') {let cursor=start;for(const [a,b] of busy){if(cursor+e.minutes*60000<=a)break;cursor=Math.max(cursor,b);}if(cursor+e.minutes*60000>end)fail('No complete match block remains in this playing window because of existing matches.',422);}
 }
}
async function forMatch(t,match,q=EXECUTESQL){if(t.schedule_policy_version!==VERSION)return match;const plan=await stored(t.id,q);if(!plan)fail('Publish the tournament schedule before drawing fixtures.');const entry=plan.entries.find(e=>e.phase===(match.type||'knockout')&&e.round===Number(match.round));if(!entry)fail('The published schedule has no entry for this fixture phase and round.');
 if(plan.mode==='fixed'){await assertConflicts({...plan,entries:[entry],include_own_matches:true,ignore_match_id:match.id},{kind:t.participant_type==='player'?'player':'club',participant:match[t.participant_type==='player'?'home_player_id':'home_club_id']},q);await assertConflicts({...plan,entries:[entry],include_own_matches:true,ignore_match_id:match.id},{kind:t.participant_type==='player'?'player':'club',participant:match[t.participant_type==='player'?'away_player_id':'away_club_id']},q);return {...match,scheduled_date:entry.starts_at.replace('T',' ').slice(0,19),confirmed_date:entry.starts_at.replace('T',' ').slice(0,19),timezone:'UTC',status:'scheduled',scheduling_status:'confirmed'};}
 return {...match,status:'unscheduled',scheduling_status:'open',scheduled_date:null,confirmed_date:null};}
async function assertMatch(t,match,schedule,q){if(t.schedule_policy_version!==VERSION)return;const plan=await stored(t.id,q);let entry=plan?.entries.find(e=>e.phase===(match.type||'knockout')&&e.round===Number(match.round));if(!entry)fail('No published schedule applies to this round.');
 const [override]=match.id?await q("SELECT * FROM league_entities WHERE id=? AND entity_type='tournament_schedule_override' AND status='applied'",[uuid(`tournament_schedule_override:${match.id}`,uuid.URL)]):[];
 if(override){const approved=unpack(override);entry={...entry,starts_at:approved.starts_at,ends_at:new Date(Date.parse(approved.starts_at)+approved.minutes*60000).toISOString(),minutes:approved.minutes};}
const start=Date.parse(matchWindows({...match,confirmed_date:schedule,scheduled_date:schedule}).kickoff_at);if(plan.mode==='fixed'||override?start!==Date.parse(entry.starts_at):start<Date.parse(entry.starts_at)||start+entry.minutes*60000>Date.parse(entry.ends_at))fail('This kickoff is outside the participant-accepted tournament schedule.');
 const kind=t.participant_type==='player'?'player':'club';
 const ids=[match[`home_${kind}_id`],match[`away_${kind}_id`]].filter(Boolean).sort();
 if(ids.length)await q(`SELECT id FROM ${kind==='player'?'players':'clubs'} WHERE id IN (${ids.map(()=>'?').join(',')}) ORDER BY id FOR UPDATE`,ids);
 for(const participant of ids)await assertConflicts({...plan,mode:'fixed',entries:[{...entry,starts_at:new Date(start).toISOString(),ends_at:new Date(start+entry.minutes*60000).toISOString()}],include_own_matches:true,ignore_match_id:match.id},{kind,participant},q);
}
function assertDraw(matches) {
 const blocks=matches.filter(m=>m.scheduled_date).map(m=>({m,start:Date.parse(matchWindows(m).kickoff_at),minutes:require('./officialPlayerConflictService').duration(m),ids:[m.home_club_id,m.away_club_id,m.home_player_id,m.away_player_id].filter(Boolean)}));
 for(let i=0;i<blocks.length;i++)for(let j=0;j<i;j++){const a=blocks[i],b=blocks[j];if(a.start<b.start+b.minutes*60000&&b.start<a.start+a.minutes*60000&&a.ids.some(id=>b.ids.includes(id)))fail('The published rounds give a participant overlapping fixtures. Correct the schedule before drawing.');}
}
function assertTermsEditable(t,patch) {
 if(t.schedule_policy_version!==VERSION)return;
 if(['schedule_policy_version','registered_clubs','registered_players','registration_proofs','creator_id','creator_email','organizer_email'].some(k=>Object.hasOwn(patch,k)) || patch.status && patch.status!==t.status)fail('Use the protected tournament participation, schedule and lifecycle actions.');
 if([...parse(t.registered_clubs),...parse(t.registered_players)].length && Object.keys(rules(t)).some(k=>Object.hasOwn(patch,k)&&String(patch[k])!==String(t[k])))fail('Participant-accepted competition conditions cannot be silently changed. Resolve the accepted-condition review first.');
}
module.exports={VERSION,validate,read,publish,accept,assertEntry,forMatch,assertMatch,assertOrganizer:organizer,assertTermsEditable,assertDraw,assertParticipant:owner,checkConflicts:assertConflicts};

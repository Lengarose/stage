'use strict';
const { v4: uuid, v5 } = require('uuid');
const { EXECUTESQL, withTransaction } = require('../db/database');
const model = require('../models/tournamentReserveModel');
const schedules = require('./tournamentScheduleService');
const { activeParticipants } = require('../lib/tournamentStartPolicy');
const parse = (v, fallback = {}) => { try { return typeof v === 'string' ? JSON.parse(v) : v || fallback; } catch { return fallback; } };
const fail = (message, status = 409) => { throw Object.assign(Error(message), { status }); };
const live = r => ['waiting','invited','submitted','entered'].includes(r.status);
async function load(id, q) {
  const [t] = await q('SELECT * FROM tournaments WHERE id=? FOR UPDATE', [id]);
  if (!t) fail('Tournament not found.',404);
  return t;
}
async function windowFor(t, q, now = Date.now()) {
  const matches = await q('SELECT * FROM matches WHERE tournament_id=?', [t.id]);
  const [row] = await q("SELECT * FROM league_entities WHERE entity_type='tournament_schedule' AND JSON_UNQUOTE(JSON_EXTRACT(data_json,'$.tournament_id'))=?", [t.id]);
  const policy = require('./tournamentWithdrawalService').policy(t,matches,row ? parse(row.data_json) : null,null,now);
  const deadlines = [policy.first_kickoff_at, t.registration_closes_at, t.registration_deadline].filter(Boolean).map(Date.parse).filter(Number.isFinite);
  const closes = Math.min(...deadlines);
  return { open: t.status === 'registration' && !policy.started && closes > now, closes, matches };
}
function occupied(t) {
  const proofs = parse(t.registration_proofs).club || {};
  return activeParticipants(t).length + Object.values(proofs).filter(p => p?.status === 'pending').length;
}
async function notice(t, record, event, q, extraEmails = []) {
  const [club] = await q('SELECT c.*,COALESCE(u.email,c.owner_email) AS contact_email FROM clubs c LEFT JOIN users u ON u.id=COALESCE(c.president_user_id,c.user_id) WHERE c.id=?',[record.club_id]);
  const emails = new Set([club?.contact_email,...extraEmails].filter(Boolean).map(e => String(e).toLowerCase()));
  const text = event === 'invited' ? `A place is reserved exclusively for ${record.club_name} until ${record.expires_at} (UTC). Open the tournament, read and accept the current schedule and rules, then complete normal registration and payment before this deadline. Joining the waiting list was free. ${record.vacated_club_id ? 'After entry approval, the organizer must confirm the inherited fixture slot before the tournament can start.' : ''}` : event === 'expired' ? 'Your exclusive invitation has expired. No entry payment was taken for the waiting list. The next eligible club may now be invited.' : event === 'replaced' ? `${record.club_name} has replaced the withdrawn club in its existing fixture slot. The group/bracket position, opponents and kickoff times are unchanged. Review the tournament and confirm your match squad again.` : 'Your reserve entry has been submitted. If review is required, the place is held until the organizer decides. This is not a change to the published playing schedule.';
  for (const email of emails) {
    const id = v5(`tournament_reserve:${record.id}:${event}:${email}`,v5.URL);
    await q("INSERT INTO inbox_messages (id,recipient_email,sender_email,sender_gamertag,subject,body,message_type,action_type,related_entity_id,related_entity_type,idempotency_key,is_system) VALUES (?,?,'system@stage.com','STAGE Tournaments',?,?,'general','none',?,'tournament',?,1) ON DUPLICATE KEY UPDATE id=id",[id,email,`Tournament reserve ${event} — ${t.name}`,`Dear Manager,\n\n${text}\n\nTournament: ${t.name}\n/tournaments/${t.id}\n\nSTAGE Tournaments`,t.id,`tournament_reserve:${id}`]);
  }
}
async function eligibility(t, clubId, q) {
  const [club] = await q('SELECT * FROM clubs WHERE id=?',[clubId]);
  if (!club) return { reason:'Club no longer exists.' };
  if (t.country_code && club.country_code !== t.country_code) return { reason:'Club does not meet the country restriction.' };
  const roster = await require('./tournamentSquadService').roster(clubId,q);
  if (roster.length < require('./tournamentSquadService').publishedRules(t).minimum_human_players) return { reason:'Club no longer meets the minimum eligible squad requirement.' };
  return { club };
}
// Called under the tournament root lock, including from registration and withdrawal.
async function reconcile(t, q) {
  const rows = await model.selectAll(t.id,q);
  if (!rows.some(live)) return rows;
  const now = Date.now(), window = await windowFor(t,q,now);
  for (const r of rows.filter(r => r.status === 'invited')) {
    if (!window.open || Date.parse(r.expires_at) <= now) { r.status='expired'; await model.update(r,q); await notice(t,r,'expired',q); }
  }
  if (!window.open || rows.some(r => r.status === 'invited') || occupied(t) >= Number(t.max_teams)) return rows;
  const proofs = parse(t.registration_proofs).club || {};
  // Each drawn vacancy has one explicit replacement; pending approvals already occupy a seat.
  const outgoing = window.matches.length ? Object.keys(proofs).filter(id => proofs[id].status === 'withdrawn' && proofs[id].withdrawal_resolution_required && window.matches.some(m => [m.home_club_id,m.away_club_id].includes(id)) && !rows.some(r => ['invited','submitted','entered'].includes(r.status) && r.vacated_club_id === id && !r.slot_confirmed_at)) : [];
  if (window.matches.length && !outgoing.length) return rows;
  for (const r of rows.filter(r => r.status === 'waiting')) {
    const eligible = await eligibility(t,r.club_id,q);
    if (eligible.reason || activeParticipants(t).includes(r.club_id) || proofs[r.club_id]?.status === 'pending') { r.status='ineligible'; r.closed_reason=eligible.reason || 'Club already has an entry.'; await model.update(r,q); continue; }
    r.status='invited'; r.invited_at=new Date(now).toISOString(); r.expires_at=new Date(Math.min(now+86400000,window.closes)).toISOString(); r.vacated_club_id=outgoing[0] || null;
    await model.update(r,q); await notice(t,r,'invited',q); break;
  }
  return rows;
}
async function assertEntry(t, clubId, q) {
  const rows = await reconcile(t,q);
  const own = [...rows].reverse().find(r => r.club_id === clubId);
  const invitation = rows.find(r => r.status === 'invited');
  if (invitation && invitation.club_id !== clubId) fail('This place is reserved for the next club on the waiting list.');
  if (own && (own.status === 'waiting' || (rows.some(r=>['waiting','invited'].includes(r.status)) && ['expired','declined','ineligible','left'].includes(own.status)))) fail('Your club needs a current reserve invitation before registering.');
  if (own?.status === 'invited' && Date.parse(own.expires_at) <= Date.now()) fail('The reserve invitation has expired.');
  // A publicly available post-draw vacancy also needs the same explicit slot handoff,
  // even when nobody was waiting. No queue member is bypassed by this branch.
  if (!rows.some(r=>['waiting','invited'].includes(r.status)) && !['submitted','entered'].includes(own?.status) && occupied(t)<Number(t.max_teams)) {
    const window=await windowFor(t,q),proofs=parse(t.registration_proofs).club || {};
    if(window.matches.length){
      const outgoing=Object.keys(proofs).find(id=>proofs[id].status==='withdrawn'&&proofs[id].withdrawal_resolution_required&&window.matches.some(m=>[m.home_club_id,m.away_club_id].includes(id))&&!rows.some(r=>['submitted','entered'].includes(r.status)&&r.vacated_club_id===id&&!r.slot_confirmed_at));
      if(!outgoing)fail('The organizer must resolve the available fixture slot before another entry.');
      const [club]=await q('SELECT name FROM clubs WHERE id=?',[clubId]);
      await model.create({id:uuid(),tournament_id:t.id,club_id:clubId,club_name:club?.name || 'Club',status:'invited',queue_sequence:Math.max(0,...rows.map(r=>Number(r.queue_sequence)||0))+1,joined_at:new Date().toISOString(),expires_at:new Date(Math.min(Date.now()+86400000,window.closes)).toISOString(),vacated_club_id:outgoing,entry_source:'unreserved_vacancy'},q);
    }
  }
}
async function registrationChanged(t, clubId, q) {
  const rows = await model.selectAll(t.id,q), r = [...rows].reverse().find(r => r.club_id === clubId && ['invited','submitted'].includes(r.status));
  if (r) {
    const status = parse(t.registration_proofs).club?.[clubId]?.status;
    r.status = status === 'pending' ? 'submitted' : status === 'approved' ? 'entered' : 'declined';
    r.registration_at = new Date().toISOString(); await model.update(r,q);
    if (r.status !== 'declined') await notice(t,r,'submitted',q);
  }
  return reconcile(t,q);
}
async function read(id, context, actor) {
  return withTransaction(async q => {
    const t=await load(id,q); let organizer=false,who=null;
    try { await schedules.assertOrganizer(t,actor,q); organizer=true; } catch(e) { if(e.status!==403)throw e; }
    if(context.club_id)try { who=await schedules.assertParticipant(t,context,actor,q); } catch(e) { if(![403,404].includes(e.status))throw e; }
    const rows=await reconcile(t,q),window=await windowFor(t,q),own=[...rows].reverse().find(r=>r.club_id===who?.participant),proof=parse(t.registration_proofs).club?.[who?.participant];
    return { organizer,can_act:Boolean(who),can_register:Boolean(who)&&window.open&&(!rows.some(r=>r.status==='invited')||own?.status==='invited')&&own?.status!=='waiting'&&(!rows.some(r=>['waiting','invited'].includes(r.status))||!own||!['expired','declined','ineligible','left'].includes(own.status)),open:window.open,entry:own || null,position:own?.status==='waiting' ? rows.filter(r=>r.status==='waiting'&&r.queue_sequence<=own.queue_sequence).length : null,can_join:Boolean(who)&&window.open&&t.participant_type!=='player'&&!activeParticipants(t).includes(who.participant)&&proof?.status!=='pending'&&proof?.status!=='withdrawn'&&(!own||!live(own))&&(occupied(t)>=Number(t.max_teams)||rows.some(r=>['waiting','invited'].includes(r.status))),entries:organizer?rows.map(r=>({...r,slot_fixtures:r.vacated_club_id&&!r.slot_confirmed_at?window.matches.filter(m=>[m.home_club_id,m.away_club_id].includes(r.vacated_club_id)).map(m=>({id:m.id,home:m.home_club_name,away:m.away_club_name,round:m.round,kickoff:m.confirmed_date||m.scheduled_date})):[]})):[],waiting_count:rows.filter(r=>r.status==='waiting').length };
  });
}
async function join(id, body, actor) {
  return withTransaction(async q => {
    const t=await load(id,q),who=await schedules.assertParticipant(t,body,actor,q);
    if(t.participant_type==='player')fail('This waiting list is for club tournaments.',422);
    if(!(await windowFor(t,q)).open)fail('The reserve waiting list is closed.');
    const proofs=parse(t.registration_proofs).club || {};
    if(activeParticipants(t).includes(who.participant)||['pending','withdrawn'].includes(proofs[who.participant]?.status))fail('This club already has an entry or withdrawal in this tournament.');
    const rows=await reconcile(t,q),existing=[...rows].reverse().find(r=>r.club_id===who.participant&&live(r));
    if(existing)return {success:true,entry:existing,already_applied:true};
    if(occupied(t)<Number(t.max_teams)&&!rows.some(r=>['waiting','invited'].includes(r.status)))fail('A normal place is available. Accept the schedule and register directly.');
    const eligible=await eligibility(t,who.participant,q); if(eligible.reason)fail(eligible.reason);
    const r={id:uuid(),tournament_id:id,club_id:who.participant,club_name:eligible.club.name,status:'waiting',joined_at:new Date().toISOString(),joined_by:who.user.id,queue_sequence:Math.max(0,...rows.map(r=>Number(r.queue_sequence)||0))+1};
    await model.create(r,q); await reconcile(t,q); return {success:true,entry:await model.selectOne(r.id,q)};
  });
}
async function leave(id, entryId, body, actor) {
  return withTransaction(async q => {
    const t=await load(id,q),who=await schedules.assertParticipant(t,body,actor,q),r=await model.selectOne(entryId,q);
    if(!r||r.tournament_id!==id||r.club_id!==who.participant)fail('Reserve entry not found.',404);
    if(['left','declined'].includes(r.status))return {success:true,already_applied:true};
    if(!['waiting','invited'].includes(r.status))fail('Use the tournament withdrawal process for a submitted or approved entry.');
    r.status=r.status==='invited'?'declined':'left'; await model.update(r,q); await reconcile(t,q); return {success:true};
  });
}
async function replaceSlot(id, entryId, body, actor) {
  return withTransaction(async q => {
    const t=await load(id,q),user=await schedules.assertOrganizer(t,actor,q),r=await model.selectOne(entryId,q);
    if(!r||r.tournament_id!==id)fail('Reserve entry not found.',404);
    if(r.slot_confirmed_at)return {success:true,already_applied:true};
    if(!String(body.reason||'').trim())fail('Explain the slot replacement.',422);
    const window=await windowFor(t,q),proofs=parse(t.registration_proofs),old=r.vacated_club_id;
    if(!window.open||r.status!=='entered'||!old||proofs.club?.[old]?.status!=='withdrawn'||proofs.club?.[r.club_id]?.status!=='approved')fail('A replacement requires an approved reserve entry and withdrawn slot before play starts.');
    const matches=await q('SELECT * FROM matches WHERE tournament_id=? FOR UPDATE',[id]);
    if(matches.some(m=>!['scheduled','unscheduled'].includes(m.status)||Number(m.stats_processed)||Number(m.report_finalized)||m.home_submission||m.away_submission))fail('No fixture replacement is permitted after match activity.');
    const affected=matches.filter(m=>[m.home_club_id,m.away_club_id].includes(old)); if(!affected.length)fail('The withdrawn fixture slot no longer exists.');
    const [club]=await q('SELECT c.*,COALESCE(u.email,c.owner_email) AS contact_email FROM clubs c LEFT JOIN users u ON u.id=COALESCE(c.president_user_id,c.user_id) WHERE c.id=?',[r.club_id]);
    if(!club)fail('Replacement club no longer exists.');
    for(const m of affected) {
      if([m.home_club_id,m.away_club_id].includes(r.club_id))fail('Replacement would create a match against the same club.');
      const side=m.home_club_id===old?'home':'away';
      // Participant-specific preparation must never transfer to another club.
      const stats=await q('SELECT id FROM match_player_stats WHERE match_id=? LIMIT 1',[m.id]);if(stats.length)fail('Existing player statistics require an explicit match review.');
      await q(`UPDATE matches SET ${side}_club_id=?,${side}_club_name=?,${side}_owner_email=?,updated_date=NOW() WHERE id=?`,[club.id,club.name,club.contact_email,m.id]);
      await q(`UPDATE competition_fixtures SET ${side}_participant_id=?,${side}_club_id=?,${side}_club_name=?,${side}_owner_email=?,updated_date=NOW() WHERE match_id=? AND legacy_fixture_type='tournament_match'`,[club.id,club.id,club.name,club.contact_email,m.id]);
      const frozen=await q("SELECT id FROM league_entities WHERE entity_type IN ('club_match_selection','official_match_selection') AND JSON_UNQUOTE(JSON_EXTRACT(data_json,'$.match_id'))=?",[m.id]);
      const liveMatches=await q('SELECT id FROM live_matches WHERE match_id=?',[m.id]);
      if(frozen.length||liveMatches.length)fail('Kickoff or live-match activity requires explicit match review; a reserve cannot inherit it.');
      await q('DELETE FROM club_fixture_lineups WHERE fixture_id IN (?,?)',[m.id,m.source_fixture_id || m.id]);
      await q('DELETE FROM dressing_rooms WHERE match_id=?',[m.id]);
      const changes=await q("SELECT * FROM league_entities WHERE entity_type='tournament_schedule_change' AND status='pending' AND JSON_UNQUOTE(JSON_EXTRACT(data_json,'$.match_id'))=?",[m.id]);
      for(const c of changes){const data=parse(c.data_json);data.status='cancelled';data.reason='Participant replaced before play; submit a new proposal if needed.';await q("UPDATE league_entities SET status='cancelled',data_json=? WHERE id=?",[JSON.stringify(data),c.id]);}
    }
    proofs.club[old]={...proofs.club[old],withdrawal_resolution_required:false,replaced_by_club_id:club.id};
    const registered=parse(t.registered_clubs,[]).filter(cid=>cid!==old);
    await q('UPDATE tournaments SET registered_clubs=?,registration_proofs=?,updated_date=NOW() WHERE id=?',[JSON.stringify(registered),JSON.stringify(proofs),id]);
    const withdrawalModel=require('../models/tournamentWithdrawalModel'),withdrawal=await withdrawalModel.selectOne(proofs.club[old].withdrawal_id,q);
    if(withdrawal){withdrawal.status='resolved';withdrawal.decision_reason=body.reason;withdrawal.replaced_by_club_id=club.id;withdrawal.decided_by=user.id;await withdrawalModel.update(withdrawal,q);}
    r.slot_confirmed_at=new Date().toISOString();r.slot_confirmed_by=user.id;r.reason=String(body.reason).slice(0,2000);r.match_ids=affected.map(m=>m.id);await model.update(r,q);
    if(user.isAdmin)await require('./rewardConfigurationService').audit(q,user,'tournament_reserve_replace_slot','tournament',id,{club_id:old,matches:affected},r,r.reason);
    const ids=[...new Set(affected.flatMap(m=>[m.home_club_id,m.away_club_id]))];
    const contacts=await q(`SELECT COALESCE(u.email,c.owner_email) AS email FROM clubs c LEFT JOIN users u ON u.id=COALESCE(c.president_user_id,c.user_id) WHERE c.id IN (${ids.map(()=>'?').join(',')})`,ids);
    await notice(t,r,'replaced',q,[t.creator_email,t.organizer_email,...contacts.map(c=>c.email)]);
    await reconcile({...t,registered_clubs:registered,registration_proofs:proofs},q);
    return {success:true,entry:r};
  });
}
let cursor='',running=false;
async function tick() {
  if(running)return;running=true;
  try {
    let rows=await EXECUTESQL("SELECT DISTINCT t.id FROM tournaments t JOIN league_entities r ON r.season_id=t.id AND r.entity_type='tournament_reserve' AND r.status IN ('waiting','invited') WHERE t.id>? ORDER BY t.id LIMIT 100",[cursor]);
    if(!rows.length){cursor='';return;}
    for(const row of rows){cursor=row.id;try{await withTransaction(async q=>reconcile(await load(row.id,q),q));}catch(e){console.error('[tournament reserves]',row.id,e.message);}}
  } finally {running=false;}
}
function startJob(){const timer=setInterval(()=>tick().catch(e=>console.error('[tournament reserves]',e.message)),60000);timer.unref();return timer;}
module.exports={read,join,leave,replaceSlot,reconcile,assertEntry,registrationChanged,windowFor,occupied,tick,startJob};

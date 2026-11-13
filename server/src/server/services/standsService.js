'use strict';
const { EXECUTESQL, withTransaction } = require('../db/database');
const { StandsModel, recordId } = require('../models/standsModel');
const policy = require('../lib/standsPolicy');
const { v4: id } = require('uuid');
const model = new StandsModel();
async function auditOwnAction(user,action,mid,before,after,q){if(user.role_id!=null&&[0,2].includes(Number(user.role_id)))await q('INSERT INTO admin_audit_log (id,admin_user_id,admin_email,action,entity_type,entity_id,old_value,new_value,reason) VALUES (?,?,?,?,?,?,?,?,?)',[id(),user.id,user.email,action,'match',mid,JSON.stringify(before),JSON.stringify(after),'Admin used a personal Stands action']);}
const fail = (message,status=409) => { throw Object.assign(Error(message),{status}); };
async function actor(auth,q=EXECUTESQL) { const [u]=await q('SELECT id,email,role_id FROM users WHERE id=?',[auth?.id]); if(!u)fail('Sign in to use The Stands.',401); return u; }
function stream(value) { try { const u=new URL(value); return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password ? u.href : null; } catch { return null; } }
function present(m) {
  const confirmed=require('../lib/tournamentStatistics').isConfirmedResult(m);
  return { id:m.id,home_name:m.home_club_name||m.home_player_name||'Home',away_name:m.away_club_name||m.away_player_name||'Away',home_avatar:m.home_club_avatar||m.home_player_avatar||null,away_avatar:m.away_club_avatar||m.away_player_avatar||null,home_id:m.home_club_id||m.home_player_id,away_id:m.away_club_id||m.away_player_id,club_match:Boolean(m.home_club_id||m.away_club_id),status:m.status,phase:m.type,round:m.round,kickoff:policy.kickoff(m),competition_key:policy.competition(m),competition_name:m.tournament_name||String(m.source_fixture_type||'Match').replaceAll('_',' '),home_score:m.home_score,away_score:m.away_score,score_status:confirmed?'Confirmed result':m.status==='completed'?'Awaiting confirmation':m.status==='in_progress'?'Match in progress':'Scheduled',streams:[{side:'home',url:stream(m.home_stream_url)},{side:'away',url:stream(m.away_stream_url)},{side:'match',url:stream(m.stream_url)}].filter(s=>s.url),normal_time_required:policy.knockout(m) };
}
async function affiliation(user,m,q=EXECUTESQL) {
  const players=await q('SELECT id,club_id,email FROM players WHERE user_id=? OR LOWER(TRIM(email))=LOWER(TRIM(?))',[user.id,user.email]);
  const ids=new Set(players.map(p=>String(p.id))),clubs=[m.home_club_id,m.away_club_id].filter(Boolean);
  if([m.home_player_id,m.away_player_id].some(p=>ids.has(String(p))) || [m.home_player_email,m.away_player_email,m.home_owner_email,m.away_owner_email].some(e=>e&&e.toLowerCase()===user.email.toLowerCase()))return 'You cannot predict your own match or your club’s match.';
  if(clubs.some(c=>players.some(p=>p.club_id===c)))return 'You are a member of a participating club.';
  if(clubs.length){
    const marks=clubs.map(()=>'?').join(',');
    const clubRows=await q(`SELECT * FROM clubs WHERE id IN (${marks})`,clubs);
    if(clubRows.some(c=>[c.user_id,c.president_user_id].includes(user.id)||ids.has(String(c.president_player_id))||String(c.owner_email||'').toLowerCase()===user.email.toLowerCase()))return 'Club managers cannot predict their own club’s match.';
    const memberships=await q(`SELECT * FROM club_memberships WHERE club_id IN (${marks}) AND status='active'`,clubs);
    if(memberships.some(r=>r.user_id===user.id||ids.has(String(r.player_id))))return 'Your active club membership prevents this prediction.';
    const staff=await q(`SELECT * FROM club_staff_roles WHERE club_id IN (${marks})`,clubs);
    if(staff.some(r=>r.user_id===user.id||ids.has(String(r.player_id))))return 'Club staff cannot predict their own club’s match.';
    const contracts=await q(`SELECT user_id FROM player_contracts WHERE team_id IN (${marks}) AND status IN ('active','pending_window')`,clubs);
    if(contracts.some(r=>r.user_id===user.id||ids.has(String(r.user_id))))return 'Your contract links you to a participating club.';
    const agreements=await q(`SELECT data_json FROM league_entities WHERE entity_type='club_agreement' AND club_id IN (${marks}) AND status='active'`,clubs);
    if(agreements.map(r=>policy.parse(r.data_json)).some(r=>r.user_id===user.id||ids.has(String(r.player_id))))return 'Your club agreement prevents this prediction.';
  }
  const refs=[m.id,m.source_fixture_id].filter(Boolean),marks=refs.map(()=>'?').join(',');
  const squads=await q(`SELECT starting_players,bench_players FROM club_fixture_lineups WHERE fixture_id IN (${marks}) AND status='published'`,refs);
  if(squads.some(r=>[...policy.parse(r.starting_players,[]),...policy.parse(r.bench_players,[])].some(p=>ids.has(String(typeof p==='object'?p.id:p)))))return 'Players selected for this match cannot predict it.';
  const captures=await q("SELECT data_json FROM league_entities WHERE entity_type='official_match_selection' AND JSON_UNQUOTE(JSON_EXTRACT(data_json,'$.match_id'))=?",[m.id]);
  if(captures.some(r=>JSON.stringify(policy.parse(r.data_json).selections||{}).split('"').some(v=>ids.has(v))))return 'Your saved match selection prevents this prediction.';
  return null;
}
async function started(m,q=EXECUTESQL) { return (await q("SELECT id FROM live_matches WHERE match_id=? AND status IN ('live','in_progress','completed') LIMIT 1",[m.id])).length || (await q("SELECT id FROM league_entities WHERE entity_type='official_match_selection' AND JSON_UNQUOTE(JSON_EXTRACT(data_json,'$.match_id'))=? LIMIT 1",[m.id])).length; }
async function directory(query) { return {matches:(await model.directory(query)).map(present)}; }
async function detailedMatch(mid) { return (await model.directory({limit:1},async(sql,args)=>{ // Use the same projection joins with a single explicit ID.
  const start=sql.indexOf(' WHERE ');return EXECUTESQL(sql.slice(0,start)+' WHERE m.id=? LIMIT 1',[mid]);
}))[0]; }
async function positions(m) {
  const ids=[m.home_club_id||m.home_player_id,m.away_club_id||m.away_player_id];
  if(m.tournament_id&&['league','group','group_stage','ucl_league'].includes(m.type)){
    const all=await EXECUTESQL('SELECT * FROM matches WHERE tournament_id=?',[m.tournament_id]);
    const rows=['group','group_stage'].includes(m.type)?all.filter(r=>r.group_number===m.group_number):all;
    const phase=['group','group_stage'].includes(m.type)?'group':m.type==='ucl_league'?'ucl_league':'league';
    const table=require('../lib/standingsCore').calculateStandings(rows,{phase,participant_type:m.home_player_id?'player':'club'}).rows;
    return table.filter(r=>ids.includes(r.id)&&r.P>0).map(r=>({name:r.name,position:r.rank,played:r.P,points:r.Pts}));
  }
  const key=policy.competition(m);if(!key)return [];
  const root=key.slice(key.indexOf(':')+1),rows=await EXECUTESQL("SELECT data_json FROM league_entities WHERE entity_type IN ('regional_league_standing','competition_standing') AND (league_id=? OR season_id=?)",[root,root]);
  const table=rows.map(r=>policy.parse(r.data_json)).sort((a,b)=>Number(b.points||0)-Number(a.points||0)||Number(b.goal_difference||0)-Number(a.goal_difference||0)||Number(b.goals_for||0)-Number(a.goals_for||0));
  return table.filter(r=>ids.includes(r.club_id)&&Number(r.played)>0).map(r=>({name:r.club_name,position:table.findIndex(t=>Number(t.points)===Number(r.points)&&Number(t.goal_difference)===Number(r.goal_difference)&&Number(t.goals_for)===Number(r.goals_for))+1,played:r.played,points:r.points}));
}
async function detail(mid,auth) {
  const user=await actor(auth),m=await detailedMatch(mid);if(!m)fail('Match not found.',404);
  const cutoff=await model.selectOne('cutoff',mid),lock=policy.lockState(m,cutoff,await started(m)),own=await model.selectOne('prediction',`${user.id}:${mid}`);
  const reason=await affiliation(user,m);const reg=await model.selectOne('regulation',mid);
  const history=await EXECUTESQL("SELECT * FROM matches WHERE id<>? AND status='completed' AND ((home_club_id IN (?,?) OR away_club_id IN (?,?)) OR (home_player_id IN (?,?) OR away_player_id IN (?,?))) ORDER BY COALESCE(confirmed_date,scheduled_date,created_date) DESC LIMIT 30",[mid,m.home_club_id,m.away_club_id,m.home_club_id,m.away_club_id,m.home_player_id,m.away_player_id,m.home_player_id,m.away_player_id]);
  const confirmed=history.filter(require('../lib/tournamentStatistics').isConfirmedResult);
  const both=r=>m.home_club_id?[r.home_club_id,r.away_club_id].includes(m.home_club_id)&&[r.home_club_id,r.away_club_id].includes(m.away_club_id):[r.home_player_id,r.away_player_id].includes(m.home_player_id)&&[r.home_player_id,r.away_player_id].includes(m.away_player_id);
  const predictions=lock.locked?(await predictionsForMatch(mid)).map(p=>({name:p.name,home_score:p.home_score,away_score:p.away_score})):[];
  return {match:present(m),lock,eligible:!reason&&!lock.locked&&!policy.closed.has(m.status),reason:reason||(!lock.closes_at?'A confirmed kickoff is required.':lock.locked?'Predictions are closed for this match.':null),prediction:own?{...own,outcome:await predictionOutcome(user,m,own,reg)}:null,predictions,reminder:await model.selectOne('reminder',`${user.id}:${mid}`),context:{positions:await positions(m),recent:confirmed.slice(0,6).map(present),head_to_head:confirmed.filter(both).slice(0,6).map(present)},is_admin:user.role_id!=null&&[0,2].includes(Number(user.role_id)),regulation:reg?{home_score:reg.home_score,away_score:reg.away_score,current:reg.result_fingerprint===policy.fingerprint(m)}:null};
}
async function predictionsForMatch(mid,q=EXECUTESQL) { return (await q("SELECT data_json FROM league_entities WHERE entity_type='stands_prediction' AND season_id=?",[mid])).map(r=>policy.parse(r.data_json)); }
async function savePrediction(mid,body,auth) {
  return withTransaction(async q=>{
    const user=await actor(auth,q),m=await model.match(mid,q,true);if(!m)fail('Match not found.',404);
    if(!policy.competition(m))fail('Prediction rankings require a competition edition.');
    const cutoff=await model.selectOne('cutoff',mid,q),lock=policy.lockState(m,cutoff,await started(m,q));if(lock.locked)fail('Predictions are closed.');
    const reason=await affiliation(user,m,q);if(reason)fail(reason,403);
    if(policy.lockState(m,cutoff,await started(m,q)).locked)fail('Predictions closed while your request was being checked.');
    const home=policy.score(body.home_score),away=policy.score(body.away_score);
    const [p]=await q('SELECT gamertag FROM players WHERE user_id=? LIMIT 1',[user.id]);
    const key=`${user.id}:${mid}`,previous=await model.selectOne('prediction',key,q);
    const value={user_id:user.id,match_id:mid,competition_key:policy.competition(m),name:p?.gamertag||'Spectator',home_score:home,away_score:away,submitted_at:previous?.submitted_at||new Date().toISOString(),updated_at:new Date().toISOString()};
    await model.create('cutoff',mid,{match_id:mid,closes_at:lock.closes_at},q);await model.create('prediction',key,value,q);await auditOwnAction(user,'stands_prediction',mid,previous,value,q);return {prediction:value};
  });
}
async function history(auth,{limit=24,offset=0}={}) {
  const user=await actor(auth);const rows=await EXECUTESQL("SELECT e.data_json,m.*,t.name AS tournament_name FROM league_entities e JOIN matches m ON m.id=e.season_id LEFT JOIN tournaments t ON t.id=m.tournament_id WHERE e.entity_type='stands_prediction' AND JSON_UNQUOTE(JSON_EXTRACT(e.data_json,'$.user_id'))=? ORDER BY e.updated_date DESC LIMIT ? OFFSET ?",[user.id,Math.min(50,Math.max(1,Math.floor(Number(limit)||24))),Math.min(100000,Math.max(0,Math.floor(Number(offset)||0)))]);
  const regs=await model.selectAll('regulation'),reg=new Map(regs.map(r=>[r.match_id,r]));
  return {predictions:await Promise.all(rows.map(async r=>{const p=policy.parse(r.data_json);return {match:present(r),prediction:{home_score:p.home_score,away_score:p.away_score},outcome:await predictionOutcome(user,r,p,reg.get(r.id))};}))};
}
async function participantAtKickoff(user,m,q=EXECUTESQL) {
  const at=policy.kickoff(m);if(!at)return false;
  const ps=await q('SELECT id FROM players WHERE user_id=? OR LOWER(TRIM(email))=LOWER(TRIM(?))',[user.id,user.email]);const ids=new Set(ps.map(p=>String(p.id)));
  if([m.home_player_id,m.away_player_id].some(v=>ids.has(String(v))))return true;
  const clubs=[m.home_club_id,m.away_club_id].filter(Boolean);
  if(clubs.length){const marks=clubs.map(()=>'?').join(',');
    const contracts=await q(`SELECT user_id FROM player_contracts WHERE team_id IN (${marks}) AND status IN ('active','terminated','expired','completed') AND start_date<=? AND (end_date IS NULL OR end_date>=?)`,[...clubs,at,at]);
    if(contracts.some(r=>r.user_id===user.id||ids.has(String(r.user_id))))return true;
    const memberships=await q(`SELECT player_id,user_id FROM club_memberships WHERE club_id IN (${marks}) AND created_date<=? AND (status='active' OR updated_date>=?)`,[...clubs,at,at]);
    if(memberships.some(r=>r.user_id===user.id||ids.has(String(r.player_id))))return true;
    const agreements=await q(`SELECT data_json FROM league_entities WHERE entity_type='club_agreement' AND club_id IN (${marks})`,clubs);
    if(agreements.map(r=>policy.parse(r.data_json)).some(r=>(r.user_id===user.id||ids.has(String(r.player_id)))&&Date.parse(r.starts_at)<=Date.parse(at)&&Date.parse(r.ends_at)>=Date.parse(at)))return true;
  }
  const captures=await q("SELECT data_json FROM league_entities WHERE entity_type='official_match_selection' AND JSON_UNQUOTE(JSON_EXTRACT(data_json,'$.match_id'))=?",[m.id]);
  return captures.map(r=>policy.parse(r.data_json)).some(r=>r.started_by_user_id===user.id||JSON.stringify(r.selections||{}).split('"').some(v=>ids.has(v)));
}
async function predictionOutcome(user,m,p,reg){const result=policy.outcome(m,p,reg);return result.status==='settled'&&await participantAtKickoff(user,m)?{status:'excluded_participant',exact:null}:result;}
async function rankings(key) {
  const rows=await EXECUTESQL("SELECT e.data_json,m.*,t.name AS tournament_name FROM league_entities e JOIN matches m ON m.id=e.season_id LEFT JOIN tournaments t ON t.id=m.tournament_id WHERE e.entity_type='stands_prediction' AND JSON_UNQUOTE(JSON_EXTRACT(e.data_json,'$.competition_key'))=?",[key]);
  const regs=new Map((await model.selectAll('regulation')).map(r=>[r.match_id,r]));
  const entries=[];
  for(const r of rows){const p=policy.parse(r.data_json);const [u]=await EXECUTESQL('SELECT id,email FROM users WHERE id=?',[p.user_id]);if(!u)continue; if(await participantAtKickoff(u,r))continue;entries.push({...p,outcome:policy.outcome(r,p,regs.get(r.id))});}
  return {minimum_predictions:5,rankings:policy.leaderboard(entries,5)};
}
async function reminder(mid,body,auth) { return withTransaction(async q=>{const u=await actor(auth,q),m=await model.match(mid,q,true);if(!m)fail('Match not found.',404);const at=policy.kickoff(m);if(!at||Date.parse(at)<=Date.now()||!['scheduled','confirmed'].includes(m.status))fail('Reminders require an upcoming scheduled match.');const value={match_id:mid,user_id:u.id,email:u.email,status:body.enabled===false?'cancelled':'active'};const previous=await model.selectOne('reminder',`${u.id}:${mid}`,q);await model.create('reminder',`${u.id}:${mid}`,value,q);await auditOwnAction(u,'stands_reminder',mid,previous,value,q);return value;}); }
async function adminAction(mid,body,auth,kind) {return withTransaction(async q=>{const u=await actor(auth,q);if(u.role_id==null||![0,2].includes(Number(u.role_id)))fail('Admin access required.',403);const m=await model.match(mid,q,true);if(!m)fail('Match not found.',404);const before=await model.selectOne(kind,mid,q);let value;
 if(kind==='feature')value={match_id:mid,status:body.enabled===false?'inactive':'active'};
 else {if(!require('../lib/tournamentStatistics').isConfirmedResult(m)||m.status==='forfeit')fail('Confirm the played result before recording its normal-time score.');if(!String(body.reason||'').trim())fail('Explain the source of the verified 90-minute score.',422);value={match_id:mid,home_score:policy.score(body.home_score),away_score:policy.score(body.away_score),result_fingerprint:policy.fingerprint(m),confirmed_by:u.id};}
 await model.create(kind,mid,value,q);await q('INSERT INTO admin_audit_log (id,admin_user_id,admin_email,action,entity_type,entity_id,old_value,new_value,reason) VALUES (?,?,?,?,?,?,?,?,?)',[id(),u.id,u.email,`stands_${kind}`,'match',mid,JSON.stringify(before),JSON.stringify(value),body.reason||'STAGE featured match selection']);return value;
});}
let running=false;
async function deliverReminder(row) {
  return withTransaction(async q=>{
    const key=`${row.user_id}:${row.match_id}`;
    const [lock]=await q('SELECT id FROM league_entities WHERE id=? FOR UPDATE',[recordId('reminder',key)]);if(!lock)return null;
    const current=await model.selectOne('reminder',key,q);if(current?.status!=='active')return null;
    const m=await model.match(row.match_id,q),[user]=await q('SELECT email FROM users WHERE id=?',[row.user_id]);
    if(!user||!m||policy.closed.has(m.status)||['completed','forfeit'].includes(m.status)){await model.update('reminder',key,{...current,status:'cancelled'},q);return null;}
    const at=policy.kickoff(m);if(!at||Date.parse(at)-Date.now()>15*60000)return null;
    if(Date.parse(at)<Date.now()-10*60000){await model.update('reminder',key,{...current,status:'expired'},q);return null;}
    const notice={id:recordId('reminder_notice',`${key}:${at}`),recipient_email:user.email,type:'match_scheduled',title:'Your broadcast reminder',body:`${m.home_club_name||m.home_player_name||'Home'} vs ${m.away_club_name||m.away_player_name||'Away'} starts at ${at}. A stream link does not guarantee the channel is broadcasting.`,link:`/the-stands?match=${m.id}`,related_id:m.id,read:0};
    const created=await q('INSERT IGNORE INTO notifications (id,recipient_email,type,title,body,link,related_id,idempotency_key) VALUES (?,?,?,?,?,?,?,?)',[notice.id,notice.recipient_email,notice.type,notice.title,notice.body,notice.link,m.id,notice.id]);
    await model.update('reminder',key,{...current,status:'sent'},q);
    return created.affectedRows===1?notice:null;
  });
}
async function remind() {
  if(running)return;running=true;
  try { for(const row of (await model.selectAll('reminder')).filter(r=>r.status==='active')){
    try{const notice=await deliverReminder(row);if(notice)await Promise.resolve(require('../utils/socketBroadcast').broadcastNotification(notice)).catch(()=>{});}
    catch(e){console.error('[stands reminder]',row.match_id,e.message);}
  }}catch(e){console.error('[stands reminders]',e.message);}finally{running=false;}
}
let reminderTimer;
function start(){if(!reminderTimer){reminderTimer=setInterval(remind,60000);reminderTimer.unref();}return reminderTimer;}
async function competitions(){const rows=await EXECUTESQL("SELECT DISTINCT m.tournament_id,m.source_fixture_type,m.competition_context,t.name AS tournament_name FROM matches m LEFT JOIN tournaments t ON t.id=m.tournament_id WHERE m.tournament_id IS NOT NULL OR m.competition_context IS NOT NULL LIMIT 1000");const values=new Map();for(const m of rows){const key=policy.competition(m);if(!key)continue;let name=m.tournament_name;if(!name){const raw=policy.parse(m.competition_context,null),edition=raw&&typeof raw==='object'?raw.edition_id||raw.season_id||raw.competition_season_id||raw.league_id:m.competition_context;const [r]=await EXECUTESQL('SELECT data_json FROM league_entities WHERE id=?',[edition]);const e=policy.parse(r?.data_json);name=[e.name||e.competition_name||String(m.source_fixture_type||'Competition').replaceAll('_',' '),e.region?String(e.region).replaceAll('-',' '):null,e.season_number?`Season ${e.season_number}`:null,e.group_code?`Group ${e.group_code}`:null].filter(Boolean).join(' · ');}values.set(key,{key,name});}return {competitions:[...values.values()].sort((a,b)=>a.name.localeCompare(b.name))};}
module.exports={competitions,tick:remind,directory,detail,savePrediction,history,rankings,reminder,adminAction,start,affiliation,present};

'use strict';
const { randomUUID } = require('crypto');
const { withTransaction, EXECUTESQL } = require('../db/database');
const { ClubBoardModel, stableId } = require('../models/clubBoardModel');
const { markContractInboxStatus } = require('./contractRulesService');
const model = new ClubBoardModel();
const parse = value => { if (typeof value !== 'string') return value || {}; try { return JSON.parse(value); } catch { return {}; } };
const final = status => ['completed','finished','ended','archived','cancelled','canceled','retired','withdrawn','rejected','void','voided','bye'].includes(String(status || '').toLowerCase());
const fail = (message,status) => { throw Object.assign(new Error(message),{status}); };
const ids = value => { const rows = parse(value); return Array.isArray(rows) ? rows.map(r=>String(typeof r === 'object' ? r.club_id || r.id : r)) : []; };

async function assertNoActiveCompetition(q, clubId) {
  const roots = await q("SELECT * FROM league_entities WHERE entity_type IN ('regional_league','competition_season','regional_cup_edition') FOR UPDATE");
  const withdrawals = await q("SELECT * FROM league_entities WHERE entity_type='regional_withdrawal' AND club_id=? AND status='applied'",[clubId]);
  const withdrawn = new Set(withdrawals.map(r=>String(r.league_id)));
  for (const row of roots) {
    const root = {...parse(row.data_json), id:row.id, status:row.status || parse(row.data_json).status};
    if (final(root.status) || root.edition_invalidated || withdrawn.has(String(row.id))) continue;
    if (['registered_clubs','registered_club_ids','participant_ids'].some(key=>ids(root[key]).includes(String(clubId)))) {
      fail(`This club is entered in ${root.name || root.competition_name || 'an active competition'}. Admin must resolve its withdrawal and fixtures before the club can be deleted.`,409);
    }
  }
  const tournaments = await q("SELECT id,name,status,registered_clubs FROM tournaments WHERE participant_type='club' FOR UPDATE");
  if(tournaments.some(t=>!final(t.status) && ids(t.registered_clubs).includes(String(clubId)))) fail('This club is entered in an active tournament. Its withdrawal must be resolved before deletion.',409);
  const matches = await q("SELECT id,tournament_id,source_fixture_type,status FROM matches WHERE (home_club_id=? OR away_club_id=?) AND status NOT IN ('completed','played','forfeit','cancelled','canceled','void','voided','bye') FOR UPDATE",[clubId,clubId]);
  if(matches.some(m=>m.tournament_id || m.source_fixture_type)) fail('Competition fixtures still involve this club. Admin must resolve the withdrawal before deletion.',409);
}

async function closeClub(q, clubId, club, actor, repair = false, reason = null) {
  const receiptId=stableId(['club_dissolution',clubId]);
  const [existing]=await q("SELECT id FROM league_entities WHERE entity_type='club_dissolution' AND id=? FOR UPDATE",[receiptId]);
  if(existing)return {success:true,already_applied:true,club_id:clubId};
  const contracts=await q("SELECT * FROM player_contracts WHERE team_id=? AND status IN ('active','pending','pending_window','negotiating') FOR UPDATE",[clubId]);
  const players=await q("SELECT * FROM players WHERE club_id=? OR id IN (SELECT user_id FROM player_contracts WHERE team_id=? AND status IN ('active','pending','pending_window','negotiating')) OR id IN (SELECT player_id FROM club_memberships WHERE club_id=? AND status='active') OR id IN (SELECT JSON_UNQUOTE(JSON_EXTRACT(data_json,'$.player_id')) FROM league_entities WHERE club_id=? AND entity_type IN ('club_agreement','club_contract_proposal')) FOR UPDATE",[clubId,clubId,clubId,clubId]);
  const boardRows=await q("SELECT * FROM league_entities WHERE club_id=? AND entity_type IN ('club_agreement','club_contract_proposal','season_registration') FOR UPDATE",[clubId]);
  const now=new Date();
  for(const row of boardRows){
    const data={...parse(row.data_json),id:row.id};
    if(final(data.status) || ['expired','terminated','declined','superseded'].includes(data.status))continue;
    if(row.entity_type==='club_agreement'){
      data.original_ends_at=data.ends_at;data.ends_at=new Date(Math.min(now.getTime(),Date.parse(data.ends_at) || now.getTime())).toISOString();
      const player=players.find(p=>p.id===data.player_id);
      if(club && player && data.status==='active')await require('./clubAgreementService').accrue(data,club,player,q,now);
      data.status='terminated';data.termination_reason='club_dissolved';
      if(repair)data.closure_finance_review=true;
    }else {data.status=row.entity_type==='season_registration'?'withdrawn':'cancelled';data.closed_reason='club_dissolved';}
    await q('UPDATE league_entities SET status=?,data_json=?,updated_date=NOW() WHERE id=?',[data.status,JSON.stringify(data),row.id]);
    await q("UPDATE inbox_messages SET status='cancelled',is_read=1 WHERE related_entity_id=? AND status IN ('pending','unread')",[row.id]);
  }
  await q("UPDATE player_contracts SET status=CASE WHEN status='active' THEN 'terminated' ELSE 'cancelled' END,end_date=LEAST(COALESCE(end_date,NOW()),NOW()),updated_date=NOW() WHERE team_id=? AND status IN ('active','pending','pending_window','negotiating')",[clubId]);
  await markContractInboxStatus({contractIds:contracts.map(c=>c.id),status:'cancelled',query:q});
  await q("UPDATE club_memberships SET status='inactive',updated_date=NOW() WHERE club_id=? AND status='active'",[clubId]);
  await q('DELETE FROM club_staff_roles WHERE club_id=?',[clubId]);
  await q("UPDATE players SET club_id=NULL,role='member',club_roles=JSON_ARRAY('member'),status='free_agent',updated_date=NOW() WHERE club_id=?",[clubId]);
  // An old orphaned contract must never detach a player from a different current club.
  for(const player of players)if(!player.club_id)await q("UPDATE players SET status='free_agent',role='member',club_roles=JSON_ARRAY('member'),updated_date=NOW() WHERE id=? AND club_id IS NULL",[player.id]);
  await q('UPDATE users SET owner_id=NULL,updated_date=NOW() WHERE owner_id=?',[clubId]);
  await q('UPDATE clubs SET president_id=NULL WHERE id=?',[clubId]);
  await q('DELETE FROM presidents WHERE club_id=?',[clubId]);
  await q("UPDATE club_applicants SET status='cancelled',updated_date=NOW() WHERE club_id=? AND status IN ('pending','approved','accepted')",[clubId]);
  await q("UPDATE matches SET status='cancelled',updated_date=NOW() WHERE (home_club_id=? OR away_club_id=?) AND tournament_id IS NULL AND source_fixture_type IS NULL AND status IN ('scheduled','unscheduled','pending','in_progress')",[clubId,clubId]);
  const name=club?.name || 'your former club';
  const affected=new Set(players.filter(p=>!p.club_id || String(p.club_id)===String(clubId)).map(p=>p.id));
  const recipients=new Set(players.filter(p=>affected.has(p.id) || contracts.some(c=>c.user_id===p.id&&c.status==='active')).map(p=>p.email).filter(Boolean));
  for(const email of recipients){
    const player=players.find(p=>p.email===email);
    const available=affected.has(player?.id);
    const body=`Dear ${player?.gamertag || 'Player'},\n\n${name} has closed and will no longer operate on STAGE. All of your playing and management contracts with this club have been terminated, and any outstanding offers from it have been cancelled.\n\n${available?'You have been released and are now a free agent. You can review offers from other clubs or start a new club.':'Your membership of your current club remains unchanged.'} Your player profile, earned achievements and match history remain yours. Previous payments and any recorded outstanding amounts remain in the financial history; closing the club does not mark unpaid wages as paid.\n\nYou can find your current club and agreement status on your profile and in Club Office. Thank you for being part of the club’s journey—we look forward to seeing your next chapter on STAGE.\n\nThe STAGE Team`;
    const key=`club_dissolved:${clubId}:${email}`,messageId=stableId([key]);
    await q("INSERT INTO inbox_messages (id,recipient_email,sender_email,sender_gamertag,subject,body,message_type,action_type,status,is_read,is_system,related_entity_id,related_entity_type,metadata,idempotency_key) VALUES (?,?,?,'STAGE Team',?,?, 'contract_terminated','none','completed',0,1,?,'club_dissolution',?,?) ON DUPLICATE KEY UPDATE id=id",[messageId,email,'system@stage.com',`${name} has closed — your contract status`,body,receiptId,JSON.stringify({club_id:clubId,club_name:name,free_agent:available}),key]);
    await q("INSERT INTO notifications (id,recipient_email,type,title,body,link,related_id,idempotency_key) VALUES (?,?,'contract_terminated',?,?,'/inbox',?,?) ON DUPLICATE KEY UPDATE id=id",[stableId(['notice',key]),email,'Club closed — contract ended',`${name} has closed. Open your Inbox for your release notice.`,receiptId,key]);
  }
  const receipt={id:receiptId,club_id:clubId,club_name:name,status:'completed',closed_at:now.toISOString(),repair,contracts_before:contracts,board_before:boardRows,released_player_ids:[...affected],recipient_count:recipients.size};
  await q("INSERT INTO league_entities (id,entity_type,club_id,status,data_json) VALUES (?,'club_dissolution',?,'completed',?)",[receiptId,clubId,JSON.stringify(receipt)]);
  await model.audit(actor,'club_dissolved',clubId,club || {id:clubId,missing:true},{id:receiptId,released_player_ids:[...affected],contract_ids:contracts.map(c=>c.id)},repair?'Repair contract links left behind by a previously deleted club':reason || 'Manager confirmed club closure',q);
  if(club)await q('DELETE FROM clubs WHERE id=?',[clubId]);
  return {success:true,club_id:clubId,released_player_ids:[...affected]};
}
async function dissolveClub({clubId,user,reason}){
  const result=await withTransaction(async q=>{
    await model.lock(clubId,q);
    const [club]=await q('SELECT * FROM clubs WHERE id=? FOR UPDATE',[clubId]);
    if(!club)fail('Club not found',404);
    const [player]=await q('SELECT id FROM players WHERE user_id=? LIMIT 1',[user.id]);
    const owner=club.user_id===user.id || club.president_user_id===user.id || club.president_player_id===player?.id || (club.owner_email && String(club.owner_email).toLowerCase()===String(user.email).toLowerCase());
    if(!owner && ![0,2].includes(Number(user.role_id)))fail('Only the club manager or Admin can delete this club',403);
    await assertNoActiveCompetition(q,clubId);
    return closeClub(q,clubId,club,user,false,reason);
  });
  require('../utils/socketBroadcast').broadcastClubDeleted(clubId);
  for(const id of result.released_player_ids || []){const [player]=await EXECUTESQL('SELECT * FROM players WHERE id=?',[id]).catch(()=>[]);if(player)require('../utils/socketBroadcast').broadcastPlayer(player);}
  const receiptId=stableId(['club_dissolution',clubId]);
  const messages=await EXECUTESQL("SELECT * FROM inbox_messages WHERE related_entity_id=? AND related_entity_type='club_dissolution'",[receiptId]).catch(()=>[]);
  for(const message of messages)require('../utils/socketBroadcast').broadcastInbox(message);
  return result;
}
async function repairDeletedClubContracts(){
  const rows=await EXECUTESQL("SELECT DISTINCT p.team_id AS id FROM player_contracts p LEFT JOIN clubs c ON c.id=p.team_id WHERE c.id IS NULL AND p.status IN ('active','pending','pending_window','negotiating') UNION SELECT DISTINCT e.club_id AS id FROM league_entities e LEFT JOIN clubs c ON c.id=e.club_id WHERE c.id IS NULL AND e.club_id IS NOT NULL AND e.entity_type IN ('club_agreement','club_contract_proposal') AND e.status IN ('active','pending','negotiating')");
  for(const {id} of rows)await withTransaction(async q=>{await model.lock(id,q);const [club]=await q('SELECT id FROM clubs WHERE id=? FOR UPDATE',[id]);if(!club)await closeClub(q,id,null,{email:'system@stage.com'},true);});
  return {repaired:rows.length};
}
module.exports={dissolveClub,repairDeletedClubContracts,assertNoActiveCompetition};

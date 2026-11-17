'use strict';
const parse=value=>typeof value==='string'?JSON.parse(value||'{}'):(value||{});
const fail=message=>{throw Object.assign(new Error(message),{status:409});};
async function accept({message,userEmail,action='accepted',createMatch,transaction,repair=false,actor=null}){
 return transaction(async query=>{
  const context=await require('./matchInviteCorrespondenceService').context(message,query);
  const [root]=await query('SELECT * FROM inbox_messages WHERE id = ? LIMIT 1 FOR UPDATE',[context.root_invitation_id]);
  if(!root)fail('The original match invitation is unavailable.');
  const current=root.id===message.id?root:(await query('SELECT * FROM inbox_messages WHERE id = ? LIMIT 1 FOR UPDATE',[message.id]))[0];
  if(!current||String(current.recipient_email).toLowerCase()!==String(userEmail).toLowerCase())fail('This invitation does not belong to your Inbox.');
  const meta={...context,...parse(current.metadata)},rootMeta=parse(root.metadata);
  const {toMysqlDateTime}=require('../utils/datetime');
  const date=toMysqlDateTime(meta.scheduled_date);if(!date)fail('A valid proposed kickoff time is required.');
  const participantIds=[meta.challenger_club_id,meta.opponent_club_id,meta.challenger_player_id,meta.opponent_player_id];
  const wrongIds=[...participantIds,root.id,meta.original_message_id].filter(Boolean);
  const oldBroken=repair && meta.reschedule_request && ['accepted','confirmed'].includes(current.status) && !meta.created_match_id && !rootMeta.created_match_id && wrongIds.includes(current.related_entity_id);
  if(current.status && current.status!=='pending' && !oldBroken)fail('This proposal has already been answered.');
  if(root.id!==current.id && ['accepted','confirmed','declined'].includes(root.status) && !oldBroken)fail('This negotiation has already been resolved.');
  let matchId=rootMeta.created_match_id||meta.created_match_id||(current.related_entity_type==='match'&&!wrongIds.includes(current.related_entity_id)?current.related_entity_id:null);
  let match,created=false;
  if(matchId){
   [match]=await query('SELECT * FROM matches WHERE id = ? LIMIT 1 FOR UPDATE',[matchId]);
   if(!match)fail('The linked match is unavailable; no schedule change was made.');
   if(!['scheduled','pending'].includes(match.status))fail('This match can no longer be rescheduled.');
   await require('./officialScheduleService').assertLegacyMatchWrite(match.id,query,date);
   await query("UPDATE matches SET scheduled_date=?,confirmed_date=?,scheduling_status='confirmed',timezone=?,updated_date=NOW() WHERE id=?",[date,date,meta.timezone||match.timezone||'Europe/Brussels',match.id]);
   match={...match,scheduled_date:date,confirmed_date:date,scheduling_status:'confirmed',timezone:meta.timezone||match.timezone||'Europe/Brussels'};
  }else{
   match=await createMatch(meta,{homeSide:'challenger',scheduledDate:date,query,emit:false});matchId=match.id;created=true;
  }
  if(created && Number(meta.wager_stc || 0)>0) {
   try {
    await require('./wagerSettlementService').settle(matchId,'reserve',actor?.id || null,{query,invitationRecipientVerified:true});
    match={...match,wager_home_locked:1,wager_away_locked:1,wager_status:'active'};
   } catch(error) { throw Object.assign(error,{status:error.status||409}); }
  }
  const updated={...meta,root_invitation_id:root.id,created_match_id:matchId,scheduled_date:date};
  for(const item of root.id===current.id?[current]:[root,current])await query("UPDATE inbox_messages SET metadata=?,related_entity_id=?,related_entity_type='match',status=?,is_read=1 WHERE id=?",[JSON.stringify({...parse(item.metadata),...updated}),matchId,action,item.id]);
  if(actor && [0,2].includes(Number(actor.role_id)))await require('./rewardConfigurationService').audit(query,actor,repair?'repair_arranged_match':'accept_arranged_match','match',match.id,{invitation_id:message.id},{match_id:match.id,scheduled_date:date},repair?'Restore accepted legacy reschedule with missing match':'Accept arranged game proposal');
  return {match,created,meta:updated};
 });
}
async function reconcile({user,query,transaction,createMatch}){
 const messages=await query(`SELECT i.* FROM inbox_messages i LEFT JOIN matches m ON m.id=i.related_entity_id
   WHERE i.message_type='match_invite' AND i.status IN ('accepted','confirmed')
   AND JSON_EXTRACT(i.metadata,'$.reschedule_request')=true
   AND NULLIF(JSON_UNQUOTE(JSON_EXTRACT(i.metadata,'$.created_match_id')),'null') IS NULL AND m.id IS NULL
   AND (LOWER(i.recipient_email)=LOWER(?) OR LOWER(i.sender_email)=LOWER(?))
   ORDER BY i.created_date DESC LIMIT 50`,[user.email,user.email]);
 const matches=[],review_required=[];
 for(const message of messages){
  try{
   const result=await accept({message,userEmail:message.recipient_email,createMatch,transaction,repair:true,actor:user});
   matches.push(result.match);
  }catch(error){if(error.status!==409)throw error;review_required.push(message.id);}
 }
 return {matches,review_required};
}
module.exports={accept,reconcile};

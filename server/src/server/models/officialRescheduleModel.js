'use strict';
const crypto=require('crypto');
const {OfficialScheduleModel}=require('./officialScheduleModel');
const {unpack}=require('../lib/regionalEditionIdentity');
class OfficialRescheduleModel extends OfficialScheduleModel {
 async requests(matchId,q){return (await q("SELECT * FROM league_entities WHERE entity_type='official_reschedule_request' AND JSON_UNQUOTE(JSON_EXTRACT(data_json,'$.match_id'))=? ORDER BY created_date,id FOR UPDATE",[matchId])).map(unpack);}
 async approved(editionId,clubId,q){return (await q("SELECT id FROM league_entities WHERE entity_type='official_reschedule_request' AND status='approved' AND JSON_UNQUOTE(JSON_EXTRACT(data_json,'$.edition_id'))=? AND JSON_UNQUOTE(JSON_EXTRACT(data_json,'$.requester_club_id'))=? FOR UPDATE",[editionId,clubId])).length;}
 async save(record,q){await q("INSERT INTO league_entities (id,entity_type,data_json,status) VALUES (?,'official_reschedule_request',?,?) ON DUPLICATE KEY UPDATE data_json=VALUES(data_json),status=VALUES(status),updated_date=NOW()",[record.id,JSON.stringify(record),record.status]);}
 async operation(user,clubId,before,after,reason,q){
  await q('INSERT INTO club_operation_audit_logs (id,club_id,actor_user_id,actor_email,action,entity_type,entity_id,old_value,new_value,reason,created_date) VALUES (?,?,?,?,?,?,?,?,?,?,NOW())',[crypto.randomUUID(),clubId,user.id,user.email || null,`official_reschedule_${after.status}`,'official_reschedule_request',after.id,JSON.stringify(before),JSON.stringify(after),reason]);
  if(user.role_id!=null && [0,2].includes(Number(user.role_id)))await q('INSERT INTO admin_audit_log (id,admin_user_id,admin_email,action,entity_type,entity_id,old_value,new_value,reason) VALUES (?,?,?,?,?,?,?,?,?)',[crypto.randomUUID(),user.id,user.email,`official_reschedule_${after.status}`,'official_reschedule_request',after.id,JSON.stringify(before),JSON.stringify(after),reason]);
 }
 async notice(clubs,request,event,q){
  const {resolveClubPresidentContact}=require('../services/clubContactService');
  const {parseMaybeJson,resolveDelivery}=require('../services/notificationPreferenceService');
  for(const clubId of clubs){
   const contact=await resolveClubPresidentContact({clubId,query:q,forUpdate:true});
   if(!contact.email)throw Object.assign(Error('The club contact is unavailable; the rescheduling action was not saved.'),{status:409});
   const [player]=await q('SELECT notification_settings FROM players WHERE LOWER(email)=LOWER(?) LIMIT 1 FOR UPDATE',[contact.email]);
   if(!resolveDelivery(parseMaybeJson(player?.notification_settings,{}),'match_reminders').inApp)continue;
   const title=event==='requested'?'Official schedule change requested':event==='approved'?'Official schedule change agreed':event==='cancelled'?'Official schedule change withdrawn':'Official schedule change declined';
   await q('INSERT INTO notifications (id,recipient_email,type,title,body,link,related_id,idempotency_key) VALUES (?,?,?,?,?,?,?,?)',[crypto.randomUUID(),contact.email,'match_scheduled',title,`${request.proposed_date} (Europe/Brussels). ${event==='requested'?`Respond by ${request.respond_by}; silence keeps the existing kickoff.`:event==='approved'?'Review the updated time and confirm your preparation again.':'The existing kickoff stays in place.'}`,`/game-day?match=${encodeURIComponent(request.match_id)}`,request.match_id,`official_reschedule:${request.id}:${event}:${clubId}`]);
  }
 }
}
module.exports={OfficialRescheduleModel};

'use strict';
const { unpack } = require('../lib/regionalEditionIdentity');
class RegionalRegistrationModel {
  async selectAll(query) {return (await query("SELECT * FROM league_entities WHERE entity_type='regional_registration_window' ORDER BY id")).map(unpack);}
  async selectOne(id,query,lock=false) {const [row]=await query(`SELECT * FROM league_entities WHERE entity_type='regional_registration_window' AND id=?${lock?' FOR UPDATE':''}`,[id]);return row?unpack(row):null;}
  async create(record,query) {await query('INSERT INTO league_entities (id,entity_type,data_json,status,region,platform,season_number,reset_series) VALUES (?,?,?,?,?,?,?,?)',[record.id,'regional_registration_window',JSON.stringify(record),record.status,record.region_slug,record.platform,record.season_number,record.reset_series]);}
  async update(record,query) {await query("UPDATE league_entities SET data_json=?,status=?,updated_date=NOW() WHERE entity_type='regional_registration_window' AND id=?",[JSON.stringify(record),record.status,record.id]);}
  async registrations(clubId,query) {return (await query("SELECT * FROM league_entities WHERE entity_type='season_registration' AND club_id=? ORDER BY id FOR UPDATE",[clubId])).map(unpack);}
  async registration(id,query) {const [row]=await query("SELECT * FROM league_entities WHERE entity_type='season_registration' AND id=? FOR UPDATE",[id]);return row?unpack(row):null;}
  async confirmedField(windowId,query) {return (await query("SELECT * FROM league_entities WHERE entity_type='season_registration' AND JSON_UNQUOTE(JSON_EXTRACT(data_json,'$.registration_window_id'))=? ORDER BY id FOR UPDATE",[windowId])).map(unpack);}
  async saveRegistration(record,query,create=false) {
    if(create)await query('INSERT INTO league_entities (id,entity_type,data_json,status,club_id,region,platform,season_number,reset_series) VALUES (?,?,?,?,?,?,?,?,?)',[record.id,'season_registration',JSON.stringify(record),record.status,record.club_id,record.region_slug,record.platform,record.season_number,record.reset_series]);
    else await query("UPDATE league_entities SET data_json=?,status=?,updated_date=NOW() WHERE entity_type='season_registration' AND id=?",[JSON.stringify(record),record.status,record.id]);
  }
  async reminderCandidates(after,now,query,windowIds) {
    if(!windowIds.length)return [];
    return query(`SELECT r.id FROM league_entities r JOIN league_entities w
      ON w.entity_type='regional_registration_window' AND w.id=JSON_UNQUOTE(JSON_EXTRACT(r.data_json,'$.registration_window_id'))
      LEFT JOIN league_entities j ON j.entity_type='regional_confirmation_notice_progress' AND JSON_UNQUOTE(JSON_EXTRACT(j.data_json,'$.source_id'))=r.id
      WHERE r.entity_type='season_registration' AND r.status='pending' AND r.id>?
        AND JSON_UNQUOTE(JSON_EXTRACT(r.data_json,'$.participation_status'))='registered'
        AND NOT (COALESCE(JSON_UNQUOTE(JSON_EXTRACT(r.data_json,'$.confirmation_notice.version')),'')='regional_confirmation_notice_v1'
          AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(r.data_json,'$.confirmation_notice.status')),'') IN ('stored','muted'))
        AND w.status='published' AND JSON_UNQUOTE(JSON_EXTRACT(w.data_json,'$.policy_version'))='regional_registration_v1'
        AND JSON_UNQUOTE(JSON_EXTRACT(w.data_json,'$.confirmation_notice_policy_version'))='regional_confirmation_notice_v1'
        AND w.id IN (${windowIds.map(()=>'?').join(',')})
        AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(j.data_json,'$.next_attempt_at')),'')<=JSON_UNQUOTE(?)
        AND JSON_UNQUOTE(JSON_EXTRACT(w.data_json,'$.registration_closes_at'))<=JSON_UNQUOTE(?)
        AND JSON_UNQUOTE(JSON_EXTRACT(w.data_json,'$.confirmation_closes_at'))>JSON_UNQUOTE(?)
      ORDER BY r.id LIMIT 80`,[after,...windowIds,...[now,now,now].map(value=>JSON.stringify(value))]);
  }
  async notificationSettings(email,query) {return (await query('SELECT notification_settings FROM players WHERE LOWER(email)=LOWER(?) LIMIT 1 FOR UPDATE',[email]))[0]?.notification_settings;}
  async saveConfirmationNotice(notice,query) {
    await query('INSERT INTO notifications (id,recipient_email,type,title,body,link,related_id,idempotency_key) VALUES (?,?,?,?,?,?,?,?)',
      [notice.id,notice.email,'club_update','Confirm your regional participation',notice.body,notice.link,notice.registration_id,notice.key]);
  }
  async actor(id,query) {return (await query('SELECT id,email,role_id FROM users WHERE id=? FOR UPDATE',[id]))[0];}
  async saveReserveNotice(notice,query) {
    await query('INSERT INTO notifications (id,recipient_email,type,title,body,link,related_id,idempotency_key) VALUES (?,?,?,?,?,?,?,?)',
      [notice.id,notice.email,'club_update','Regional reserve response requested',notice.body,notice.link,notice.registration_id,notice.key]);
  }
  async club(id,query) {return (await query('SELECT id,name,tag,logo_url,platform,president_user_id,user_id,owner_email FROM clubs WHERE id=? FOR UPDATE',[id]))[0];}
  async actorPlayer(user,query) {return (await query('SELECT id,subscription,subscription_expires_at FROM players WHERE user_id=? OR LOWER(TRIM(email))=LOWER(TRIM(?)) ORDER BY user_id=? DESC,updated_date DESC LIMIT 1 FOR UPDATE',[user.id,user.email,user.id]))[0];}
  async players(clubId,query) {
    return query(`SELECT p.id,p.gamertag,p.club_id,p.subscription,p.subscription_expires_at,p.club_id AS playing_club_id
      FROM players p WHERE p.club_id=? ORDER BY p.id FOR UPDATE`,[clubId]);
  }
}
module.exports={RegionalRegistrationModel};

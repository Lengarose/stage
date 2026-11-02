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
  async actor(id,query) {return (await query('SELECT id,email,role_id FROM users WHERE id=? FOR UPDATE',[id]))[0];}
  async club(id,query) {return (await query('SELECT id,name,tag,logo_url,platform,president_user_id,user_id,owner_email FROM clubs WHERE id=? FOR UPDATE',[id]))[0];}
  async actorPlayer(user,query) {return (await query('SELECT id,subscription,subscription_expires_at FROM players WHERE user_id=? OR LOWER(TRIM(email))=LOWER(TRIM(?)) ORDER BY user_id=? DESC,updated_date DESC LIMIT 1 FOR UPDATE',[user.id,user.email,user.id]))[0];}
  async players(clubId,query) {
    return query(`SELECT p.id,p.gamertag,p.club_id,p.subscription,p.subscription_expires_at,COALESCE(pl.loan_club_id,p.club_id) AS playing_club_id
      FROM players p LEFT JOIN player_loans pl ON pl.player_id=p.id AND pl.status='ACTIVE'
      WHERE p.club_id=? OR pl.loan_club_id=? ORDER BY p.id FOR UPDATE`,[clubId,clubId]);
  }
}
module.exports={RegionalRegistrationModel};

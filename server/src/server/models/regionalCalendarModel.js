'use strict';
const crypto=require('crypto');
const {unpack}=require('../lib/regionalEditionIdentity');
const {OfficialScheduleModel}=require('./officialScheduleModel');
class RegionalCalendarModel extends OfficialScheduleModel {
  async editions(q) {return (await q("SELECT * FROM league_entities WHERE entity_type='regional_league' ORDER BY id FOR UPDATE")).map(unpack);}
  async fixtures(ids,q) {return (await q(`SELECT * FROM league_entities WHERE entity_type='regional_league_fixture' AND league_id IN (${ids.map(()=>'?').join(',')}) ORDER BY id FOR UPDATE`,ids)).map(unpack);}
  async selections(matchIds,q) {
    if(!matchIds.length)return [];
    return q(`SELECT id,data_json FROM league_entities WHERE entity_type IN ('official_match_selection','official_match_preparation') AND JSON_UNQUOTE(JSON_EXTRACT(data_json,'$.match_id')) IN (${matchIds.map(()=>'?').join(',')}) ORDER BY id FOR UPDATE`,matchIds);
  }
  async published(id,q) {const [row]=await q("SELECT * FROM league_entities WHERE entity_type='regional_calendar' AND id=? FOR UPDATE",[id]);return row?unpack(row):null;}
  async save(record,user,reason,q) {
    await q("INSERT INTO league_entities (id,entity_type,data_json) VALUES (?,'regional_calendar',?)",[record.id,JSON.stringify(record)]);
    await q('INSERT INTO admin_audit_log (id,admin_user_id,admin_email,action,entity_type,entity_id,old_value,new_value,reason) VALUES (?,?,?,?,?,?,?,?,?)',[crypto.randomUUID(),user.id,user.email,'publish_regional_calendar','regional_calendar',record.id,'null',JSON.stringify(record),reason]);
  }
  async summary(clubs,record,q) {
    const contacts=await q(`SELECT c.id,COALESCE(u.email,c.owner_email) AS email FROM clubs c LEFT JOIN users u ON u.id=COALESCE(c.president_user_id,c.user_id) WHERE c.id IN (${clubs.map(()=>'?').join(',')})`,clubs);
    if(contacts.length!==clubs.length || contacts.some(r=>!String(r.email || '').trim()))throw Object.assign(Error('Competition contacts are unavailable; calendar was not published'),{status:409});
    for(const email of new Set(contacts.map(c=>String(c.email).trim().toLowerCase())))await q('INSERT INTO notifications (id,recipient_email,type,title,body,link,related_id,idempotency_key) VALUES (?,?,?,?,?,?,?,?)',[crypto.randomUUID(),email,'match_scheduled','Regional season calendar published',`38 rounds from the week of ${record.start_monday}, Europe/Brussels. Review your fixtures and publish your selections.`, '/leagues',record.id,`calendar:${record.id}:${crypto.createHash('sha256').update(email).digest('hex')}`]);
  }
}
module.exports={RegionalCalendarModel};

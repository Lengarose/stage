'use strict';
const crypto=require('crypto');
const {unpack}=require('../lib/regionalEditionIdentity');
const {RegionalCalendarModel}=require('./regionalCalendarModel');
class RegionalPromotionCalendarModel extends RegionalCalendarModel {
  async cycle(id,q) {const [row]=await q("SELECT * FROM league_entities WHERE entity_type='regional_cycle' AND id=? FOR UPDATE",[id]);return row?unpack(row):null;}
  async calendars(q) {return (await q("SELECT * FROM league_entities WHERE entity_type='regional_calendar' ORDER BY id FOR UPDATE")).map(unpack);}
  async published(id,q) {const [row]=await q("SELECT * FROM league_entities WHERE entity_type='regional_pathway_calendar' AND id=? FOR UPDATE",[id]);return row?unpack(row):null;}
  async save(record,user,reason,q) {
    await q("INSERT INTO league_entities (id,entity_type,data_json) VALUES (?,'regional_pathway_calendar',?)",[record.id,JSON.stringify(record)]);
    await q('INSERT INTO admin_audit_log (id,admin_user_id,admin_email,action,entity_type,entity_id,old_value,new_value,reason) VALUES (?,?,?,?,?,?,?,?,?)',[crypto.randomUUID(),user.id,user.email,record.stage==='decisions'?'publish_decision_calendar':'publish_promotion_calendar','regional_pathway_calendar',record.id,'null',JSON.stringify(record),reason]);
  }
  async cycleMatches(id,q) {return q('SELECT * FROM matches WHERE competition_context=? ORDER BY id FOR UPDATE',[id]);}
}
module.exports={RegionalPromotionCalendarModel};

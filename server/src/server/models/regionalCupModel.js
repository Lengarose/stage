'use strict';
const crypto=require('crypto');
const {RegionalCalendarModel}=require('./regionalCalendarModel');
const {unpack}=require('../lib/regionalEditionIdentity');
class RegionalCupModel extends RegionalCalendarModel {
  async records(q) {return (await q("SELECT * FROM league_entities WHERE entity_type IN ('regional_cup','regional_cup_edition','regional_calendar') ORDER BY id FOR UPDATE")).map(unpack);}
  async edition(id,q) {const [row]=await q("SELECT * FROM league_entities WHERE entity_type='regional_cup_edition' AND id=? FOR UPDATE",[id]);return row?unpack(row):null;}
  async fixtures(id,q) {return q('SELECT * FROM competition_fixtures WHERE competition_instance_id=? ORDER BY id FOR UPDATE',[id]);}
  async matches(id,q) {return q('SELECT * FROM matches WHERE competition_context=? ORDER BY id FOR UPDATE',[id]);}
  async clubs(ids,q) {return q(`SELECT id,name,logo_url,owner_email FROM clubs WHERE id IN (${ids.map(()=>'?').join(',')}) ORDER BY id FOR UPDATE`,ids);}
  async insert(table,row,q) {
    if(!['competition_instances','competition_participants','competition_fixtures'].includes(table))throw Error('Unsupported Cup engine table');
    const keys=Object.keys(row);await q(`INSERT INTO ${table} (${keys.map(k=>`\`${k}\``).join(',')}) VALUES (${keys.map(()=>'?').join(',')})`,keys.map(k=>row[k]??null));
  }
  async saveEdition(before,row,user,reason,q) {
    await q("UPDATE league_entities SET data_json=?,status=?,updated_date=NOW() WHERE entity_type='regional_cup_edition' AND id=?",[JSON.stringify(row),row.status,row.id]);
    await q('INSERT INTO admin_audit_log (id,admin_user_id,admin_email,action,entity_type,entity_id,old_value,new_value,reason) VALUES (?,?,?,?,?,?,?,?,?)',[crypto.randomUUID(),user?.id || null,user?.email || null,'progress_regional_cup','regional_cup_edition',row.id,JSON.stringify(before),JSON.stringify(row),reason]);
  }
  async complete(id,q) {await q("UPDATE competition_instances SET status='completed',updated_date=NOW() WHERE id=?",[id]);}
  async create(type,row,user,reason,q) {
    if(!['regional_cup','regional_cup_edition'].includes(type))throw Error('Unsupported Cup record type');
    await q('INSERT INTO league_entities (id,entity_type,data_json,status) VALUES (?,?,?,?)',[row.id,type,JSON.stringify(row),row.status]);
    await q('INSERT INTO admin_audit_log (id,admin_user_id,admin_email,action,entity_type,entity_id,old_value,new_value,reason) VALUES (?,?,?,?,?,?,?,?,?)',[crypto.randomUUID(),user.id,user.email,`create_${type}`,type,row.id,'null',JSON.stringify(row),reason]);
  }
}
module.exports={RegionalCupModel};

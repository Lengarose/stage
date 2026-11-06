'use strict';
const { unpack } = require('../lib/regionalEditionIdentity');

// Regional cycles are transactional business snapshots in the existing flexible
// store. They deliberately have no generic client-mutable CRUD route.
class RegionalCycleModel {
  async selectAll(query) {
    return (await query("SELECT * FROM league_entities WHERE entity_type='regional_cycle' ORDER BY id")).map(unpack);
  }
  async selectOne(id, query, lock = false) {
    const [row] = await query(`SELECT * FROM league_entities WHERE id=? AND entity_type='regional_cycle'${lock ? ' FOR UPDATE' : ''}`, [id]);
    return row ? unpack(row) : null;
  }
  async create(record, query) {
    await query('INSERT INTO league_entities (id,entity_type,data_json,status,region,platform,season_number,reset_series) VALUES (?,?,?,?,?,?,?,?)',
      [record.id, 'regional_cycle', JSON.stringify(record), record.status, record.region_slug, record.platform, record.season_number, record.reset_series]);
  }
  async update(record, query) {
    await query("UPDATE league_entities SET data_json=?,status=?,updated_date=NOW() WHERE id=? AND entity_type='regional_cycle'", [JSON.stringify(record), record.status, record.id]);
  }
  async registrations(ids, query) {
    if (!ids.length) return [];
    return (await query(`SELECT * FROM league_entities WHERE entity_type='season_registration' AND id IN (${ids.map(() => '?').join(',')}) ORDER BY id FOR UPDATE`, ids)).map(unpack);
  }
  async clubs(ids, query) {
    if (!ids.length) return [];
    return query(`SELECT id,name,owner_email,platform FROM clubs WHERE id IN (${ids.map(() => '?').join(',')}) ORDER BY id FOR UPDATE`, ids);
  }
  async linkedRegistrations(ids, query) {
    return (await query(`SELECT * FROM league_entities WHERE entity_type='season_registration' AND club_id IN (${ids.map(() => '?').join(',')}) ORDER BY id FOR UPDATE`,ids)).map(unpack);
  }
  async assignRegistration(record, query) {
    await query("UPDATE league_entities SET data_json=?,league_id=?,division=?,platform=?,region=?,season_number=?,reset_series=?,updated_date=NOW() WHERE id=? AND entity_type='season_registration'",[JSON.stringify(record),record.league_id,record.division,record.platform,record.region,record.season_number,record.reset_series,record.id]);
  }
  async notificationSettings(email, query) {
    return (await query('SELECT notification_settings FROM players WHERE LOWER(email)=LOWER(?) LIMIT 1 FOR UPDATE',[email]))[0]?.notification_settings;
  }
  async saveAllocationNotification(notice, query) {
    await query('INSERT INTO notifications (id,recipient_email,type,title,body,link,related_id,idempotency_key) VALUES (?,?,?,?,?,?,?,?)',
      [notice.id,notice.recipient_email,'club_update','Regional group assigned',notice.body,notice.link,notice.edition_id,notice.idempotency_key]);
  }
  async fixtures(id, query, lock = true) {
    return query(`SELECT * FROM competition_fixtures WHERE competition_instance_id=? ORDER BY id${lock ? ' FOR UPDATE' : ''}`, [id]);
  }
  async matches(id, query, lock = true) {
    return query(`SELECT * FROM matches WHERE competition_context=? ORDER BY id${lock ? ' FOR UPDATE' : ''}`, [id]);
  }
  async completeInstance(id, query) {
    await query("UPDATE competition_instances SET status='completed',updated_date=NOW() WHERE id=?",[id]);
  }
  async insert(table, record, query) {
    if (!['competition_instances', 'competition_participants', 'competition_fixtures', 'matches', 'league_entities'].includes(table)) throw new Error('Unsupported regional cycle table');
    const keys = Object.keys(record);
    await query(`INSERT INTO ${table} (${keys.map(k => `\`${k}\``).join(',')}) VALUES (${keys.map(() => '?').join(',')})`, keys.map(k => record[k] ?? null));
  }
}
module.exports = { RegionalCycleModel };

'use strict';

const crypto = require('crypto');
const {
  EXECUTESQL
} = require('../db/database');
const parse = row => row ? {
  ...JSON.parse(row.data_json || '{}'),
  id: row.id
} : null;
const stableId = parts => {
  const h = crypto.createHash('sha256').update(JSON.stringify(parts)).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
};
// Domain records live in the established league_entities store. All writes are
// made by business services, never by a generic client entity route.
class ClubBoardModel {
  async lock(clubId, q = EXECUTESQL) {
    const id = stableId(['club_board_lock', clubId]);
    await q("INSERT INTO league_entities (id,entity_type,data_json) VALUES (?,'club_board_lock','{}') ON DUPLICATE KEY UPDATE id=id", [id]);
    await q('SELECT id FROM league_entities WHERE id=? FOR UPDATE', [id]);
  }
  async selectOne(type, id, q = EXECUTESQL) {
    const [r] = await q('SELECT * FROM league_entities WHERE entity_type=? AND id=? FOR UPDATE', [type, id]);
    return parse(r);
  }
  async selectAll(type, clubId, q = EXECUTESQL) {
    return (await q('SELECT * FROM league_entities WHERE entity_type=? AND (? IS NULL OR club_id=?) ORDER BY id FOR UPDATE', [type, clubId, clubId])).map(parse);
  }
  async create(type, row, q = EXECUTESQL) {
    await q('INSERT INTO league_entities (id,entity_type,club_id,status,data_json) VALUES (?,?,?,?,?)', [row.id, type, row.club_id || null, row.status || null, JSON.stringify(row)]);
    return row;
  }
  async update(type, row, q = EXECUTESQL) {
    await q('UPDATE league_entities SET data_json=?,status=?,updated_date=NOW() WHERE entity_type=? AND id=?', [JSON.stringify(row), row.status || null, type, row.id]);
    return row;
  }
  async save(type, row, q = EXECUTESQL) {
    return (await this.selectOne(type, row.id, q)) ? this.update(type, row, q) : this.create(type, row, q);
  }
  async delete() {
    throw Object.assign(new Error('Board and progression evidence cannot be deleted through CRUD'), {
      status: 405
    });
  }
  async club(id, q = EXECUTESQL) {
    return (await q('SELECT * FROM clubs WHERE id=? LIMIT 1 FOR UPDATE', [id]))[0] || null;
  }
  async player(id, q = EXECUTESQL) {
    return (await q('SELECT * FROM players WHERE id=? LIMIT 1 FOR UPDATE', [id]))[0] || null;
  }
  async audit(actor, action, clubId, before, after, reason, q = EXECUTESQL) {
    await q('INSERT INTO club_operation_audit_logs (id,club_id,actor_user_id,actor_email,action,entity_type,entity_id,old_value,new_value,reason) VALUES (?,?,?,?,?,?,?,?,?,?)', [crypto.randomUUID(), clubId, actor?.id || null, actor?.email || null, action, 'club_board', after?.id || clubId, JSON.stringify(before), JSON.stringify(after), reason]);
    if ([0, 2].includes(Number(actor?.role_id))) await q('INSERT INTO admin_audit_log (id,admin_user_id,admin_email,action,entity_type,entity_id,old_value,new_value,reason) VALUES (?,?,?,?,?,?,?,?,?)', [crypto.randomUUID(), actor.id, actor.email, action, 'club_board', after?.id || clubId, JSON.stringify(before), JSON.stringify(after), reason]);
  }
}
module.exports = {
  ClubBoardModel,
  stableId,
  parse
};

'use strict';
const { EXECUTESQL } = require('../db/database');
const { unpack } = require('./competitionScopeModel');
class TournamentReserveModel {
  async selectOne(id, q = EXECUTESQL) { const [row] = await q("SELECT * FROM league_entities WHERE id=? AND entity_type='tournament_reserve'", [id]); return row ? unpack(row) : null; }
  async selectAll(id, q = EXECUTESQL) { return (await q("SELECT * FROM league_entities WHERE entity_type='tournament_reserve' AND season_id=? ORDER BY created_date,id", [id])).map(unpack).sort((a,b) => a.queue_sequence-b.queue_sequence); }
  async create(record, q = EXECUTESQL) { await q("INSERT INTO league_entities (id,entity_type,season_id,status,data_json) VALUES (?,'tournament_reserve',?,?,?)", [record.id,record.tournament_id,record.status,JSON.stringify(record)]); return record; }
  async update(record, q = EXECUTESQL) { await q("UPDATE league_entities SET status=?,data_json=?,updated_date=NOW() WHERE id=? AND entity_type='tournament_reserve'", [record.status,JSON.stringify(record),record.id]); return record; }
  async delete(id, q = EXECUTESQL) { return q("DELETE FROM league_entities WHERE id=? AND entity_type='tournament_reserve'", [id]); }
}
module.exports = new TournamentReserveModel();

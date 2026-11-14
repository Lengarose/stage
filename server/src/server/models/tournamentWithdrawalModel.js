'use strict';
const { EXECUTESQL } = require('../db/database');
const { unpack } = require('./competitionScopeModel');
class TournamentWithdrawalModel {
  async selectOne(id, q = EXECUTESQL) { const [row] = await q("SELECT * FROM league_entities WHERE id=? AND entity_type='tournament_withdrawal'", [id]); return row ? unpack(row) : null; }
  async selectAll(tournamentId, q = EXECUTESQL) { return (await q("SELECT * FROM league_entities WHERE entity_type='tournament_withdrawal' AND season_id=? ORDER BY created_date DESC", [tournamentId])).map(unpack); }
  async create(record, q = EXECUTESQL) { await q("INSERT INTO league_entities (id,entity_type,season_id,status,data_json) VALUES (?,'tournament_withdrawal',?,?,?)", [record.id, record.tournament_id, record.status, JSON.stringify(record)]); return record; }
  async update(record, q = EXECUTESQL) { await q("UPDATE league_entities SET status=?,data_json=?,updated_date=NOW() WHERE id=? AND entity_type='tournament_withdrawal'", [record.status, JSON.stringify(record), record.id]); return record; }
  async delete(id, q = EXECUTESQL) { return q("DELETE FROM league_entities WHERE id=? AND entity_type='tournament_withdrawal'", [id]); }
}
module.exports = new TournamentWithdrawalModel();

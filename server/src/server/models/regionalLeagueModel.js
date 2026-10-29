'use strict';
const { unpack } = require('../lib/regionalEditionIdentity');
const indexed = ['status', 'slug', 'region', 'division', 'platform', 'season_number', 'league_id', 'is_active', 'permanent_league_id', 'reset_series'];
class RegionalLeagueModel {
  async selectAll(query, lock = false) {
    return query(`SELECT * FROM league_entities WHERE entity_type='regional_league' ORDER BY id${lock ? ' FOR UPDATE' : ''}`);
  }
  async selectOne(id, query) {
    return (await query("SELECT * FROM league_entities WHERE id=? AND entity_type='regional_league'", [id]))[0];
  }
  async create(record, key, query) {
    const columns = ['id', 'entity_type', 'data_json', 'regional_edition_key', 'regional_league_key', ...indexed];
    const values = [record.id, 'regional_league', JSON.stringify(record), key, record.permanent_league_id===record.id ? require('../lib/regionalLeagueHierarchy').leagueKey(record) : null, ...indexed.map(field => record[field] ?? null)];
    await query(`INSERT INTO \`league_entities\` (${columns.map(c => `\`${c}\``).join(',')}) VALUES (${columns.map(() => '?').join(',')})`, values);
    return record;
  }
  async update(record, key, query) {
    await query(`UPDATE league_entities SET data_json=?,regional_edition_key=?,${indexed.map(field => `\`${field}\`=?`).join(',')},updated_date=NOW() WHERE id=? AND entity_type='regional_league'`, [JSON.stringify(record), key, ...indexed.map(field => record[field] ?? null), record.id]);
    return record;
  }
  async delete(id, query) { await query("DELETE FROM league_entities WHERE id=? AND entity_type='regional_league'", [id]); }
  async bindIdentity(id, key, query) { await query("UPDATE league_entities SET regional_edition_key=? WHERE id=? AND entity_type='regional_league'", [key, id]); }
  async lock(query) {
    // Infrastructure mutex in the existing flexible store, held until COMMIT.
    await query("INSERT INTO league_entities (id,entity_type,data_json) VALUES ('regional-edition-write-lock','regional_edition_lock','{}') ON DUPLICATE KEY UPDATE id=id");
    await query("SELECT id FROM league_entities WHERE id='regional-edition-write-lock' FOR UPDATE");
  }
}
module.exports = { RegionalLeagueModel, indexed, unpack };

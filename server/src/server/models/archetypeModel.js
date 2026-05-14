const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

/**
 * `archetypes` — catalogue of player archetypes (inspired by EAFC Clubs Pro).
 *
 * Each archetype has a tactical position, a JSON map of base stat modifiers
 * (e.g. {"pace": 1.05, "shooting": 1.08}) and a JSON list of signature
 * playstyles. Players reference an archetype via the `players.archetype`
 * column (string match on `archetypes.code` or `archetypes.name`).
 *
 * The scheduleEngine reads these modifiers at match simulation time.
 */
class ArchetypeModel {
  constructor(body = {}) {
    this.id                  = body.id;
    this.code                = body.code;
    this.name                = body.name;
    this.position            = body.position || null;
    this.description         = body.description || null;
    this.base_modifiers      = body.base_modifiers
      ? (typeof body.base_modifiers === 'string'
          ? body.base_modifiers
          : JSON.stringify(body.base_modifiers))
      : null;
    this.signature_playstyles = body.signature_playstyles
      ? (typeof body.signature_playstyles === 'string'
          ? body.signature_playstyles
          : JSON.stringify(body.signature_playstyles))
      : null;
    this.icon_inspiration    = body.icon_inspiration || null;
    this.sort_order          = body.sort_order ?? 0;
    this.is_active           = body.is_active ?? 1;
  }

  selectAll(page = 1) {
    const pageSize = 50;
    const offset   = (page - 1) * pageSize;
    return EXECUTESQL(
      'SELECT * FROM archetypes ORDER BY sort_order ASC, name ASC LIMIT ? OFFSET ?',
      [pageSize, offset]
    );
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM archetypes WHERE id = ?', [id]);
  }

  selectByCode(code) {
    return EXECUTESQL('SELECT * FROM archetypes WHERE code = ? LIMIT 1', [code]);
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO archetypes
      (id, code, name, position, description, base_modifiers, signature_playstyles, icon_inspiration, sort_order, is_active)
      VALUES (?,?,?,?,?,?,?,?,?,?)`;
    const values = [
      this.id, this.code, this.name, this.position, this.description,
      this.base_modifiers, this.signature_playstyles, this.icon_inspiration,
      this.sort_order, this.is_active,
    ];
    return EXECUTESQL(sql, values);
  }

  update(id) {
    const sql = `UPDATE archetypes SET
      code=?, name=?, position=?, description=?, base_modifiers=?,
      signature_playstyles=?, icon_inspiration=?, sort_order=?, is_active=?
      WHERE id=?`;
    const values = [
      this.code, this.name, this.position, this.description, this.base_modifiers,
      this.signature_playstyles, this.icon_inspiration, this.sort_order, this.is_active,
      id,
    ];
    return EXECUTESQL(sql, values);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM archetypes WHERE id = ?', [id]);
  }
}

module.exports = ArchetypeModel;

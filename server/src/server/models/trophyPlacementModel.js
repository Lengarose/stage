const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class TrophyPlacementModel {
  static async getAll({ limit = 25, offset = 0, owner_id, owner_type, player_id, trophy_item_id } = {}) {
    let sql = 'SELECT * FROM trophy_placements WHERE 1=1';
    const params = [];
    // Support both legacy (player_id) and current (owner_id/owner_type) filters.
    if (owner_id)       { sql += ' AND owner_id = ?';       params.push(owner_id); }
    if (owner_type)     { sql += ' AND owner_type = ?';     params.push(owner_type); }
    if (player_id)      { sql += ' AND (player_id = ? OR owner_id = ?)'; params.push(player_id, player_id); }
    if (trophy_item_id) { sql += ' AND trophy_item_id = ?'; params.push(trophy_item_id); }
    sql += ' ORDER BY created_date DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));
    return EXECUTESQL(sql, params);
  }

  static async getById(id) {
    const rows = await EXECUTESQL('SELECT * FROM trophy_placements WHERE id = ?', [id]);
    return rows[0] || null;
  }

  static async create(data) {
    const id = uuidv4();
    // Current payload (owner-based)
    const ownerId = data.owner_id || data.player_id || null;
    const ownerType = data.owner_type || (data.player_id ? 'player' : null);
    const position = data.position ?? data.slot_index ?? 0;
    await EXECUTESQL(
      `INSERT INTO trophy_placements (id, owner_id, owner_type, trophy_item_id, position)
       VALUES (?, ?, ?, ?, ?)`,
      [id, ownerId, ownerType, data.trophy_item_id, position]
    );
    return this.getById(id);
  }

  static async update(id, data) {
    const fields = [];
    const params = [];
    if (data.position       !== undefined) { fields.push('position = ?');       params.push(data.position); }
    if (data.slot_index     !== undefined) { fields.push('position = ?');       params.push(data.slot_index); }
    if (data.trophy_item_id !== undefined) { fields.push('trophy_item_id = ?'); params.push(data.trophy_item_id); }
    if (!fields.length) return this.getById(id);
    params.push(id);
    await EXECUTESQL(`UPDATE trophy_placements SET ${fields.join(', ')} WHERE id = ?`, params);
    return this.getById(id);
  }

  static async delete(id) {
    return EXECUTESQL('DELETE FROM trophy_placements WHERE id = ?', [id]);
  }
}

module.exports = TrophyPlacementModel;

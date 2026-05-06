const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class TrophyPlacementModel {
  static async getAll({ limit = 25, offset = 0, player_id, trophy_item_id } = {}) {
    let sql = 'SELECT * FROM trophy_placements WHERE 1=1';
    const params = [];
    if (player_id)      { sql += ' AND player_id = ?';      params.push(player_id); }
    if (trophy_item_id) { sql += ' AND trophy_item_id = ?'; params.push(trophy_item_id); }
    sql += ' ORDER BY placed_date DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));
    return EXECUTESQL(sql, params);
  }

  static async getById(id) {
    const rows = await EXECUTESQL('SELECT * FROM trophy_placements WHERE id = ?', [id]);
    return rows[0] || null;
  }

  static async create(data) {
    const id = uuidv4();
    await EXECUTESQL(
      `INSERT INTO trophy_placements (id, player_id, trophy_item_id, slot_index, placed_date)
       VALUES (?, ?, ?, ?, NOW())`,
      [id, data.player_id, data.trophy_item_id, data.slot_index || 0]
    );
    return this.getById(id);
  }

  static async update(id, data) {
    const fields = [];
    const params = [];
    if (data.slot_index     !== undefined) { fields.push('slot_index = ?');     params.push(data.slot_index); }
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

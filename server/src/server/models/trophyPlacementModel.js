const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class TrophyPlacementModel {
  static async getAll({ limit = 25, offset = 0, owner_id, owner_type, player_id, trophy_item_id } = {}) {
    let sql = 'SELECT * FROM trophy_placements WHERE 1=1';
    const params = [];
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
    const ownerId   = data.owner_id || data.player_id || null;
    const ownerType = data.owner_type || (data.player_id ? 'player' : null);
    const position  = data.position ?? data.slot_index ?? 0;
    const wonIds    = data.won_tournament_ids
      ? (typeof data.won_tournament_ids === 'string' ? data.won_tournament_ids : JSON.stringify(data.won_tournament_ids))
      : null;
    await EXECUTESQL(
      `INSERT INTO trophy_placements
        (id, owner_id, owner_type, trophy_item_id,
         trophy_image_url, trophy_name,
         x_percent, y_percent, scale,
         won_tournament_ids, win_count, position)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, ownerId, ownerType, data.trophy_item_id,
        data.trophy_image_url || null,
        data.trophy_name || null,
        data.x_percent ?? 50,
        data.y_percent ?? 50,
        data.scale ?? 1,
        wonIds,
        data.win_count ?? 1,
        position,
      ]
    );
    return this.getById(id);
  }

  static async update(id, data) {
    const fields = [];
    const params = [];
    const updatable = [
      'trophy_item_id', 'trophy_image_url', 'trophy_name',
      'x_percent', 'y_percent', 'scale',
      'win_count', 'position',
    ];
    for (const key of updatable) {
      if (data[key] !== undefined) {
        fields.push(`${key} = ?`);
        params.push(data[key]);
      }
    }
    if (data.slot_index !== undefined) { fields.push('position = ?'); params.push(data.slot_index); }
    if (data.won_tournament_ids !== undefined) {
      fields.push('won_tournament_ids = ?');
      params.push(typeof data.won_tournament_ids === 'string'
        ? data.won_tournament_ids
        : JSON.stringify(data.won_tournament_ids));
    }
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

const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class TrophyItemModel {
  static async getAll({ limit = 25, offset = 0, rarity } = {}) {
    let sql = 'SELECT * FROM trophy_items WHERE 1=1';
    const params = [];
    if (rarity) { sql += ' AND rarity = ?'; params.push(rarity); }
    sql += ' ORDER BY sort_order ASC, created_date DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));
    return EXECUTESQL(sql, params);
  }

  static async getById(id) {
    const rows = await EXECUTESQL('SELECT * FROM trophy_items WHERE id = ?', [id]);
    return rows[0] || null;
  }

  static async create(data) {
    const id = uuidv4();
    await EXECUTESQL(
      `INSERT INTO trophy_items
        (id, name, description, image_url,
         competition_name, tournament_id, tournament_type,
         is_official, rarity, admin_only, sort_order, price, created_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        id,
        data.name,
        data.description || null,
        data.image_url || null,
        data.competition_name || null,
        data.tournament_id || null,
        data.tournament_type || null,
        data.is_official ? 1 : 0,
        data.rarity || 'common',
        data.admin_only ? 1 : 0,
        data.sort_order ?? 0,
        data.price || 0,
      ]
    );
    return this.getById(id);
  }

  static async update(id, data) {
    const fields = [];
    const params = [];
    const updatable = [
      'name', 'description', 'image_url',
      'competition_name', 'tournament_id', 'tournament_type',
      'is_official', 'rarity', 'admin_only', 'sort_order', 'price',
    ];
    for (const key of updatable) {
      if (data[key] !== undefined) {
        fields.push(`${key} = ?`);
        params.push(data[key]);
      }
    }
    if (!fields.length) return this.getById(id);
    params.push(id);
    await EXECUTESQL(`UPDATE trophy_items SET ${fields.join(', ')} WHERE id = ?`, params);
    return this.getById(id);
  }

  static async delete(id) {
    return EXECUTESQL('DELETE FROM trophy_items WHERE id = ?', [id]);
  }
}

module.exports = TrophyItemModel;

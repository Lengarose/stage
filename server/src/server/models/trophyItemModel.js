const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

/** Avoid MySQL "Data too long" / strict-mode errors on VARCHAR columns. */
function clipStr(val, maxLen) {
  if (val == null) return val;
  const s = String(val);
  return s.length <= maxLen ? s : s.slice(0, maxLen);
}

class TrophyItemModel {
  static async getAll({ limit = 200, offset = 0, rarity } = {}) {
    let sql = 'SELECT * FROM trophy_items WHERE 1=1';
    const params = [];
    if (rarity) { sql += ' AND rarity = ?'; params.push(rarity); }
    // Order only by sort_order — keeps the query resilient against legacy
    // databases that don't yet have a created_date column.
    sql += ' ORDER BY sort_order ASC, id ASC LIMIT ? OFFSET ?';
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
         is_official, rarity, admin_only, sort_order, price,
         linked_source_type, linked_source_id, linked_source_name,
         created_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        id,
        clipStr(data.name, 200),
        data.description || null,
        data.image_url || null,
        clipStr(data.competition_name, 255) || null,
        clipStr(data.tournament_id, 36) || null,
        clipStr(data.tournament_type, 30) || null,
        data.is_official ? 1 : 0,
        clipStr(data.rarity, 20) || 'common',
        data.admin_only ? 1 : 0,
        data.sort_order ?? 0,
        data.price || 0,
        clipStr(data.linked_source_type, 50) || null,
        clipStr(data.linked_source_id, 36) || null,
        clipStr(data.linked_source_name, 255) || null,
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
      'linked_source_type', 'linked_source_id', 'linked_source_name',
    ];
    const clipLen = {
      name: 200,
      competition_name: 255,
      tournament_id: 36,
      tournament_type: 30,
      rarity: 20,
      linked_source_type: 50,
      linked_source_id: 36,
      linked_source_name: 255,
    };
    for (const key of updatable) {
      if (data[key] !== undefined) {
        fields.push(`${key} = ?`);
        const max = clipLen[key];
        let val = data[key];
        if (max != null && typeof val === 'string') val = clipStr(val, max);
        params.push(val);
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

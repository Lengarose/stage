const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class TrophyItemModel {
  static async getAll({ limit = 25, offset = 0, rarity } = {}) {
    let sql = 'SELECT * FROM trophy_items WHERE 1=1';
    const params = [];
    if (rarity) { sql += ' AND rarity = ?'; params.push(rarity); }
    sql += ' ORDER BY created_date DESC LIMIT ? OFFSET ?';
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
      `INSERT INTO trophy_items (id, name, description, image_url, rarity, price, created_date)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [id, data.name, data.description, data.image_url, data.rarity || 'common', data.price || 0]
    );
    return this.getById(id);
  }

  static async update(id, data) {
    const fields = [];
    const params = [];
    if (data.name        !== undefined) { fields.push('name = ?');        params.push(data.name); }
    if (data.description !== undefined) { fields.push('description = ?'); params.push(data.description); }
    if (data.image_url   !== undefined) { fields.push('image_url = ?');   params.push(data.image_url); }
    if (data.rarity      !== undefined) { fields.push('rarity = ?');      params.push(data.rarity); }
    if (data.price       !== undefined) { fields.push('price = ?');       params.push(data.price); }
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

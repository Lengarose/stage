const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class UserPurchaseModel {
  static async getAll({ limit = 25, offset = 0, player_id, item_type } = {}) {
    let sql = 'SELECT * FROM user_purchases WHERE 1=1';
    const params = [];
    if (player_id) { sql += ' AND player_id = ?'; params.push(player_id); }
    if (item_type) { sql += ' AND item_type = ?'; params.push(item_type); }
    sql += ' ORDER BY purchase_date DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));
    return EXECUTESQL(sql, params);
  }

  static async getById(id) {
    const rows = await EXECUTESQL('SELECT * FROM user_purchases WHERE id = ?', [id]);
    return rows[0] || null;
  }

  static async create(data) {
    const id = uuidv4();
    await EXECUTESQL(
      `INSERT INTO user_purchases (id, player_id, item_id, item_type, amount_paid, currency, purchase_date)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [id, data.player_id, data.item_id, data.item_type, data.amount_paid, data.currency || 'STC']
    );
    return this.getById(id);
  }

  static async update(id, data) {
    const fields = [];
    const params = [];
    if (data.amount_paid !== undefined) { fields.push('amount_paid = ?'); params.push(data.amount_paid); }
    if (data.currency    !== undefined) { fields.push('currency = ?');    params.push(data.currency); }
    if (!fields.length) return this.getById(id);
    params.push(id);
    await EXECUTESQL(`UPDATE user_purchases SET ${fields.join(', ')} WHERE id = ?`, params);
    return this.getById(id);
  }

  static async delete(id) {
    return EXECUTESQL('DELETE FROM user_purchases WHERE id = ?', [id]);
  }
}

module.exports = UserPurchaseModel;

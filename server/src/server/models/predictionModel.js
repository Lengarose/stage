const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class PredictionModel {
  static async getAll({ limit = 25, offset = 0, player_id, match_id } = {}) {
    let sql = 'SELECT * FROM predictions WHERE 1=1';
    const params = [];
    if (player_id) { sql += ' AND player_id = ?'; params.push(player_id); }
    if (match_id)  { sql += ' AND match_id = ?';  params.push(match_id); }
    sql += ' ORDER BY created_date DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));
    return EXECUTESQL(sql, params);
  }

  static async getById(id) {
    const rows = await EXECUTESQL('SELECT * FROM predictions WHERE id = ?', [id]);
    return rows[0] || null;
  }

  static async create(data) {
    const id = uuidv4();
    await EXECUTESQL(
      `INSERT INTO predictions (id, player_id, match_id, home_score, away_score, status, points_earned, created_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [id, data.player_id, data.match_id, data.home_score, data.away_score, data.status || 'pending', data.points_earned || 0]
    );
    return this.getById(id);
  }

  static async update(id, data) {
    const fields = [];
    const params = [];
    if (data.home_score    !== undefined) { fields.push('home_score = ?');    params.push(data.home_score); }
    if (data.away_score    !== undefined) { fields.push('away_score = ?');    params.push(data.away_score); }
    if (data.status        !== undefined) { fields.push('status = ?');        params.push(data.status); }
    if (data.points_earned !== undefined) { fields.push('points_earned = ?'); params.push(data.points_earned); }
    if (!fields.length) return this.getById(id);
    params.push(id);
    await EXECUTESQL(`UPDATE predictions SET ${fields.join(', ')} WHERE id = ?`, params);
    return this.getById(id);
  }

  static async delete(id) {
    return EXECUTESQL('DELETE FROM predictions WHERE id = ?', [id]);
  }
}

module.exports = PredictionModel;

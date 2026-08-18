const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class Follow {
  static async getAll({
    follower_id,
    follower_email,
    follower_player_id,
    target_id,
    target_type,
    limit = 200,
  } = {}) {
    let sql = 'SELECT * FROM follows WHERE 1=1';
    const params = [];
    if (follower_id) {
      sql += ' AND follower_id = ?';
      params.push(follower_id);
    }
    if (follower_email) {
      sql += ' AND LOWER(TRIM(follower_email)) = LOWER(TRIM(?))';
      params.push(follower_email);
    }
    if (follower_player_id) {
      sql += ' AND follower_player_id = ?';
      params.push(follower_player_id);
    }
    if (target_id) {
      sql += ' AND target_id = ?';
      params.push(target_id);
    }
    if (target_type) {
      sql += ' AND target_type = ?';
      params.push(target_type);
    }
    sql += ' ORDER BY created_date DESC LIMIT ?';
    params.push(Math.min(500, Math.max(1, Number(limit) || 200)));
    return EXECUTESQL(sql, params);
  }

  static async getById(id) {
    const rows = await EXECUTESQL('SELECT * FROM follows WHERE id = ? LIMIT 1', [id]);
    return rows[0] || null;
  }

  static async findOne({ follower_id, target_id, target_type }) {
    const rows = await EXECUTESQL(
      'SELECT * FROM follows WHERE follower_id = ? AND target_id = ? AND target_type = ? LIMIT 1',
      [follower_id, target_id, target_type]
    );
    return rows[0] || null;
  }

  static async create(data) {
    const existing = await Follow.findOne({
      follower_id: data.follower_id,
      target_id: data.target_id,
      target_type: data.target_type,
    });
    if (existing) return existing;

    const id = data.id || uuidv4();
    try {
      await EXECUTESQL(
        `INSERT INTO follows
          (id, follower_id, follower_email, follower_player_id, target_id, target_type, target_name)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          data.follower_id,
          data.follower_email || null,
          data.follower_player_id || null,
          data.target_id,
          data.target_type,
          data.target_name || null,
        ]
      );
    } catch (err) {
      if (err && (err.code === 'ER_DUP_ENTRY' || err.errno === 1062)) {
        return Follow.findOne({
          follower_id: data.follower_id,
          target_id: data.target_id,
          target_type: data.target_type,
        });
      }
      throw err;
    }
    return Follow.getById(id);
  }

  static async delete(id) {
    await EXECUTESQL('DELETE FROM follows WHERE id = ?', [id]);
    return { success: true, id };
  }
}

module.exports = Follow;

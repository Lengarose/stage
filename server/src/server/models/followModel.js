const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class Follow {
  constructor(body = {}) {
    this.id               = body.id;
    this.follower_email   = body.follower_email;
    this.follower_player_id = body.follower_player_id;
    this.target_id        = body.target_id;
    this.target_type      = body.target_type;
    this.target_name      = body.target_name;
  }

  selectAll(page = 1) {
    const pageSize = 25;
    const offset   = (page - 1) * pageSize;
    return EXECUTESQL('SELECT * FROM follows LIMIT ? OFFSET ?', [pageSize, offset]);
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM follows WHERE id = ?', [id]);
  }

  selectByFollower(email) {
    return EXECUTESQL('SELECT * FROM follows WHERE follower_email = ?', [email]);
  }

  selectByTarget(target_id, target_type) {
    return EXECUTESQL(
      'SELECT * FROM follows WHERE target_id = ? AND target_type = ?',
      [target_id, target_type]
    );
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO follows
      (id, follower_email, follower_player_id, target_id, target_type, target_name)
      VALUES (?,?,?,?,?,?)`;
    const values = [
      this.id, this.follower_email, this.follower_player_id,
      this.target_id, this.target_type, this.target_name,
    ];
    return EXECUTESQL(sql, values);
  }

  update(id) {
    const sql = `UPDATE follows SET
      follower_email=?, follower_player_id=?, target_id=?, target_type=?, target_name=?
      WHERE id=?`;
    const values = [
      this.follower_email, this.follower_player_id, this.target_id,
      this.target_type, this.target_name,
      id,
    ];
    return EXECUTESQL(sql, values);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM follows WHERE id = ?', [id]);
  }
}

module.exports = Follow;

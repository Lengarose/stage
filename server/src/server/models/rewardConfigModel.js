const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class RewardConfigModel {
  constructor(body = {}) {
    this.id             = body.id;
    this.source_id      = body.source_id;
    this.source_type    = body.source_type;
    this.source_name    = body.source_name;
    this.position       = body.position;
    this.position_label = body.position_label;
    this.badge_type     = body.badge_type || 'participant';
    this.stc_amount     = body.stc_amount ?? 0;
  }

  selectAll(page = 1) {
    const pageSize = 25;
    const offset   = (page - 1) * pageSize;
    return EXECUTESQL('SELECT * FROM reward_configs ORDER BY source_id, position ASC LIMIT ? OFFSET ?', [pageSize, offset]);
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM reward_configs WHERE id = ?', [id]);
  }

  selectBySource(source_id) {
    return EXECUTESQL('SELECT * FROM reward_configs WHERE source_id = ? ORDER BY position ASC', [source_id]);
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO reward_configs
      (id, source_id, source_type, source_name, position, position_label, badge_type, stc_amount)
      VALUES (?,?,?,?,?,?,?,?)`;
    const values = [
      this.id, this.source_id, this.source_type, this.source_name,
      this.position, this.position_label, this.badge_type, this.stc_amount,
    ];
    return EXECUTESQL(sql, values);
  }

  update(id) {
    const sql = `UPDATE reward_configs SET
      source_id=?, source_type=?, source_name=?,
      position=?, position_label=?, badge_type=?, stc_amount=?
      WHERE id=?`;
    const values = [
      this.source_id, this.source_type, this.source_name,
      this.position, this.position_label, this.badge_type, this.stc_amount,
      id,
    ];
    return EXECUTESQL(sql, values);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM reward_configs WHERE id = ?', [id]);
  }
}

module.exports = RewardConfigModel;

const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class PlayerContractHistoryModel {
  constructor(body = {}) {
    this.id          = body.id;
    this.contract_id = body.contract_id;
    this.action_type = body.action_type;
    this.action_by   = body.action_by;
    this.action_note = body.action_note;
  }

  selectAll(page = 1) {
    const pageSize = 25;
    const offset   = (page - 1) * pageSize;
    return EXECUTESQL('SELECT * FROM player_contract_history ORDER BY created_date DESC LIMIT ? OFFSET ?', [pageSize, offset]);
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM player_contract_history WHERE id = ?', [id]);
  }

  selectByContract(contract_id) {
    return EXECUTESQL('SELECT * FROM player_contract_history WHERE contract_id = ? ORDER BY created_date ASC', [contract_id]);
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO player_contract_history
      (id, contract_id, action_type, action_by, action_note)
      VALUES (?,?,?,?,?)`;
    const values = [
      this.id, this.contract_id, this.action_type, this.action_by, this.action_note,
    ];
    return EXECUTESQL(sql, values);
  }

  update(id) {
    const sql = `UPDATE player_contract_history SET
      contract_id=?, action_type=?, action_by=?, action_note=?
      WHERE id=?`;
    const values = [
      this.contract_id, this.action_type, this.action_by, this.action_note,
      id,
    ];
    return EXECUTESQL(sql, values);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM player_contract_history WHERE id = ?', [id]);
  }
}

module.exports = PlayerContractHistoryModel;

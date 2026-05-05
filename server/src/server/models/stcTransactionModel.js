const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class StcTransaction {
  constructor(body = {}) {
    this.id           = body.id;
    this.club_id      = body.club_id;
    this.amount       = body.amount;
    this.type         = body.type;
    this.description  = body.description;
    this.reference_id = body.reference_id;
  }

  selectAll(page = 1) {
    const pageSize = 25;
    const offset   = (page - 1) * pageSize;
    return EXECUTESQL('SELECT * FROM stc_transactions ORDER BY id DESC LIMIT ? OFFSET ?', [pageSize, offset]);
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM stc_transactions WHERE id = ?', [id]);
  }

  selectByClub(club_id) {
    return EXECUTESQL(
      'SELECT * FROM stc_transactions WHERE club_id = ? ORDER BY id DESC',
      [club_id]
    );
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO stc_transactions
      (id, club_id, amount, type, description, reference_id)
      VALUES (?,?,?,?,?,?)`;
    const values = [
      this.id, this.club_id, this.amount, this.type,
      this.description, this.reference_id,
    ];
    return EXECUTESQL(sql, values);
  }

  update(id) {
    const sql = `UPDATE stc_transactions SET
      club_id=?, amount=?, type=?, description=?, reference_id=?
      WHERE id=?`;
    const values = [
      this.club_id, this.amount, this.type, this.description,
      this.reference_id,
      id,
    ];
    return EXECUTESQL(sql, values);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM stc_transactions WHERE id = ?', [id]);
  }
}

module.exports = StcTransaction;

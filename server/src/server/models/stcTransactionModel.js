const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class StcTransaction {
  constructor(body = {}) {
    this.id           = body.id;
    this.club_id      = body.club_id;
    this.amount       = body.amount;
    this.balance_after= body.balance_after;
    this.type         = body.type;
    this.category     = body.category;
    this.description  = body.description;
    this.reference_id = body.reference_id;
  }

  selectAll(page = 1) {
    const pageSize = 25;
    const offset   = (page - 1) * pageSize;
    return EXECUTESQL('SELECT * FROM stc_transactions ORDER BY created_date DESC LIMIT ? OFFSET ?', [pageSize, offset]);
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM stc_transactions WHERE id = ?', [id]);
  }

  selectByClub(club_id, limit = 50, offset = 0) {
    return EXECUTESQL(
      'SELECT * FROM stc_transactions WHERE club_id = ? ORDER BY created_date DESC LIMIT ? OFFSET ?',
      [club_id, limit, offset]
    );
  }

  selectByType(type) {
    return EXECUTESQL(
      'SELECT * FROM stc_transactions WHERE type = ? ORDER BY created_date DESC',
      [type]
    );
  }

  selectByClubAndCategory(club_id, category) {
    return EXECUTESQL(
      'SELECT * FROM stc_transactions WHERE club_id = ? AND category = ? ORDER BY created_date DESC',
      [club_id, category]
    );
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO stc_transactions
      (id, club_id, amount, balance_after, type, category, description, reference_id, created_date)
      VALUES (?,?,?,?,?,?,?,?,NOW())`;
    return EXECUTESQL(sql, [
      this.id, this.club_id, this.amount, this.balance_after ?? null,
      this.type || null, this.category || null,
      this.description || null, this.reference_id || null,
    ]);
  }

  update(id) {
    const sql = `UPDATE stc_transactions SET
      club_id=?, amount=?, balance_after=?, type=?, category=?, description=?, reference_id=?
      WHERE id=?`;
    return EXECUTESQL(sql, [
      this.club_id, this.amount, this.balance_after ?? null,
      this.type || null, this.category || null,
      this.description || null, this.reference_id || null,
      id,
    ]);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM stc_transactions WHERE id = ?', [id]);
  }
}

module.exports = StcTransaction;

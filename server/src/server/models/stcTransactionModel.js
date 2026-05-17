const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class StcTransaction {
  constructor(body = {}) {
    this.id           = body.id;
    this.player_id    = body.player_id;
    this.player_email = body.player_email;
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

  selectByClub(club_id) {
    return EXECUTESQL('SELECT * FROM stc_transactions WHERE club_id = ? ORDER BY id DESC', [club_id]);
  }

  selectByPlayer(player_id) {
    return EXECUTESQL('SELECT * FROM stc_transactions WHERE player_id = ? ORDER BY id DESC', [player_id]);
  }

  selectByType(type) {
    return EXECUTESQL('SELECT * FROM stc_transactions WHERE type = ? ORDER BY id DESC', [type]);
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
      (id, player_id, player_email, club_id, amount, balance_after, type, category, description, reference_id)
      VALUES (?,?,?,?,?,?,?,?,?,?)`;
    const values = [
      this.id, this.player_id, this.player_email, this.club_id,
      this.amount, this.balance_after, this.type, this.category,
      this.description, this.reference_id,
    ];
    return EXECUTESQL(sql, values);
  }

  update(id) {
    const sql = `UPDATE stc_transactions SET
      player_id=?, player_email=?, club_id=?, amount=?, balance_after=?, type=?, category=?, description=?, reference_id=?
      WHERE id=?`;
    const values = [
      this.player_id, this.player_email, this.club_id,
      this.amount, this.balance_after, this.type, this.category,
      this.description, this.reference_id,
      id,
    ];
    return EXECUTESQL(sql, values);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM stc_transactions WHERE id = ?', [id]);
  }
}

module.exports = StcTransaction;

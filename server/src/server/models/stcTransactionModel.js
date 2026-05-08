const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class StcTransaction {
  constructor(body = {}) {
    this.id           = body.id;
    this.player_id    = body.player_id;
    this.player_email = body.player_email;
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
    return EXECUTESQL('SELECT * FROM stc_transactions WHERE club_id = ? ORDER BY id DESC', [club_id]);
  }

  selectByPlayer(player_id) {
    return EXECUTESQL('SELECT * FROM stc_transactions WHERE player_id = ? ORDER BY id DESC', [player_id]);
  }

  selectByType(type) {
    return EXECUTESQL('SELECT * FROM stc_transactions WHERE type = ? ORDER BY id DESC', [type]);
  }

  selectByClubAndType(club_id, type) {
    return EXECUTESQL(
      'SELECT * FROM stc_transactions WHERE club_id = ? AND type = ? ORDER BY id DESC',
      [club_id, type]
    );
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO stc_transactions
      (id, player_id, player_email, club_id, amount, type, description, reference_id)
      VALUES (?,?,?,?,?,?,?,?)`;
    const values = [
      this.id, this.player_id, this.player_email, this.club_id,
      this.amount, this.type, this.description, this.reference_id,
    ];
    return EXECUTESQL(sql, values);
  }

  update(id) {
    const sql = `UPDATE stc_transactions SET
      player_id=?, player_email=?, club_id=?, amount=?, type=?, description=?, reference_id=?
      WHERE id=?`;
    const values = [
      this.player_id, this.player_email, this.club_id,
      this.amount, this.type, this.description, this.reference_id,
      id,
    ];
    return EXECUTESQL(sql, values);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM stc_transactions WHERE id = ?', [id]);
  }
}

module.exports = StcTransaction;

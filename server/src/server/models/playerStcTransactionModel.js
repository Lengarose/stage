const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class PlayerStcTransaction {
  constructor(body = {}) {
    this.id           = body.id;
    this.player_id    = body.player_id;
    this.player_email = body.player_email;
    this.amount       = body.amount;
    this.balance_after = body.balance_after;
    this.type         = body.type;        // 'income' | 'expense'
    this.category     = body.category;   // 'salary', 'lifestyle_purchase', 'wager_win', etc.
    this.source       = body.source;
    this.description  = body.description;
    this.reference_id = body.reference_id;
  }

  selectAll(page = 1) {
    const pageSize = 50;
    const offset   = (page - 1) * pageSize;
    return EXECUTESQL('SELECT * FROM player_stc_transactions ORDER BY created_date DESC LIMIT ? OFFSET ?', [pageSize, offset]);
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM player_stc_transactions WHERE id = ?', [id]);
  }

  selectByPlayer(player_id, limit = 50, offset = 0) {
    return EXECUTESQL(
      'SELECT * FROM player_stc_transactions WHERE player_id = ? ORDER BY created_date DESC LIMIT ? OFFSET ?',
      [player_id, limit, offset]
    );
  }

  selectByPlayerEmail(player_email, limit = 50) {
    return EXECUTESQL(
      'SELECT * FROM player_stc_transactions WHERE player_email = ? ORDER BY created_date DESC LIMIT ?',
      [player_email, limit]
    );
  }

  create() {
    this.id = this.id || uuidv4();
    return EXECUTESQL(
      `INSERT INTO player_stc_transactions
         (id, player_id, player_email, amount, balance_after, type, category, source, description, reference_id, created_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [this.id, this.player_id, this.player_email || null, this.amount, this.balance_after ?? null,
       this.type || null, this.category || null, this.source || null,
       this.description || null, this.reference_id || null]
    );
  }

  update(id) {
    return EXECUTESQL(
      `UPDATE player_stc_transactions SET
         player_id=?, player_email=?, amount=?, balance_after=?, type=?, category=?, source=?, description=?, reference_id=?
       WHERE id=?`,
      [this.player_id, this.player_email, this.amount, this.balance_after,
       this.type, this.category, this.source, this.description, this.reference_id, id]
    );
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM player_stc_transactions WHERE id = ?', [id]);
  }
}

module.exports = PlayerStcTransaction;

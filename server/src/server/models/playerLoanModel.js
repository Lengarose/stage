const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class PlayerLoan {
  constructor(body = {}) {
    this.id = body.id;
    this.player_id = body.player_id;
    this.contract_id = body.contract_id;
    this.parent_club_id = body.parent_club_id;
    this.loan_club_id = body.loan_club_id;
    this.start_date = body.start_date;
    this.end_date = body.end_date;
    this.loan_fee_stc = body.loan_fee_stc;
    this.parent_wage_percentage = body.parent_wage_percentage;
    this.loan_wage_percentage = body.loan_wage_percentage;
    this.recall_allowed = body.recall_allowed;
    this.recall_after_date = body.recall_after_date;
    this.status = body.status || 'PROPOSED';
    this.proposed_by_club_id = body.proposed_by_club_id;
  }

  selectAll({ player_id, parent_club_id, loan_club_id, status, limit = 100, offset = 0 } = {}) {
    const where = [];
    const params = [];
    if (player_id) { where.push('pl.player_id = ?'); params.push(player_id); }
    if (parent_club_id) { where.push('pl.parent_club_id = ?'); params.push(parent_club_id); }
    if (loan_club_id) { where.push('pl.loan_club_id = ?'); params.push(loan_club_id); }
    if (status) { where.push('pl.status = ?'); params.push(status); }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    params.push(Math.min(Number(limit) || 100, 300), Number(offset) || 0);
    return EXECUTESQL(
      `SELECT pl.*,
              p.gamertag AS player_gamertag,
              parent.name AS parent_club_name,
              loaner.name AS loan_club_name
         FROM player_loans pl
         LEFT JOIN players p ON p.id = pl.player_id
         LEFT JOIN clubs parent ON parent.id = pl.parent_club_id
         LEFT JOIN clubs loaner ON loaner.id = pl.loan_club_id
         ${clause}
         ORDER BY pl.created_date DESC
         LIMIT ? OFFSET ?`,
      params
    );
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM player_loans WHERE id = ?', [id]);
  }

  create() {
    this.id = this.id || uuidv4();
    return EXECUTESQL(
      `INSERT INTO player_loans
        (id, player_id, contract_id, parent_club_id, loan_club_id, start_date, end_date,
         loan_fee_stc, parent_wage_percentage, loan_wage_percentage, status, proposed_by_club_id,
         recall_allowed, recall_after_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        this.id, this.player_id, this.contract_id, this.parent_club_id, this.loan_club_id,
        this.start_date, this.end_date, this.loan_fee_stc, this.parent_wage_percentage,
        this.loan_wage_percentage, this.status, this.proposed_by_club_id,
        this.recall_allowed == null ? 1 : this.recall_allowed,
        this.recall_after_date || null,
      ]
    );
  }

  update(id) {
    return EXECUTESQL(
      `UPDATE player_loans
          SET start_date = ?, end_date = ?, loan_fee_stc = ?, parent_wage_percentage = ?,
              loan_wage_percentage = ?, status = ?, updated_date = NOW()
        WHERE id = ?`,
      [
        this.start_date, this.end_date, this.loan_fee_stc, this.parent_wage_percentage,
        this.loan_wage_percentage, this.status, id,
      ]
    );
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM player_loans WHERE id = ?', [id]);
  }
}

module.exports = PlayerLoan;

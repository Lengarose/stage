const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class FaqItem {
  constructor(body = {}) {
    this.id         = body.id;
    this.question   = body.question;
    this.answer     = body.answer;
    this.sort_order = body.sort_order != null ? Number(body.sort_order) : 0;
    this.is_active  = body.is_active != null ? (Number(body.is_active) ? 1 : 0) : 1;
  }

  selectAll(query = {}) {
    let sql = 'SELECT * FROM faq_items WHERE 1=1';
    const params = [];

    if (query.is_active !== undefined && query.is_active !== '') {
      sql += ' AND is_active = ?';
      params.push(Number(query.is_active) ? 1 : 0);
    }

    sql += ' ORDER BY sort_order ASC, created_date ASC';

    const limit = Number(query.limit);
    if (limit > 0) {
      sql += ' LIMIT ?';
      params.push(limit);
    }

    return EXECUTESQL(sql, params);
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM faq_items WHERE id = ? LIMIT 1', [id]);
  }

  create() {
    this.id = this.id || uuidv4();
    return EXECUTESQL(
      `INSERT INTO faq_items (id, question, answer, sort_order, is_active)
       VALUES (?,?,?,?,?)`,
      [this.id, this.question, this.answer, this.sort_order, this.is_active]
    );
  }

  update(id) {
    return EXECUTESQL(
      `UPDATE faq_items SET question=?, answer=?, sort_order=?, is_active=? WHERE id=?`,
      [this.question, this.answer, this.sort_order, this.is_active, id]
    );
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM faq_items WHERE id = ?', [id]);
  }
}

module.exports = FaqItem;

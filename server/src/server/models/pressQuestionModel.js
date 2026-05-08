const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class PressQuestion {
  constructor(body = {}) {
    this.id         = body.id;
    this.category   = body.category;
    this.question   = body.question;
    this.text       = body.text;
    this.answer_a   = body.answer_a;
    this.answer_b   = body.answer_b;
    this.answer_c   = body.answer_c;
    this.answer_d   = body.answer_d;
    this.sort_order = body.sort_order;
  }

  selectAll(page = 1) {
    const pageSize = 25;
    const offset   = (page - 1) * pageSize;
    return EXECUTESQL('SELECT * FROM press_questions ORDER BY sort_order ASC LIMIT ? OFFSET ?', [pageSize, offset]);
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM press_questions WHERE id = ?', [id]);
  }

  selectByCategory(category) {
    return EXECUTESQL(
      'SELECT * FROM press_questions WHERE category = ? ORDER BY sort_order ASC',
      [category]
    );
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO press_questions
      (id, category, question, text, answer_a, answer_b, answer_c, answer_d, sort_order)
      VALUES (?,?,?,?,?,?,?,?,?)`;
    return EXECUTESQL(sql, [
      this.id, this.category, this.question, this.text,
      this.answer_a, this.answer_b, this.answer_c, this.answer_d, this.sort_order,
    ]);
  }

  update(id) {
    const sql = `UPDATE press_questions SET
      category=?, question=?, text=?, answer_a=?, answer_b=?, answer_c=?, answer_d=?, sort_order=?
      WHERE id=?`;
    return EXECUTESQL(sql, [
      this.category, this.question, this.text,
      this.answer_a, this.answer_b, this.answer_c, this.answer_d, this.sort_order,
      id,
    ]);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM press_questions WHERE id = ?', [id]);
  }
}

module.exports = PressQuestion;

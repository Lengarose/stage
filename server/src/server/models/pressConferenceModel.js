const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class PressConference {
  constructor(body = {}) {
    this.id                    = body.id;
    this.match_id              = body.match_id;
    this.club_id               = body.club_id;
    this.status                = body.status;
    this.selected_question_ids = body.selected_question_ids
      ? (typeof body.selected_question_ids === 'string'
          ? body.selected_question_ids
          : JSON.stringify(body.selected_question_ids))
      : null;
    this.answers               = body.answers
      ? (typeof body.answers === 'string' ? body.answers : JSON.stringify(body.answers))
      : null;
  }

  selectAll(page = 1) {
    const pageSize = 25;
    const offset   = (page - 1) * pageSize;
    return EXECUTESQL('SELECT * FROM press_conferences LIMIT ? OFFSET ?', [pageSize, offset]);
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM press_conferences WHERE id = ?', [id]);
  }

  selectByMatch(match_id) {
    return EXECUTESQL('SELECT * FROM press_conferences WHERE match_id = ?', [match_id]);
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO press_conferences
      (id, match_id, club_id, status, selected_question_ids, answers)
      VALUES (?,?,?,?,?,?)`;
    const values = [
      this.id, this.match_id, this.club_id, this.status,
      this.selected_question_ids, this.answers,
    ];
    return EXECUTESQL(sql, values);
  }

  update(id) {
    const sql = `UPDATE press_conferences SET
      match_id=?, club_id=?, status=?, selected_question_ids=?, answers=?
      WHERE id=?`;
    const values = [
      this.match_id, this.club_id, this.status,
      this.selected_question_ids, this.answers,
      id,
    ];
    return EXECUTESQL(sql, values);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM press_conferences WHERE id = ?', [id]);
  }
}

module.exports = PressConference;

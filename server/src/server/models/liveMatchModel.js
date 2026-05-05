const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class LiveMatch {
  constructor(body = {}) {
    this.id          = body.id;
    this.match_id    = body.match_id;
    this.home_club_id = body.home_club_id;
    this.away_club_id = body.away_club_id;
    this.home_score  = body.home_score;
    this.away_score  = body.away_score;
    this.minute      = body.minute;
    this.status      = body.status;
    this.events      = body.events
      ? (typeof body.events === 'string' ? body.events : JSON.stringify(body.events))
      : null;
  }

  selectAll(page = 1) {
    const pageSize = 25;
    const offset   = (page - 1) * pageSize;
    return EXECUTESQL('SELECT * FROM live_matches LIMIT ? OFFSET ?', [pageSize, offset]);
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM live_matches WHERE id = ?', [id]);
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO live_matches
      (id, match_id, home_club_id, away_club_id, home_score, away_score, minute, status, events)
      VALUES (?,?,?,?,?,?,?,?,?)`;
    const values = [
      this.id, this.match_id, this.home_club_id, this.away_club_id,
      this.home_score, this.away_score, this.minute, this.status, this.events,
    ];
    return EXECUTESQL(sql, values);
  }

  update(id) {
    const sql = `UPDATE live_matches SET
      match_id=?, home_club_id=?, away_club_id=?, home_score=?,
      away_score=?, minute=?, status=?, events=?
      WHERE id=?`;
    const values = [
      this.match_id, this.home_club_id, this.away_club_id,
      this.home_score, this.away_score, this.minute, this.status, this.events,
      id,
    ];
    return EXECUTESQL(sql, values);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM live_matches WHERE id = ?', [id]);
  }
}

module.exports = LiveMatch;

const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class DressingRoom {
  constructor(body = {}) {
    this.id             = body.id;
    this.match_id       = body.match_id;
    this.club_id        = body.club_id;
    this.seated_players = body.seated_players
      ? (typeof body.seated_players === 'string'
          ? body.seated_players
          : JSON.stringify(body.seated_players))
      : null;
  }

  selectAll(page = 1) {
    const pageSize = 25;
    const offset   = (page - 1) * pageSize;
    return EXECUTESQL('SELECT * FROM dressing_rooms LIMIT ? OFFSET ?', [pageSize, offset]);
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM dressing_rooms WHERE id = ?', [id]);
  }

  selectByMatch(match_id) {
    return EXECUTESQL('SELECT * FROM dressing_rooms WHERE match_id = ?', [match_id]);
  }

  selectByClub(club_id) {
    return EXECUTESQL('SELECT * FROM dressing_rooms WHERE club_id = ?', [club_id]);
  }

  selectByMatchAndClub(match_id, club_id) {
    return EXECUTESQL('SELECT * FROM dressing_rooms WHERE match_id = ? AND club_id = ?', [match_id, club_id]);
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO dressing_rooms (id, match_id, club_id, seated_players) VALUES (?,?,?,?)`;
    return EXECUTESQL(sql, [this.id, this.match_id, this.club_id, this.seated_players]);
  }

  update(id) {
    const sql = `UPDATE dressing_rooms SET match_id=?, club_id=?, seated_players=? WHERE id=?`;
    return EXECUTESQL(sql, [this.match_id, this.club_id, this.seated_players, id]);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM dressing_rooms WHERE id = ?', [id]);
  }
}

module.exports = DressingRoom;

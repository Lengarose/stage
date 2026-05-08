const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class JoinRequest {
  constructor(body = {}) {
    this.id              = body.id;
    this.player_id       = body.player_id;
    this.player_email    = body.player_email;
    this.player_gamertag = body.player_gamertag;
    this.club_id         = body.club_id;
    this.club_name       = body.club_name;
    this.message         = body.message;
    this.status          = body.status;
  }

  selectAll(page = 1) {
    const pageSize = 25;
    const offset   = (page - 1) * pageSize;
    return EXECUTESQL('SELECT * FROM join_requests ORDER BY id DESC LIMIT ? OFFSET ?', [pageSize, offset]);
  }

  selectFiltered({ club_id, player_id, player_email, status } = {}) {
    const conditions = [];
    const params = [];
    if (club_id)      { conditions.push('club_id = ?');      params.push(club_id); }
    if (player_id)    { conditions.push('player_id = ?');    params.push(player_id); }
    if (player_email) { conditions.push('player_email = ?'); params.push(player_email); }
    if (status)       { conditions.push('status = ?');       params.push(status); }
    const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
    return EXECUTESQL(`SELECT * FROM join_requests${where} ORDER BY id DESC`, params);
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM join_requests WHERE id = ?', [id]);
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO join_requests
      (id, player_id, player_email, player_gamertag, club_id, club_name, message, status)
      VALUES (?,?,?,?,?,?,?,?)`;
    const values = [
      this.id, this.player_id, this.player_email, this.player_gamertag,
      this.club_id, this.club_name, this.message, this.status,
    ];
    return EXECUTESQL(sql, values);
  }

  update(id) {
    const sql = `UPDATE join_requests SET
      player_id=?, player_email=?, player_gamertag=?, club_id=?, club_name=?, message=?, status=?
      WHERE id=?`;
    const values = [
      this.player_id, this.player_email, this.player_gamertag,
      this.club_id, this.club_name, this.message, this.status,
      id,
    ];
    return EXECUTESQL(sql, values);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM join_requests WHERE id = ?', [id]);
  }
}

module.exports = JoinRequest;

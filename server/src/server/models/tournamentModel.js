const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class Tournament {
  constructor(body = {}) {
    this.id                 = body.id;
    this.name               = body.name;
    this.status             = body.status;
    this.current_round      = body.current_round;
    this.num_groups         = body.num_groups;
    this.winner_club_id     = body.winner_club_id;
    this.winner_club_name   = body.winner_club_name;
    this.trophy_url         = body.trophy_url;
    this.registered_players = body.registered_players
      ? (typeof body.registered_players === 'string'
          ? body.registered_players
          : JSON.stringify(body.registered_players))
      : null;
    this.registered_clubs   = body.registered_clubs
      ? (typeof body.registered_clubs === 'string'
          ? body.registered_clubs
          : JSON.stringify(body.registered_clubs))
      : null;
  }

  selectAll(page = 1) {
    const pageSize = 25;
    const offset   = (page - 1) * pageSize;
    return EXECUTESQL('SELECT * FROM tournaments LIMIT ? OFFSET ?', [pageSize, offset]);
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM tournaments WHERE id = ?', [id]);
  }

  selectByStatus(status) {
    return EXECUTESQL('SELECT * FROM tournaments WHERE status = ?', [status]);
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO tournaments
      (id, name, status, current_round, num_groups, winner_club_id,
       winner_club_name, trophy_url, registered_players, registered_clubs)
      VALUES (?,?,?,?,?,?,?,?,?,?)`;
    const values = [
      this.id, this.name, this.status, this.current_round, this.num_groups,
      this.winner_club_id, this.winner_club_name, this.trophy_url,
      this.registered_players, this.registered_clubs,
    ];
    return EXECUTESQL(sql, values);
  }

  update(id) {
    const sql = `UPDATE tournaments SET
      name=?, status=?, current_round=?, num_groups=?, winner_club_id=?,
      winner_club_name=?, trophy_url=?, registered_players=?, registered_clubs=?
      WHERE id=?`;
    const values = [
      this.name, this.status, this.current_round, this.num_groups,
      this.winner_club_id, this.winner_club_name, this.trophy_url,
      this.registered_players, this.registered_clubs,
      id,
    ];
    return EXECUTESQL(sql, values);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM tournaments WHERE id = ?', [id]);
  }
}

module.exports = Tournament;

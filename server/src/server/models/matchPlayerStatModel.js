const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class MatchPlayerStat {
  constructor(body = {}) {
    this.id           = body.id;
    this.match_id     = body.match_id;
    this.tournament_id = body.tournament_id;
    this.club_id      = body.club_id;
    this.player_email = body.player_email;
    this.goals        = body.goals;
    this.assists      = body.assists;
    this.rating       = body.rating;
  }

  selectAll(page = 1) {
    const pageSize = 25;
    const offset   = (page - 1) * pageSize;
    return EXECUTESQL('SELECT * FROM match_player_stats LIMIT ? OFFSET ?', [pageSize, offset]);
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM match_player_stats WHERE id = ?', [id]);
  }

  selectByMatch(match_id) {
    return EXECUTESQL('SELECT * FROM match_player_stats WHERE match_id = ?', [match_id]);
  }

  selectByPlayer(player_email) {
    return EXECUTESQL('SELECT * FROM match_player_stats WHERE player_email = ?', [player_email]);
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO match_player_stats
      (id, match_id, tournament_id, club_id, player_email, goals, assists, rating)
      VALUES (?,?,?,?,?,?,?,?)`;
    const values = [
      this.id, this.match_id, this.tournament_id, this.club_id,
      this.player_email, this.goals, this.assists, this.rating,
    ];
    return EXECUTESQL(sql, values);
  }

  update(id) {
    const sql = `UPDATE match_player_stats SET
      match_id=?, tournament_id=?, club_id=?, player_email=?,
      goals=?, assists=?, rating=?
      WHERE id=?`;
    const values = [
      this.match_id, this.tournament_id, this.club_id, this.player_email,
      this.goals, this.assists, this.rating,
      id,
    ];
    return EXECUTESQL(sql, values);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM match_player_stats WHERE id = ?', [id]);
  }
}

module.exports = MatchPlayerStat;

const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class MatchPlayerStat {
  constructor(body = {}) {
    this.id              = body.id;
    this.match_id        = body.match_id;
    this.tournament_id   = body.tournament_id;
    this.club_id         = body.club_id;
    this.player_id       = body.player_id;
    this.player_email    = body.player_email;
    this.player_gamertag = body.player_gamertag;
    this.position        = body.position;
    this.goals           = body.goals;
    this.assists         = body.assists;
    this.own_goals       = body.own_goals;
    this.clean_sheet     = body.clean_sheet;
    this.is_motm         = body.is_motm;
    this.rating          = body.rating;
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

  selectByPlayerId(player_id) {
    return EXECUTESQL('SELECT * FROM match_player_stats WHERE player_id = ?', [player_id]);
  }

  selectByClub(club_id) {
    return EXECUTESQL('SELECT * FROM match_player_stats WHERE club_id = ?', [club_id]);
  }

  selectByClubAndPlayer(club_id, player_id) {
    return EXECUTESQL('SELECT * FROM match_player_stats WHERE club_id = ? AND player_id = ?', [club_id, player_id]);
  }

  selectByClubAndPlayerEmail(club_id, player_email) {
    return EXECUTESQL('SELECT * FROM match_player_stats WHERE club_id = ? AND LOWER(player_email) = LOWER(?)', [club_id, player_email]);
  }

  selectByTournament(tournament_id) {
    return EXECUTESQL('SELECT * FROM match_player_stats WHERE tournament_id = ?', [tournament_id]);
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO match_player_stats
      (id, match_id, tournament_id, club_id, player_id, player_email, player_gamertag,
       position, goals, assists, own_goals, clean_sheet, is_motm, rating)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
    const values = [
      this.id, this.match_id, this.tournament_id, this.club_id, this.player_id,
      this.player_email, this.player_gamertag, this.position,
      this.goals, this.assists, this.own_goals, this.clean_sheet, this.is_motm, this.rating,
    ];
    return EXECUTESQL(sql, values);
  }

  update(id) {
    const sql = `UPDATE match_player_stats SET
      match_id=?, tournament_id=?, club_id=?, player_id=?, player_email=?, player_gamertag=?,
      position=?, goals=?, assists=?, own_goals=?, clean_sheet=?, is_motm=?, rating=?
      WHERE id=?`;
    const values = [
      this.match_id, this.tournament_id, this.club_id, this.player_id,
      this.player_email, this.player_gamertag, this.position,
      this.goals, this.assists, this.own_goals, this.clean_sheet, this.is_motm, this.rating,
      id,
    ];
    return EXECUTESQL(sql, values);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM match_player_stats WHERE id = ?', [id]);
  }
}

module.exports = MatchPlayerStat;

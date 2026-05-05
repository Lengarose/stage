const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class Match {
  constructor(body = {}) {
    this.id                = body.id;
    this.home_club_id      = body.home_club_id;
    this.away_club_id      = body.away_club_id;
    this.home_player_id    = body.home_player_id;
    this.away_player_id    = body.away_player_id;
    this.home_club_name    = body.home_club_name;
    this.away_club_name    = body.away_club_name;
    this.home_score        = body.home_score;
    this.away_score        = body.away_score;
    this.status            = body.status;
    this.mode              = body.mode;
    this.type              = body.type;
    this.round             = body.round;
    this.tournament_id     = body.tournament_id;
    this.scheduled_date    = body.scheduled_date;
    this.wager_stc         = body.wager_stc;
    this.wager_status      = body.wager_status;
    this.wager_home_locked = body.wager_home_locked;
    this.wager_away_locked = body.wager_away_locked;
    this.stream_url        = body.stream_url;
    this.stream_embed_html = body.stream_embed_html;
  }

  selectAll(page = 1) {
    const pageSize = 25;
    const offset   = (page - 1) * pageSize;
    return EXECUTESQL('SELECT * FROM matches LIMIT ? OFFSET ?', [pageSize, offset]);
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM matches WHERE id = ?', [id]);
  }

  selectByClub(club_id) {
    return EXECUTESQL(
      'SELECT * FROM matches WHERE home_club_id = ? OR away_club_id = ? ORDER BY scheduled_date DESC',
      [club_id, club_id]
    );
  }

  selectByTournament(tournament_id) {
    return EXECUTESQL('SELECT * FROM matches WHERE tournament_id = ?', [tournament_id]);
  }

  selectByStatus(status) {
    return EXECUTESQL('SELECT * FROM matches WHERE status = ?', [status]);
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO matches
      (id, home_club_id, away_club_id, home_player_id, away_player_id,
       home_club_name, away_club_name, home_score, away_score, status, mode,
       type, round, tournament_id, scheduled_date, wager_stc, wager_status,
       wager_home_locked, wager_away_locked, stream_url, stream_embed_html)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
    const values = [
      this.id, this.home_club_id, this.away_club_id, this.home_player_id,
      this.away_player_id, this.home_club_name, this.away_club_name,
      this.home_score, this.away_score, this.status, this.mode, this.type,
      this.round, this.tournament_id, this.scheduled_date, this.wager_stc,
      this.wager_status, this.wager_home_locked, this.wager_away_locked,
      this.stream_url, this.stream_embed_html,
    ];
    return EXECUTESQL(sql, values);
  }

  update(id) {
    const sql = `UPDATE matches SET
      home_club_id=?, away_club_id=?, home_player_id=?, away_player_id=?,
      home_club_name=?, away_club_name=?, home_score=?, away_score=?,
      status=?, mode=?, type=?, round=?, tournament_id=?, scheduled_date=?,
      wager_stc=?, wager_status=?, wager_home_locked=?, wager_away_locked=?,
      stream_url=?, stream_embed_html=?
      WHERE id=?`;
    const values = [
      this.home_club_id, this.away_club_id, this.home_player_id,
      this.away_player_id, this.home_club_name, this.away_club_name,
      this.home_score, this.away_score, this.status, this.mode, this.type,
      this.round, this.tournament_id, this.scheduled_date, this.wager_stc,
      this.wager_status, this.wager_home_locked, this.wager_away_locked,
      this.stream_url, this.stream_embed_html,
      id,
    ];
    return EXECUTESQL(sql, values);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM matches WHERE id = ?', [id]);
  }
}

module.exports = Match;

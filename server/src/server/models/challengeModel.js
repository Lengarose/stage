const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');
const { toMysqlDateTime } = require('../utils/datetime');

class ChallengeModel {
  constructor(body = {}) {
    this.id                    = body.id;
    this.challenger_id         = body.challenger_id;
    this.challenger_club_id    = body.challenger_club_id;
    this.challenger_club_name  = body.challenger_club_name;
    this.opponent_club_id      = body.opponent_club_id;
    this.opponent_club_name    = body.opponent_club_name;
    this.opponent_player_id    = body.opponent_player_id;
    this.opponent_player_name  = body.opponent_player_name;
    this.type                  = body.type || 'friendly';
    this.scheduled_date        = toMysqlDateTime(body.scheduled_date);
    this.message               = body.message;
    this.status                = body.status || 'pending';
    this.home_score            = body.home_score ?? null;
    this.away_score            = body.away_score ?? null;
    this.winner_club_id        = body.winner_club_id;
    this.winner_player_id      = body.winner_player_id;
    this.wager_credits         = body.wager_credits ?? 0;
    this.challenger_wager_paid = body.challenger_wager_paid ?? false;
    this.opponent_wager_paid   = body.opponent_wager_paid ?? false;
    this.live_match_id         = body.live_match_id;
  }

  selectAll(page = 1) {
    const pageSize = 25;
    const offset   = (page - 1) * pageSize;
    return EXECUTESQL('SELECT * FROM challenges ORDER BY created_date DESC LIMIT ? OFFSET ?', [pageSize, offset]);
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM challenges WHERE id = ?', [id]);
  }

  selectByChallenger(challenger_id) {
    return EXECUTESQL('SELECT * FROM challenges WHERE challenger_id = ? ORDER BY created_date DESC', [challenger_id]);
  }

  selectByOpponent(opponent_club_id) {
    return EXECUTESQL('SELECT * FROM challenges WHERE opponent_club_id = ? ORDER BY created_date DESC', [opponent_club_id]);
  }

  selectByStatus(status) {
    return EXECUTESQL('SELECT * FROM challenges WHERE status = ? ORDER BY created_date DESC', [status]);
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO challenges
      (id, challenger_id, challenger_club_id, challenger_club_name,
       opponent_club_id, opponent_club_name, opponent_player_id, opponent_player_name,
       type, scheduled_date, message, status,
       home_score, away_score, winner_club_id, winner_player_id,
       wager_credits, challenger_wager_paid, opponent_wager_paid, live_match_id)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
    const values = [
      this.id, this.challenger_id, this.challenger_club_id, this.challenger_club_name,
      this.opponent_club_id, this.opponent_club_name, this.opponent_player_id, this.opponent_player_name,
      this.type, this.scheduled_date, this.message, this.status,
      this.home_score, this.away_score, this.winner_club_id, this.winner_player_id,
      this.wager_credits, this.challenger_wager_paid, this.opponent_wager_paid, this.live_match_id,
    ];
    return EXECUTESQL(sql, values);
  }

  update(id) {
    const sql = `UPDATE challenges SET
      challenger_id=?, challenger_club_id=?, challenger_club_name=?,
      opponent_club_id=?, opponent_club_name=?, opponent_player_id=?, opponent_player_name=?,
      type=?, scheduled_date=?, message=?, status=?,
      home_score=?, away_score=?, winner_club_id=?, winner_player_id=?,
      wager_credits=?, challenger_wager_paid=?, opponent_wager_paid=?, live_match_id=?
      WHERE id=?`;
    const values = [
      this.challenger_id, this.challenger_club_id, this.challenger_club_name,
      this.opponent_club_id, this.opponent_club_name, this.opponent_player_id, this.opponent_player_name,
      this.type, this.scheduled_date, this.message, this.status,
      this.home_score, this.away_score, this.winner_club_id, this.winner_player_id,
      this.wager_credits, this.challenger_wager_paid, this.opponent_wager_paid, this.live_match_id,
      id,
    ];
    return EXECUTESQL(sql, values);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM challenges WHERE id = ?', [id]);
  }
}

module.exports = ChallengeModel;

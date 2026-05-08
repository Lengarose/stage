const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

function toMysqlDateTime(val) {
  if (!val) return null;
  return new Date(val).toISOString().slice(0, 19).replace('T', ' ');
}

class RatingHistoryModel {
  constructor(body = {}) {
    this.id                       = body.id;
    this.club_id                  = body.club_id;
    this.club_name                = body.club_name;
    this.opponent_club_id         = body.opponent_club_id;
    this.opponent_club_name       = body.opponent_club_name;
    this.match_id                 = body.match_id;
    this.competition_type         = body.competition_type || 'tournament';
    this.competition_slug         = body.competition_slug;
    this.division                 = body.division ?? null;
    this.phase                    = body.phase;
    this.result                   = body.result;
    this.home_score               = body.home_score ?? 0;
    this.away_score               = body.away_score ?? 0;
    this.points_before            = body.points_before ?? 0;
    this.points_after             = body.points_after ?? 0;
    this.points_change            = body.points_change ?? 0;
    this.opponent_rank            = body.opponent_rank ?? 0;
    this.opp_strength_multiplier  = body.opp_strength_multiplier ?? 1.0;
    this.competition_multiplier   = body.competition_multiplier ?? 1.0;
    this.stage_multiplier         = body.stage_multiplier ?? 1.0;
    this.voided                   = body.voided ?? false;
    this.void_reason              = body.void_reason;
    this.played_at                = toMysqlDateTime(body.played_at);
  }

  selectAll(page = 1) {
    const pageSize = 25;
    const offset   = (page - 1) * pageSize;
    return EXECUTESQL('SELECT * FROM rating_history ORDER BY played_at DESC LIMIT ? OFFSET ?', [pageSize, offset]);
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM rating_history WHERE id = ?', [id]);
  }

  selectByClub(club_id) {
    return EXECUTESQL('SELECT * FROM rating_history WHERE club_id = ? ORDER BY played_at DESC', [club_id]);
  }

  selectByMatch(match_id) {
    return EXECUTESQL('SELECT * FROM rating_history WHERE match_id = ?', [match_id]);
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO rating_history
      (id, club_id, club_name, opponent_club_id, opponent_club_name,
       match_id, competition_type, competition_slug, division, phase,
       result, home_score, away_score,
       points_before, points_after, points_change,
       opponent_rank, opp_strength_multiplier, competition_multiplier, stage_multiplier,
       voided, void_reason, played_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
    const values = [
      this.id, this.club_id, this.club_name, this.opponent_club_id, this.opponent_club_name,
      this.match_id, this.competition_type, this.competition_slug, this.division, this.phase,
      this.result, this.home_score, this.away_score,
      this.points_before, this.points_after, this.points_change,
      this.opponent_rank, this.opp_strength_multiplier, this.competition_multiplier, this.stage_multiplier,
      this.voided, this.void_reason, this.played_at,
    ];
    return EXECUTESQL(sql, values);
  }

  update(id) {
    const sql = `UPDATE rating_history SET
      club_id=?, club_name=?, opponent_club_id=?, opponent_club_name=?,
      match_id=?, competition_type=?, competition_slug=?, division=?, phase=?,
      result=?, home_score=?, away_score=?,
      points_before=?, points_after=?, points_change=?,
      opponent_rank=?, opp_strength_multiplier=?, competition_multiplier=?, stage_multiplier=?,
      voided=?, void_reason=?, played_at=?
      WHERE id=?`;
    const values = [
      this.club_id, this.club_name, this.opponent_club_id, this.opponent_club_name,
      this.match_id, this.competition_type, this.competition_slug, this.division, this.phase,
      this.result, this.home_score, this.away_score,
      this.points_before, this.points_after, this.points_change,
      this.opponent_rank, this.opp_strength_multiplier, this.competition_multiplier, this.stage_multiplier,
      this.voided, this.void_reason, this.played_at,
      id,
    ];
    return EXECUTESQL(sql, values);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM rating_history WHERE id = ?', [id]);
  }
}

module.exports = RatingHistoryModel;

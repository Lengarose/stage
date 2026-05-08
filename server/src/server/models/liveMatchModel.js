const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

function toMysqlDateTime(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 19).replace('T', ' ');
  }
  const asString = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(asString)) return asString;
  const parsed = new Date(asString);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 19).replace('T', ' ');
  }
  return null;
}

class LiveMatch {
  constructor(body = {}) {
    this.id                  = body.id;
    this.match_id            = body.match_id;
    this.home_club_id        = body.home_club_id;
    this.home_club_name      = body.home_club_name;
    this.away_club_id        = body.away_club_id;
    this.away_club_name      = body.away_club_name;
    this.home_player_id      = body.home_player_id;
    this.home_player_name    = body.home_player_name;
    this.away_player_id      = body.away_player_id;
    this.away_player_name    = body.away_player_name;
    this.match_type          = body.match_type;
    this.tournament_id       = body.tournament_id;
    this.home_score          = body.home_score;
    this.away_score          = body.away_score;
    this.minute              = body.minute;
    this.status              = body.status;
    this.stats_processed     = body.stats_processed;
    this.home_confirmed      = body.home_confirmed;
    this.away_confirmed      = body.away_confirmed;
    this.started_at          = toMysqlDateTime(body.started_at);
    this.ended_at            = toMysqlDateTime(body.ended_at);
    this.home_formation      = body.home_formation;
    this.away_formation      = body.away_formation;
    this.player_or_clubs     = body.player_or_clubs;
    this.events              = body.events
      ? (typeof body.events === 'string' ? body.events : JSON.stringify(body.events))
      : null;
    this.home_lineup         = body.home_lineup
      ? (typeof body.home_lineup === 'string' ? body.home_lineup : JSON.stringify(body.home_lineup))
      : null;
    this.away_lineup         = body.away_lineup
      ? (typeof body.away_lineup === 'string' ? body.away_lineup : JSON.stringify(body.away_lineup))
      : null;
    this.home_ready_players  = body.home_ready_players
      ? (typeof body.home_ready_players === 'string' ? body.home_ready_players : JSON.stringify(body.home_ready_players))
      : null;
    this.away_ready_players  = body.away_ready_players
      ? (typeof body.away_ready_players === 'string' ? body.away_ready_players : JSON.stringify(body.away_ready_players))
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

  selectByMatch(match_id) {
    return EXECUTESQL('SELECT * FROM live_matches WHERE match_id = ?', [match_id]);
  }

  selectByMatchAndStatus(match_id, status) {
    return EXECUTESQL('SELECT * FROM live_matches WHERE match_id = ? AND status = ?', [match_id, status]);
  }

  selectByStatus(status) {
    return EXECUTESQL('SELECT * FROM live_matches WHERE status = ?', [status]);
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO live_matches
      (id, match_id,
       home_club_id, home_club_name, away_club_id, away_club_name,
       home_player_id, home_player_name, away_player_id, away_player_name,
       match_type, tournament_id,
       home_score, away_score, minute, status,
       stats_processed, home_confirmed, away_confirmed,
       started_at, ended_at, home_formation, away_formation, player_or_clubs,
       events, home_lineup, away_lineup, home_ready_players, away_ready_players)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
    const values = [
      this.id, this.match_id,
      this.home_club_id, this.home_club_name, this.away_club_id, this.away_club_name,
      this.home_player_id, this.home_player_name, this.away_player_id, this.away_player_name,
      this.match_type, this.tournament_id,
      this.home_score, this.away_score, this.minute, this.status,
      this.stats_processed, this.home_confirmed, this.away_confirmed,
      this.started_at, this.ended_at, this.home_formation, this.away_formation, this.player_or_clubs,
      this.events, this.home_lineup, this.away_lineup, this.home_ready_players, this.away_ready_players,
    ];
    return EXECUTESQL(sql, values);
  }

  update(id) {
    const sql = `UPDATE live_matches SET
      match_id=?,
      home_club_id=?, home_club_name=?, away_club_id=?, away_club_name=?,
      home_player_id=?, home_player_name=?, away_player_id=?, away_player_name=?,
      match_type=?, tournament_id=?,
      home_score=?, away_score=?, minute=?, status=?,
      stats_processed=?, home_confirmed=?, away_confirmed=?,
      started_at=?, ended_at=?, home_formation=?, away_formation=?, player_or_clubs=?,
      events=?, home_lineup=?, away_lineup=?, home_ready_players=?, away_ready_players=?
      WHERE id=?`;
    const values = [
      this.match_id,
      this.home_club_id, this.home_club_name, this.away_club_id, this.away_club_name,
      this.home_player_id, this.home_player_name, this.away_player_id, this.away_player_name,
      this.match_type, this.tournament_id,
      this.home_score, this.away_score, this.minute, this.status,
      this.stats_processed, this.home_confirmed, this.away_confirmed,
      this.started_at, this.ended_at, this.home_formation, this.away_formation, this.player_or_clubs,
      this.events, this.home_lineup, this.away_lineup, this.home_ready_players, this.away_ready_players,
      id,
    ];
    return EXECUTESQL(sql, values);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM live_matches WHERE id = ?', [id]);
  }
}

module.exports = LiveMatch;

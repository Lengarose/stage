const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class LiveMatchEventModel {
  constructor(body = {}) {
    this.id               = body.id;
    this.live_match_id    = body.live_match_id;
    this.club_id          = body.club_id;
    this.club_name        = body.club_name;
    this.scorer_email     = body.scorer_email;
    this.scorer_gamertag  = body.scorer_gamertag;
    this.assist_email     = body.assist_email;
    this.assist_gamertag  = body.assist_gamertag;
    this.is_penalty       = body.is_penalty ?? false;
    this.is_own_goal      = body.is_own_goal ?? false;
    this.minute           = body.minute;
  }

  selectAll(page = 1) {
    const pageSize = 25;
    const offset   = (page - 1) * pageSize;
    return EXECUTESQL('SELECT * FROM live_match_events ORDER BY created_date DESC LIMIT ? OFFSET ?', [pageSize, offset]);
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM live_match_events WHERE id = ?', [id]);
  }

  selectByMatch(live_match_id) {
    return EXECUTESQL('SELECT * FROM live_match_events WHERE live_match_id = ? ORDER BY minute ASC', [live_match_id]);
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO live_match_events
      (id, live_match_id, club_id, club_name,
       scorer_email, scorer_gamertag, assist_email, assist_gamertag,
       is_penalty, is_own_goal, minute)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`;
    const values = [
      this.id, this.live_match_id, this.club_id, this.club_name,
      this.scorer_email, this.scorer_gamertag, this.assist_email, this.assist_gamertag,
      this.is_penalty, this.is_own_goal, this.minute,
    ];
    return EXECUTESQL(sql, values);
  }

  update(id) {
    const sql = `UPDATE live_match_events SET
      live_match_id=?, club_id=?, club_name=?,
      scorer_email=?, scorer_gamertag=?, assist_email=?, assist_gamertag=?,
      is_penalty=?, is_own_goal=?, minute=?
      WHERE id=?`;
    const values = [
      this.live_match_id, this.club_id, this.club_name,
      this.scorer_email, this.scorer_gamertag, this.assist_email, this.assist_gamertag,
      this.is_penalty, this.is_own_goal, this.minute,
      id,
    ];
    return EXECUTESQL(sql, values);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM live_match_events WHERE id = ?', [id]);
  }
}

module.exports = LiveMatchEventModel;

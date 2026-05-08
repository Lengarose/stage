const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class PressConference {
  constructor(body = {}) {
    this.id                    = body.id;
    this.match_id              = body.match_id;
    this.context               = body.context;
    this.tournament_id         = body.tournament_id;
    this.club_id               = body.club_id;
    this.club_name             = body.club_name;
    this.club_logo_url         = body.club_logo_url;
    this.player_id             = body.player_id;
    this.player_name           = body.player_name;
    this.player_avatar_url     = body.player_avatar_url;
    this.opponent_name         = body.opponent_name;
    this.match_name            = body.match_name;
    this.tournament_name       = body.tournament_name;
    this.status                = body.status;
    this.selected_question_ids = body.selected_question_ids
      ? (typeof body.selected_question_ids === 'string'
          ? body.selected_question_ids
          : JSON.stringify(body.selected_question_ids))
      : null;
    this.answers               = body.answers
      ? (typeof body.answers === 'string' ? body.answers : JSON.stringify(body.answers))
      : null;
  }

  selectAll(page = 1) {
    const pageSize = 25;
    const offset   = (page - 1) * pageSize;
    return EXECUTESQL('SELECT * FROM press_conferences LIMIT ? OFFSET ?', [pageSize, offset]);
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM press_conferences WHERE id = ?', [id]);
  }

  selectByMatch(match_id) {
    return EXECUTESQL('SELECT * FROM press_conferences WHERE match_id = ?', [match_id]);
  }

  selectByClub(club_id) {
    return EXECUTESQL('SELECT * FROM press_conferences WHERE club_id = ?', [club_id]);
  }

  selectFiltered({ match_id, club_id, status } = {}) {
    const conditions = [];
    const params = [];
    if (match_id) { conditions.push('match_id = ?'); params.push(match_id); }
    if (club_id)  { conditions.push('club_id = ?');  params.push(club_id); }
    if (status)   { conditions.push('status = ?');   params.push(status); }
    const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
    return EXECUTESQL(`SELECT * FROM press_conferences${where}`, params);
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO press_conferences
      (id, match_id, context, tournament_id,
       club_id, club_name, club_logo_url,
       player_id, player_name, player_avatar_url,
       opponent_name, match_name, tournament_name,
       status, selected_question_ids, answers)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
    const values = [
      this.id, this.match_id, this.context, this.tournament_id,
      this.club_id, this.club_name, this.club_logo_url,
      this.player_id, this.player_name, this.player_avatar_url,
      this.opponent_name, this.match_name, this.tournament_name,
      this.status, this.selected_question_ids, this.answers,
    ];
    return EXECUTESQL(sql, values);
  }

  update(id) {
    const sql = `UPDATE press_conferences SET
      match_id=?, context=?, tournament_id=?,
      club_id=?, club_name=?, club_logo_url=?,
      player_id=?, player_name=?, player_avatar_url=?,
      opponent_name=?, match_name=?, tournament_name=?,
      status=?, selected_question_ids=?, answers=?
      WHERE id=?`;
    const values = [
      this.match_id, this.context, this.tournament_id,
      this.club_id, this.club_name, this.club_logo_url,
      this.player_id, this.player_name, this.player_avatar_url,
      this.opponent_name, this.match_name, this.tournament_name,
      this.status, this.selected_question_ids, this.answers,
      id,
    ];
    return EXECUTESQL(sql, values);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM press_conferences WHERE id = ?', [id]);
  }
}

module.exports = PressConference;

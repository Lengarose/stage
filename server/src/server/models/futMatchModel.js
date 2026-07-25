const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class FutMatchModel {
  constructor(body = {}) {
    this.id            = body.id;
    this.player_id     = body.player_id;
    this.player_email  = body.player_email || null;
    this.played_at     = body.played_at;
    this.result        = body.result;
    this.goals_for     = body.goals_for ?? 0;
    this.goals_against = body.goals_against ?? 0;
    this.mode          = body.mode || 'rivals';
    this.opponent_note = body.opponent_note || null;
    this.notes         = body.notes || null;
    this.proof_url     = body.proof_url || null;
  }

  selectAll(limit = 50, offset = 0) {
    return EXECUTESQL(
      'SELECT * FROM player_fut_matches ORDER BY played_at DESC LIMIT ? OFFSET ?',
      [Number(limit) || 50, Number(offset) || 0]
    );
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM player_fut_matches WHERE id = ?', [id]);
  }

  selectByPlayer(player_id, limit = 50) {
    return EXECUTESQL(
      'SELECT * FROM player_fut_matches WHERE player_id = ? ORDER BY played_at DESC LIMIT ?',
      [player_id, Number(limit) || 50]
    );
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO player_fut_matches
      (id, player_id, player_email, played_at, result, goals_for, goals_against, mode, opponent_note, notes, proof_url)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`;
    const values = [
      this.id, this.player_id, this.player_email, this.played_at, this.result,
      this.goals_for, this.goals_against, this.mode, this.opponent_note, this.notes, this.proof_url,
    ];
    return EXECUTESQL(sql, values);
  }

  update(id) {
    const sql = `UPDATE player_fut_matches SET
      player_id=?, player_email=?, played_at=?, result=?, goals_for=?, goals_against=?,
      mode=?, opponent_note=?, notes=?, proof_url=?
      WHERE id=?`;
    const values = [
      this.player_id, this.player_email, this.played_at, this.result,
      this.goals_for, this.goals_against, this.mode, this.opponent_note, this.notes, this.proof_url,
      id,
    ];
    return EXECUTESQL(sql, values);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM player_fut_matches WHERE id = ?', [id]);
  }
}

module.exports = FutMatchModel;

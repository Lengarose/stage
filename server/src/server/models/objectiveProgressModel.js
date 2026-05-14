const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

/**
 * `objective_progress` — per-player progress on a given ObjectiveDefinition.
 *
 *   current_value   numeric progress toward `objective_definitions.target_value`
 *   completed_at    set the first time current_value reaches target_value
 *   claimed_at      set when the player calls functions/claimObjectiveReward
 *
 * Unique (player_id, objective_id) — one progress row per (player, objective).
 */
class ObjectiveProgressModel {
  constructor(body = {}) {
    this.id            = body.id;
    this.player_id     = body.player_id;
    this.player_email  = body.player_email || null;
    this.objective_id  = body.objective_id;
    this.scope         = body.scope || null;
    this.current_value = body.current_value ?? 0;
    this.target_value  = body.target_value ?? null;
    this.completed_at  = body.completed_at || null;
    this.claimed_at    = body.claimed_at || null;
  }

  selectAll(page = 1) {
    const pageSize = 50;
    const offset   = (page - 1) * pageSize;
    return EXECUTESQL(
      'SELECT * FROM objective_progress ORDER BY created_date DESC LIMIT ? OFFSET ?',
      [pageSize, offset]
    );
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM objective_progress WHERE id = ?', [id]);
  }

  selectByPlayer(player_id) {
    return EXECUTESQL(
      `SELECT op.*, od.title, od.description, od.metric, od.scope AS def_scope,
              od.reward_stc, od.reward_xp, od.target_value AS def_target
         FROM objective_progress op
         JOIN objective_definitions od ON od.id = op.objective_id
        WHERE op.player_id = ?
        ORDER BY op.created_date DESC`,
      [player_id]
    );
  }

  selectByPlayerAndObjective(player_id, objective_id) {
    return EXECUTESQL(
      'SELECT * FROM objective_progress WHERE player_id = ? AND objective_id = ? LIMIT 1',
      [player_id, objective_id]
    );
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO objective_progress
      (id, player_id, player_email, objective_id, scope, current_value, target_value, completed_at, claimed_at)
      VALUES (?,?,?,?,?,?,?,?,?)`;
    const values = [
      this.id, this.player_id, this.player_email, this.objective_id, this.scope,
      this.current_value, this.target_value, this.completed_at, this.claimed_at,
    ];
    return EXECUTESQL(sql, values);
  }

  update(id) {
    const sql = `UPDATE objective_progress SET
      player_id=?, player_email=?, objective_id=?, scope=?,
      current_value=?, target_value=?, completed_at=?, claimed_at=?
      WHERE id=?`;
    const values = [
      this.player_id, this.player_email, this.objective_id, this.scope,
      this.current_value, this.target_value, this.completed_at, this.claimed_at,
      id,
    ];
    return EXECUTESQL(sql, values);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM objective_progress WHERE id = ?', [id]);
  }
}

module.exports = ObjectiveProgressModel;

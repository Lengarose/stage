const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

/**
 * `objective_definitions` — the catalogue of available Daily / Weekly objectives.
 *
 * Seeded by an admin (or by a regen job that picks N daily + M weekly each
 * period). Player-side progress is tracked in `objective_progress` and the
 * reward claim is processed by functionsController#claimObjectiveReward.
 *
 *   scope          'daily' | 'weekly' | 'season'
 *   metric         e.g. 'goals_scored', 'wins', 'matches_played', 'clean_sheets'
 *   target_value   integer the metric must reach (>=) to mark it as completed
 *   reward_stc     STC granted when the player claims the completed objective
 *   reward_xp      Optional season/battle-pass XP granted alongside
 *   active_from    Inclusive start of the window (NULL = always active)
 *   active_until   Exclusive end of the window  (NULL = never expires)
 *   is_active      Master switch; allows soft-disable without delete
 */
class ObjectiveDefinitionModel {
  constructor(body = {}) {
    this.id            = body.id;
    this.scope         = body.scope || 'daily';
    this.code          = body.code || null;
    this.title         = body.title;
    this.description   = body.description || null;
    this.metric        = body.metric;
    this.target_value  = body.target_value ?? 1;
    this.reward_stc    = body.reward_stc ?? 0;
    this.reward_xp     = body.reward_xp ?? 0;
    this.active_from   = body.active_from || null;
    this.active_until  = body.active_until || null;
    this.is_active     = body.is_active ?? 1;
  }

  selectAll(page = 1) {
    const pageSize = 50;
    const offset   = (page - 1) * pageSize;
    return EXECUTESQL(
      'SELECT * FROM objective_definitions ORDER BY scope ASC, created_date DESC LIMIT ? OFFSET ?',
      [pageSize, offset]
    );
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM objective_definitions WHERE id = ?', [id]);
  }

  selectActiveByScope(scope) {
    return EXECUTESQL(
      `SELECT * FROM objective_definitions
        WHERE scope = ? AND is_active = 1
          AND (active_from  IS NULL OR active_from  <= NOW())
          AND (active_until IS NULL OR active_until >  NOW())
        ORDER BY created_date DESC`,
      [scope]
    );
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO objective_definitions
      (id, scope, code, title, description, metric, target_value, reward_stc, reward_xp, active_from, active_until, is_active)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`;
    const values = [
      this.id, this.scope, this.code, this.title, this.description,
      this.metric, this.target_value, this.reward_stc, this.reward_xp,
      this.active_from, this.active_until, this.is_active,
    ];
    return EXECUTESQL(sql, values);
  }

  update(id) {
    const sql = `UPDATE objective_definitions SET
      scope=?, code=?, title=?, description=?, metric=?, target_value=?,
      reward_stc=?, reward_xp=?, active_from=?, active_until=?, is_active=?
      WHERE id=?`;
    const values = [
      this.scope, this.code, this.title, this.description, this.metric, this.target_value,
      this.reward_stc, this.reward_xp, this.active_from, this.active_until, this.is_active,
      id,
    ];
    return EXECUTESQL(sql, values);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM objective_definitions WHERE id = ?', [id]);
  }
}

module.exports = ObjectiveDefinitionModel;

const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

/**
 * `sbc_submissions` — log of every SBC submission attempt by a player.
 *
 *   sacrificed_player_ids   JSON array of player IDs offered for sacrifice
 *   reward_payload          JSON snapshot of the reward granted (for audit)
 *   status                  'pending' | 'completed' | 'failed' | 'reverted'
 *   failure_reason          When status='failed', why (e.g. "min_rating not met")
 *
 * Note: the actual destructive operation (marking players as sacrificed and
 * crediting STC) is performed in a transaction by
 * functionsController#submitSbc — this model is the canonical record.
 */
class SbcSubmissionModel {
  constructor(body = {}) {
    this.id                    = body.id;
    this.sbc_id                = body.sbc_id;
    this.player_id             = body.player_id;
    this.player_email          = body.player_email || null;
    this.player_gamertag       = body.player_gamertag || null;
    this.club_id               = body.club_id || null;
    this.sacrificed_player_ids = body.sacrificed_player_ids
      ? (typeof body.sacrificed_player_ids === 'string'
          ? body.sacrificed_player_ids
          : JSON.stringify(body.sacrificed_player_ids))
      : null;
    this.reward_payload        = body.reward_payload
      ? (typeof body.reward_payload === 'string'
          ? body.reward_payload
          : JSON.stringify(body.reward_payload))
      : null;
    this.stc_credited          = body.stc_credited ?? 0;
    this.status                = body.status || 'pending';
    this.failure_reason        = body.failure_reason || null;
    this.submitted_at          = body.submitted_at || null;
    this.completed_at          = body.completed_at || null;
  }

  selectAll(page = 1) {
    const pageSize = 50;
    const offset   = (page - 1) * pageSize;
    return EXECUTESQL(
      'SELECT * FROM sbc_submissions ORDER BY created_date DESC LIMIT ? OFFSET ?',
      [pageSize, offset]
    );
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM sbc_submissions WHERE id = ?', [id]);
  }

  selectByPlayer(player_id) {
    return EXECUTESQL(
      'SELECT * FROM sbc_submissions WHERE player_id = ? ORDER BY created_date DESC',
      [player_id]
    );
  }

  selectBySbc(sbc_id) {
    return EXECUTESQL(
      'SELECT * FROM sbc_submissions WHERE sbc_id = ? ORDER BY created_date DESC',
      [sbc_id]
    );
  }

  countCompletionsByPlayer(sbc_id, player_id) {
    return EXECUTESQL(
      "SELECT COUNT(*) AS n FROM sbc_submissions WHERE sbc_id = ? AND player_id = ? AND status = 'completed'",
      [sbc_id, player_id]
    );
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO sbc_submissions
      (id, sbc_id, player_id, player_email, player_gamertag, club_id,
       sacrificed_player_ids, reward_payload, stc_credited,
       status, failure_reason, submitted_at, completed_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`;
    const values = [
      this.id, this.sbc_id, this.player_id, this.player_email, this.player_gamertag, this.club_id,
      this.sacrificed_player_ids, this.reward_payload, this.stc_credited,
      this.status, this.failure_reason, this.submitted_at, this.completed_at,
    ];
    return EXECUTESQL(sql, values);
  }

  update(id) {
    const sql = `UPDATE sbc_submissions SET
      sbc_id=?, player_id=?, player_email=?, player_gamertag=?, club_id=?,
      sacrificed_player_ids=?, reward_payload=?, stc_credited=?,
      status=?, failure_reason=?, submitted_at=?, completed_at=?
      WHERE id=?`;
    const values = [
      this.sbc_id, this.player_id, this.player_email, this.player_gamertag, this.club_id,
      this.sacrificed_player_ids, this.reward_payload, this.stc_credited,
      this.status, this.failure_reason, this.submitted_at, this.completed_at,
      id,
    ];
    return EXECUTESQL(sql, values);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM sbc_submissions WHERE id = ?', [id]);
  }
}

module.exports = SbcSubmissionModel;

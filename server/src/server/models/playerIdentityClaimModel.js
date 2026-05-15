const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class PlayerIdentityClaim {
  constructor(body = {}) {
    this.id                    = body.id;
    this.player_id             = body.player_id;
    this.user_id               = body.user_id;
    this.email                 = body.email;
    this.gamertag              = body.gamertag;
    this.platform              = body.platform;
    this.platform_handle       = body.platform_handle;
    this.ea_id                 = body.ea_id;
    this.discord_handle        = body.discord_handle;
    this.proof_url             = body.proof_url;
    this.notes                 = body.notes;
    this.status                = body.status || 'pending';
    this.review_notes          = body.review_notes;
    this.rejection_reason      = body.rejection_reason;
    this.reviewed_by           = body.reviewed_by;
    this.reviewed_by_email     = body.reviewed_by_email;
    this.reviewed_at           = body.reviewed_at;
  }

  selectAll(page = 1) {
    const pageSize = 50;
    const offset = (page - 1) * pageSize;
    return EXECUTESQL(
      'SELECT * FROM player_identity_claims ORDER BY created_date DESC LIMIT ? OFFSET ?',
      [pageSize, offset]
    );
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM player_identity_claims WHERE id = ?', [id]);
  }

  selectByPlayer(player_id) {
    return EXECUTESQL(
      'SELECT * FROM player_identity_claims WHERE player_id = ? ORDER BY created_date DESC',
      [player_id]
    );
  }

  selectByUser(user_id) {
    return EXECUTESQL(
      'SELECT * FROM player_identity_claims WHERE user_id = ? ORDER BY created_date DESC',
      [user_id]
    );
  }

  selectByStatus(status) {
    return EXECUTESQL(
      'SELECT * FROM player_identity_claims WHERE status = ? ORDER BY created_date DESC',
      [status]
    );
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO player_identity_claims
      (id, player_id, user_id, email, gamertag, platform, platform_handle, ea_id,
       discord_handle, proof_url, notes, status, review_notes, rejection_reason,
       reviewed_by, reviewed_by_email, reviewed_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
    const values = [
      this.id, this.player_id, this.user_id, this.email, this.gamertag,
      this.platform, this.platform_handle, this.ea_id, this.discord_handle,
      this.proof_url, this.notes, this.status, this.review_notes,
      this.rejection_reason, this.reviewed_by, this.reviewed_by_email,
      this.reviewed_at,
    ];
    return EXECUTESQL(sql, values);
  }

  update(id) {
    const sql = `UPDATE player_identity_claims SET
      player_id=?, user_id=?, email=?, gamertag=?, platform=?, platform_handle=?,
      ea_id=?, discord_handle=?, proof_url=?, notes=?, status=?, review_notes=?,
      rejection_reason=?, reviewed_by=?, reviewed_by_email=?, reviewed_at=?,
      updated_date=NOW()
      WHERE id=?`;
    const values = [
      this.player_id, this.user_id, this.email, this.gamertag,
      this.platform, this.platform_handle, this.ea_id, this.discord_handle,
      this.proof_url, this.notes, this.status, this.review_notes,
      this.rejection_reason, this.reviewed_by, this.reviewed_by_email,
      this.reviewed_at, id,
    ];
    return EXECUTESQL(sql, values);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM player_identity_claims WHERE id = ?', [id]);
  }
}

module.exports = PlayerIdentityClaim;

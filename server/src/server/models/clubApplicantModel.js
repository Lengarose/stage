const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class ClubApplicant {
  constructor(body = {}) {
    this.id = body.id;
    this.club_id = body.club_id;
    this.player_id = body.player_id;
    this.user_id = body.user_id;
    this.source_type = body.source_type || 'manual';
    this.source_id = body.source_id;
    this.status = body.status || 'new';
    this.preferred_position = body.preferred_position;
    this.platform = body.platform;
    this.message = body.message;
    this.notes = body.notes;
  }

  selectAll({ club_id, player_id, user_id, source_type, status, limit = 100, offset = 0 } = {}) {
    const where = [];
    const params = [];
    if (club_id) { where.push('ca.club_id = ?'); params.push(club_id); }
    if (player_id) { where.push('ca.player_id = ?'); params.push(player_id); }
    if (user_id) { where.push('ca.user_id = ?'); params.push(user_id); }
    if (source_type) { where.push('ca.source_type = ?'); params.push(source_type); }
    if (status) { where.push('ca.status = ?'); params.push(status); }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    params.push(Math.min(Number(limit) || 100, 300), Number(offset) || 0);
    return EXECUTESQL(
      `SELECT ca.*,
              p.gamertag AS player_gamertag,
              p.email AS player_email,
              p.avatar_url AS player_avatar_url,
              p.position AS player_position,
              p.secondary_position AS player_secondary_position,
              p.platform AS player_platform,
              p.overall_rating AS player_overall_rating,
              p.is_verified AS player_is_verified,
              c.name AS club_name
       FROM club_applicants ca
       LEFT JOIN players p ON p.id = ca.player_id
       LEFT JOIN clubs c ON c.id = ca.club_id
       ${clause}
       ORDER BY ca.created_date DESC
       LIMIT ? OFFSET ?`,
      params
    );
  }

  selectOne(id) {
    return EXECUTESQL(
      `SELECT ca.*,
              p.gamertag AS player_gamertag,
              p.email AS player_email,
              p.avatar_url AS player_avatar_url,
              p.position AS player_position,
              p.secondary_position AS player_secondary_position,
              p.platform AS player_platform,
              p.overall_rating AS player_overall_rating,
              p.is_verified AS player_is_verified,
              c.name AS club_name
       FROM club_applicants ca
       LEFT JOIN players p ON p.id = ca.player_id
       LEFT JOIN clubs c ON c.id = ca.club_id
       WHERE ca.id = ?`,
      [id]
    );
  }

  create() {
    this.id = this.id || uuidv4();
    return EXECUTESQL(
      `INSERT INTO club_applicants
        (id, club_id, player_id, user_id, source_type, source_id, status,
         preferred_position, platform, message, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        this.id, this.club_id, this.player_id, this.user_id, this.source_type,
        this.source_id, this.status, this.preferred_position, this.platform,
        this.message, this.notes,
      ]
    );
  }

  update(id) {
    return EXECUTESQL(
      `UPDATE club_applicants SET
        club_id=?, player_id=?, user_id=?, source_type=?, source_id=?, status=?,
        preferred_position=?, platform=?, message=?, notes=?, updated_date=NOW()
       WHERE id=?`,
      [
        this.club_id, this.player_id, this.user_id, this.source_type, this.source_id,
        this.status, this.preferred_position, this.platform, this.message, this.notes, id,
      ]
    );
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM club_applicants WHERE id = ?', [id]);
  }
}

module.exports = ClubApplicant;

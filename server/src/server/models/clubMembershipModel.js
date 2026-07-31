const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class ClubMembership {
  constructor(body = {}) {
    this.id = body.id;
    this.club_id = body.club_id;
    this.player_id = body.player_id;
    this.user_id = body.user_id;
    this.status = body.status || 'active';
    this.primary_role = body.primary_role || 'member';
    this.source = body.source || 'manual';
  }

  selectAll({ club_id, player_id, user_id, status, limit = 100, offset = 0 } = {}) {
    const where = [];
    const params = [];
    if (club_id) { where.push('cm.club_id = ?'); params.push(club_id); }
    if (player_id) { where.push('cm.player_id = ?'); params.push(player_id); }
    if (user_id) { where.push('cm.user_id = ?'); params.push(user_id); }
    if (status) { where.push('cm.status = ?'); params.push(status); }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    params.push(Math.min(Number(limit) || 100, 300), Number(offset) || 0);
    return EXECUTESQL(
      `SELECT cm.*, p.gamertag AS player_gamertag, p.email AS player_email, c.name AS club_name
       FROM club_memberships cm
       LEFT JOIN players p ON p.id = cm.player_id
       LEFT JOIN clubs c ON c.id = cm.club_id
       ${clause}
       ORDER BY cm.created_date DESC
       LIMIT ? OFFSET ?`,
      params
    );
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM club_memberships WHERE id = ?', [id]);
  }

  create() {
    this.id = this.id || uuidv4();
    return EXECUTESQL(
      `INSERT INTO club_memberships
        (id, club_id, player_id, user_id, status, primary_role, source)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [this.id, this.club_id, this.player_id, this.user_id, this.status, this.primary_role, this.source]
    );
  }

  update(id) {
    return EXECUTESQL(
      `UPDATE club_memberships SET
        club_id = ?, player_id = ?, user_id = ?, status = ?, primary_role = ?, source = ?, updated_date = NOW()
       WHERE id = ?`,
      [this.club_id, this.player_id, this.user_id, this.status, this.primary_role, this.source, id]
    );
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM club_memberships WHERE id = ?', [id]);
  }
}

module.exports = ClubMembership;

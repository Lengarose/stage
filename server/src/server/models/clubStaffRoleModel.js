const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

function jsonOrNull(value) {
  if (value == null || value === '') return null;
  return typeof value === 'string' ? value : JSON.stringify(value);
}

class ClubStaffRole {
  constructor(body = {}) {
    this.id = body.id;
    this.club_id = body.club_id;
    this.player_id = body.player_id;
    this.user_id = body.user_id;
    this.role = body.role;
    this.permissions = jsonOrNull(body.permissions);
    this.assigned_by_user_id = body.assigned_by_user_id;
  }

  selectAll({ club_id, player_id, user_id, role, limit = 100, offset = 0 } = {}) {
    const where = [];
    const params = [];
    if (club_id) { where.push('csr.club_id = ?'); params.push(club_id); }
    if (player_id) { where.push('csr.player_id = ?'); params.push(player_id); }
    if (user_id) { where.push('csr.user_id = ?'); params.push(user_id); }
    if (role) { where.push('csr.role = ?'); params.push(role); }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    params.push(Math.min(Number(limit) || 100, 300), Number(offset) || 0);
    return EXECUTESQL(
      `SELECT csr.*, p.gamertag AS player_gamertag, p.email AS player_email, c.name AS club_name
       FROM club_staff_roles csr
       LEFT JOIN players p ON p.id = csr.player_id
       LEFT JOIN clubs c ON c.id = csr.club_id
       ${clause}
       ORDER BY csr.created_date DESC
       LIMIT ? OFFSET ?`,
      params
    );
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM club_staff_roles WHERE id = ?', [id]);
  }

  create() {
    this.id = this.id || uuidv4();
    return EXECUTESQL(
      `INSERT INTO club_staff_roles
        (id, club_id, player_id, user_id, role, permissions, assigned_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [this.id, this.club_id, this.player_id, this.user_id, this.role, this.permissions, this.assigned_by_user_id]
    );
  }

  update(id) {
    return EXECUTESQL(
      `UPDATE club_staff_roles SET
        club_id=?, player_id=?, user_id=?, role=?, permissions=?, assigned_by_user_id=?, updated_date=NOW()
       WHERE id=?`,
      [this.club_id, this.player_id, this.user_id, this.role, this.permissions, this.assigned_by_user_id, id]
    );
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM club_staff_roles WHERE id = ?', [id]);
  }
}

module.exports = ClubStaffRole;

const { EXECUTESQL } = require('../db/database');

class ClubOperationAuditLog {
  selectAll({ club_id, actor_user_id, action, entity_type, limit = 100, offset = 0 } = {}) {
    const where = [];
    const params = [];
    if (club_id) { where.push('club_id = ?'); params.push(club_id); }
    if (actor_user_id) { where.push('actor_user_id = ?'); params.push(actor_user_id); }
    if (action) { where.push('action = ?'); params.push(action); }
    if (entity_type) { where.push('entity_type = ?'); params.push(entity_type); }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    params.push(Math.min(Number(limit) || 100, 300), Number(offset) || 0);
    return EXECUTESQL(
      `SELECT * FROM club_operation_audit_logs
       ${clause}
       ORDER BY created_date DESC
       LIMIT ? OFFSET ?`,
      params
    );
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM club_operation_audit_logs WHERE id = ?', [id]);
  }
}

module.exports = ClubOperationAuditLog;

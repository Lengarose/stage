const { EXECUTESQL } = require('../db/database');

class UserModel {
  constructor(body = {}) {
    this.id    = body.id;
    this.email = body.email;
    this.role  = body.role || 'user';
  }

  selectAll(page = 1) {
    const pageSize = 25;
    const offset   = (page - 1) * pageSize;
    return EXECUTESQL('SELECT id, email, role, created_date FROM users ORDER BY created_date DESC LIMIT ? OFFSET ?', [pageSize, offset]);
  }

  selectOne(id) {
    return EXECUTESQL('SELECT id, email, role, created_date FROM users WHERE id = ?', [id]);
  }

  selectByEmail(email) {
    return EXECUTESQL('SELECT id, email, role, created_date FROM users WHERE LOWER(email) = LOWER(?)', [email]);
  }

  updateRole(id, role) {
    return EXECUTESQL('UPDATE users SET role = ? WHERE id = ?', [role, id]);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM users WHERE id = ?', [id]);
  }
}

module.exports = UserModel;

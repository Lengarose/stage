const { EXECUTESQL } = require('../db/database');
const { deleteUserAccount } = require('../services/accountDeletion');

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

  /**
   * Remove login row only (keeps player/club entities with user_id cleared).
   * For full profile + owned-club removal use deleteUserAccount from accountDeletion (hard mode).
   */
  async delete(id) {
    try {
      await deleteUserAccount(id, 'soft');
      return { affectedRows: 1 };
    } catch (e) {
      if (String(e.message || '').includes('User not found')) return { affectedRows: 0 };
      throw e;
    }
  }
}

module.exports = UserModel;

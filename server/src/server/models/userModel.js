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

  /**
   * Safely delete a user while respecting schema relations:
   * - auth_tokens keyed by email
   * - players.user_id -> users.id (FK ON DELETE SET NULL)
   * - clubs.user_id   -> users.id (FK ON DELETE SET NULL)
   *
   * We still null dependent links explicitly first to be robust on
   * partially migrated databases where FKs may not yet exist.
   */
  async delete(id) {
    const users = await EXECUTESQL(
      'SELECT id, email FROM users WHERE id = ? LIMIT 1',
      [id]
    );
    if (!users.length) return { affectedRows: 0 };

    const user = users[0];

    if (user.email) {
      await EXECUTESQL('DELETE FROM auth_tokens WHERE email = ?', [user.email]);
    }

    // Break optional relations before deleting the user.
    await EXECUTESQL('UPDATE players SET user_id = NULL WHERE user_id = ?', [id]);
    await EXECUTESQL('UPDATE clubs SET user_id = NULL WHERE user_id = ?', [id]);
    await EXECUTESQL('UPDATE users SET player_id = NULL, owner_id = NULL WHERE id = ?', [id]);

    return EXECUTESQL('DELETE FROM users WHERE id = ?', [id]);
  }
}

module.exports = UserModel;

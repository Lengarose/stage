const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class AdminMailMessage {
  constructor(body = {}) {
    this.id = body.id;
    this.direction = body.direction || 'in';
    this.folder = body.folder || 'inbox';
    this.mailbox = body.mailbox || null;
    this.from_email = body.from_email || null;
    this.from_name = body.from_name || null;
    this.to_email = body.to_email || null;
    this.to_addresses = body.to_addresses
      ? (typeof body.to_addresses === 'string' ? body.to_addresses : JSON.stringify(body.to_addresses))
      : null;
    this.cc_addresses = body.cc_addresses
      ? (typeof body.cc_addresses === 'string' ? body.cc_addresses : JSON.stringify(body.cc_addresses))
      : null;
    this.subject = body.subject || null;
    this.body_text = body.body_text || null;
    this.body_html = body.body_html || null;
    this.is_read = body.is_read ? 1 : 0;
    this.external_uid = body.external_uid != null ? Number(body.external_uid) : null;
    this.external_message_id = body.external_message_id || null;
    this.in_reply_to = body.in_reply_to || null;
    this.admin_user_id = body.admin_user_id || null;
    this.admin_email = body.admin_email || null;
    this.received_at = body.received_at || null;
  }

  static selectAll({ folder = 'inbox', search = '', limit = 50, offset = 0 } = {}) {
    const params = [folder];
    let sql = 'SELECT * FROM admin_mail_messages WHERE folder = ?';
    const q = String(search || '').trim();
    if (q) {
      sql += ' AND (subject LIKE ? OR from_email LIKE ? OR to_email LIKE ? OR body_text LIKE ?)';
      const like = `%${q}%`;
      params.push(like, like, like, like);
    }
    sql += ' ORDER BY COALESCE(received_at, created_date) DESC LIMIT ? OFFSET ?';
    params.push(Number(limit) || 50, Number(offset) || 0);
    return EXECUTESQL(sql, params);
  }

  static count({ folder = 'inbox', search = '' } = {}) {
    const params = [folder];
    let sql = 'SELECT COUNT(*) AS total FROM admin_mail_messages WHERE folder = ?';
    const q = String(search || '').trim();
    if (q) {
      sql += ' AND (subject LIKE ? OR from_email LIKE ? OR to_email LIKE ? OR body_text LIKE ?)';
      const like = `%${q}%`;
      params.push(like, like, like, like);
    }
    return EXECUTESQL(sql, params);
  }

  static selectOne(id) {
    return EXECUTESQL('SELECT * FROM admin_mail_messages WHERE id = ? LIMIT 1', [id]);
  }

  static maxExternalUid(mailbox) {
    return EXECUTESQL(
      'SELECT COALESCE(MAX(external_uid), 0) AS max_uid FROM admin_mail_messages WHERE mailbox = ? AND direction = ?',
      [mailbox, 'in'],
    );
  }

  static unreadCount(folder = 'inbox') {
    return EXECUTESQL(
      'SELECT COUNT(*) AS total FROM admin_mail_messages WHERE folder = ? AND is_read = 0',
      [folder],
    );
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO admin_mail_messages
      (id, direction, folder, mailbox, from_email, from_name, to_email, to_addresses, cc_addresses,
       subject, body_text, body_html, is_read, external_uid, external_message_id, in_reply_to,
       admin_user_id, admin_email, received_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
    const values = [
      this.id, this.direction, this.folder, this.mailbox,
      this.from_email, this.from_name, this.to_email, this.to_addresses, this.cc_addresses,
      this.subject, this.body_text, this.body_html, this.is_read,
      this.external_uid, this.external_message_id, this.in_reply_to,
      this.admin_user_id, this.admin_email, this.received_at,
    ];
    return EXECUTESQL(sql, values);
  }

  static update(id, data = {}) {
    const fields = [];
    const params = [];
    const allowed = [
      'folder', 'is_read', 'subject', 'body_text', 'body_html',
      'from_email', 'from_name', 'to_email', 'to_addresses', 'cc_addresses',
    ];
    for (const key of allowed) {
      if (data[key] !== undefined) {
        fields.push(`${key} = ?`);
        params.push(key === 'is_read' ? (data[key] ? 1 : 0) : data[key]);
      }
    }
    if (!fields.length) return Promise.resolve();
    params.push(id);
    return EXECUTESQL(`UPDATE admin_mail_messages SET ${fields.join(', ')} WHERE id = ?`, params);
  }

  static delete(id) {
    return EXECUTESQL('DELETE FROM admin_mail_messages WHERE id = ?', [id]);
  }

  static deleteByFolder(folder) {
    return EXECUTESQL('DELETE FROM admin_mail_messages WHERE folder = ?', [folder]);
  }
}

module.exports = AdminMailMessage;

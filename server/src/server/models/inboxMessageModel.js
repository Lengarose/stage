const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class InboxMessage {
  constructor(body = {}) {
    this.id                  = body.id;
    this.recipient_email     = body.recipient_email;
    this.sender_email        = body.sender_email;
    this.subject             = body.subject;
    this.body                = body.body;
    this.message_type        = body.message_type;
    this.status              = body.status;
    this.is_read             = body.is_read;
    this.related_entity_id   = body.related_entity_id;
    this.related_entity_type = body.related_entity_type;
  }

  selectAll(page = 1) {
    const pageSize = 25;
    const offset   = (page - 1) * pageSize;
    return EXECUTESQL('SELECT * FROM inbox_messages ORDER BY id DESC LIMIT ? OFFSET ?', [pageSize, offset]);
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM inbox_messages WHERE id = ?', [id]);
  }

  selectByRecipient(email) {
    return EXECUTESQL(
      'SELECT * FROM inbox_messages WHERE recipient_email = ? ORDER BY id DESC',
      [email]
    );
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO inbox_messages
      (id, recipient_email, sender_email, subject, body, message_type,
       status, is_read, related_entity_id, related_entity_type)
      VALUES (?,?,?,?,?,?,?,?,?,?)`;
    const values = [
      this.id, this.recipient_email, this.sender_email, this.subject,
      this.body, this.message_type, this.status, this.is_read,
      this.related_entity_id, this.related_entity_type,
    ];
    return EXECUTESQL(sql, values);
  }

  update(id) {
    const sql = `UPDATE inbox_messages SET
      recipient_email=?, sender_email=?, subject=?, body=?, message_type=?,
      status=?, is_read=?, related_entity_id=?, related_entity_type=?
      WHERE id=?`;
    const values = [
      this.recipient_email, this.sender_email, this.subject, this.body,
      this.message_type, this.status, this.is_read,
      this.related_entity_id, this.related_entity_type,
      id,
    ];
    return EXECUTESQL(sql, values);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM inbox_messages WHERE id = ?', [id]);
  }
}

module.exports = InboxMessage;

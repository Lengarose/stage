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
    this.action_type         = body.action_type;
    this.status              = body.status;
    this.is_read             = body.is_read;
    this.sender_gamertag     = body.sender_gamertag;
    this.sender_avatar_url   = body.sender_avatar_url;
    this.sender_club_name    = body.sender_club_name;
    this.metadata            = body.metadata
      ? (typeof body.metadata === 'string' ? body.metadata : JSON.stringify(body.metadata))
      : null;
    this.related_entity_id   = body.related_entity_id;
    this.related_entity_type = body.related_entity_type; 
  }

  selectAll(page = 1) {
    const pageSize = 25;
    const offset   = (page - 1) * pageSize;
    return EXECUTESQL('SELECT * FROM inbox_messages ORDER BY created_date DESC LIMIT ? OFFSET ?', [pageSize, offset]);
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM inbox_messages WHERE id = ?', [id]);
  }

  selectByRecipient(email) {
    return EXECUTESQL(
      'SELECT * FROM inbox_messages WHERE recipient_email = ? ORDER BY created_date DESC',
      [email]
    );
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO inbox_messages
      (id, recipient_email, sender_email, sender_gamertag, sender_avatar_url, sender_club_name,
       subject, body, message_type, action_type, status, is_read, metadata,
       related_entity_id, related_entity_type)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
    const values = [
      this.id, this.recipient_email, this.sender_email, this.sender_gamertag, this.sender_avatar_url, this.sender_club_name,
      this.subject, this.body, this.message_type, this.action_type, this.status, this.is_read, this.metadata,
      this.related_entity_id, this.related_entity_type,
    ];
    return EXECUTESQL(sql, values);
  }

  update(id) {
    const sql = `UPDATE inbox_messages SET
      recipient_email=?, sender_email=?, sender_gamertag=?, sender_avatar_url=?, sender_club_name=?,
      subject=?, body=?, message_type=?, action_type=?,
      status=?, is_read=?, metadata=?, related_entity_id=?, related_entity_type=?
      WHERE id=?`;
    const values = [
      this.recipient_email, this.sender_email, this.sender_gamertag, this.sender_avatar_url, this.sender_club_name,
      this.subject, this.body, this.message_type, this.action_type,
      this.status, this.is_read, this.metadata,
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

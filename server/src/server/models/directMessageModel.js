const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class DirectMessage {
  constructor(body = {}) {
    this.id              = body.id;
    this.conversation_id = body.conversation_id;
    this.sender_email    = body.sender_email;
    this.sender_name     = body.sender_name;
    this.recipient_email = body.recipient_email;
    this.recipient_name  = body.recipient_name;
    this.content         = body.content;
    this.read            = body.read === true || body.read === 1 || body.read === '1' ? 1 : 0;
    this.media_url       = body.media_url;
  }

  selectAll(page = 1) {
    const pageSize = 25;
    const offset   = (page - 1) * pageSize;
    return EXECUTESQL('SELECT * FROM direct_messages ORDER BY id DESC LIMIT ? OFFSET ?', [pageSize, offset]);
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM direct_messages WHERE id = ?', [id]);
  }

  selectByConversation(conversation_id) {
    return EXECUTESQL(
      'SELECT * FROM direct_messages WHERE conversation_id = ? ORDER BY id ASC',
      [conversation_id]
    );
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO direct_messages
      (id, conversation_id, sender_email, sender_name, recipient_email, recipient_name,
       content, \`read\`, media_url)
      VALUES (?,?,?,?,?,?,?,?,?)`;
    const values = [
      this.id, this.conversation_id, this.sender_email, this.sender_name,
      this.recipient_email, this.recipient_name, this.content, this.read, this.media_url,
    ];
    return EXECUTESQL(sql, values);
  }

  update(id) {
    const sql = `UPDATE direct_messages SET
      conversation_id=?, sender_email=?, sender_name=?, recipient_email=?, recipient_name=?,
      content=?, \`read\`=?, media_url=?
      WHERE id=?`;
    const values = [
      this.conversation_id, this.sender_email, this.sender_name,
      this.recipient_email, this.recipient_name, this.content, this.read, this.media_url,
      id,
    ];
    return EXECUTESQL(sql, values);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM direct_messages WHERE id = ?', [id]);
  }
}

module.exports = DirectMessage;

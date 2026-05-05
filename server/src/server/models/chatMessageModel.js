const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class ChatMessage {
  constructor(body = {}) {
    this.id           = body.id;
    this.match_id     = body.match_id;
    this.sender_email = body.sender_email;
    this.content      = body.content;
  }

  selectAll(page = 1) {
    const pageSize = 25;
    const offset   = (page - 1) * pageSize;
    return EXECUTESQL('SELECT * FROM chat_messages ORDER BY id ASC LIMIT ? OFFSET ?', [pageSize, offset]);
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM chat_messages WHERE id = ?', [id]);
  }

  selectByMatch(match_id) {
    return EXECUTESQL(
      'SELECT * FROM chat_messages WHERE match_id = ? ORDER BY id ASC',
      [match_id]
    );
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO chat_messages (id, match_id, sender_email, content) VALUES (?,?,?,?)`;
    return EXECUTESQL(sql, [this.id, this.match_id, this.sender_email, this.content]);
  }

  update(id) {
    const sql = `UPDATE chat_messages SET match_id=?, sender_email=?, content=? WHERE id=?`;
    return EXECUTESQL(sql, [this.match_id, this.sender_email, this.content, id]);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM chat_messages WHERE id = ?', [id]);
  }
}

module.exports = ChatMessage;

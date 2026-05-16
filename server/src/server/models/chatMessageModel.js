const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class ChatMessage {
  constructor(body = {}) {
    this.id            = body.id;
    this.channel       = body.channel;
    this.club_id       = body.club_id;
    this.match_id      = body.match_id;
    this.sender_email  = body.sender_email;
    this.sender_name   = body.sender_name;
    this.sender_avatar = body.sender_avatar;
    this.content       = body.content;
  }

  selectAll(page = 1) {
    const pageSize = 25;
    const offset   = (page - 1) * pageSize;
    return EXECUTESQL('SELECT * FROM chat_messages ORDER BY id ASC LIMIT ? OFFSET ?', [pageSize, offset]);
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM chat_messages WHERE id = ?', [id]);
  }

  selectByMatch(match_id, limit = 200) {
    return EXECUTESQL(
      'SELECT * FROM chat_messages WHERE match_id = ? ORDER BY created_date ASC LIMIT ?',
      [match_id, Math.min(Math.max(Number(limit) || 200, 1), 500)]
    );
  }

  selectByChannel(channel, club_id = null) {
    if (club_id) {
      return EXECUTESQL('SELECT * FROM chat_messages WHERE channel = ? AND club_id = ? ORDER BY id ASC', [channel, club_id]);
    }
    return EXECUTESQL('SELECT * FROM chat_messages WHERE channel = ? ORDER BY id ASC', [channel]);
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO chat_messages
      (id, channel, club_id, match_id, sender_email, sender_name, sender_avatar, content)
      VALUES (?,?,?,?,?,?,?,?)`;
    return EXECUTESQL(sql, [
      this.id, this.channel, this.club_id, this.match_id,
      this.sender_email, this.sender_name, this.sender_avatar, this.content,
    ]);
  }

  update(id) {
    const sql = `UPDATE chat_messages SET
      channel=?, club_id=?, match_id=?, sender_email=?, sender_name=?, sender_avatar=?, content=?
      WHERE id=?`;
    return EXECUTESQL(sql, [
      this.channel, this.club_id, this.match_id,
      this.sender_email, this.sender_name, this.sender_avatar, this.content,
      id,
    ]);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM chat_messages WHERE id = ?', [id]);
  }
}

module.exports = ChatMessage;

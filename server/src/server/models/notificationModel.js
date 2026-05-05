const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class Notification {
  constructor(body = {}) {
    this.id              = body.id;
    this.recipient_email = body.recipient_email;
    this.type            = body.type;
    this.title           = body.title;
    this.body            = body.body;
    this.read            = body.read;
    this.link            = body.link;
  }

  selectAll(page = 1) {
    const pageSize = 25;
    const offset   = (page - 1) * pageSize;
    return EXECUTESQL('SELECT * FROM notifications ORDER BY id DESC LIMIT ? OFFSET ?', [pageSize, offset]);
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM notifications WHERE id = ?', [id]);
  }

  selectByRecipient(email) {
    return EXECUTESQL(
      'SELECT * FROM notifications WHERE recipient_email = ? ORDER BY id DESC',
      [email]
    );
  }

  markRead(id) {
    return EXECUTESQL('UPDATE notifications SET read = 1 WHERE id = ?', [id]);
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO notifications
      (id, recipient_email, type, title, body, read, link)
      VALUES (?,?,?,?,?,?,?)`;
    const values = [
      this.id, this.recipient_email, this.type, this.title,
      this.body, this.read, this.link,
    ];
    return EXECUTESQL(sql, values);
  }

  update(id) {
    const sql = `UPDATE notifications SET
      recipient_email=?, type=?, title=?, body=?, read=?, link=?
      WHERE id=?`;
    const values = [
      this.recipient_email, this.type, this.title, this.body,
      this.read, this.link,
      id,
    ];
    return EXECUTESQL(sql, values);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM notifications WHERE id = ?', [id]);
  }
}

module.exports = Notification;

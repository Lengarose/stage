const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class Comment {
  constructor(body = {}) {
    this.id            = body.id;
    this.post_id       = body.post_id;
    this.author_email  = body.author_email;
    this.author_name   = body.author_name;
    this.author_avatar = body.author_avatar;
    this.content       = body.content;
  }

  selectAll(page = 1) {
    const pageSize = 25;
    const offset   = (page - 1) * pageSize;
    return EXECUTESQL('SELECT * FROM comments ORDER BY id DESC LIMIT ? OFFSET ?', [pageSize, offset]);
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM comments WHERE id = ?', [id]);
  }

  selectByPost(post_id) {
    return EXECUTESQL('SELECT * FROM comments WHERE post_id = ? ORDER BY id ASC', [post_id]);
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO comments
      (id, post_id, author_email, author_name, author_avatar, content)
      VALUES (?,?,?,?,?,?)`;
    return EXECUTESQL(sql, [
      this.id, this.post_id, this.author_email,
      this.author_name, this.author_avatar, this.content,
    ]);
  }

  update(id) {
    const sql = `UPDATE comments SET
      post_id=?, author_email=?, author_name=?, author_avatar=?, content=?
      WHERE id=?`;
    return EXECUTESQL(sql, [
      this.post_id, this.author_email,
      this.author_name, this.author_avatar, this.content,
      id,
    ]);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM comments WHERE id = ?', [id]);
  }
}

module.exports = Comment;

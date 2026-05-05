const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class NewsItem {
  constructor(body = {}) {
    this.id           = body.id;
    this.title        = body.title;
    this.body         = body.body;
    this.link         = body.link;
    this.published_at = body.published_at;
  }

  selectAll(page = 1) {
    const pageSize = 25;
    const offset   = (page - 1) * pageSize;
    return EXECUTESQL('SELECT * FROM news_items ORDER BY published_at DESC LIMIT ? OFFSET ?', [pageSize, offset]);
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM news_items WHERE id = ?', [id]);
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO news_items (id, title, body, link, published_at) VALUES (?,?,?,?,?)`;
    return EXECUTESQL(sql, [this.id, this.title, this.body, this.link, this.published_at]);
  }

  update(id) {
    const sql = `UPDATE news_items SET title=?, body=?, link=?, published_at=? WHERE id=?`;
    return EXECUTESQL(sql, [this.title, this.body, this.link, this.published_at, id]);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM news_items WHERE id = ?', [id]);
  }
}

module.exports = NewsItem;

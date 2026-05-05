const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class PressArticle {
  constructor(body = {}) {
    this.id                  = body.id;
    this.title               = body.title;
    this.body                = body.body;
    this.club_name           = body.club_name;
    this.club_logo_url       = body.club_logo_url;
    this.player_name         = body.player_name;
    this.player_avatar_url   = body.player_avatar_url;
    this.link                = body.link;
    this.press_conference_id = body.press_conference_id;
    this.published_at        = body.published_at;
  }

  selectAll(page = 1) {
    const pageSize = 25;
    const offset   = (page - 1) * pageSize;
    return EXECUTESQL('SELECT * FROM press_articles ORDER BY published_at DESC LIMIT ? OFFSET ?', [pageSize, offset]);
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM press_articles WHERE id = ?', [id]);
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO press_articles
      (id, title, body, club_name, club_logo_url, player_name,
       player_avatar_url, link, press_conference_id, published_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)`;
    const values = [
      this.id, this.title, this.body, this.club_name, this.club_logo_url,
      this.player_name, this.player_avatar_url, this.link,
      this.press_conference_id, this.published_at,
    ];
    return EXECUTESQL(sql, values);
  }

  update(id) {
    const sql = `UPDATE press_articles SET
      title=?, body=?, club_name=?, club_logo_url=?, player_name=?,
      player_avatar_url=?, link=?, press_conference_id=?, published_at=?
      WHERE id=?`;
    const values = [
      this.title, this.body, this.club_name, this.club_logo_url,
      this.player_name, this.player_avatar_url, this.link,
      this.press_conference_id, this.published_at,
      id,
    ];
    return EXECUTESQL(sql, values);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM press_articles WHERE id = ?', [id]);
  }
}

module.exports = PressArticle;

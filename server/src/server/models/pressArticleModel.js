const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

function toMysqlDateTime(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 19).replace('T', ' ');
  }
  const asString = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(asString)) return asString;
  const parsed = new Date(asString);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 19).replace('T', ' ');
  }
  return null;
}

class PressArticle {
  constructor(body = {}) {
    this.id                  = body.id;
    this.press_conference_id = body.press_conference_id;
    this.headline            = body.headline;
    this.title               = body.title;
    this.body                = body.body;
    this.player_name         = body.player_name;
    this.player_avatar_url   = body.player_avatar_url;
    this.club_name           = body.club_name;
    this.club_logo_url       = body.club_logo_url;
    this.match_name          = body.match_name;
    this.tournament_name     = body.tournament_name;
    this.tournament_id       = body.tournament_id;
    this.photo_url           = body.photo_url;
    this.photo_position      = body.photo_position;
    this.photo_zoom          = body.photo_zoom;
    this.visibility          = body.visibility;
    this.published_at        = toMysqlDateTime(body.published_at);
    this.link                = body.link;
    this.quotes              = body.quotes
      ? (typeof body.quotes === 'string' ? body.quotes : JSON.stringify(body.quotes))
      : null;
    this.registered_clubs    = body.registered_clubs
      ? (typeof body.registered_clubs === 'string' ? body.registered_clubs : JSON.stringify(body.registered_clubs))
      : null;
  }

  selectAll(page = 1) {
    const pageSize = 25;
    const offset   = (page - 1) * pageSize;
    return EXECUTESQL('SELECT * FROM press_articles ORDER BY published_at DESC LIMIT ? OFFSET ?', [pageSize, offset]);
  }

  selectFiltered({ press_conference_id, club_name } = {}) {
    const conditions = [];
    const params = [];
    if (press_conference_id) { conditions.push('press_conference_id = ?'); params.push(press_conference_id); }
    if (club_name)           { conditions.push('club_name = ?');           params.push(club_name); }
    const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
    return EXECUTESQL(`SELECT * FROM press_articles${where} ORDER BY published_at DESC`, params);
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM press_articles WHERE id = ?', [id]);
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO press_articles
      (id, press_conference_id, headline, title, body,
       player_name, player_avatar_url, club_name, club_logo_url,
       match_name, tournament_name, tournament_id,
       photo_url, photo_position, photo_zoom,
       visibility, published_at, link,
       quotes, registered_clubs)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
    const values = [
      this.id, this.press_conference_id, this.headline, this.title, this.body,
      this.player_name, this.player_avatar_url, this.club_name, this.club_logo_url,
      this.match_name, this.tournament_name, this.tournament_id,
      this.photo_url, this.photo_position, this.photo_zoom,
      this.visibility, this.published_at, this.link,
      this.quotes, this.registered_clubs,
    ];
    return EXECUTESQL(sql, values);
  }

  update(id) {
    const sql = `UPDATE press_articles SET
      press_conference_id=?, headline=?, title=?, body=?,
      player_name=?, player_avatar_url=?, club_name=?, club_logo_url=?,
      match_name=?, tournament_name=?, tournament_id=?,
      photo_url=?, photo_position=?, photo_zoom=?,
      visibility=?, published_at=?, link=?,
      quotes=?, registered_clubs=?
      WHERE id=?`;
    const values = [
      this.press_conference_id, this.headline, this.title, this.body,
      this.player_name, this.player_avatar_url, this.club_name, this.club_logo_url,
      this.match_name, this.tournament_name, this.tournament_id,
      this.photo_url, this.photo_position, this.photo_zoom,
      this.visibility, this.published_at, this.link,
      this.quotes, this.registered_clubs,
      id,
    ];
    return EXECUTESQL(sql, values);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM press_articles WHERE id = ?', [id]);
  }
}

module.exports = PressArticle;

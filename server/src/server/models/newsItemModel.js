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

class NewsItem {
  constructor(body = {}) {
    this.id                    = body.id;
    this.type                  = body.type;
    this.category              = body.category;
    this.title                 = body.title;
    this.body                  = body.body;
    this.image_url             = body.image_url;
    this.club_id               = body.club_id;
    this.club_name             = body.club_name;
    this.club_logo_url         = body.club_logo_url;
    this.player_id             = body.player_id;
    this.player_name           = body.player_name;
    this.player_avatar_url     = body.player_avatar_url;
    this.tournament_id         = body.tournament_id;
    this.tournament_name       = body.tournament_name;
    this.is_featured           = body.is_featured;
    this.is_global             = body.is_global;
    this.published_at          = toMysqlDateTime(body.published_at);
    this.link                  = body.link;
    this.transfer_fee_stc      = body.transfer_fee_stc;
    this.tags                  = body.tags
      ? (typeof body.tags === 'string' ? body.tags : JSON.stringify(body.tags))
      : null;
    this.visible_to_club_ids   = body.visible_to_club_ids
      ? (typeof body.visible_to_club_ids === 'string' ? body.visible_to_club_ids : JSON.stringify(body.visible_to_club_ids))
      : null;
    this.visible_to_player_ids = body.visible_to_player_ids
      ? (typeof body.visible_to_player_ids === 'string' ? body.visible_to_player_ids : JSON.stringify(body.visible_to_player_ids))
      : null;
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
    const sql = `INSERT INTO news_items
      (id, type, category, title, body, image_url,
       club_id, club_name, club_logo_url,
       player_id, player_name, player_avatar_url,
       tournament_id, tournament_name,
       is_featured, is_global, published_at, link, transfer_fee_stc,
       tags, visible_to_club_ids, visible_to_player_ids)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
    const values = [
      this.id, this.type, this.category, this.title, this.body, this.image_url,
      this.club_id, this.club_name, this.club_logo_url,
      this.player_id, this.player_name, this.player_avatar_url,
      this.tournament_id, this.tournament_name,
      this.is_featured, this.is_global, this.published_at, this.link, this.transfer_fee_stc,
      this.tags, this.visible_to_club_ids, this.visible_to_player_ids,
    ];
    return EXECUTESQL(sql, values);
  }

  update(id) {
    const sql = `UPDATE news_items SET
      type=?, category=?, title=?, body=?, image_url=?,
      club_id=?, club_name=?, club_logo_url=?,
      player_id=?, player_name=?, player_avatar_url=?,
      tournament_id=?, tournament_name=?,
      is_featured=?, is_global=?, published_at=?, link=?, transfer_fee_stc=?,
      tags=?, visible_to_club_ids=?, visible_to_player_ids=?
      WHERE id=?`;
    const values = [
      this.type, this.category, this.title, this.body, this.image_url,
      this.club_id, this.club_name, this.club_logo_url,
      this.player_id, this.player_name, this.player_avatar_url,
      this.tournament_id, this.tournament_name,
      this.is_featured, this.is_global, this.published_at, this.link, this.transfer_fee_stc,
      this.tags, this.visible_to_club_ids, this.visible_to_player_ids,
      id,
    ];
    return EXECUTESQL(sql, values);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM news_items WHERE id = ?', [id]);
  }
}

module.exports = NewsItem;

const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');
const { toMysqlDateTime } = require('../utils/datetime');
const fields = ['type','category','title','body','image_url','club_id','club_name','club_logo_url','player_id','player_name','player_avatar_url','tournament_id','tournament_name','is_featured','is_global','published_at','link','transfer_fee_stc','tags','visible_to_club_ids','visible_to_player_ids','transfer_id','editorial','expires_at','publication_status'];
const jsonFields = new Set(['tags','visible_to_club_ids','visible_to_player_ids','editorial']);
class NewsItem {
  constructor(body = {}, query = EXECUTESQL) {
    this.query = query;
    this.id = body.id || uuidv4();
    for (const key of fields) {
      const value = body[key] ?? (key === 'publication_status' ? 'published' : null);
      this[key] = jsonFields.has(key) && value != null && typeof value !== 'string' ? JSON.stringify(value) : ['published_at','expires_at'].includes(key) ? toMysqlDateTime(value) : value;
    }
  }
  selectAll(page = 1) { return this.query('SELECT * FROM news_items ORDER BY published_at DESC,id LIMIT 25 OFFSET ?', [Math.max(0, (page - 1) * 25)]); }
  selectOne(id) { return this.query('SELECT * FROM news_items WHERE id=?', [id]); }
  create() { return this.query(`INSERT INTO news_items (id,${fields.join(',')}) VALUES (${['id',...fields].map(()=>'?').join(',')})`, [this.id,...fields.map(key=>this[key])]); }
  update(id) { return this.query(`UPDATE news_items SET ${fields.map(key=>`${key}=?`).join(',')} WHERE id=?`, [...fields.map(key=>this[key]),id]); }
  delete(id) { return this.query('DELETE FROM news_items WHERE id=?',[id]); }
}
module.exports = NewsItem;

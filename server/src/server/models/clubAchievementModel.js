const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

function toMysqlDateTime(val) {
  if (!val) return null;
  return new Date(val).toISOString().slice(0, 19).replace('T', ' ');
}

class ClubAchievementModel {
  constructor(body = {}) {
    this.id              = body.id;
    this.club_id         = body.club_id;
    this.club_name       = body.club_name;
    this.club_logo_url   = body.club_logo_url;
    this.club_tag        = body.club_tag;
    this.source_id       = body.source_id;
    this.source_type     = body.source_type;
    this.source_name     = body.source_name;
    this.season_id       = body.season_id;
    this.season_number   = body.season_number;
    this.season_label    = body.season_label;
    this.position        = body.position ?? null;
    this.position_label  = body.position_label;
    this.badge_type      = body.badge_type || 'participant';
    this.stc_awarded     = body.stc_awarded ?? 0;
    this.trophy_image_url = body.trophy_image_url;
    this.awarded_at      = toMysqlDateTime(body.awarded_at);
  }

  selectAll(page = 1) {
    const pageSize = 25;
    const offset   = (page - 1) * pageSize;
    return EXECUTESQL('SELECT * FROM club_achievements ORDER BY awarded_at DESC LIMIT ? OFFSET ?', [pageSize, offset]);
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM club_achievements WHERE id = ?', [id]);
  }

  selectByClub(club_id) {
    return EXECUTESQL('SELECT * FROM club_achievements WHERE club_id = ? ORDER BY awarded_at DESC', [club_id]);
  }

  selectBySource(source_id) {
    return EXECUTESQL('SELECT * FROM club_achievements WHERE source_id = ? ORDER BY position ASC', [source_id]);
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO club_achievements
      (id, club_id, club_name, club_logo_url, club_tag,
       source_id, source_type, source_name,
       season_id, season_number, season_label,
       position, position_label, badge_type, stc_awarded, trophy_image_url, awarded_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
    const values = [
      this.id, this.club_id, this.club_name, this.club_logo_url, this.club_tag,
      this.source_id, this.source_type, this.source_name,
      this.season_id, this.season_number, this.season_label,
      this.position, this.position_label, this.badge_type, this.stc_awarded, this.trophy_image_url, this.awarded_at,
    ];
    return EXECUTESQL(sql, values);
  }

  update(id) {
    const sql = `UPDATE club_achievements SET
      club_id=?, club_name=?, club_logo_url=?, club_tag=?,
      source_id=?, source_type=?, source_name=?,
      season_id=?, season_number=?, season_label=?,
      position=?, position_label=?, badge_type=?, stc_awarded=?, trophy_image_url=?, awarded_at=?
      WHERE id=?`;
    const values = [
      this.club_id, this.club_name, this.club_logo_url, this.club_tag,
      this.source_id, this.source_type, this.source_name,
      this.season_id, this.season_number, this.season_label,
      this.position, this.position_label, this.badge_type, this.stc_awarded, this.trophy_image_url, this.awarded_at,
      id,
    ];
    return EXECUTESQL(sql, values);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM club_achievements WHERE id = ?', [id]);
  }
}

module.exports = ClubAchievementModel;

const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

function toMysqlDateTime(val) {
  if (!val) return null;
  return new Date(val).toISOString().slice(0, 19).replace('T', ' ');
}

class QualificationEntryModel {
  constructor(body = {}) {
    this.id                       = body.id;
    this.source_type              = body.source_type || 'regional_league';
    this.regional_league_id       = body.regional_league_id;
    this.regional_league_name     = body.regional_league_name;
    this.regional_finish_position = body.regional_finish_position ?? null;
    this.target_competition_id    = body.target_competition_id;
    this.target_competition_name  = body.target_competition_name;
    this.target_competition_tier  = body.target_competition_tier ?? null;
    this.target_season_id         = body.target_season_id;
    this.target_season_number     = body.target_season_number ?? null;
    this.club_id                  = body.club_id;
    this.club_name                = body.club_name;
    this.club_logo_url            = body.club_logo_url;
    this.club_tag                 = body.club_tag;
    this.club_region              = body.club_region;
    this.club_platform            = body.club_platform;
    this.status                   = body.status || 'pending';
    this.confirmed_by             = body.confirmed_by;
    this.confirmed_at             = toMysqlDateTime(body.confirmed_at);
    this.notes                    = body.notes;
  }

  selectAll(page = 1) {
    const pageSize = 25;
    const offset   = (page - 1) * pageSize;
    return EXECUTESQL('SELECT * FROM qualification_entries ORDER BY created_date DESC LIMIT ? OFFSET ?', [pageSize, offset]);
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM qualification_entries WHERE id = ?', [id]);
  }

  selectByClub(club_id) {
    return EXECUTESQL('SELECT * FROM qualification_entries WHERE club_id = ? ORDER BY created_date DESC', [club_id]);
  }

  selectByTarget(target_competition_id) {
    return EXECUTESQL('SELECT * FROM qualification_entries WHERE target_competition_id = ? ORDER BY created_date DESC', [target_competition_id]);
  }

  selectByStatus(status) {
    return EXECUTESQL('SELECT * FROM qualification_entries WHERE status = ? ORDER BY created_date DESC', [status]);
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO qualification_entries
      (id, source_type, regional_league_id, regional_league_name, regional_finish_position,
       target_competition_id, target_competition_name, target_competition_tier,
       target_season_id, target_season_number,
       club_id, club_name, club_logo_url, club_tag, club_region, club_platform,
       status, confirmed_by, confirmed_at, notes)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
    const values = [
      this.id, this.source_type, this.regional_league_id, this.regional_league_name, this.regional_finish_position,
      this.target_competition_id, this.target_competition_name, this.target_competition_tier,
      this.target_season_id, this.target_season_number,
      this.club_id, this.club_name, this.club_logo_url, this.club_tag, this.club_region, this.club_platform,
      this.status, this.confirmed_by, this.confirmed_at, this.notes,
    ];
    return EXECUTESQL(sql, values);
  }

  update(id) {
    const sql = `UPDATE qualification_entries SET
      source_type=?, regional_league_id=?, regional_league_name=?, regional_finish_position=?,
      target_competition_id=?, target_competition_name=?, target_competition_tier=?,
      target_season_id=?, target_season_number=?,
      club_id=?, club_name=?, club_logo_url=?, club_tag=?, club_region=?, club_platform=?,
      status=?, confirmed_by=?, confirmed_at=?, notes=?
      WHERE id=?`;
    const values = [
      this.source_type, this.regional_league_id, this.regional_league_name, this.regional_finish_position,
      this.target_competition_id, this.target_competition_name, this.target_competition_tier,
      this.target_season_id, this.target_season_number,
      this.club_id, this.club_name, this.club_logo_url, this.club_tag, this.club_region, this.club_platform,
      this.status, this.confirmed_by, this.confirmed_at, this.notes,
      id,
    ];
    return EXECUTESQL(sql, values);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM qualification_entries WHERE id = ?', [id]);
  }
}

module.exports = QualificationEntryModel;

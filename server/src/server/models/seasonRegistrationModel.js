const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

function toMysqlDateTime(val) {
  if (!val) return null;
  return new Date(val).toISOString().slice(0, 19).replace('T', ' ');
}

class SeasonRegistrationModel {
  constructor(body = {}) {
    this.id                   = body.id;
    this.club_id              = body.club_id;
    this.club_name            = body.club_name;
    this.club_tag             = body.club_tag;
    this.club_logo_url        = body.club_logo_url;
    this.owner_email          = body.owner_email;
    this.target_type          = body.target_type || 'regional_league';
    this.region_slug          = body.region_slug;
    this.region_name          = body.region_name;
    this.platform             = body.platform;
    this.preferred_division   = body.preferred_division ?? 1;
    this.note_from_club       = body.note_from_club;
    this.season_label         = body.season_label;
    this.status               = body.status || 'pending';
    this.assigned_league_id   = body.assigned_league_id;
    this.assigned_league_name = body.assigned_league_name;
    this.assigned_division    = body.assigned_division ?? null;
    this.admin_notes          = body.admin_notes;
    this.reviewed_by          = body.reviewed_by;
    this.reviewed_at          = toMysqlDateTime(body.reviewed_at);
    this.applied_at           = toMysqlDateTime(body.applied_at);
  }

  selectAll(page = 1) {
    const pageSize = 25;
    const offset   = (page - 1) * pageSize;
    return EXECUTESQL('SELECT * FROM season_registrations ORDER BY created_date DESC LIMIT ? OFFSET ?', [pageSize, offset]);
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM season_registrations WHERE id = ?', [id]);
  }

  selectByClub(club_id) {
    return EXECUTESQL('SELECT * FROM season_registrations WHERE club_id = ? ORDER BY created_date DESC', [club_id]);
  }

  selectByStatus(status) {
    return EXECUTESQL('SELECT * FROM season_registrations WHERE status = ? ORDER BY created_date DESC', [status]);
  }

  selectByRegion(region_slug) {
    return EXECUTESQL('SELECT * FROM season_registrations WHERE region_slug = ? ORDER BY created_date DESC', [region_slug]);
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO season_registrations
      (id, club_id, club_name, club_tag, club_logo_url, owner_email,
       target_type, region_slug, region_name, platform, preferred_division, note_from_club,
       season_label, status,
       assigned_league_id, assigned_league_name, assigned_division,
       admin_notes, reviewed_by, reviewed_at, applied_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
    const values = [
      this.id, this.club_id, this.club_name, this.club_tag, this.club_logo_url, this.owner_email,
      this.target_type, this.region_slug, this.region_name, this.platform, this.preferred_division, this.note_from_club,
      this.season_label, this.status,
      this.assigned_league_id, this.assigned_league_name, this.assigned_division,
      this.admin_notes, this.reviewed_by, this.reviewed_at, this.applied_at,
    ];
    return EXECUTESQL(sql, values);
  }

  update(id) {
    const sql = `UPDATE season_registrations SET
      club_id=?, club_name=?, club_tag=?, club_logo_url=?, owner_email=?,
      target_type=?, region_slug=?, region_name=?, platform=?, preferred_division=?, note_from_club=?,
      season_label=?, status=?,
      assigned_league_id=?, assigned_league_name=?, assigned_division=?,
      admin_notes=?, reviewed_by=?, reviewed_at=?, applied_at=?
      WHERE id=?`;
    const values = [
      this.club_id, this.club_name, this.club_tag, this.club_logo_url, this.owner_email,
      this.target_type, this.region_slug, this.region_name, this.platform, this.preferred_division, this.note_from_club,
      this.season_label, this.status,
      this.assigned_league_id, this.assigned_league_name, this.assigned_division,
      this.admin_notes, this.reviewed_by, this.reviewed_at, this.applied_at,
      id,
    ];
    return EXECUTESQL(sql, values);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM season_registrations WHERE id = ?', [id]);
  }
}

module.exports = SeasonRegistrationModel;

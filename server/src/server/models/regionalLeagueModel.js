const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

function toMysqlDateTime(val) {
  if (!val) return null;
  return new Date(val).toISOString().slice(0, 19).replace('T', ' ');
}

class RegionalLeagueModel {
  constructor(body = {}) {
    this.id                      = body.id;
    this.name                    = body.name;
    this.slug                    = body.slug;
    this.region_slug             = body.region_slug;
    this.division                = body.division ?? 1;
    this.country_code            = body.country_code;
    this.region                  = body.region;
    this.platform                = body.platform || 'Cross-Platform';
    this.season_number           = body.season_number ?? 1;
    this.status                  = body.status || 'draft';
    this.archived_at             = toMysqlDateTime(body.archived_at);
    this.next_season_id          = body.next_season_id;
    this.max_clubs               = body.max_clubs ?? 16;
    this.num_clubs               = body.num_clubs ?? 0;
    this.start_date              = toMysqlDateTime(body.start_date);
    this.end_date                = toMysqlDateTime(body.end_date);
    this.promoted_slots          = body.promoted_slots ?? 2;
    this.target_competition_id   = body.target_competition_id;
    this.target_competition_name = body.target_competition_name;
    this.target_competition_tier = body.target_competition_tier ?? null;
    this.target_season_id        = body.target_season_id;
    this.registered_club_ids     = body.registered_club_ids
      ? (typeof body.registered_club_ids === 'string' ? body.registered_club_ids : JSON.stringify(body.registered_club_ids))
      : null;
    this.winner_club_id          = body.winner_club_id;
    this.winner_club_name        = body.winner_club_name;
    this.organizer_email         = body.organizer_email;
    this.trophy_item_id          = body.trophy_item_id;
    this.banner_url              = body.banner_url;
    this.linked_league_slug      = body.linked_league_slug;
    this.admin_notes             = body.admin_notes;
    this.trophy_image_url        = body.trophy_image_url;
  }

  selectAll(page = 1) {
    const pageSize = 25;
    const offset   = (page - 1) * pageSize;
    return EXECUTESQL('SELECT * FROM regional_leagues ORDER BY created_date DESC LIMIT ? OFFSET ?', [pageSize, offset]);
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM regional_leagues WHERE id = ?', [id]);
  }

  selectByRegion(region_slug) {
    return EXECUTESQL('SELECT * FROM regional_leagues WHERE region_slug = ? ORDER BY division ASC, season_number DESC', [region_slug]);
  }

  selectByStatus(status) {
    return EXECUTESQL('SELECT * FROM regional_leagues WHERE status = ? ORDER BY region_slug ASC, division ASC', [status]);
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO regional_leagues
      (id, name, slug, region_slug, division, country_code, region, platform,
       season_number, status, archived_at, next_season_id,
       max_clubs, num_clubs, start_date, end_date, promoted_slots,
       target_competition_id, target_competition_name, target_competition_tier, target_season_id,
       registered_club_ids, winner_club_id, winner_club_name,
       organizer_email, trophy_item_id, banner_url, linked_league_slug, admin_notes, trophy_image_url)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
    const values = [
      this.id, this.name, this.slug, this.region_slug, this.division, this.country_code, this.region, this.platform,
      this.season_number, this.status, this.archived_at, this.next_season_id,
      this.max_clubs, this.num_clubs, this.start_date, this.end_date, this.promoted_slots,
      this.target_competition_id, this.target_competition_name, this.target_competition_tier, this.target_season_id,
      this.registered_club_ids, this.winner_club_id, this.winner_club_name,
      this.organizer_email, this.trophy_item_id, this.banner_url, this.linked_league_slug, this.admin_notes, this.trophy_image_url,
    ];
    return EXECUTESQL(sql, values);
  }

  update(id) {
    const sql = `UPDATE regional_leagues SET
      name=?, slug=?, region_slug=?, division=?, country_code=?, region=?, platform=?,
      season_number=?, status=?, archived_at=?, next_season_id=?,
      max_clubs=?, num_clubs=?, start_date=?, end_date=?, promoted_slots=?,
      target_competition_id=?, target_competition_name=?, target_competition_tier=?, target_season_id=?,
      registered_club_ids=?, winner_club_id=?, winner_club_name=?,
      organizer_email=?, trophy_item_id=?, banner_url=?, linked_league_slug=?, admin_notes=?, trophy_image_url=?
      WHERE id=?`;
    const values = [
      this.name, this.slug, this.region_slug, this.division, this.country_code, this.region, this.platform,
      this.season_number, this.status, this.archived_at, this.next_season_id,
      this.max_clubs, this.num_clubs, this.start_date, this.end_date, this.promoted_slots,
      this.target_competition_id, this.target_competition_name, this.target_competition_tier, this.target_season_id,
      this.registered_club_ids, this.winner_club_id, this.winner_club_name,
      this.organizer_email, this.trophy_item_id, this.banner_url, this.linked_league_slug, this.admin_notes, this.trophy_image_url,
      id,
    ];
    return EXECUTESQL(sql, values);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM regional_leagues WHERE id = ?', [id]);
  }
}

module.exports = RegionalLeagueModel;

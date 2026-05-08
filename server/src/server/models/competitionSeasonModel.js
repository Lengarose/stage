const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

function toMysqlDateTime(val) {
  if (!val) return null;
  return new Date(val).toISOString().slice(0, 19).replace('T', ' ');
}

class CompetitionSeasonModel {
  constructor(body = {}) {
    this.id                    = body.id;
    this.competition_id        = body.competition_id;
    this.competition_name      = body.competition_name;
    this.competition_tier      = body.competition_tier;
    this.competition_slug      = body.competition_slug;
    this.season_number         = body.season_number ?? 1;
    this.season_label          = body.season_label;
    this.platform              = body.platform || 'Cross-Platform';
    this.region                = body.region || 'Global';
    this.format                = body.format || 'league_36_8md';
    this.num_league_matchdays  = body.num_league_matchdays ?? 8;
    this.fixtures_generated    = body.fixtures_generated ?? false;
    this.status                = body.status || 'draft';
    this.archived_at           = toMysqlDateTime(body.archived_at);
    this.next_season_id        = body.next_season_id;
    this.playoff_format        = body.playoff_format || '9_24_bracket';
    this.start_date            = toMysqlDateTime(body.start_date);
    this.end_date              = toMysqlDateTime(body.end_date);
    this.registration_deadline = toMysqlDateTime(body.registration_deadline);
    this.registered_club_ids   = body.registered_club_ids
      ? (typeof body.registered_club_ids === 'string' ? body.registered_club_ids : JSON.stringify(body.registered_club_ids))
      : null;
    this.num_clubs             = body.num_clubs ?? 0;
    this.league_matchday_total = body.league_matchday_total ?? 0;
    this.current_matchday      = body.current_matchday ?? 1;
    this.winner_club_id        = body.winner_club_id;
    this.winner_club_name      = body.winner_club_name;
    this.runner_up_club_id     = body.runner_up_club_id;
    this.runner_up_club_name   = body.runner_up_club_name;
    this.prize_pool_stc        = body.prize_pool_stc ?? 0;
    this.trophy_item_id        = body.trophy_item_id;
    this.admin_notes           = body.admin_notes;
  }

  selectAll(page = 1) {
    const pageSize = 25;
    const offset   = (page - 1) * pageSize;
    return EXECUTESQL('SELECT * FROM competition_seasons ORDER BY created_date DESC LIMIT ? OFFSET ?', [pageSize, offset]);
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM competition_seasons WHERE id = ?', [id]);
  }

  selectByCompetition(competition_id) {
    return EXECUTESQL('SELECT * FROM competition_seasons WHERE competition_id = ? ORDER BY season_number DESC', [competition_id]);
  }

  selectByStatus(status) {
    return EXECUTESQL('SELECT * FROM competition_seasons WHERE status = ? ORDER BY created_date DESC', [status]);
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO competition_seasons
      (id, competition_id, competition_name, competition_tier, competition_slug,
       season_number, season_label, platform, region, format,
       num_league_matchdays, fixtures_generated, status, archived_at, next_season_id,
       playoff_format, start_date, end_date, registration_deadline, registered_club_ids,
       num_clubs, league_matchday_total, current_matchday,
       winner_club_id, winner_club_name, runner_up_club_id, runner_up_club_name,
       prize_pool_stc, trophy_item_id, admin_notes)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
    const values = [
      this.id, this.competition_id, this.competition_name, this.competition_tier, this.competition_slug,
      this.season_number, this.season_label, this.platform, this.region, this.format,
      this.num_league_matchdays, this.fixtures_generated, this.status, this.archived_at, this.next_season_id,
      this.playoff_format, this.start_date, this.end_date, this.registration_deadline, this.registered_club_ids,
      this.num_clubs, this.league_matchday_total, this.current_matchday,
      this.winner_club_id, this.winner_club_name, this.runner_up_club_id, this.runner_up_club_name,
      this.prize_pool_stc, this.trophy_item_id, this.admin_notes,
    ];
    return EXECUTESQL(sql, values);
  }

  update(id) {
    const sql = `UPDATE competition_seasons SET
      competition_id=?, competition_name=?, competition_tier=?, competition_slug=?,
      season_number=?, season_label=?, platform=?, region=?, format=?,
      num_league_matchdays=?, fixtures_generated=?, status=?, archived_at=?, next_season_id=?,
      playoff_format=?, start_date=?, end_date=?, registration_deadline=?, registered_club_ids=?,
      num_clubs=?, league_matchday_total=?, current_matchday=?,
      winner_club_id=?, winner_club_name=?, runner_up_club_id=?, runner_up_club_name=?,
      prize_pool_stc=?, trophy_item_id=?, admin_notes=?
      WHERE id=?`;
    const values = [
      this.competition_id, this.competition_name, this.competition_tier, this.competition_slug,
      this.season_number, this.season_label, this.platform, this.region, this.format,
      this.num_league_matchdays, this.fixtures_generated, this.status, this.archived_at, this.next_season_id,
      this.playoff_format, this.start_date, this.end_date, this.registration_deadline, this.registered_club_ids,
      this.num_clubs, this.league_matchday_total, this.current_matchday,
      this.winner_club_id, this.winner_club_name, this.runner_up_club_id, this.runner_up_club_name,
      this.prize_pool_stc, this.trophy_item_id, this.admin_notes,
      id,
    ];
    return EXECUTESQL(sql, values);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM competition_seasons WHERE id = ?', [id]);
  }
}

module.exports = CompetitionSeasonModel;

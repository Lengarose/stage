const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

function toMysqlDateTime(val) {
  if (!val) return null;
  return new Date(val).toISOString().slice(0, 19).replace('T', ' ');
}

class CompetitionFixtureModel {
  constructor(body = {}) {
    this.id                  = body.id;
    this.season_id           = body.season_id;
    this.competition_id      = body.competition_id;
    this.competition_name    = body.competition_name;
    this.competition_tier    = body.competition_tier;
    this.competition_slug    = body.competition_slug;
    this.season_number       = body.season_number;
    this.match_id            = body.match_id;
    this.home_club_id        = body.home_club_id;
    this.home_club_name      = body.home_club_name;
    this.home_club_logo_url  = body.home_club_logo_url;
    this.home_club_tag       = body.home_club_tag;
    this.away_club_id        = body.away_club_id;
    this.away_club_name      = body.away_club_name;
    this.away_club_logo_url  = body.away_club_logo_url;
    this.away_club_tag       = body.away_club_tag;
    this.phase               = body.phase || 'league';
    this.tie_id              = body.tie_id;
    this.leg                 = body.leg ?? null;
    this.matchday            = body.matchday ?? null;
    this.round               = body.round ?? null;
    this.bracket_position    = body.bracket_position ?? null;
    this.scheduled_date      = toMysqlDateTime(body.scheduled_date);
    this.status              = body.status || 'scheduled';
    this.home_score          = body.home_score ?? 0;
    this.away_score          = body.away_score ?? 0;
    this.home_submitted_score = body.home_submitted_score;
    this.away_submitted_score = body.away_submitted_score;
    this.winner_club_id      = body.winner_club_id;
    this.winner_club_name    = body.winner_club_name;
    this.stats_processed     = body.stats_processed ?? false;
    this.window_start        = toMysqlDateTime(body.window_start);
    this.window_end          = toMysqlDateTime(body.window_end);
    this.window_days         = body.window_days ?? 5;
    this.scheduling_status   = body.scheduling_status || 'open';
    this.home_proposed_date  = toMysqlDateTime(body.home_proposed_date);
    this.away_proposed_date  = toMysqlDateTime(body.away_proposed_date);
    this.confirmed_date      = toMysqlDateTime(body.confirmed_date);
    this.last_proposed_by    = body.last_proposed_by;
    this.proposal_count      = body.proposal_count ?? 0;
    this.admin_notes         = body.admin_notes;
  }

  selectAll(page = 1) {
    const pageSize = 25;
    const offset   = (page - 1) * pageSize;
    return EXECUTESQL('SELECT * FROM competition_fixtures ORDER BY created_date DESC LIMIT ? OFFSET ?', [pageSize, offset]);
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM competition_fixtures WHERE id = ?', [id]);
  }

  selectBySeason(season_id) {
    return EXECUTESQL('SELECT * FROM competition_fixtures WHERE season_id = ? ORDER BY matchday ASC, round ASC', [season_id]);
  }

  selectByClub(club_id) {
    return EXECUTESQL(
      'SELECT * FROM competition_fixtures WHERE home_club_id = ? OR away_club_id = ? ORDER BY created_date DESC',
      [club_id, club_id]
    );
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO competition_fixtures
      (id, season_id, competition_id, competition_name, competition_tier, competition_slug, season_number,
       match_id, home_club_id, home_club_name, home_club_logo_url, home_club_tag,
       away_club_id, away_club_name, away_club_logo_url, away_club_tag,
       phase, tie_id, leg, matchday, round, bracket_position,
       scheduled_date, status, home_score, away_score,
       home_submitted_score, away_submitted_score, winner_club_id, winner_club_name,
       stats_processed, window_start, window_end, window_days,
       scheduling_status, home_proposed_date, away_proposed_date, confirmed_date,
       last_proposed_by, proposal_count, admin_notes)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
    const values = [
      this.id, this.season_id, this.competition_id, this.competition_name, this.competition_tier, this.competition_slug, this.season_number,
      this.match_id, this.home_club_id, this.home_club_name, this.home_club_logo_url, this.home_club_tag,
      this.away_club_id, this.away_club_name, this.away_club_logo_url, this.away_club_tag,
      this.phase, this.tie_id, this.leg, this.matchday, this.round, this.bracket_position,
      this.scheduled_date, this.status, this.home_score, this.away_score,
      this.home_submitted_score, this.away_submitted_score, this.winner_club_id, this.winner_club_name,
      this.stats_processed, this.window_start, this.window_end, this.window_days,
      this.scheduling_status, this.home_proposed_date, this.away_proposed_date, this.confirmed_date,
      this.last_proposed_by, this.proposal_count, this.admin_notes,
    ];
    return EXECUTESQL(sql, values);
  }

  update(id) {
    const sql = `UPDATE competition_fixtures SET
      season_id=?, competition_id=?, competition_name=?, competition_tier=?, competition_slug=?, season_number=?,
      match_id=?, home_club_id=?, home_club_name=?, home_club_logo_url=?, home_club_tag=?,
      away_club_id=?, away_club_name=?, away_club_logo_url=?, away_club_tag=?,
      phase=?, tie_id=?, leg=?, matchday=?, round=?, bracket_position=?,
      scheduled_date=?, status=?, home_score=?, away_score=?,
      home_submitted_score=?, away_submitted_score=?, winner_club_id=?, winner_club_name=?,
      stats_processed=?, window_start=?, window_end=?, window_days=?,
      scheduling_status=?, home_proposed_date=?, away_proposed_date=?, confirmed_date=?,
      last_proposed_by=?, proposal_count=?, admin_notes=?
      WHERE id=?`;
    const values = [
      this.season_id, this.competition_id, this.competition_name, this.competition_tier, this.competition_slug, this.season_number,
      this.match_id, this.home_club_id, this.home_club_name, this.home_club_logo_url, this.home_club_tag,
      this.away_club_id, this.away_club_name, this.away_club_logo_url, this.away_club_tag,
      this.phase, this.tie_id, this.leg, this.matchday, this.round, this.bracket_position,
      this.scheduled_date, this.status, this.home_score, this.away_score,
      this.home_submitted_score, this.away_submitted_score, this.winner_club_id, this.winner_club_name,
      this.stats_processed, this.window_start, this.window_end, this.window_days,
      this.scheduling_status, this.home_proposed_date, this.away_proposed_date, this.confirmed_date,
      this.last_proposed_by, this.proposal_count, this.admin_notes,
      id,
    ];
    return EXECUTESQL(sql, values);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM competition_fixtures WHERE id = ?', [id]);
  }
}

module.exports = CompetitionFixtureModel;

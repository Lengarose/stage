const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

function toMysqlDateTime(val) {
  if (!val) return null;
  return new Date(val).toISOString().slice(0, 19).replace('T', ' ');
}

class RegionalLeagueFixtureModel {
  constructor(body = {}) {
    this.id                   = body.id;
    this.league_id            = body.league_id;
    this.league_name          = body.league_name;
    this.region_slug          = body.region_slug;
    this.division             = body.division ?? 1;
    this.season_number        = body.season_number ?? 1;
    this.matchday             = body.matchday;
    this.home_club_id         = body.home_club_id;
    this.home_club_name       = body.home_club_name;
    this.home_club_logo_url   = body.home_club_logo_url;
    this.home_club_tag        = body.home_club_tag;
    this.away_club_id         = body.away_club_id;
    this.away_club_name       = body.away_club_name;
    this.away_club_logo_url   = body.away_club_logo_url;
    this.away_club_tag        = body.away_club_tag;
    this.window_start         = toMysqlDateTime(body.window_start);
    this.window_end           = toMysqlDateTime(body.window_end);
    this.window_days          = body.window_days ?? 4;
    this.scheduling_status    = body.scheduling_status || 'open';
    this.home_proposed_date   = toMysqlDateTime(body.home_proposed_date);
    this.away_proposed_date   = toMysqlDateTime(body.away_proposed_date);
    this.confirmed_date       = toMysqlDateTime(body.confirmed_date);
    this.last_proposed_by     = body.last_proposed_by;
    this.proposal_count       = body.proposal_count ?? 0;
    this.status               = body.status || 'unscheduled';
    this.home_score           = body.home_score ?? 0;
    this.away_score           = body.away_score ?? 0;
    this.home_submitted_score = body.home_submitted_score;
    this.away_submitted_score = body.away_submitted_score;
    this.winner_club_id       = body.winner_club_id;
    this.winner_club_name     = body.winner_club_name;
    this.stats_processed      = body.stats_processed ?? false;
    this.admin_notes          = body.admin_notes;
    this.match_id             = body.match_id;
  }

  selectAll(page = 1) {
    const pageSize = 25;
    const offset   = (page - 1) * pageSize;
    return EXECUTESQL('SELECT * FROM regional_league_fixtures ORDER BY created_date DESC LIMIT ? OFFSET ?', [pageSize, offset]);
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM regional_league_fixtures WHERE id = ?', [id]);
  }

  selectByLeague(league_id) {
    return EXECUTESQL('SELECT * FROM regional_league_fixtures WHERE league_id = ? ORDER BY matchday ASC', [league_id]);
  }

  selectByClub(club_id) {
    return EXECUTESQL(
      'SELECT * FROM regional_league_fixtures WHERE home_club_id = ? OR away_club_id = ? ORDER BY matchday ASC',
      [club_id, club_id]
    );
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO regional_league_fixtures
      (id, league_id, league_name, region_slug, division, season_number, matchday,
       home_club_id, home_club_name, home_club_logo_url, home_club_tag,
       away_club_id, away_club_name, away_club_logo_url, away_club_tag,
       window_start, window_end, window_days,
       scheduling_status, home_proposed_date, away_proposed_date, confirmed_date,
       last_proposed_by, proposal_count,
       status, home_score, away_score,
       home_submitted_score, away_submitted_score,
       winner_club_id, winner_club_name, stats_processed, admin_notes, match_id)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
    const values = [
      this.id, this.league_id, this.league_name, this.region_slug, this.division, this.season_number, this.matchday,
      this.home_club_id, this.home_club_name, this.home_club_logo_url, this.home_club_tag,
      this.away_club_id, this.away_club_name, this.away_club_logo_url, this.away_club_tag,
      this.window_start, this.window_end, this.window_days,
      this.scheduling_status, this.home_proposed_date, this.away_proposed_date, this.confirmed_date,
      this.last_proposed_by, this.proposal_count,
      this.status, this.home_score, this.away_score,
      this.home_submitted_score, this.away_submitted_score,
      this.winner_club_id, this.winner_club_name, this.stats_processed, this.admin_notes, this.match_id,
    ];
    return EXECUTESQL(sql, values);
  }

  update(id) {
    const sql = `UPDATE regional_league_fixtures SET
      league_id=?, league_name=?, region_slug=?, division=?, season_number=?, matchday=?,
      home_club_id=?, home_club_name=?, home_club_logo_url=?, home_club_tag=?,
      away_club_id=?, away_club_name=?, away_club_logo_url=?, away_club_tag=?,
      window_start=?, window_end=?, window_days=?,
      scheduling_status=?, home_proposed_date=?, away_proposed_date=?, confirmed_date=?,
      last_proposed_by=?, proposal_count=?,
      status=?, home_score=?, away_score=?,
      home_submitted_score=?, away_submitted_score=?,
      winner_club_id=?, winner_club_name=?, stats_processed=?, admin_notes=?, match_id=?
      WHERE id=?`;
    const values = [
      this.league_id, this.league_name, this.region_slug, this.division, this.season_number, this.matchday,
      this.home_club_id, this.home_club_name, this.home_club_logo_url, this.home_club_tag,
      this.away_club_id, this.away_club_name, this.away_club_logo_url, this.away_club_tag,
      this.window_start, this.window_end, this.window_days,
      this.scheduling_status, this.home_proposed_date, this.away_proposed_date, this.confirmed_date,
      this.last_proposed_by, this.proposal_count,
      this.status, this.home_score, this.away_score,
      this.home_submitted_score, this.away_submitted_score,
      this.winner_club_id, this.winner_club_name, this.stats_processed, this.admin_notes, this.match_id,
      id,
    ];
    return EXECUTESQL(sql, values);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM regional_league_fixtures WHERE id = ?', [id]);
  }
}

module.exports = RegionalLeagueFixtureModel;

const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class CompetitionStandingModel {
  constructor(body = {}) {
    this.id                  = body.id;
    this.season_id           = body.season_id;
    this.competition_id      = body.competition_id;
    this.competition_name    = body.competition_name;
    this.competition_tier    = body.competition_tier;
    this.competition_slug    = body.competition_slug;
    this.season_number       = body.season_number;
    this.club_id             = body.club_id;
    this.club_name           = body.club_name;
    this.club_logo_url       = body.club_logo_url;
    this.club_tag            = body.club_tag;
    this.platform            = body.platform;
    this.region              = body.region;
    this.position            = body.position ?? 0;
    this.played              = body.played ?? 0;
    this.wins                = body.wins ?? 0;
    this.draws               = body.draws ?? 0;
    this.losses              = body.losses ?? 0;
    this.goals_for           = body.goals_for ?? 0;
    this.goals_against       = body.goals_against ?? 0;
    this.goal_difference     = body.goal_difference ?? 0;
    this.points              = body.points ?? 0;
    this.form                = body.form
      ? (typeof body.form === 'string' ? body.form : JSON.stringify(body.form))
      : null;
    this.is_promoted         = body.is_promoted ?? false;
    this.is_relegated        = body.is_relegated ?? false;
    this.is_playoff_qualified = body.is_playoff_qualified ?? false;
    this.is_direct_knockout  = body.is_direct_knockout ?? false;
    this.is_eliminated       = body.is_eliminated ?? false;
    this.final_position      = body.final_position ?? null;
  }

  selectAll(page = 1) {
    const pageSize = 25;
    const offset   = (page - 1) * pageSize;
    return EXECUTESQL('SELECT * FROM competition_standings ORDER BY season_id, position ASC LIMIT ? OFFSET ?', [pageSize, offset]);
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM competition_standings WHERE id = ?', [id]);
  }

  selectBySeason(season_id) {
    return EXECUTESQL('SELECT * FROM competition_standings WHERE season_id = ? ORDER BY position ASC', [season_id]);
  }

  selectByClub(club_id) {
    return EXECUTESQL('SELECT * FROM competition_standings WHERE club_id = ? ORDER BY created_date DESC', [club_id]);
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO competition_standings
      (id, season_id, competition_id, competition_name, competition_tier, competition_slug,
       season_number, club_id, club_name, club_logo_url, club_tag, platform, region,
       position, played, wins, draws, losses, goals_for, goals_against, goal_difference, points,
       form, is_promoted, is_relegated, is_playoff_qualified, is_direct_knockout, is_eliminated, final_position)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
    const values = [
      this.id, this.season_id, this.competition_id, this.competition_name, this.competition_tier, this.competition_slug,
      this.season_number, this.club_id, this.club_name, this.club_logo_url, this.club_tag, this.platform, this.region,
      this.position, this.played, this.wins, this.draws, this.losses, this.goals_for, this.goals_against, this.goal_difference, this.points,
      this.form, this.is_promoted, this.is_relegated, this.is_playoff_qualified, this.is_direct_knockout, this.is_eliminated, this.final_position,
    ];
    return EXECUTESQL(sql, values);
  }

  update(id) {
    const sql = `UPDATE competition_standings SET
      season_id=?, competition_id=?, competition_name=?, competition_tier=?, competition_slug=?,
      season_number=?, club_id=?, club_name=?, club_logo_url=?, club_tag=?, platform=?, region=?,
      position=?, played=?, wins=?, draws=?, losses=?, goals_for=?, goals_against=?, goal_difference=?, points=?,
      form=?, is_promoted=?, is_relegated=?, is_playoff_qualified=?, is_direct_knockout=?, is_eliminated=?, final_position=?
      WHERE id=?`;
    const values = [
      this.season_id, this.competition_id, this.competition_name, this.competition_tier, this.competition_slug,
      this.season_number, this.club_id, this.club_name, this.club_logo_url, this.club_tag, this.platform, this.region,
      this.position, this.played, this.wins, this.draws, this.losses, this.goals_for, this.goals_against, this.goal_difference, this.points,
      this.form, this.is_promoted, this.is_relegated, this.is_playoff_qualified, this.is_direct_knockout, this.is_eliminated, this.final_position,
      id,
    ];
    return EXECUTESQL(sql, values);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM competition_standings WHERE id = ?', [id]);
  }
}

module.exports = CompetitionStandingModel;

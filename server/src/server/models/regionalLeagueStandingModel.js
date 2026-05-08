const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class RegionalLeagueStandingModel {
  constructor(body = {}) {
    this.id                          = body.id;
    this.league_id                   = body.league_id;
    this.league_name                 = body.league_name;
    this.region_slug                 = body.region_slug;
    this.division                    = body.division ?? 1;
    this.season_number               = body.season_number ?? 1;
    this.club_id                     = body.club_id;
    this.club_name                   = body.club_name;
    this.club_logo_url               = body.club_logo_url;
    this.club_tag                    = body.club_tag;
    this.platform                    = body.platform;
    this.region                      = body.region;
    this.position                    = body.position ?? 1;
    this.played                      = body.played ?? 0;
    this.wins                        = body.wins ?? 0;
    this.draws                       = body.draws ?? 0;
    this.losses                      = body.losses ?? 0;
    this.goals_for                   = body.goals_for ?? 0;
    this.goals_against               = body.goals_against ?? 0;
    this.goal_difference             = body.goal_difference ?? 0;
    this.points                      = body.points ?? 0;
    this.form                        = body.form
      ? (typeof body.form === 'string' ? body.form : JSON.stringify(body.form))
      : null;
    this.is_stage_qualified          = body.is_stage_qualified ?? false;
    this.stage_competition_slug      = body.stage_competition_slug;
    this.is_promoted                 = body.is_promoted ?? false;
    this.is_relegated                = body.is_relegated ?? false;
    this.final_position              = body.final_position ?? null;
    this.promotion_target_league_id  = body.promotion_target_league_id;
    this.relegation_target_league_id = body.relegation_target_league_id;
  }

  selectAll(page = 1) {
    const pageSize = 25;
    const offset   = (page - 1) * pageSize;
    return EXECUTESQL('SELECT * FROM regional_league_standings ORDER BY league_id, position ASC LIMIT ? OFFSET ?', [pageSize, offset]);
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM regional_league_standings WHERE id = ?', [id]);
  }

  selectByLeague(league_id) {
    return EXECUTESQL('SELECT * FROM regional_league_standings WHERE league_id = ? ORDER BY position ASC', [league_id]);
  }

  selectByClub(club_id) {
    return EXECUTESQL('SELECT * FROM regional_league_standings WHERE club_id = ? ORDER BY created_date DESC', [club_id]);
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO regional_league_standings
      (id, league_id, league_name, region_slug, division, season_number,
       club_id, club_name, club_logo_url, club_tag, platform, region,
       position, played, wins, draws, losses,
       goals_for, goals_against, goal_difference, points,
       form, is_stage_qualified, stage_competition_slug,
       is_promoted, is_relegated, final_position,
       promotion_target_league_id, relegation_target_league_id)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
    const values = [
      this.id, this.league_id, this.league_name, this.region_slug, this.division, this.season_number,
      this.club_id, this.club_name, this.club_logo_url, this.club_tag, this.platform, this.region,
      this.position, this.played, this.wins, this.draws, this.losses,
      this.goals_for, this.goals_against, this.goal_difference, this.points,
      this.form, this.is_stage_qualified, this.stage_competition_slug,
      this.is_promoted, this.is_relegated, this.final_position,
      this.promotion_target_league_id, this.relegation_target_league_id,
    ];
    return EXECUTESQL(sql, values);
  }

  update(id) {
    const sql = `UPDATE regional_league_standings SET
      league_id=?, league_name=?, region_slug=?, division=?, season_number=?,
      club_id=?, club_name=?, club_logo_url=?, club_tag=?, platform=?, region=?,
      position=?, played=?, wins=?, draws=?, losses=?,
      goals_for=?, goals_against=?, goal_difference=?, points=?,
      form=?, is_stage_qualified=?, stage_competition_slug=?,
      is_promoted=?, is_relegated=?, final_position=?,
      promotion_target_league_id=?, relegation_target_league_id=?
      WHERE id=?`;
    const values = [
      this.league_id, this.league_name, this.region_slug, this.division, this.season_number,
      this.club_id, this.club_name, this.club_logo_url, this.club_tag, this.platform, this.region,
      this.position, this.played, this.wins, this.draws, this.losses,
      this.goals_for, this.goals_against, this.goal_difference, this.points,
      this.form, this.is_stage_qualified, this.stage_competition_slug,
      this.is_promoted, this.is_relegated, this.final_position,
      this.promotion_target_league_id, this.relegation_target_league_id,
      id,
    ];
    return EXECUTESQL(sql, values);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM regional_league_standings WHERE id = ?', [id]);
  }
}

module.exports = RegionalLeagueStandingModel;

const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class Tournament {
  constructor(body = {}) {
    this.id                      = body.id;
    this.name                    = body.name;
    this.description             = body.description;
    this.type                    = body.type;
    this.participant_type        = body.participant_type;
    this.platform                = body.platform;
    this.region                  = body.region;
    this.max_teams               = body.max_teams;
    this.entry_credits           = body.entry_credits;
    this.entry_fee_stc           = body.entry_fee_stc;
    this.prize_description       = body.prize_description;
    this.prize_pool_stc          = body.prize_pool_stc;
    this.prize_winner_stc        = body.prize_winner_stc;
    this.prize_runner_up_stc     = body.prize_runner_up_stc;
    this.prize_semi_final_stc    = body.prize_semi_final_stc;
    this.prize_participation_stc = body.prize_participation_stc;
    this.custom_rules            = body.custom_rules;
    this.rules_file_url          = body.rules_file_url;
    this.country_code            = body.country_code;
    this.start_date              = body.start_date;
    this.end_date                = body.end_date;
    this.organizer_email         = body.organizer_email;
    this.creator_email           = body.creator_email;
    this.creator_id              = body.creator_id;
    this.creator_gamertag        = body.creator_gamertag;
    this.win_credits             = body.win_credits;
    this.win_credits_awarded     = body.win_credits_awarded;
    this.status                  = body.status;
    this.current_round           = body.current_round;
    this.total_rounds            = body.total_rounds;
    this.num_groups              = body.num_groups;
    this.swiss_rounds            = body.swiss_rounds;
    this.season                  = body.season;
    this.ucl_phase               = body.ucl_phase;
    this.winner_club_id          = body.winner_club_id;
    this.winner_club_name        = body.winner_club_name;
    this.banner_url              = body.banner_url;
    this.banner_color            = body.banner_color;
    this.banner_position         = body.banner_position;
    this.trophy_url              = body.trophy_url;
    this.trophy_item_id          = body.trophy_item_id;
    this.registered_players      = body.registered_players
      ? (typeof body.registered_players === 'string'
          ? body.registered_players
          : JSON.stringify(body.registered_players))
      : null;
    this.registered_clubs        = body.registered_clubs
      ? (typeof body.registered_clubs === 'string'
          ? body.registered_clubs
          : JSON.stringify(body.registered_clubs))
      : null;
  }

  selectAll(page = 1) {
    const pageSize = 25;
    const offset   = (page - 1) * pageSize;
    return EXECUTESQL('SELECT * FROM tournaments LIMIT ? OFFSET ?', [pageSize, offset]);
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM tournaments WHERE id = ?', [id]);
  }

  selectByStatus(status) {
    return EXECUTESQL('SELECT * FROM tournaments WHERE status = ?', [status]);
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO tournaments
      (id, name, description, type, participant_type, platform, region, max_teams,
       entry_credits, entry_fee_stc, prize_description, prize_pool_stc,
       prize_winner_stc, prize_runner_up_stc, prize_semi_final_stc, prize_participation_stc,
       custom_rules, rules_file_url, country_code,
       start_date, end_date, organizer_email,
       creator_email, creator_id, creator_gamertag,
       win_credits, win_credits_awarded,
       status, current_round, total_rounds, num_groups, swiss_rounds, season, ucl_phase,
       winner_club_id, winner_club_name,
       banner_url, banner_color, banner_position,
       trophy_url, trophy_item_id,
       registered_players, registered_clubs)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
    const values = [
      this.id, this.name, this.description, this.type, this.participant_type,
      this.platform, this.region, this.max_teams,
      this.entry_credits, this.entry_fee_stc, this.prize_description, this.prize_pool_stc,
      this.prize_winner_stc, this.prize_runner_up_stc, this.prize_semi_final_stc, this.prize_participation_stc,
      this.custom_rules, this.rules_file_url, this.country_code,
      this.start_date, this.end_date, this.organizer_email,
      this.creator_email, this.creator_id, this.creator_gamertag,
      this.win_credits, this.win_credits_awarded,
      this.status, this.current_round, this.total_rounds, this.num_groups, this.swiss_rounds, this.season, this.ucl_phase,
      this.winner_club_id, this.winner_club_name,
      this.banner_url, this.banner_color, this.banner_position,
      this.trophy_url, this.trophy_item_id,
      this.registered_players, this.registered_clubs,
    ];
    return EXECUTESQL(sql, values);
  }

  update(id) {
    const sql = `UPDATE tournaments SET
      name=?, description=?, type=?, participant_type=?, platform=?, region=?, max_teams=?,
      entry_credits=?, entry_fee_stc=?, prize_description=?, prize_pool_stc=?,
      prize_winner_stc=?, prize_runner_up_stc=?, prize_semi_final_stc=?, prize_participation_stc=?,
      custom_rules=?, rules_file_url=?, country_code=?,
      start_date=?, end_date=?, organizer_email=?,
      creator_email=?, creator_id=?, creator_gamertag=?,
      win_credits=?, win_credits_awarded=?,
      status=?, current_round=?, total_rounds=?, num_groups=?, swiss_rounds=?, season=?, ucl_phase=?,
      winner_club_id=?, winner_club_name=?,
      banner_url=?, banner_color=?, banner_position=?,
      trophy_url=?, trophy_item_id=?,
      registered_players=?, registered_clubs=?
      WHERE id=?`;
    const values = [
      this.name, this.description, this.type, this.participant_type,
      this.platform, this.region, this.max_teams,
      this.entry_credits, this.entry_fee_stc, this.prize_description, this.prize_pool_stc,
      this.prize_winner_stc, this.prize_runner_up_stc, this.prize_semi_final_stc, this.prize_participation_stc,
      this.custom_rules, this.rules_file_url, this.country_code,
      this.start_date, this.end_date, this.organizer_email,
      this.creator_email, this.creator_id, this.creator_gamertag,
      this.win_credits, this.win_credits_awarded,
      this.status, this.current_round, this.total_rounds, this.num_groups, this.swiss_rounds, this.season, this.ucl_phase,
      this.winner_club_id, this.winner_club_name,
      this.banner_url, this.banner_color, this.banner_position,
      this.trophy_url, this.trophy_item_id,
      this.registered_players, this.registered_clubs,
      id,
    ];
    return EXECUTESQL(sql, values);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM tournaments WHERE id = ?', [id]);
  }
}

module.exports = Tournament;

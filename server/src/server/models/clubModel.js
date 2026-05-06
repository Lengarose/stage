const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class Club {
  constructor(body = {}) {
    this.id                  = body.id;
    this.user_id             = body.user_id;
    this.owner_email         = body.owner_email;
    this.name                = body.name;
    this.tag                 = body.tag;
    this.platform            = body.platform;
    this.region              = body.region;
    this.country_code        = body.country_code;
    this.logo_url            = body.logo_url;
    this.logo_position       = body.logo_position;
    this.description         = body.description;
    this.wins                = body.wins;
    this.losses              = body.losses;
    this.draws               = body.draws;
    this.goals_scored        = body.goals_scored;
    this.goals_conceded      = body.goals_conceded;
    this.rating              = body.rating;
    this.peak_rating         = body.peak_rating;
    this.matches_ranked      = body.matches_ranked;
    this.is_provisional      = body.is_provisional;
    this.credits             = body.credits;
    this.stc                 = body.stc;
    this.wage_budget_stc     = body.wage_budget_stc;
    this.transfer_budget_stc = body.transfer_budget_stc;
    this.stadium_level       = body.stadium_level;
    this.stadium_capacity    = body.stadium_capacity;
    this.tier                = body.tier;
    this.form                = body.form;
    this.win_streak          = body.win_streak;
    this.loss_streak         = body.loss_streak;
    this.status              = body.status;
    this.formation           = body.formation;
    this.lineup              = body.lineup
      ? (typeof body.lineup === 'string' ? body.lineup : JSON.stringify(body.lineup))
      : null;
    this.trophies            = body.trophies
      ? (typeof body.trophies === 'string' ? body.trophies : JSON.stringify(body.trophies))
      : null;
  }

  selectAll(page = 1) {
    const pageSize = 25;
    const offset   = (page - 1) * pageSize;
    return EXECUTESQL('SELECT * FROM clubs LIMIT ? OFFSET ?', [pageSize, offset]);
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM clubs WHERE id = ?', [id]);
  }

  selectByOwner(email) {
    return EXECUTESQL('SELECT * FROM clubs WHERE owner_email = ?', [email]);
  }

  selectByUserId(user_id) {
    return EXECUTESQL('SELECT * FROM clubs WHERE user_id = ?', [user_id]);
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO clubs
      (id, user_id, owner_email, name, tag, platform, region, country_code, logo_url,
       logo_position, description, wins, losses, draws, goals_scored,
       goals_conceded, rating, peak_rating, matches_ranked, is_provisional,
       credits, stc, wage_budget_stc, transfer_budget_stc, stadium_level,
       stadium_capacity, tier, form, win_streak, loss_streak, status,
       formation, lineup, trophies)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
    const values = [
      this.id, this.user_id, this.owner_email, this.name, this.tag, this.platform,
      this.region, this.country_code, this.logo_url, this.logo_position,
      this.description, this.wins, this.losses, this.draws, this.goals_scored,
      this.goals_conceded, this.rating, this.peak_rating, this.matches_ranked,
      this.is_provisional, this.credits, this.stc, this.wage_budget_stc,
      this.transfer_budget_stc, this.stadium_level, this.stadium_capacity,
      this.tier, this.form, this.win_streak, this.loss_streak, this.status,
      this.formation, this.lineup, this.trophies,
    ];
    return EXECUTESQL(sql, values);
  }

  update(id) {
    const sql = `UPDATE clubs SET
      user_id=?, owner_email=?, name=?, tag=?, platform=?, region=?, country_code=?,
      logo_url=?, logo_position=?, description=?, wins=?, losses=?, draws=?,
      goals_scored=?, goals_conceded=?, rating=?, peak_rating=?,
      matches_ranked=?, is_provisional=?, credits=?, stc=?, wage_budget_stc=?,
      transfer_budget_stc=?, stadium_level=?, stadium_capacity=?, tier=?,
      form=?, win_streak=?, loss_streak=?, status=?, formation=?,
      lineup=?, trophies=?
      WHERE id=?`;
    const values = [
      this.user_id, this.owner_email, this.name, this.tag, this.platform, this.region,
      this.country_code, this.logo_url, this.logo_position, this.description,
      this.wins, this.losses, this.draws, this.goals_scored, this.goals_conceded,
      this.rating, this.peak_rating, this.matches_ranked, this.is_provisional,
      this.credits, this.stc, this.wage_budget_stc, this.transfer_budget_stc,
      this.stadium_level, this.stadium_capacity, this.tier, this.form,
      this.win_streak, this.loss_streak, this.status, this.formation,
      this.lineup, this.trophies,
      id,
    ];
    return EXECUTESQL(sql, values);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM clubs WHERE id = ?', [id]);
  }
}

module.exports = Club;

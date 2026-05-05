const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class PlayerContract {
  constructor(body = {}) {
    this.id                  = body.id;
    this.team_id             = body.team_id;
    this.user_id             = body.user_id;
    this.contract_type       = body.contract_type;
    this.status              = body.status;
    this.offered_by          = body.offered_by;
    this.max_games           = body.max_games;
    this.max_days            = body.max_days;
    this.weekly_salary_stc   = body.weekly_salary_stc;
    this.signing_bonus_stc   = body.signing_bonus_stc;
    this.transfer_fee_stc    = body.transfer_fee_stc;
    this.offer_note          = body.offer_note;
    this.captaincy_offered   = body.captaincy_offered;
    this.last_negotiated_by  = body.last_negotiated_by;
    this.negotiation_round   = body.negotiation_round;
    this.start_date          = body.start_date;
    this.end_date            = body.end_date;
    this.performance_targets = body.performance_targets
      ? (typeof body.performance_targets === 'string'
          ? body.performance_targets
          : JSON.stringify(body.performance_targets))
      : null;
  }

  selectAll(page = 1) {
    const pageSize = 25;
    const offset   = (page - 1) * pageSize;
    return EXECUTESQL('SELECT * FROM player_contracts LIMIT ? OFFSET ?', [pageSize, offset]);
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM player_contracts WHERE id = ?', [id]);
  }

  selectByTeam(team_id) {
    return EXECUTESQL('SELECT * FROM player_contracts WHERE team_id = ?', [team_id]);
  }

  selectByUser(user_id) {
    return EXECUTESQL('SELECT * FROM player_contracts WHERE user_id = ?', [user_id]);
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO player_contracts
      (id, team_id, user_id, contract_type, status, offered_by, max_games,
       max_days, weekly_salary_stc, signing_bonus_stc, transfer_fee_stc,
       offer_note, captaincy_offered, last_negotiated_by, negotiation_round,
       start_date, end_date, performance_targets)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
    const values = [
      this.id, this.team_id, this.user_id, this.contract_type, this.status,
      this.offered_by, this.max_games, this.max_days, this.weekly_salary_stc,
      this.signing_bonus_stc, this.transfer_fee_stc, this.offer_note,
      this.captaincy_offered, this.last_negotiated_by, this.negotiation_round,
      this.start_date, this.end_date, this.performance_targets,
    ];
    return EXECUTESQL(sql, values);
  }

  update(id) {
    const sql = `UPDATE player_contracts SET
      team_id=?, user_id=?, contract_type=?, status=?, offered_by=?,
      max_games=?, max_days=?, weekly_salary_stc=?, signing_bonus_stc=?,
      transfer_fee_stc=?, offer_note=?, captaincy_offered=?,
      last_negotiated_by=?, negotiation_round=?, start_date=?, end_date=?,
      performance_targets=?
      WHERE id=?`;
    const values = [
      this.team_id, this.user_id, this.contract_type, this.status,
      this.offered_by, this.max_games, this.max_days, this.weekly_salary_stc,
      this.signing_bonus_stc, this.transfer_fee_stc, this.offer_note,
      this.captaincy_offered, this.last_negotiated_by, this.negotiation_round,
      this.start_date, this.end_date, this.performance_targets,
      id,
    ];
    return EXECUTESQL(sql, values);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM player_contracts WHERE id = ?', [id]);
  }
}

module.exports = PlayerContract;

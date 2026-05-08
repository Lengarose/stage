const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class RankingConfigModel {
  constructor(body = {}) {
    this.id                   = body.id;
    this.label                = body.label || 'Default';
    this.is_active            = body.is_active ?? true;
    this.win_points           = body.win_points ?? 100;
    this.draw_points          = body.draw_points ?? 40;
    this.loss_points          = body.loss_points ?? 10;
    this.opp_top10            = body.opp_top10 ?? 2.0;
    this.opp_top25            = body.opp_top25 ?? 1.5;
    this.opp_top50            = body.opp_top50 ?? 1.2;
    this.opp_bot50            = body.opp_bot50 ?? 1.0;
    this.opp_bot25            = body.opp_bot25 ?? 0.8;
    this.comp_regional_div2   = body.comp_regional_div2 ?? 0.8;
    this.comp_regional_div1   = body.comp_regional_div1 ?? 1.0;
    this.comp_challenger      = body.comp_challenger ?? 1.2;
    this.comp_elite           = body.comp_elite ?? 1.5;
    this.comp_supreme         = body.comp_supreme ?? 2.0;
    this.comp_tournament      = body.comp_tournament ?? 1.0;
    this.stage_group          = body.stage_group ?? 1.0;
    this.stage_playoff        = body.stage_playoff ?? 1.1;
    this.stage_r16            = body.stage_r16 ?? 1.2;
    this.stage_qf             = body.stage_qf ?? 1.4;
    this.stage_sf             = body.stage_sf ?? 1.6;
    this.stage_final          = body.stage_final ?? 2.0;
  }

  selectAll(page = 1) {
    const pageSize = 25;
    const offset   = (page - 1) * pageSize;
    return EXECUTESQL('SELECT * FROM ranking_configs ORDER BY created_date DESC LIMIT ? OFFSET ?', [pageSize, offset]);
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM ranking_configs WHERE id = ?', [id]);
  }

  selectActive() {
    return EXECUTESQL('SELECT * FROM ranking_configs WHERE is_active = 1 LIMIT 1', []);
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO ranking_configs
      (id, label, is_active,
       win_points, draw_points, loss_points,
       opp_top10, opp_top25, opp_top50, opp_bot50, opp_bot25,
       comp_regional_div2, comp_regional_div1, comp_challenger, comp_elite, comp_supreme, comp_tournament,
       stage_group, stage_playoff, stage_r16, stage_qf, stage_sf, stage_final)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
    const values = [
      this.id, this.label, this.is_active,
      this.win_points, this.draw_points, this.loss_points,
      this.opp_top10, this.opp_top25, this.opp_top50, this.opp_bot50, this.opp_bot25,
      this.comp_regional_div2, this.comp_regional_div1, this.comp_challenger, this.comp_elite, this.comp_supreme, this.comp_tournament,
      this.stage_group, this.stage_playoff, this.stage_r16, this.stage_qf, this.stage_sf, this.stage_final,
    ];
    return EXECUTESQL(sql, values);
  }

  update(id) {
    const sql = `UPDATE ranking_configs SET
      label=?, is_active=?,
      win_points=?, draw_points=?, loss_points=?,
      opp_top10=?, opp_top25=?, opp_top50=?, opp_bot50=?, opp_bot25=?,
      comp_regional_div2=?, comp_regional_div1=?, comp_challenger=?, comp_elite=?, comp_supreme=?, comp_tournament=?,
      stage_group=?, stage_playoff=?, stage_r16=?, stage_qf=?, stage_sf=?, stage_final=?
      WHERE id=?`;
    const values = [
      this.label, this.is_active,
      this.win_points, this.draw_points, this.loss_points,
      this.opp_top10, this.opp_top25, this.opp_top50, this.opp_bot50, this.opp_bot25,
      this.comp_regional_div2, this.comp_regional_div1, this.comp_challenger, this.comp_elite, this.comp_supreme, this.comp_tournament,
      this.stage_group, this.stage_playoff, this.stage_r16, this.stage_qf, this.stage_sf, this.stage_final,
      id,
    ];
    return EXECUTESQL(sql, values);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM ranking_configs WHERE id = ?', [id]);
  }
}

module.exports = RankingConfigModel;

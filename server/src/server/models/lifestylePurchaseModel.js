const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class LifestylePurchase {
  constructor(body = {}) {
    this.id                    = body.id;
    this.player_id             = body.player_id;
    this.player_email          = body.player_email;
    this.item_id               = body.item_id;
    this.item_type             = body.item_type;
    this.item_tier             = body.item_tier;
    this.rent_active           = body.rent_active;
    this.is_residence          = body.is_residence;
    this.purchase_type         = body.purchase_type;
    this.price_paid_stc        = body.price_paid_stc;
    this.rent_end_date         = body.rent_end_date;
    this.invest_end_date       = body.invest_end_date;
    this.invest_return_amount  = body.invest_return_amount;
    this.status                = body.status;
    this.current_value_stc     = body.current_value_stc;
    this.upgrade_level         = body.upgrade_level;
    this.last_passive_collected = body.last_passive_collected;
    this.base_upgrade_cost_stc = body.base_upgrade_cost_stc;
  }

  selectAll(page = 1) {
    const pageSize = 50;
    const offset   = (page - 1) * pageSize;
    return EXECUTESQL(
      "SELECT * FROM lifestyle_purchases WHERE status != 'sold' ORDER BY created_date DESC LIMIT ? OFFSET ?",
      [pageSize, offset]
    );
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM lifestyle_purchases WHERE id = ?', [id]);
  }

  selectByPlayer(player_id) {
    return EXECUTESQL(
      "SELECT * FROM lifestyle_purchases WHERE player_id = ? AND status != 'sold' ORDER BY created_date DESC",
      [player_id]
    );
  }

  selectByPlayerAndType(player_id, purchase_type) {
    return EXECUTESQL(
      "SELECT * FROM lifestyle_purchases WHERE player_id = ? AND purchase_type = ? AND status = 'active' ORDER BY created_date DESC",
      [player_id, purchase_type]
    );
  }

  selectByItemType(item_type) {
    return EXECUTESQL(
      "SELECT * FROM lifestyle_purchases WHERE item_type = ? AND status != 'sold'",
      [item_type]
    );
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO lifestyle_purchases
      (id, player_id, player_email, item_id, item_type, item_tier, rent_active, is_residence,
       purchase_type, price_paid_stc, rent_end_date, invest_end_date, invest_return_amount,
       status, current_value_stc, upgrade_level, base_upgrade_cost_stc, created_date)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW())`;
    return EXECUTESQL(sql, [
      this.id, this.player_id, this.player_email || null,
      this.item_id, this.item_type || null, this.item_tier || null,
      this.rent_active   != null ? (this.rent_active   ? 1 : 0) : 0,
      this.is_residence  != null ? (this.is_residence  ? 1 : 0) : 0,
      this.purchase_type         || 'buy',
      Number(this.price_paid_stc       || 0),
      this.rent_end_date             || null,
      this.invest_end_date           || null,
      Number(this.invest_return_amount || 0),
      this.status                    || 'active',
      Number(this.current_value_stc   || 0),
      Number(this.upgrade_level       || 0),
      Number(this.base_upgrade_cost_stc || 0),
    ]);
  }

  update(id) {
    const sql = `UPDATE lifestyle_purchases SET
      player_id=?, player_email=?, item_id=?, item_type=?, item_tier=?,
      rent_active=?, is_residence=?, purchase_type=?, price_paid_stc=?,
      rent_end_date=?, invest_end_date=?, invest_return_amount=?,
      status=?, current_value_stc=?, upgrade_level=?, last_passive_collected=?,
      base_upgrade_cost_stc=?
      WHERE id=?`;
    return EXECUTESQL(sql, [
      this.player_id, this.player_email || null,
      this.item_id, this.item_type || null, this.item_tier || null,
      this.rent_active   != null ? (this.rent_active   ? 1 : 0) : 0,
      this.is_residence  != null ? (this.is_residence  ? 1 : 0) : 0,
      this.purchase_type         || 'buy',
      Number(this.price_paid_stc       || 0),
      this.rent_end_date             || null,
      this.invest_end_date           || null,
      Number(this.invest_return_amount || 0),
      this.status                    || 'active',
      Number(this.current_value_stc   || 0),
      Number(this.upgrade_level       || 0),
      this.last_passive_collected    || null,
      Number(this.base_upgrade_cost_stc || 0),
      id,
    ]);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM lifestyle_purchases WHERE id = ?', [id]);
  }
}

module.exports = LifestylePurchase;

const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class LifestylePurchase {
  constructor(body = {}) {
    this.id           = body.id;
    this.player_id    = body.player_id;
    this.item_id      = body.item_id;
    this.item_type    = body.item_type;
    this.item_tier    = body.item_tier;
    this.rent_active  = body.rent_active;
    this.is_residence = body.is_residence;
  }

  selectAll(page = 1) {
    const pageSize = 25;
    const offset   = (page - 1) * pageSize;
    return EXECUTESQL('SELECT * FROM lifestyle_purchases LIMIT ? OFFSET ?', [pageSize, offset]);
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM lifestyle_purchases WHERE id = ?', [id]);
  }

  selectByPlayer(player_id) {
    return EXECUTESQL('SELECT * FROM lifestyle_purchases WHERE player_id = ?', [player_id]);
  }

  selectByItemType(item_type) {
    return EXECUTESQL('SELECT * FROM lifestyle_purchases WHERE item_type = ?', [item_type]);
  }

  selectByPlayerAndType(player_id, item_type) {
    return EXECUTESQL('SELECT * FROM lifestyle_purchases WHERE player_id = ? AND item_type = ?', [player_id, item_type]);
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO lifestyle_purchases
      (id, player_id, item_id, item_type, item_tier, rent_active, is_residence)
      VALUES (?,?,?,?,?,?,?)`;
    const values = [
      this.id, this.player_id, this.item_id, this.item_type,
      this.item_tier, this.rent_active, this.is_residence,
    ];
    return EXECUTESQL(sql, values);
  }

  update(id) {
    const sql = `UPDATE lifestyle_purchases SET
      player_id=?, item_id=?, item_type=?, item_tier=?,
      rent_active=?, is_residence=?
      WHERE id=?`;
    const values = [
      this.player_id, this.item_id, this.item_type, this.item_tier,
      this.rent_active, this.is_residence,
      id,
    ];
    return EXECUTESQL(sql, values);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM lifestyle_purchases WHERE id = ?', [id]);
  }
}

module.exports = LifestylePurchase;

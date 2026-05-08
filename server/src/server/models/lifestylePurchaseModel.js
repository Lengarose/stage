const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

function toMysqlDateTime(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 19).replace('T', ' ');
  }
  const asString = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(asString)) return asString;
  const parsed = new Date(asString);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 19).replace('T', ' ');
  }
  return null;
}

class LifestylePurchase {
  constructor(body = {}) {
    this.id                       = body.id;
    this.player_id                = body.player_id;
    this.player_email             = body.player_email;
    this.player_gamertag          = body.player_gamertag;
    this.item_id                  = body.item_id;
    this.item_name                = body.item_name;
    this.item_category            = body.item_category;
    this.item_subcategory         = body.item_subcategory;
    this.item_emoji               = body.item_emoji;
    this.item_tier                = body.item_tier;
    this.item_type                = body.item_type;
    this.price_paid_stc           = body.price_paid_stc;
    this.purchase_type            = body.purchase_type;
    this.is_residence             = body.is_residence;
    this.monthly_rent_stc         = body.monthly_rent_stc;
    this.last_rent_paid_at        = toMysqlDateTime(body.last_rent_paid_at);
    this.rent_active              = body.rent_active;
    this.last_passive_collected_at = toMysqlDateTime(body.last_passive_collected_at);
    this.upgrade_level            = body.upgrade_level;
    this.current_value_stc        = body.current_value_stc;
    this.location_city            = body.location_city;
    this.location_country         = body.location_country;
    this.location_emoji           = body.location_emoji;
    this.custom_name              = body.custom_name;
    this.weekly_maintenance_stc   = body.weekly_maintenance_stc;
    this.last_maintenance_paid_at = toMysqlDateTime(body.last_maintenance_paid_at);
    this.is_defaulted             = body.is_defaulted;
    this.upgrade_slots            = body.upgrade_slots
      ? (typeof body.upgrade_slots === 'string' ? body.upgrade_slots : JSON.stringify(body.upgrade_slots))
      : null;
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
      (id, player_id, player_email, player_gamertag,
       item_id, item_name, item_category, item_subcategory, item_emoji, item_tier, item_type,
       price_paid_stc, purchase_type, is_residence,
       monthly_rent_stc, last_rent_paid_at, rent_active,
       last_passive_collected_at, upgrade_level, current_value_stc,
       location_city, location_country, location_emoji, custom_name,
       weekly_maintenance_stc, last_maintenance_paid_at, is_defaulted, upgrade_slots)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
    const values = [
      this.id, this.player_id, this.player_email, this.player_gamertag,
      this.item_id, this.item_name, this.item_category, this.item_subcategory, this.item_emoji, this.item_tier, this.item_type,
      this.price_paid_stc, this.purchase_type, this.is_residence,
      this.monthly_rent_stc, this.last_rent_paid_at, this.rent_active,
      this.last_passive_collected_at, this.upgrade_level, this.current_value_stc,
      this.location_city, this.location_country, this.location_emoji, this.custom_name,
      this.weekly_maintenance_stc, this.last_maintenance_paid_at, this.is_defaulted, this.upgrade_slots,
    ];
    return EXECUTESQL(sql, values);
  }

  update(id) {
    const sql = `UPDATE lifestyle_purchases SET
      player_id=?, player_email=?, player_gamertag=?,
      item_id=?, item_name=?, item_category=?, item_subcategory=?, item_emoji=?, item_tier=?, item_type=?,
      price_paid_stc=?, purchase_type=?, is_residence=?,
      monthly_rent_stc=?, last_rent_paid_at=?, rent_active=?,
      last_passive_collected_at=?, upgrade_level=?, current_value_stc=?,
      location_city=?, location_country=?, location_emoji=?, custom_name=?,
      weekly_maintenance_stc=?, last_maintenance_paid_at=?, is_defaulted=?, upgrade_slots=?
      WHERE id=?`;
    const values = [
      this.player_id, this.player_email, this.player_gamertag,
      this.item_id, this.item_name, this.item_category, this.item_subcategory, this.item_emoji, this.item_tier, this.item_type,
      this.price_paid_stc, this.purchase_type, this.is_residence,
      this.monthly_rent_stc, this.last_rent_paid_at, this.rent_active,
      this.last_passive_collected_at, this.upgrade_level, this.current_value_stc,
      this.location_city, this.location_country, this.location_emoji, this.custom_name,
      this.weekly_maintenance_stc, this.last_maintenance_paid_at, this.is_defaulted, this.upgrade_slots,
      id,
    ];
    return EXECUTESQL(sql, values);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM lifestyle_purchases WHERE id = ?', [id]);
  }
}

module.exports = LifestylePurchase;

const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class LifestyleItem {
  constructor(body = {}) {
    this.id                          = body.id;
    this.name                        = body.name;
    this.category                    = body.category;
    this.subcategory                 = body.subcategory;
    this.description                 = body.description;
    this.price_stc                   = body.price_stc;
    this.rent_price_stc              = body.rent_price_stc;
    this.can_rent                    = body.can_rent;
    this.passive_income_stc          = body.passive_income_stc;
    this.passive_income_interval_days = body.passive_income_interval_days;
    this.image_url                   = body.image_url;
    this.emoji                       = body.emoji;
    this.tier                        = body.tier;
    this.is_active                   = body.is_active;
    this.sort_order                  = body.sort_order;
    this.max_upgrade_level           = body.max_upgrade_level;
    this.upgrade_base_cost_stc       = body.upgrade_base_cost_stc;
    this.weekly_maintenance_stc      = body.weekly_maintenance_stc;
    this.allows_multiple             = body.allows_multiple;
    this.available_cities            = body.available_cities
      ? (typeof body.available_cities === 'string' ? body.available_cities : JSON.stringify(body.available_cities))
      : null;
  }

  selectAll(page = 1) {
    const pageSize = 25;
    const offset   = (page - 1) * pageSize;
    return EXECUTESQL('SELECT * FROM lifestyle_items ORDER BY sort_order ASC LIMIT ? OFFSET ?', [pageSize, offset]);
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM lifestyle_items WHERE id = ?', [id]);
  }

  selectByActive(isActive) {
    return EXECUTESQL(
      'SELECT * FROM lifestyle_items WHERE is_active = ? ORDER BY sort_order ASC',
      [isActive ? 1 : 0]
    );
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO lifestyle_items
      (id, name, category, subcategory, description,
       price_stc, rent_price_stc, can_rent,
       passive_income_stc, passive_income_interval_days,
       image_url, emoji, tier, is_active, sort_order,
       max_upgrade_level, upgrade_base_cost_stc, weekly_maintenance_stc,
       allows_multiple, available_cities)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
    const values = [
      this.id, this.name, this.category, this.subcategory, this.description,
      this.price_stc, this.rent_price_stc, this.can_rent,
      this.passive_income_stc, this.passive_income_interval_days,
      this.image_url, this.emoji, this.tier, this.is_active, this.sort_order,
      this.max_upgrade_level, this.upgrade_base_cost_stc, this.weekly_maintenance_stc,
      this.allows_multiple, this.available_cities,
    ];
    return EXECUTESQL(sql, values);
  }

  update(id) {
    const sql = `UPDATE lifestyle_items SET
      name=?, category=?, subcategory=?, description=?,
      price_stc=?, rent_price_stc=?, can_rent=?,
      passive_income_stc=?, passive_income_interval_days=?,
      image_url=?, emoji=?, tier=?, is_active=?, sort_order=?,
      max_upgrade_level=?, upgrade_base_cost_stc=?, weekly_maintenance_stc=?,
      allows_multiple=?, available_cities=?
      WHERE id=?`;
    const values = [
      this.name, this.category, this.subcategory, this.description,
      this.price_stc, this.rent_price_stc, this.can_rent,
      this.passive_income_stc, this.passive_income_interval_days,
      this.image_url, this.emoji, this.tier, this.is_active, this.sort_order,
      this.max_upgrade_level, this.upgrade_base_cost_stc, this.weekly_maintenance_stc,
      this.allows_multiple, this.available_cities,
      id,
    ];
    return EXECUTESQL(sql, values);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM lifestyle_items WHERE id = ?', [id]);
  }
}

module.exports = LifestyleItem;

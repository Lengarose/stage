const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class LifestyleItem {
  constructor(body = {}) {
    this.id                           = body.id;
    this.name                         = body.name;
    this.is_active                    = body.is_active;
    this.sort_order                   = body.sort_order;
    this.category                     = body.category;
    this.subcategory                  = body.subcategory;
    this.description                  = body.description;
    this.image_url                    = body.image_url;
    this.tier                         = body.tier;
    this.price_stc                    = body.price_stc;
    this.rent_price_stc               = body.rent_price_stc;
    this.rent_duration_days           = body.rent_duration_days;
    this.invest_price_stc             = body.invest_price_stc;
    this.invest_return_rate           = body.invest_return_rate;
    this.invest_duration_days         = body.invest_duration_days;
    this.passive_income_stc           = body.passive_income_stc;
    this.passive_income_interval_days = body.passive_income_interval_days;
    this.weekly_maintenance_stc       = body.weekly_maintenance_stc;
    this.can_buy                      = body.can_buy;
    this.can_rent                     = body.can_rent;
    this.can_invest                   = body.can_invest;
    this.can_sell                     = body.can_sell;
    this.sell_value_percent           = body.sell_value_percent;
    this.allows_multiple              = body.allows_multiple;
  }

  selectAll(page = 1) {
    const pageSize = 100;
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

  selectByCategory(category) {
    return EXECUTESQL(
      'SELECT * FROM lifestyle_items WHERE category = ? AND is_active = 1 ORDER BY sort_order ASC',
      [category]
    );
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO lifestyle_items
      (id, name, is_active, sort_order, category, subcategory, description, image_url, tier,
       price_stc, rent_price_stc, rent_duration_days, invest_price_stc, invest_return_rate,
       invest_duration_days, passive_income_stc, passive_income_interval_days,
       weekly_maintenance_stc, can_buy, can_rent, can_invest, can_sell,
       sell_value_percent, allows_multiple)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
    return EXECUTESQL(sql, [
      this.id, this.name,
      this.is_active  != null ? this.is_active  : 1,
      this.sort_order != null ? this.sort_order : 0,
      this.category              || null,
      this.subcategory           || null,
      this.description           || null,
      this.image_url             || null,
      this.tier                  || 'standard',
      Number(this.price_stc                    || 0),
      Number(this.rent_price_stc               || 0),
      Number(this.rent_duration_days           || 30),
      Number(this.invest_price_stc             || 0),
      Number(this.invest_return_rate           || 0),
      Number(this.invest_duration_days         || 30),
      Number(this.passive_income_stc           || 0),
      Number(this.passive_income_interval_days || 7),
      Number(this.weekly_maintenance_stc       || 0),
      this.can_buy    != null ? (this.can_buy    ? 1 : 0) : 1,
      this.can_rent   != null ? (this.can_rent   ? 1 : 0) : 0,
      this.can_invest != null ? (this.can_invest ? 1 : 0) : 0,
      this.can_sell   != null ? (this.can_sell   ? 1 : 0) : 1,
      Number(this.sell_value_percent || 60),
      this.allows_multiple != null ? (this.allows_multiple ? 1 : 0) : 1,
    ]);
  }

  update(id) {
    const sql = `UPDATE lifestyle_items SET
      name=?, is_active=?, sort_order=?, category=?, subcategory=?, description=?, image_url=?, tier=?,
      price_stc=?, rent_price_stc=?, rent_duration_days=?, invest_price_stc=?, invest_return_rate=?,
      invest_duration_days=?, passive_income_stc=?, passive_income_interval_days=?,
      weekly_maintenance_stc=?, can_buy=?, can_rent=?, can_invest=?, can_sell=?,
      sell_value_percent=?, allows_multiple=?
      WHERE id=?`;
    return EXECUTESQL(sql, [
      this.name,
      this.is_active  != null ? this.is_active  : 1,
      this.sort_order != null ? this.sort_order : 0,
      this.category              || null,
      this.subcategory           || null,
      this.description           || null,
      this.image_url             || null,
      this.tier                  || 'standard',
      Number(this.price_stc                    || 0),
      Number(this.rent_price_stc               || 0),
      Number(this.rent_duration_days           || 30),
      Number(this.invest_price_stc             || 0),
      Number(this.invest_return_rate           || 0),
      Number(this.invest_duration_days         || 30),
      Number(this.passive_income_stc           || 0),
      Number(this.passive_income_interval_days || 7),
      Number(this.weekly_maintenance_stc       || 0),
      this.can_buy    != null ? (this.can_buy    ? 1 : 0) : 1,
      this.can_rent   != null ? (this.can_rent   ? 1 : 0) : 0,
      this.can_invest != null ? (this.can_invest ? 1 : 0) : 0,
      this.can_sell   != null ? (this.can_sell   ? 1 : 0) : 1,
      Number(this.sell_value_percent || 60),
      this.allows_multiple != null ? (this.allows_multiple ? 1 : 0) : 1,
      id,
    ]);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM lifestyle_items WHERE id = ?', [id]);
  }
}

module.exports = LifestyleItem;

const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');
const { normalizeStoreSettings } = require('../utils/storeSettings');

class StoreConfig {
  constructor(body = {}) {
    this.id = body.id;
    this.name = body.name ?? 'STAGE Plus';
    this.stage_plus_monthly_price = body.stage_plus_monthly_price ?? null;
    this.stage_plus_yearly_price = body.stage_plus_yearly_price ?? null;
    this.monthly_credits = body.monthly_credits ?? null;
    this.starter_credits = body.starter_credits ?? null;
    this.tournament_entry_credits = body.tournament_entry_credits ?? null;
    this.community_tournament_limit = body.community_tournament_limit ?? null;
    this.headline = body.headline ?? null;
    this.description = body.description ?? null;
    this.badge_image_url = body.badge_image_url ?? null;
    this.perks = body.perks ?? null;
    this.is_active = body.is_active ?? 1;
  }

  static normalizeRow(row = {}) {
    return normalizeStoreSettings(row);
  }

  selectAll(filters = {}, limit = 50) {
    const where = [];
    const params = [];
    if (filters.is_active !== undefined && filters.is_active !== '') {
      where.push('is_active = ?');
      params.push(Number(filters.is_active) ? 1 : 0);
    }
    const sql = `SELECT * FROM store_configs ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY updated_date DESC LIMIT ?`;
    params.push(Number(limit) || 50);
    return EXECUTESQL(sql, params).then(rows => rows.map(StoreConfig.normalizeRow));
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM store_configs WHERE id = ? LIMIT 1', [id])
      .then(rows => rows.map(StoreConfig.normalizeRow));
  }

  create() {
    this.id = this.id || uuidv4();
    const perks = Array.isArray(this.perks) ? JSON.stringify(this.perks) : this.perks;
    return EXECUTESQL(
      `INSERT INTO store_configs (
        id, name, stage_plus_monthly_price, stage_plus_yearly_price, monthly_credits,
        starter_credits, tournament_entry_credits, community_tournament_limit,
        headline, description, badge_image_url, perks, is_active, created_date, updated_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        this.id, this.name, this.stage_plus_monthly_price, this.stage_plus_yearly_price,
        this.monthly_credits, this.starter_credits, this.tournament_entry_credits,
        this.community_tournament_limit, this.headline, this.description, this.badge_image_url, perks,
        Number(this.is_active) ? 1 : 0,
      ]
    );
  }

  update(id) {
    const perks = Array.isArray(this.perks) ? JSON.stringify(this.perks) : this.perks;
    return EXECUTESQL(
      `UPDATE store_configs SET
        name=?, stage_plus_monthly_price=?, stage_plus_yearly_price=?, monthly_credits=?,
        starter_credits=?, tournament_entry_credits=?, community_tournament_limit=?,
        headline=?, description=?, badge_image_url=?, perks=?, is_active=?, updated_date=NOW()
      WHERE id=?`,
      [
        this.name, this.stage_plus_monthly_price, this.stage_plus_yearly_price,
        this.monthly_credits, this.starter_credits, this.tournament_entry_credits,
        this.community_tournament_limit, this.headline, this.description, this.badge_image_url, perks,
        Number(this.is_active) ? 1 : 0, id,
      ]
    );
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM store_configs WHERE id = ?', [id]);
  }
}

module.exports = StoreConfig;

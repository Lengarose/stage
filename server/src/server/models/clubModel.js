const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

const CLUB_COLUMNS = [
  'id',
  'user_id',
  'president_user_id',
  'president_id',
  'president_player_id',
  'owner_email',
  'name',
  'tag',
  'platform',
  'region',
  'country_code',
  'logo_url',
  'logo_position',
  'logo_zoom',
  'description',
  'wins',
  'losses',
  'draws',
  'goals_scored',
  'goals_conceded',
  'rating',
  'peak_rating',
  'matches_ranked',
  'is_provisional',
  'credits',
  'stc',
  'wage_budget_stc',
  'transfer_budget_stc',
  'stadium_level',
  'stadium_capacity',
  'tier',
  'form',
  'win_streak',
  'loss_streak',
  'status',
  'formation',
  'lineup',
  'trophies',
  'banner_url',
  'banner_position',
  'banner_zoom',
  'stats_tile_background_type',
  'stats_tile_background_id',
  'stats_tile_background_url',
  'stats_tile_background_position',
  'stats_tile_background_zoom',
  'stats_tile_backgrounds',
];

const JSON_FIELDS = new Set(['lineup', 'trophies', 'stats_tile_backgrounds']);

function normalizeFieldValue(field, value) {
  if (!JSON_FIELDS.has(field)) return value;
  return value ? (typeof value === 'string' ? value : JSON.stringify(value)) : null;
}

class Club {
  constructor(body = {}) {
    for (const field of CLUB_COLUMNS) {
      this[field] = normalizeFieldValue(field, body[field]);
    }
  }

  selectAll({ page = 1, limit = 25, offset } = {}) {
    const pageSize = Math.max(1, Math.min(Number(limit) || 25, 1000));
    const safePage = Math.max(1, Number(page) || 1);
    const safeOffset = offset !== undefined
      ? Math.max(0, Number(offset) || 0)
      : (safePage - 1) * pageSize;
    return EXECUTESQL('SELECT * FROM clubs ORDER BY name ASC LIMIT ? OFFSET ?', [pageSize, safeOffset]);
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

  selectByPresidentPlayerId(president_player_id) {
    return EXECUTESQL('SELECT * FROM clubs WHERE president_player_id = ? LIMIT 50', [president_player_id]);
  }

  create() {
    this.id = this.id || uuidv4();
    this.president_user_id = this.president_user_id || this.user_id || null;
    if (!this.president_user_id) {
      throw new Error('Club president_user_id is required');
    }
    const sql = `INSERT INTO clubs (${CLUB_COLUMNS.join(', ')})
      VALUES (${CLUB_COLUMNS.map(() => '?').join(',')})`;
    const values = CLUB_COLUMNS.map((field) => this[field]);
    return EXECUTESQL(sql, values);
  }

  update(id) {
    const fields = CLUB_COLUMNS.filter((field) => field !== 'id');
    const sql = `UPDATE clubs SET ${fields.map((field) => `${field}=?`).join(', ')}
      WHERE id=?`;
    const values = [...fields.map((field) => this[field]), id];
    return EXECUTESQL(sql, values);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM clubs WHERE id = ?', [id]);
  }
}

module.exports = Club;

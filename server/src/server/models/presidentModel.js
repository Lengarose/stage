const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

const PRESIDENT_COLUMNS = [
  'id',
  'user_id',
  'club_id',
  'email',
  'display_name',
  'role_title',
  'avatar_url',
  'avatar_position',
  'avatar_zoom',
  'banner_url',
  'banner_position',
  'banner_zoom',
  'bio',
  'success_level',
  'country_code',
  'quote',
  'management_style',
  'started_at',
  'social_links',
  'status',
];

const JSON_FIELDS = new Set(['social_links']);

function normalizeFieldValue(field, value) {
  if (!JSON_FIELDS.has(field)) return value;
  if (value == null || value === '') return null;
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function normalizeRow(row = {}) {
  const next = { ...row };
  if (typeof next.social_links === 'string') {
    try {
      next.social_links = JSON.parse(next.social_links || 'null');
    } catch {
      next.social_links = null;
    }
  }
  return next;
}

class President {
  constructor(body = {}) {
    for (const field of PRESIDENT_COLUMNS) {
      this[field] = normalizeFieldValue(field, body[field]);
    }
    if (this.status == null) this.status = 'active';
  }

  static normalizeRow(row) {
    return normalizeRow(row);
  }

  selectAll(page = 1, limit = 25) {
    const pageSize = Math.max(1, Math.min(Number(limit) || 25, 500));
    const offset = (Math.max(1, Number(page) || 1) - 1) * pageSize;
    return EXECUTESQL('SELECT * FROM presidents LIMIT ? OFFSET ?', [pageSize, offset])
      .then((rows) => rows.map(normalizeRow));
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM presidents WHERE id = ?', [id])
      .then((rows) => rows.map(normalizeRow));
  }

  selectByUserId(user_id) {
    return EXECUTESQL('SELECT * FROM presidents WHERE user_id = ?', [user_id])
      .then((rows) => rows.map(normalizeRow));
  }

  selectByClub(club_id) {
    return EXECUTESQL('SELECT * FROM presidents WHERE club_id = ?', [club_id])
      .then((rows) => rows.map(normalizeRow));
  }

  selectByEmail(email) {
    return EXECUTESQL('SELECT * FROM presidents WHERE LOWER(email) = LOWER(?)', [email])
      .then((rows) => rows.map(normalizeRow));
  }

  create() {
    this.id = this.id || uuidv4();
    if (!this.user_id) {
      throw new Error('President user_id is required');
    }
    if (this.status == null) this.status = 'active';
    const sql = `INSERT INTO presidents (${PRESIDENT_COLUMNS.join(', ')})
      VALUES (${PRESIDENT_COLUMNS.map(() => '?').join(',')})`;
    const values = PRESIDENT_COLUMNS.map((field) => this[field]);
    return EXECUTESQL(sql, values);
  }

  update(id) {
    const fields = PRESIDENT_COLUMNS.filter((field) => field !== 'id');
    const sql = `UPDATE presidents SET ${fields.map((field) => `${field}=?`).join(', ')}
      WHERE id=?`;
    const values = [...fields.map((field) => this[field]), id];
    return EXECUTESQL(sql, values);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM presidents WHERE id = ?', [id]);
  }
}

module.exports = President;
module.exports.PRESIDENT_COLUMNS = PRESIDENT_COLUMNS;

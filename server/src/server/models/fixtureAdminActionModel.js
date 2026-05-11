/**
 * FixtureAdminAction model.
 *
 * Backs the `fixture_admin_actions` audit table. Each row represents one admin
 * intervention on an expired fixture (force-schedule, declare-forfeit, or
 * flag-for-review). Written by fixtureAdminActionController.js.
 */
const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

function serializePayload(payload) {
  if (payload == null) return null;
  if (typeof payload === 'string') return payload;
  try {
    return JSON.stringify(payload);
  } catch {
    return null;
  }
}

function deserializeRow(row) {
  if (!row) return row;
  if (typeof row.payload === 'string' && row.payload) {
    try { row.payload = JSON.parse(row.payload); } catch { /* keep raw */ }
  }
  return row;
}

class FixtureAdminActionModel {
  constructor(body = {}) {
    this.id                = body.id;
    this.fixture_id        = body.fixture_id;
    this.fixture_type      = body.fixture_type;
    this.action_type       = body.action_type;
    this.performed_by      = body.performed_by ?? null;
    this.performed_by_name = body.performed_by_name ?? null;
    this.home_club_id      = body.home_club_id ?? null;
    this.away_club_id      = body.away_club_id ?? null;
    this.payload           = serializePayload(body.payload);
    this.admin_note        = body.admin_note ?? null;
  }

  async create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO fixture_admin_actions
      (id, fixture_id, fixture_type, action_type, performed_by, performed_by_name,
       home_club_id, away_club_id, payload, admin_note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const values = [
      this.id, this.fixture_id, this.fixture_type, this.action_type,
      this.performed_by, this.performed_by_name,
      this.home_club_id, this.away_club_id,
      this.payload, this.admin_note,
    ];
    await EXECUTESQL(sql, values);
    return this.id;
  }

  static async selectOne(id) {
    const rows = await EXECUTESQL('SELECT * FROM fixture_admin_actions WHERE id = ? LIMIT 1', [id]);
    return rows.length ? deserializeRow(rows[0]) : null;
  }

  static async selectAll({ fixture_id, fixture_type, action_type, performed_by, limit = 100 } = {}) {
    const cap = Math.max(1, Math.min(Number(limit) || 100, 500));
    const where = [];
    const params = [];
    if (fixture_id)   { where.push('fixture_id = ?');   params.push(String(fixture_id)); }
    if (fixture_type) { where.push('fixture_type = ?'); params.push(String(fixture_type)); }
    if (action_type)  { where.push('action_type = ?');  params.push(String(action_type)); }
    if (performed_by) { where.push('performed_by = ?'); params.push(String(performed_by)); }
    const sql = `SELECT * FROM fixture_admin_actions
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY created_date DESC LIMIT ?`;
    params.push(cap);
    const rows = await EXECUTESQL(sql, params);
    return rows.map(deserializeRow);
  }

  static delete(id) {
    return EXECUTESQL('DELETE FROM fixture_admin_actions WHERE id = ?', [id]);
  }
}

module.exports = FixtureAdminActionModel;

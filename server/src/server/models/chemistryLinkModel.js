const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

/**
 * `chemistry_links` — a relationship between two players that grants a
 * chemistry bonus when they line up in the same XI.
 *
 *   link_type     'nationality' | 'club_current' | 'club_past' |
 *                 'league' | 'icon' | 'cornerstone' | 'manual'
 *   bonus_factor  multiplier applied to the linked players' stat aggregate
 *                 (e.g. 1.05 = +5% performance). Aggregated by
 *                 chemistryService#computeChemistry before kicking into the
 *                 scheduleEngine.
 *   source        Free-text marker (e.g. "FRA" for nationality FRA, or club_id)
 *                 used to dedupe and to surface in the UI.
 *
 * The pair (player_a_id, player_b_id) is canonicalised by sorting them so
 * that A <= B; this guarantees a single row per pair regardless of insert order.
 */
class ChemistryLinkModel {
  constructor(body = {}) {
    let a = body.player_a_id;
    let b = body.player_b_id;
    if (a && b && String(b) < String(a)) { const t = a; a = b; b = t; }
    this.id           = body.id;
    this.player_a_id  = a;
    this.player_b_id  = b;
    this.link_type    = body.link_type;
    this.bonus_factor = body.bonus_factor ?? 1.0;
    this.source       = body.source || null;
    this.description  = body.description || null;
    this.is_active    = body.is_active ?? 1;
  }

  selectAll(page = 1) {
    const pageSize = 100;
    const offset   = (page - 1) * pageSize;
    return EXECUTESQL(
      'SELECT * FROM chemistry_links ORDER BY created_date DESC LIMIT ? OFFSET ?',
      [pageSize, offset]
    );
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM chemistry_links WHERE id = ?', [id]);
  }

  selectByPlayer(player_id) {
    return EXECUTESQL(
      'SELECT * FROM chemistry_links WHERE (player_a_id = ? OR player_b_id = ?) AND is_active = 1',
      [player_id, player_id]
    );
  }

  selectByPair(player_a_id, player_b_id) {
    let a = player_a_id, b = player_b_id;
    if (String(b) < String(a)) { const t = a; a = b; b = t; }
    return EXECUTESQL(
      'SELECT * FROM chemistry_links WHERE player_a_id = ? AND player_b_id = ?',
      [a, b]
    );
  }

  /** Bulk-load links for a squad list (returns only links where BOTH endpoints are in the squad). */
  selectBySquad(playerIds) {
    if (!Array.isArray(playerIds) || playerIds.length < 2) return Promise.resolve([]);
    const placeholders = playerIds.map(() => '?').join(',');
    return EXECUTESQL(
      `SELECT * FROM chemistry_links
        WHERE is_active = 1
          AND player_a_id IN (${placeholders})
          AND player_b_id IN (${placeholders})`,
      [...playerIds, ...playerIds]
    );
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO chemistry_links
      (id, player_a_id, player_b_id, link_type, bonus_factor, source, description, is_active)
      VALUES (?,?,?,?,?,?,?,?)`;
    const values = [
      this.id, this.player_a_id, this.player_b_id, this.link_type,
      this.bonus_factor, this.source, this.description, this.is_active,
    ];
    return EXECUTESQL(sql, values);
  }

  update(id) {
    const sql = `UPDATE chemistry_links SET
      player_a_id=?, player_b_id=?, link_type=?, bonus_factor=?,
      source=?, description=?, is_active=?
      WHERE id=?`;
    const values = [
      this.player_a_id, this.player_b_id, this.link_type, this.bonus_factor,
      this.source, this.description, this.is_active,
      id,
    ];
    return EXECUTESQL(sql, values);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM chemistry_links WHERE id = ?', [id]);
  }
}

module.exports = ChemistryLinkModel;

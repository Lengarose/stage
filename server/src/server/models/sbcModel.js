const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

/**
 * `sbcs` — Squad Building Challenge definitions.
 *
 *   requirements    JSON describing the constraints, e.g.
 *                   { "min_chem": 75, "min_rating": 82, "nationality": "FRA",
 *                     "league_id": "...", "squad_size": 11 }
 *   reward          JSON describing the reward, e.g.
 *                   { "stc": 250000, "trophy_item_id": "...", "title": "Bleu pack" }
 *   max_completions Max times a single player can complete this SBC
 *                   (NULL = unlimited)
 *   expires_at      Inclusive deadline; submissions after this are rejected
 */
class SbcModel {
  constructor(body = {}) {
    this.id              = body.id;
    this.name            = body.name;
    this.description     = body.description || null;
    this.category        = body.category || 'general';
    this.requirements    = body.requirements
      ? (typeof body.requirements === 'string'
          ? body.requirements
          : JSON.stringify(body.requirements))
      : null;
    this.reward          = body.reward
      ? (typeof body.reward === 'string'
          ? body.reward
          : JSON.stringify(body.reward))
      : null;
    this.image_url       = body.image_url || null;
    this.max_completions = body.max_completions ?? null;
    this.expires_at      = body.expires_at || null;
    this.is_active       = body.is_active ?? 1;
  }

  selectAll(page = 1) {
    const pageSize = 50;
    const offset   = (page - 1) * pageSize;
    return EXECUTESQL(
      'SELECT * FROM sbcs ORDER BY created_date DESC LIMIT ? OFFSET ?',
      [pageSize, offset]
    );
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM sbcs WHERE id = ?', [id]);
  }

  selectActive() {
    return EXECUTESQL(
      `SELECT * FROM sbcs
        WHERE is_active = 1
          AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY created_date DESC`
    );
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO sbcs
      (id, name, description, category, requirements, reward, image_url, max_completions, expires_at, is_active)
      VALUES (?,?,?,?,?,?,?,?,?,?)`;
    const values = [
      this.id, this.name, this.description, this.category, this.requirements,
      this.reward, this.image_url, this.max_completions, this.expires_at, this.is_active,
    ];
    return EXECUTESQL(sql, values);
  }

  update(id) {
    const sql = `UPDATE sbcs SET
      name=?, description=?, category=?, requirements=?, reward=?,
      image_url=?, max_completions=?, expires_at=?, is_active=?
      WHERE id=?`;
    const values = [
      this.name, this.description, this.category, this.requirements, this.reward,
      this.image_url, this.max_completions, this.expires_at, this.is_active,
      id,
    ];
    return EXECUTESQL(sql, values);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM sbcs WHERE id = ?', [id]);
  }
}

module.exports = SbcModel;

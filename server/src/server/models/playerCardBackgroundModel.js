const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

function clip(value, max) {
  if (value == null) return value;
  const text = String(value);
  return text.length > max ? text.slice(0, max) : text;
}

class PlayerCardBackground {
  constructor(body = {}) {
    this.id = body.id;
    this.name = body.name;
    this.description = body.description;
    this.image_url = body.image_url;
    this.is_active = body.is_active;
    this.is_stage_plus = body.is_stage_plus;
    this.sort_order = body.sort_order;
    this.created_by = body.created_by;
  }

  selectAll({ include_inactive = 0, limit = 100 } = {}) {
    const params = [];
    let sql = 'SELECT * FROM player_card_backgrounds';
    if (!Number(include_inactive)) {
      sql += ' WHERE is_active = 1';
    }
    sql += ' ORDER BY sort_order ASC, created_date DESC LIMIT ?';
    params.push(Math.max(1, Math.min(Number(limit) || 100, 200)));
    return EXECUTESQL(sql, params);
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM player_card_backgrounds WHERE id = ?', [id]);
  }

  create() {
    this.id = this.id || uuidv4();
    return EXECUTESQL(
      `INSERT INTO player_card_backgrounds
        (id, name, description, image_url, is_active, is_stage_plus, sort_order, created_by, created_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        this.id,
        clip(this.name, 120),
        this.description || null,
        this.image_url,
        this.is_active == null ? 1 : Number(Boolean(this.is_active)),
        this.is_stage_plus == null ? 1 : Number(Boolean(this.is_stage_plus)),
        Number(this.sort_order) || 0,
        this.created_by || null,
      ],
    );
  }

  update(id) {
    return EXECUTESQL(
      `UPDATE player_card_backgrounds SET
        name=?, description=?, image_url=?, is_active=?, is_stage_plus=?, sort_order=?, updated_date=NOW()
       WHERE id=?`,
      [
        clip(this.name, 120),
        this.description || null,
        this.image_url,
        this.is_active == null ? 1 : Number(Boolean(this.is_active)),
        this.is_stage_plus == null ? 1 : Number(Boolean(this.is_stage_plus)),
        Number(this.sort_order) || 0,
        id,
      ],
    );
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM player_card_backgrounds WHERE id = ?', [id]);
  }
}

module.exports = PlayerCardBackground;

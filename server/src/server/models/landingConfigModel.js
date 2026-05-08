const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class LandingConfig {
  constructor(body = {}) {
    this.id              = body.id;
    this.hero_title      = body.hero_title      ?? null; // eyebrow label
    this.hero_description= body.hero_description?? null;
    this.hero_image_url  = body.hero_image_url  ?? null;
    this.stats_json      = body.stats_json      ?? null;
    this.section1_tag    = body.section1_tag    ?? null;
    this.section1_title  = body.section1_title  ?? null;
    this.section1_text   = body.section1_text   ?? null;
    this.section1_image_url = body.section1_image_url ?? null;
    this.section2_tag    = body.section2_tag    ?? null;
    this.section2_title  = body.section2_title  ?? null;
    this.section2_text   = body.section2_text   ?? null;
    this.section2_image_url = body.section2_image_url ?? null;
    this.section3_tag    = body.section3_tag    ?? null;
    this.section3_title  = body.section3_title  ?? null;
    this.section3_text   = body.section3_text   ?? null;
    this.section3_image_url = body.section3_image_url ?? null;
    this.footer_tagline  = body.footer_tagline  ?? null;
  }

  static normalizeRow(row = {}) {
    const next = { ...row };
    if (typeof next.stats_json === 'string' && next.stats_json) {
      try { next.stats_json = JSON.parse(next.stats_json); } catch {}
    }
    return next;
  }

  selectAll(limit = 1) {
    return EXECUTESQL(
      'SELECT * FROM landing_config ORDER BY updated_date DESC LIMIT ?',
      [Number(limit) || 1]
    ).then(rows => rows.map(r => LandingConfig.normalizeRow(r)));
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM landing_config WHERE id = ? LIMIT 1', [id])
      .then(rows => rows.map(r => LandingConfig.normalizeRow(r)));
  }

  create() {
    this.id = this.id || uuidv4();
    const statsVal = typeof this.stats_json === 'object'
      ? JSON.stringify(this.stats_json) : (this.stats_json || null);
    return EXECUTESQL(
      `INSERT INTO landing_config (
        id, hero_title, hero_description, hero_image_url, stats_json,
        section1_tag, section1_title, section1_text, section1_image_url,
        section2_tag, section2_title, section2_text, section2_image_url,
        section3_tag, section3_title, section3_text, section3_image_url,
        footer_tagline
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        this.id, this.hero_title, this.hero_description, this.hero_image_url, statsVal,
        this.section1_tag, this.section1_title, this.section1_text, this.section1_image_url,
        this.section2_tag, this.section2_title, this.section2_text, this.section2_image_url,
        this.section3_tag, this.section3_title, this.section3_text, this.section3_image_url,
        this.footer_tagline,
      ]
    );
  }

  update(id) {
    const statsVal = typeof this.stats_json === 'object'
      ? JSON.stringify(this.stats_json) : (this.stats_json || null);
    return EXECUTESQL(
      `UPDATE landing_config SET
        hero_title=?, hero_description=?, hero_image_url=?, stats_json=?,
        section1_tag=?, section1_title=?, section1_text=?, section1_image_url=?,
        section2_tag=?, section2_title=?, section2_text=?, section2_image_url=?,
        section3_tag=?, section3_title=?, section3_text=?, section3_image_url=?,
        footer_tagline=?
      WHERE id=?`,
      [
        this.hero_title, this.hero_description, this.hero_image_url, statsVal,
        this.section1_tag, this.section1_title, this.section1_text, this.section1_image_url,
        this.section2_tag, this.section2_title, this.section2_text, this.section2_image_url,
        this.section3_tag, this.section3_title, this.section3_text, this.section3_image_url,
        this.footer_tagline,
        id,
      ]
    );
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM landing_config WHERE id = ?', [id]);
  }
}

module.exports = LandingConfig;

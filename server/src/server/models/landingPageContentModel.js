const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class LandingPageContent {
  constructor(body = {}) {
    this.id = body.id;
    this.hero_title = body.hero_title ?? null;
    this.hero_subtitle = body.hero_subtitle ?? null;
    this.hero_description = body.hero_description ?? null;
    this.hero_image_url = body.hero_image_url ?? null;
    this.hero_cta_1_label = body.hero_cta_1_label ?? null;
    this.hero_cta_1_url = body.hero_cta_1_url ?? null;
    this.hero_cta_2_label = body.hero_cta_2_label ?? null;
    this.hero_cta_2_url = body.hero_cta_2_url ?? null;
    this.hero_cta_3_label = body.hero_cta_3_label ?? null;
    this.hero_cta_3_url = body.hero_cta_3_url ?? null;
    this.section1_title = body.section1_title ?? null;
    this.section1_text = body.section1_text ?? null;
    this.section1_image_url = body.section1_image_url ?? null;
    this.section2_title = body.section2_title ?? null;
    this.section2_text = body.section2_text ?? null;
    this.section2_image_url = body.section2_image_url ?? null;
    this.section3_title = body.section3_title ?? null;
    this.section3_text = body.section3_text ?? null;
    this.section3_image_url = body.section3_image_url ?? null;
    this.faq_items = body.faq_items ?? [];
    this.contact_email = body.contact_email ?? null;
    this.footer_tagline = body.footer_tagline ?? null;
  }

  static normalizeRow(row = {}) {
    const next = { ...row };
    if (typeof next.faq_items === 'string') {
      try {
        next.faq_items = JSON.parse(next.faq_items || '[]');
      } catch {
        next.faq_items = [];
      }
    }
    if (!Array.isArray(next.faq_items)) next.faq_items = [];
    return next;
  }

  selectAll(limit = 50) {
    return EXECUTESQL(
      'SELECT * FROM landing_page_contents ORDER BY updated_date DESC LIMIT ?',
      [Number(limit) || 50]
    ).then((rows) => rows.map((r) => LandingPageContent.normalizeRow(r)));
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM landing_page_contents WHERE id = ? LIMIT 1', [id])
      .then((rows) => rows.map((r) => LandingPageContent.normalizeRow(r)));
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `
      INSERT INTO landing_page_contents (
        id, hero_title, hero_subtitle, hero_description, hero_image_url,
        hero_cta_1_label, hero_cta_1_url, hero_cta_2_label, hero_cta_2_url, hero_cta_3_label, hero_cta_3_url,
        section1_title, section1_text, section1_image_url,
        section2_title, section2_text, section2_image_url,
        section3_title, section3_text, section3_image_url,
        faq_items, contact_email, footer_tagline
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `;
    return EXECUTESQL(sql, [
      this.id, this.hero_title, this.hero_subtitle, this.hero_description, this.hero_image_url,
      this.hero_cta_1_label, this.hero_cta_1_url, this.hero_cta_2_label, this.hero_cta_2_url, this.hero_cta_3_label, this.hero_cta_3_url,
      this.section1_title, this.section1_text, this.section1_image_url,
      this.section2_title, this.section2_text, this.section2_image_url,
      this.section3_title, this.section3_text, this.section3_image_url,
      JSON.stringify(Array.isArray(this.faq_items) ? this.faq_items : []),
      this.contact_email, this.footer_tagline,
    ]);
  }

  update(id) {
    const sql = `
      UPDATE landing_page_contents SET
        hero_title=?, hero_subtitle=?, hero_description=?, hero_image_url=?,
        hero_cta_1_label=?, hero_cta_1_url=?, hero_cta_2_label=?, hero_cta_2_url=?, hero_cta_3_label=?, hero_cta_3_url=?,
        section1_title=?, section1_text=?, section1_image_url=?,
        section2_title=?, section2_text=?, section2_image_url=?,
        section3_title=?, section3_text=?, section3_image_url=?,
        faq_items=?, contact_email=?, footer_tagline=?
      WHERE id=?
    `;
    return EXECUTESQL(sql, [
      this.hero_title, this.hero_subtitle, this.hero_description, this.hero_image_url,
      this.hero_cta_1_label, this.hero_cta_1_url, this.hero_cta_2_label, this.hero_cta_2_url, this.hero_cta_3_label, this.hero_cta_3_url,
      this.section1_title, this.section1_text, this.section1_image_url,
      this.section2_title, this.section2_text, this.section2_image_url,
      this.section3_title, this.section3_text, this.section3_image_url,
      JSON.stringify(Array.isArray(this.faq_items) ? this.faq_items : []),
      this.contact_email, this.footer_tagline,
      id,
    ]);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM landing_page_contents WHERE id = ?', [id]);
  }
}

module.exports = LandingPageContent;

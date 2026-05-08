const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

class CompetitionModel {
  constructor(body = {}) {
    this.id                              = body.id;
    this.name                            = body.name;
    this.slug                            = body.slug;
    this.tier                            = body.tier;
    this.description                     = body.description;
    this.logo_url                        = body.logo_url;
    this.banner_url                      = body.banner_url;
    this.primary_color                   = body.primary_color || '#00E5BD';
    this.platform                        = body.platform || 'Cross-Platform';
    this.region                          = body.region || 'Global';
    this.max_clubs_per_season            = body.max_clubs_per_season ?? 16;
    this.promotion_spots                 = body.promotion_spots ?? 2;
    this.relegation_spots                = body.relegation_spots ?? 2;
    this.playoff_spots                   = body.playoff_spots ?? 4;
    this.qualification_spots_per_region  = body.qualification_spots_per_region ?? 2;
    this.current_season                  = body.current_season ?? 1;
    this.is_active                       = body.is_active ?? true;
    this.trophy_image_url                = body.trophy_image_url;
  }

  selectAll(page = 1) {
    const pageSize = 25;
    const offset   = (page - 1) * pageSize;
    return EXECUTESQL('SELECT * FROM competitions ORDER BY tier ASC LIMIT ? OFFSET ?', [pageSize, offset]);
  }

  selectOne(id) {
    return EXECUTESQL('SELECT * FROM competitions WHERE id = ?', [id]);
  }

  selectBySlug(slug) {
    return EXECUTESQL('SELECT * FROM competitions WHERE slug = ?', [slug]);
  }

  selectActive() {
    return EXECUTESQL('SELECT * FROM competitions WHERE is_active = 1 ORDER BY tier ASC', []);
  }

  create() {
    this.id = this.id || uuidv4();
    const sql = `INSERT INTO competitions
      (id, name, slug, tier, description, logo_url, banner_url, primary_color,
       platform, region, max_clubs_per_season, promotion_spots, relegation_spots,
       playoff_spots, qualification_spots_per_region, current_season, is_active, trophy_image_url)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
    const values = [
      this.id, this.name, this.slug, this.tier, this.description, this.logo_url, this.banner_url, this.primary_color,
      this.platform, this.region, this.max_clubs_per_season, this.promotion_spots, this.relegation_spots,
      this.playoff_spots, this.qualification_spots_per_region, this.current_season, this.is_active, this.trophy_image_url,
    ];
    return EXECUTESQL(sql, values);
  }

  update(id) {
    const sql = `UPDATE competitions SET
      name=?, slug=?, tier=?, description=?, logo_url=?, banner_url=?, primary_color=?,
      platform=?, region=?, max_clubs_per_season=?, promotion_spots=?, relegation_spots=?,
      playoff_spots=?, qualification_spots_per_region=?, current_season=?, is_active=?, trophy_image_url=?
      WHERE id=?`;
    const values = [
      this.name, this.slug, this.tier, this.description, this.logo_url, this.banner_url, this.primary_color,
      this.platform, this.region, this.max_clubs_per_season, this.promotion_spots, this.relegation_spots,
      this.playoff_spots, this.qualification_spots_per_region, this.current_season, this.is_active, this.trophy_image_url,
      id,
    ];
    return EXECUTESQL(sql, values);
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM competitions WHERE id = ?', [id]);
  }
}

module.exports = CompetitionModel;

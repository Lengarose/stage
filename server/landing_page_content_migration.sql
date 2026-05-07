-- Adds landing_page_contents table used by admin landing page editor
-- mysql -u root -p stage_league < landing_page_content_migration.sql

USE stage_league;

CREATE TABLE IF NOT EXISTS landing_page_contents (
  id VARCHAR(64) PRIMARY KEY,
  hero_title VARCHAR(255) NULL,
  hero_subtitle VARCHAR(255) NULL,
  hero_description TEXT NULL,
  hero_image_url VARCHAR(500) NULL,
  hero_cta_1_label VARCHAR(255) NULL,
  hero_cta_1_url VARCHAR(500) NULL,
  hero_cta_2_label VARCHAR(255) NULL,
  hero_cta_2_url VARCHAR(500) NULL,
  hero_cta_3_label VARCHAR(255) NULL,
  hero_cta_3_url VARCHAR(500) NULL,
  section1_title VARCHAR(255) NULL,
  section1_text TEXT NULL,
  section1_image_url VARCHAR(500) NULL,
  section2_title VARCHAR(255) NULL,
  section2_text TEXT NULL,
  section2_image_url VARCHAR(500) NULL,
  section3_title VARCHAR(255) NULL,
  section3_text TEXT NULL,
  section3_image_url VARCHAR(500) NULL,
  faq_items LONGTEXT NULL,
  contact_email VARCHAR(255) NULL,
  footer_tagline TEXT NULL,
  created_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

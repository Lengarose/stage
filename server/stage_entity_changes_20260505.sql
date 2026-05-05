-- STAGE platform entity changes (2026-05-05)
-- Safe/idempotent migration for MariaDB/MySQL.
SET @db = DATABASE();

-- Ensure matches exists before altering it
CREATE TABLE IF NOT EXISTS matches (
  id                  VARCHAR(36)  PRIMARY KEY,
  home_club_id        VARCHAR(36),
  away_club_id        VARCHAR(36),
  home_player_id      VARCHAR(36),
  away_player_id      VARCHAR(36),
  home_club_name      VARCHAR(150),
  away_club_name      VARCHAR(150),
  home_score          INT          DEFAULT 0,
  away_score          INT          DEFAULT 0,
  status              VARCHAR(50)  DEFAULT 'scheduled',
  mode                VARCHAR(50),
  type                VARCHAR(50),
  round               INT,
  tournament_id       VARCHAR(36),
  scheduled_date      DATETIME,
  wager_stc           DECIMAL(12,2) DEFAULT 0,
  wager_status        VARCHAR(50),
  wager_home_locked   TINYINT(1)   DEFAULT 0,
  wager_away_locked   TINYINT(1)   DEFAULT 0,
  stream_url          TEXT,
  stream_embed_html   TEXT,
  created_date        DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_date        DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Match: add source and goal event fields
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'matches' AND COLUMN_NAME = 'source_fixture_id') = 0,
  'ALTER TABLE matches ADD COLUMN source_fixture_id VARCHAR(36)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'matches' AND COLUMN_NAME = 'source_fixture_type') = 0,
  'ALTER TABLE matches ADD COLUMN source_fixture_type VARCHAR(50)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'matches' AND COLUMN_NAME = 'competition_context') = 0,
  'ALTER TABLE matches ADD COLUMN competition_context VARCHAR(255)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'matches' AND COLUMN_NAME = 'home_goal_events') = 0,
  'ALTER TABLE matches ADD COLUMN home_goal_events JSON',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'matches' AND COLUMN_NAME = 'away_goal_events') = 0,
  'ALTER TABLE matches ADD COLUMN away_goal_events JSON',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Ensure regional_league_fixtures exists before altering it
CREATE TABLE IF NOT EXISTS regional_league_fixtures (
  id                  VARCHAR(36)  PRIMARY KEY,
  league_id           VARCHAR(36)  NOT NULL,
  league_name         VARCHAR(200),
  region_slug         VARCHAR(100),
  division            INT          DEFAULT 1,
  season_number       INT          DEFAULT 1,
  matchday            INT          NOT NULL,
  home_club_id        VARCHAR(36)  NOT NULL,
  home_club_name      VARCHAR(200),
  home_club_logo_url  TEXT,
  home_club_tag       VARCHAR(50),
  away_club_id        VARCHAR(36)  NOT NULL,
  away_club_name      VARCHAR(200),
  away_club_logo_url  TEXT,
  away_club_tag       VARCHAR(50),
  window_start        DATETIME,
  window_end          DATETIME,
  window_days         INT          DEFAULT 4,
  scheduling_status   VARCHAR(50)  DEFAULT 'open',
  home_proposed_date  DATETIME,
  away_proposed_date  DATETIME,
  confirmed_date      DATETIME,
  last_proposed_by    VARCHAR(50),
  proposal_count      INT          DEFAULT 0,
  status              VARCHAR(50)  DEFAULT 'unscheduled',
  home_score          INT          DEFAULT 0,
  away_score          INT          DEFAULT 0,
  home_submitted_score VARCHAR(20),
  away_submitted_score VARCHAR(20),
  winner_club_id      VARCHAR(36),
  winner_club_name    VARCHAR(200),
  stats_processed     TINYINT(1)   DEFAULT 0,
  admin_notes         TEXT,
  created_date        DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_date        DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- RegionalLeagueFixture: linked Match id
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'regional_league_fixtures' AND COLUMN_NAME = 'match_id') = 0,
  'ALTER TABLE regional_league_fixtures ADD COLUMN match_id VARCHAR(36)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Competition + RegionalLeague: trophy image URL
CREATE TABLE IF NOT EXISTS competitions (
  id               VARCHAR(36)  PRIMARY KEY,
  name             VARCHAR(200) NOT NULL,
  slug             VARCHAR(100),
  tier             INT,
  description      TEXT,
  logo_url         TEXT,
  banner_url       TEXT,
  primary_color    VARCHAR(20),
  platform         VARCHAR(50),
  region           VARCHAR(100),
  max_clubs_per_season INT      DEFAULT 16,
  promotion_spots  INT          DEFAULT 2,
  relegation_spots INT          DEFAULT 2,
  playoff_spots    INT          DEFAULT 4,
  qualification_spots_per_region INT DEFAULT 2,
  current_season   INT          DEFAULT 1,
  is_active        TINYINT(1)   DEFAULT 1,
  created_date     DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_date     DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS regional_leagues (
  id                    VARCHAR(36)  PRIMARY KEY,
  name                  VARCHAR(200) NOT NULL,
  slug                  VARCHAR(100),
  region_slug           VARCHAR(100),
  division              INT          DEFAULT 1,
  country_code          VARCHAR(10),
  region                VARCHAR(100),
  platform              VARCHAR(50),
  season_number         INT          DEFAULT 1,
  status                VARCHAR(50)  DEFAULT 'draft',
  archived_at           DATETIME,
  next_season_id        VARCHAR(36),
  max_clubs             INT          DEFAULT 16,
  num_clubs             INT          DEFAULT 0,
  start_date            DATETIME,
  end_date              DATETIME,
  promoted_slots        INT          DEFAULT 2,
  target_competition_id VARCHAR(36),
  target_competition_name VARCHAR(200),
  target_competition_tier INT,
  target_season_id      VARCHAR(36),
  registered_club_ids   JSON,
  winner_club_id        VARCHAR(36),
  winner_club_name      VARCHAR(200),
  organizer_email       VARCHAR(255),
  trophy_item_id        VARCHAR(36),
  banner_url            TEXT,
  linked_league_slug    VARCHAR(100),
  admin_notes           TEXT,
  created_date          DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_date          DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'competitions' AND COLUMN_NAME = 'trophy_image_url') = 0,
  'ALTER TABLE competitions ADD COLUMN trophy_image_url TEXT',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'regional_leagues' AND COLUMN_NAME = 'trophy_image_url') = 0,
  'ALTER TABLE regional_leagues ADD COLUMN trophy_image_url TEXT',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- New entities
CREATE TABLE IF NOT EXISTS season_registrations (
  id                    VARCHAR(36)  PRIMARY KEY,
  club_id               VARCHAR(36)  NOT NULL,
  club_name             VARCHAR(200) NOT NULL,
  club_tag              VARCHAR(50),
  club_logo_url         TEXT,
  owner_email           VARCHAR(255),
  target_type           VARCHAR(50)  NOT NULL,
  region_slug           VARCHAR(100) NOT NULL,
  region_name           VARCHAR(200),
  platform              VARCHAR(50)  NOT NULL,
  preferred_division    VARCHAR(50),
  note_from_club        TEXT,
  season_label          VARCHAR(150),
  status                VARCHAR(50)  NOT NULL DEFAULT 'pending',
  assigned_league_id    VARCHAR(36),
  assigned_league_name  VARCHAR(200),
  assigned_division     VARCHAR(50),
  admin_notes           TEXT,
  reviewed_by           VARCHAR(255),
  reviewed_at           DATETIME,
  applied_at            DATETIME,
  created_date          DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_date          DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reward_configs (
  id             VARCHAR(36)   PRIMARY KEY,
  source_id      VARCHAR(36)   NOT NULL,
  source_type    VARCHAR(50)   NOT NULL,
  source_name    VARCHAR(200),
  position       INT           NOT NULL,
  position_label VARCHAR(100),
  badge_type     VARCHAR(50)   DEFAULT 'participant',
  stc_amount     DECIMAL(12,2) DEFAULT 0,
  created_date   DATETIME      DEFAULT CURRENT_TIMESTAMP,
  updated_date   DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS club_achievements (
  id               VARCHAR(36)   PRIMARY KEY,
  club_id          VARCHAR(36)   NOT NULL,
  club_name        VARCHAR(200),
  club_logo_url    TEXT,
  club_tag         VARCHAR(50),
  source_id        VARCHAR(36)   NOT NULL,
  source_type      VARCHAR(50)   NOT NULL,
  source_name      VARCHAR(200),
  season_id        VARCHAR(36),
  season_number    INT           NOT NULL,
  season_label     VARCHAR(150),
  position         INT,
  position_label   VARCHAR(100),
  badge_type       VARCHAR(50)   DEFAULT 'participant',
  stc_awarded      DECIMAL(12,2) DEFAULT 0,
  trophy_image_url TEXT,
  awarded_at       DATETIME,
  created_date     DATETIME      DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS player_achievements (
  id               VARCHAR(36)  PRIMARY KEY,
  player_id        VARCHAR(36)  NOT NULL,
  player_email     VARCHAR(255),
  player_gamertag  VARCHAR(100),
  club_id          VARCHAR(36),
  club_name        VARCHAR(200),
  source_id        VARCHAR(36)  NOT NULL,
  source_type      VARCHAR(50)  NOT NULL,
  source_name      VARCHAR(200),
  season_id        VARCHAR(36),
  season_number    INT          NOT NULL,
  season_label     VARCHAR(150),
  position         INT,
  position_label   VARCHAR(100),
  badge_type       VARCHAR(50)  DEFAULT 'participant',
  trophy_image_url TEXT,
  awarded_at       DATETIME,
  created_date     DATETIME     DEFAULT CURRENT_TIMESTAMP
);

-- STCTransaction enum update compatibility (if type is ENUM)
-- If your `stc_transactions.type` is VARCHAR, no action is needed.
-- If it's ENUM in production, run this:
-- ALTER TABLE stc_transactions
--   MODIFY COLUMN type ENUM('purchase','transfer_fee','match_reward','fine','achievement','season_prize','salary','other');

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'matches' AND INDEX_NAME = 'idx_matches_source_fx') = 0,
  'CREATE INDEX idx_matches_source_fx ON matches(source_fixture_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'season_registrations' AND INDEX_NAME = 'idx_season_reg_club') = 0,
  'CREATE INDEX idx_season_reg_club ON season_registrations(club_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'reward_configs' AND INDEX_NAME = 'idx_reward_source') = 0,
  'CREATE INDEX idx_reward_source ON reward_configs(source_type, source_id, position)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

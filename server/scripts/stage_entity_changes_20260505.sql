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

-- Ensure inbox_messages can store invite action metadata (needed for scheduling IDs)
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'inbox_messages' AND COLUMN_NAME = 'action_type') = 0,
  'ALTER TABLE inbox_messages ADD COLUMN action_type VARCHAR(100)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'inbox_messages' AND COLUMN_NAME = 'sender_gamertag') = 0,
  'ALTER TABLE inbox_messages ADD COLUMN sender_gamertag VARCHAR(255)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'inbox_messages' AND COLUMN_NAME = 'sender_avatar_url') = 0,
  'ALTER TABLE inbox_messages ADD COLUMN sender_avatar_url TEXT',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'inbox_messages' AND COLUMN_NAME = 'sender_club_name') = 0,
  'ALTER TABLE inbox_messages ADD COLUMN sender_club_name VARCHAR(255)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'inbox_messages' AND COLUMN_NAME = 'metadata') = 0,
  'ALTER TABLE inbox_messages ADD COLUMN metadata JSON',
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
  (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'reward_configs' AND INDEX_NAME = 'idx_reward_source') = 0,
  'CREATE INDEX idx_reward_source ON reward_configs(source_type, source_id, position)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

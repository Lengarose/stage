-- Run this migration to add banner columns to players and clubs
-- mysql -u root -p stage_league < banner_migration.sql

USE stage_league;

-- players: banner_url
SET @sql = (
  SELECT IF(
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'players'
        AND column_name = 'banner_url'
    ),
    'SELECT 1',
    'ALTER TABLE players ADD COLUMN banner_url VARCHAR(500) NULL'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- players: banner_position
SET @sql = (
  SELECT IF(
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'players'
        AND column_name = 'banner_position'
    ),
    'SELECT 1',
    'ALTER TABLE players ADD COLUMN banner_position VARCHAR(50) NULL'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- players: banner_zoom
SET @sql = (
  SELECT IF(
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'players'
        AND column_name = 'banner_zoom'
    ),
    'SELECT 1',
    'ALTER TABLE players ADD COLUMN banner_zoom INT NULL'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- clubs: banner_url
SET @sql = (
  SELECT IF(
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'clubs'
        AND column_name = 'banner_url'
    ),
    'SELECT 1',
    'ALTER TABLE clubs ADD COLUMN banner_url VARCHAR(500) NULL'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- clubs: banner_position
SET @sql = (
  SELECT IF(
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'clubs'
        AND column_name = 'banner_position'
    ),
    'SELECT 1',
    'ALTER TABLE clubs ADD COLUMN banner_position VARCHAR(50) NULL'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- clubs: banner_zoom
SET @sql = (
  SELECT IF(
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'clubs'
        AND column_name = 'banner_zoom'
    ),
    'SELECT 1',
    'ALTER TABLE clubs ADD COLUMN banner_zoom INT NULL'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

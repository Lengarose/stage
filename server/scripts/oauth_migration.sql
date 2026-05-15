-- Run this migration to add OAuth + password support to existing tables
-- mysql -u root -p stage_league < oauth_migration.sql

USE stage_league;

-- Add OAuth + password columns to players (MySQL-compatible idempotent form)
SET @sql = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'players'
        AND column_name = 'password_hash'
    ),
    'SELECT 1',
    'ALTER TABLE players ADD COLUMN password_hash VARCHAR(255) DEFAULT NULL'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'players'
        AND column_name = 'oauth_provider'
    ),
    'SELECT 1',
    'ALTER TABLE players ADD COLUMN oauth_provider VARCHAR(50) DEFAULT NULL'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'players'
        AND column_name = 'oauth_id'
    ),
    'SELECT 1',
    'ALTER TABLE players ADD COLUMN oauth_id VARCHAR(255) DEFAULT NULL'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Allow email to be nullable (OAuth users may not have email)
ALTER TABLE players MODIFY COLUMN email VARCHAR(255) DEFAULT NULL;

-- Index for fast OAuth lookups
SET @sql = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'players'
        AND index_name = 'idx_players_oauth'
    ),
    'SELECT 1',
    'CREATE INDEX idx_players_oauth ON players (oauth_provider, oauth_id)'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Remove NOT NULL from auth_tokens player_id to allow system tokens (optional)
-- ALTER TABLE auth_tokens MODIFY COLUMN player_id VARCHAR(36) DEFAULT NULL;

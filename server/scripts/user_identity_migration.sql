-- Run this migration to add users + ownership links
-- mysql -u root -p stage_league < user_identity_migration.sql

USE stage_league;

CREATE TABLE IF NOT EXISTS roles (
  id            INT PRIMARY KEY,
  name          VARCHAR(100) NOT NULL UNIQUE,
  description   VARCHAR(255),
  created_date  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_date  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO roles (id, name, description) VALUES
  (1, 'player_club', 'Player/Club role'),
  (2, 'admin', 'Administrator role')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description);

CREATE TABLE IF NOT EXISTS users (
  id            VARCHAR(36) PRIMARY KEY,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255),
  role_id       INT DEFAULT 1,
  player_id     VARCHAR(36),
  owner_id      VARCHAR(36),
  created_date  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_date  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

SET @sql = (
  SELECT IF(
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'players'
        AND column_name = 'user_id'
    ),
    'SELECT 1',
    'ALTER TABLE players ADD COLUMN user_id VARCHAR(36) DEFAULT NULL'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'clubs'
        AND column_name = 'user_id'
    ),
    'SELECT 1',
    'ALTER TABLE clubs ADD COLUMN user_id VARCHAR(36) DEFAULT NULL'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Backfill users from existing players by email
INSERT INTO users (id, email, created_date, updated_date)
SELECT p.id, p.email, NOW(), NOW()
FROM players p
LEFT JOIN users u ON u.email = p.email
WHERE p.email IS NOT NULL AND p.email <> '' AND u.id IS NULL;

UPDATE players p
JOIN users u ON u.email = p.email
SET p.user_id = u.id
WHERE p.user_id IS NULL;

-- Backfill clubs.user_id from owner_email when user exists
UPDATE clubs c
JOIN users u ON u.email = c.owner_email
SET c.user_id = u.id
WHERE c.user_id IS NULL;

-- Sync pointer columns
UPDATE users u
LEFT JOIN players p ON p.user_id = u.id
LEFT JOIN clubs c ON c.user_id = u.id
SET u.player_id = p.id,
    u.owner_id = c.id,
    u.role_id = CASE
      WHEN p.id IS NOT NULL OR c.id IS NOT NULL THEN 1
      ELSE COALESCE(u.role_id, 1)
    END;


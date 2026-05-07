-- Adds missing match display name columns (safe to re-run).
USE stage_league;

SET @db := DATABASE();

-- home_player_name
SET @exists_home_player_name := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = @db AND table_name = 'matches' AND column_name = 'home_player_name'
);
SET @sql_home_player_name := IF(
  @exists_home_player_name = 0,
  'ALTER TABLE matches ADD COLUMN home_player_name VARCHAR(150) NULL AFTER away_club_name',
  'SELECT 1'
);
PREPARE stmt FROM @sql_home_player_name;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- away_player_name
SET @exists_away_player_name := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = @db AND table_name = 'matches' AND column_name = 'away_player_name'
);
SET @sql_away_player_name := IF(
  @exists_away_player_name = 0,
  'ALTER TABLE matches ADD COLUMN away_player_name VARCHAR(150) NULL AFTER home_player_name',
  'SELECT 1'
);
PREPARE stmt FROM @sql_away_player_name;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


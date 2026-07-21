-- Production readiness indexes for the high-traffic STAGE tables.
--
-- Usage:
--   mysql -u root -p stage_league < server/scripts/add_production_indexes.sql
--
-- The script is idempotent:
-- - skips indexes that already exist
-- - skips indexes when the target table or column set is missing
-- - can be re-run safely after future migrations

USE stage_league;

DROP PROCEDURE IF EXISTS add_index_if_missing;

DELIMITER $$

CREATE PROCEDURE add_index_if_missing(
  IN p_table_name VARCHAR(128),
  IN p_index_name VARCHAR(128),
  IN p_index_columns TEXT,
  IN p_required_columns TEXT
)
BEGIN
  DECLARE v_table_exists INT DEFAULT 0;
  DECLARE v_index_exists INT DEFAULT 0;
  DECLARE v_missing_columns INT DEFAULT 0;
  DECLARE v_column_name VARCHAR(128);
  DECLARE v_remaining TEXT;
  DECLARE v_comma_pos INT DEFAULT 0;
  DECLARE v_sql TEXT;

  SELECT COUNT(*)
    INTO v_table_exists
    FROM information_schema.TABLES
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = p_table_name;

  IF v_table_exists = 1 THEN
    SELECT COUNT(*)
      INTO v_index_exists
      FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = p_table_name
       AND INDEX_NAME = p_index_name;

    SET v_remaining = p_required_columns;

    WHILE v_remaining IS NOT NULL AND LENGTH(TRIM(v_remaining)) > 0 DO
      SET v_comma_pos = LOCATE(',', v_remaining);
      IF v_comma_pos = 0 THEN
        SET v_column_name = TRIM(v_remaining);
        SET v_remaining = '';
      ELSE
        SET v_column_name = TRIM(SUBSTRING(v_remaining, 1, v_comma_pos - 1));
        SET v_remaining = SUBSTRING(v_remaining, v_comma_pos + 1);
      END IF;

      IF v_column_name <> '' THEN
        IF (
          SELECT COUNT(*)
            FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE()
             AND TABLE_NAME = p_table_name
             AND COLUMN_NAME = v_column_name
        ) = 0 THEN
          SET v_missing_columns = v_missing_columns + 1;
        END IF;
      END IF;
    END WHILE;

    IF v_index_exists = 0 AND v_missing_columns = 0 THEN
      SET v_sql = CONCAT('CREATE INDEX ', p_index_name, ' ON ', p_table_name, ' (', p_index_columns, ')');
      SET @ddl = v_sql;
      PREPARE stmt FROM @ddl;
      EXECUTE stmt;
      DEALLOCATE PREPARE stmt;
    END IF;
  END IF;
END$$

DELIMITER ;

-- Match / Game Day / Schedule lookups.
CALL add_index_if_missing('matches', 'idx_matches_status_scheduled', 'status, scheduled_date', 'status,scheduled_date');
CALL add_index_if_missing('matches', 'idx_matches_home_club_status_date', 'home_club_id, status, scheduled_date', 'home_club_id,status,scheduled_date');
CALL add_index_if_missing('matches', 'idx_matches_away_club_status_date', 'away_club_id, status, scheduled_date', 'away_club_id,status,scheduled_date');
CALL add_index_if_missing('matches', 'idx_matches_home_player_status_date', 'home_player_id, status, scheduled_date', 'home_player_id,status,scheduled_date');
CALL add_index_if_missing('matches', 'idx_matches_away_player_status_date', 'away_player_id, status, scheduled_date', 'away_player_id,status,scheduled_date');
CALL add_index_if_missing('matches', 'idx_matches_tournament_status_round', 'tournament_id, status, round, group_number, scheduled_date', 'tournament_id,status,round,group_number,scheduled_date');
CALL add_index_if_missing('matches', 'idx_matches_updated_status', 'updated_date, status', 'updated_date,status');
CALL add_index_if_missing('matches', 'idx_matches_source_fixture', 'source_fixture_id', 'source_fixture_id');

-- Inbox flow.
CALL add_index_if_missing('inbox_messages', 'idx_inbox_recipient_read_created', 'recipient_email, is_read, created_date', 'recipient_email,is_read,created_date');
CALL add_index_if_missing('inbox_messages', 'idx_inbox_recipient_status_created', 'recipient_email, status, created_date', 'recipient_email,status,created_date');
CALL add_index_if_missing('inbox_messages', 'idx_inbox_related_entity', 'related_entity_type, related_entity_id', 'related_entity_type,related_entity_id');

-- Notifications.
CALL add_index_if_missing('notifications', 'idx_notifications_recipient_read_created', 'recipient_email, `read`, created_date', 'recipient_email,read,created_date');
CALL add_index_if_missing('notifications', 'idx_notifications_recipient_created', 'recipient_email, created_date', 'recipient_email,created_date');

-- Chat channels and sender moderation/account-deletion lookups.
CALL add_index_if_missing('chat_messages', 'idx_chat_match_created_id', 'match_id, created_date, id', 'match_id,created_date,id');
CALL add_index_if_missing('chat_messages', 'idx_chat_sender_created', 'sender_email, created_date', 'sender_email,created_date');

-- Tournament listing and management.
CALL add_index_if_missing('tournaments', 'idx_tournaments_status_created', 'status, created_date', 'status,created_date');
CALL add_index_if_missing('tournaments', 'idx_tournaments_status_updated', 'status, updated_date', 'status,updated_date');
CALL add_index_if_missing('tournaments', 'idx_tournaments_creator_status', 'creator_email, status', 'creator_email,status');
CALL add_index_if_missing('tournaments', 'idx_tournaments_organizer_status', 'organizer_email, status', 'organizer_email,status');
CALL add_index_if_missing('tournaments', 'idx_tournaments_status_start', 'status, start_date', 'status,start_date');
CALL add_index_if_missing('tournaments', 'idx_tournaments_type_status', 'type, status', 'type,status');

-- Player discovery, rankings, club roster and scouting.
CALL add_index_if_missing('players', 'idx_players_club_position', 'club_id, position', 'club_id,position');
CALL add_index_if_missing('players', 'idx_players_platform_position', 'platform, position', 'platform,position');
CALL add_index_if_missing('players', 'idx_players_country_rank_points', 'country_code, ranking_points', 'country_code,ranking_points');
CALL add_index_if_missing('players', 'idx_players_position_rank_points', 'position, ranking_points', 'position,ranking_points');
CALL add_index_if_missing('players', 'idx_players_region_rank_points', 'region, ranking_points', 'region,ranking_points');
CALL add_index_if_missing('players', 'idx_players_gamertag', 'gamertag', 'gamertag');
CALL add_index_if_missing('players', 'idx_players_updated', 'updated_date', 'updated_date');

-- Club discovery, rankings and owner lookups.
CALL add_index_if_missing('clubs', 'idx_clubs_platform_region', 'platform, region', 'platform,region');
CALL add_index_if_missing('clubs', 'idx_clubs_country_rank_points', 'country_code, ranking_points', 'country_code,ranking_points');
CALL add_index_if_missing('clubs', 'idx_clubs_region_rank_points', 'region, ranking_points', 'region,ranking_points');
CALL add_index_if_missing('clubs', 'idx_clubs_status_created', 'status, created_date', 'status,created_date');
CALL add_index_if_missing('clubs', 'idx_clubs_name', 'name', 'name');
CALL add_index_if_missing('clubs', 'idx_clubs_updated', 'updated_date', 'updated_date');

DROP PROCEDURE IF EXISTS add_index_if_missing;

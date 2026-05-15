-- ============================================================
-- Migration: align players, clubs, tournaments with JSONC schema
-- Safe to re-run (IF NOT EXISTS guards on every column)
-- mysql -u <user> -p <dbname> < player_club_tournament_migration.sql
-- ============================================================

USE stage_league;

-- ────────────────────────────────────────────────────────────
-- PLAYERS — add 19 missing columns
-- ────────────────────────────────────────────────────────────

SET @t='players';

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='stc'),'SELECT 1','ALTER TABLE players ADD COLUMN stc BIGINT NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='goals_player'),'SELECT 1','ALTER TABLE players ADD COLUMN goals_player INT NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='matches_played'),'SELECT 1','ALTER TABLE players ADD COLUMN matches_played INT NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='matches_played_club'),'SELECT 1','ALTER TABLE players ADD COLUMN matches_played_club INT NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='wins_count'),'SELECT 1','ALTER TABLE players ADD COLUMN wins_count INT NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='wins_club'),'SELECT 1','ALTER TABLE players ADD COLUMN wins_club INT NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='losses_count'),'SELECT 1','ALTER TABLE players ADD COLUMN losses_count INT NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='losses_club'),'SELECT 1','ALTER TABLE players ADD COLUMN losses_club INT NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='draws_count'),'SELECT 1','ALTER TABLE players ADD COLUMN draws_count INT NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='draws_club'),'SELECT 1','ALTER TABLE players ADD COLUMN draws_club INT NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='clean_sheets'),'SELECT 1','ALTER TABLE players ADD COLUMN clean_sheets INT NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='man_of_the_match'),'SELECT 1','ALTER TABLE players ADD COLUMN man_of_the_match INT NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='avg_match_rating'),'SELECT 1','ALTER TABLE players ADD COLUMN avg_match_rating DECIMAL(4,2) NULL DEFAULT 6.00'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='status'),'SELECT 1','ALTER TABLE players ADD COLUMN status VARCHAR(20) NULL DEFAULT ''active'''));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='is_verified'),'SELECT 1','ALTER TABLE players ADD COLUMN is_verified TINYINT(1) NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='subscription_expires_at'),'SELECT 1','ALTER TABLE players ADD COLUMN subscription_expires_at DATETIME NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='subscription_billing'),'SELECT 1','ALTER TABLE players ADD COLUMN subscription_billing VARCHAR(20) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='stripe_subscription_id'),'SELECT 1','ALTER TABLE players ADD COLUMN stripe_subscription_id VARCHAR(255) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='stripe_customer_id'),'SELECT 1','ALTER TABLE players ADD COLUMN stripe_customer_id VARCHAR(255) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ────────────────────────────────────────────────────────────
-- CLUBS — add 6 missing columns
-- ────────────────────────────────────────────────────────────

SET @t='clubs';

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='logo_frame_id'),'SELECT 1','ALTER TABLE clubs ADD COLUMN logo_frame_id VARCHAR(100) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='ranking_points'),'SELECT 1','ALTER TABLE clubs ADD COLUMN ranking_points INT NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='global_rank'),'SELECT 1','ALTER TABLE clubs ADD COLUMN global_rank INT NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='regional_rank'),'SELECT 1','ALTER TABLE clubs ADD COLUMN regional_rank INT NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='stadium_name'),'SELECT 1','ALTER TABLE clubs ADD COLUMN stadium_name VARCHAR(255) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='achievements'),'SELECT 1','ALTER TABLE clubs ADD COLUMN achievements JSON NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ────────────────────────────────────────────────────────────
-- TOURNAMENTS — add 33 missing columns
-- ────────────────────────────────────────────────────────────

SET @t='tournaments';

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='description'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN description TEXT NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='type'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN type VARCHAR(30) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='participant_type'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN participant_type VARCHAR(10) NULL DEFAULT ''club'''));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='platform'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN platform VARCHAR(20) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='region'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN region VARCHAR(30) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='max_teams'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN max_teams INT NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='entry_credits'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN entry_credits INT NULL DEFAULT 50'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='entry_fee_stc'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN entry_fee_stc BIGINT NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='prize_description'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN prize_description TEXT NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='prize_pool_stc'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN prize_pool_stc BIGINT NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='prize_winner_stc'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN prize_winner_stc BIGINT NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='prize_runner_up_stc'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN prize_runner_up_stc BIGINT NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='prize_semi_final_stc'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN prize_semi_final_stc BIGINT NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='prize_participation_stc'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN prize_participation_stc BIGINT NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='custom_rules'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN custom_rules TEXT NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='rules_file_url'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN rules_file_url VARCHAR(500) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='country_code'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN country_code VARCHAR(10) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='start_date'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN start_date DATETIME NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='end_date'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN end_date DATETIME NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='organizer_email'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN organizer_email VARCHAR(255) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='creator_email'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN creator_email VARCHAR(255) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='creator_id'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN creator_id VARCHAR(36) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='creator_gamertag'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN creator_gamertag VARCHAR(100) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='win_credits'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN win_credits INT NULL DEFAULT 150'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='win_credits_awarded'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN win_credits_awarded TINYINT(1) NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='total_rounds'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN total_rounds INT NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='swiss_rounds'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN swiss_rounds INT NULL DEFAULT 5'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='season'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN season VARCHAR(50) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='ucl_phase'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN ucl_phase VARCHAR(20) NULL DEFAULT ''league'''));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='banner_url'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN banner_url VARCHAR(500) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='banner_color'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN banner_color VARCHAR(20) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='banner_position'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN banner_position VARCHAR(50) NULL DEFAULT ''50% 50%'''));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='trophy_item_id'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN trophy_item_id VARCHAR(36) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

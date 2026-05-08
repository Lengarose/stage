-- Migration: Match, LiveMatch, LifestyleItem, LifestylePurchase, NewsItem alignment
-- All statements are idempotent (safe to run multiple times)

-- ============================================================
-- matches
-- ============================================================

SET @t='matches';

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='stats_processed'),'SELECT 1','ALTER TABLE matches ADD COLUMN stats_processed TINYINT(1) NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='winner_club_id'),'SELECT 1','ALTER TABLE matches ADD COLUMN winner_club_id VARCHAR(36) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='winner_club_name'),'SELECT 1','ALTER TABLE matches ADD COLUMN winner_club_name VARCHAR(100) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='winner_player_id'),'SELECT 1','ALTER TABLE matches ADD COLUMN winner_player_id VARCHAR(36) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='winner_player_name'),'SELECT 1','ALTER TABLE matches ADD COLUMN winner_player_name VARCHAR(100) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='loser_club_id'),'SELECT 1','ALTER TABLE matches ADD COLUMN loser_club_id VARCHAR(36) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='loser_club_name'),'SELECT 1','ALTER TABLE matches ADD COLUMN loser_club_name VARCHAR(100) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='loser_player_id'),'SELECT 1','ALTER TABLE matches ADD COLUMN loser_player_id VARCHAR(36) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='loser_player_name'),'SELECT 1','ALTER TABLE matches ADD COLUMN loser_player_name VARCHAR(100) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='group_number'),'SELECT 1','ALTER TABLE matches ADD COLUMN group_number INT NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='bracket_side'),'SELECT 1','ALTER TABLE matches ADD COLUMN bracket_side VARCHAR(20) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='result_home_submitted'),'SELECT 1','ALTER TABLE matches ADD COLUMN result_home_submitted TINYINT(1) NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='result_away_submitted'),'SELECT 1','ALTER TABLE matches ADD COLUMN result_away_submitted TINYINT(1) NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='home_submitted_score'),'SELECT 1','ALTER TABLE matches ADD COLUMN home_submitted_score VARCHAR(20) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='away_submitted_score'),'SELECT 1','ALTER TABLE matches ADD COLUMN away_submitted_score VARCHAR(20) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='first_submission_at'),'SELECT 1','ALTER TABLE matches ADD COLUMN first_submission_at DATETIME NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='first_submitter_club_id'),'SELECT 1','ALTER TABLE matches ADD COLUMN first_submitter_club_id VARCHAR(36) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='video_url'),'SELECT 1','ALTER TABLE matches ADD COLUMN video_url TEXT NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='proof_url'),'SELECT 1','ALTER TABLE matches ADD COLUMN proof_url TEXT NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='home_stream_url'),'SELECT 1','ALTER TABLE matches ADD COLUMN home_stream_url TEXT NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='away_stream_url'),'SELECT 1','ALTER TABLE matches ADD COLUMN away_stream_url TEXT NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='forfeit_claimed_by'),'SELECT 1','ALTER TABLE matches ADD COLUMN forfeit_claimed_by VARCHAR(36) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='forfeit_proof_url'),'SELECT 1','ALTER TABLE matches ADD COLUMN forfeit_proof_url TEXT NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='forfeit_status'),'SELECT 1','ALTER TABLE matches ADD COLUMN forfeit_status VARCHAR(20) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='admin_notes'),'SELECT 1','ALTER TABLE matches ADD COLUMN admin_notes TEXT NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='notes'),'SELECT 1','ALTER TABLE matches ADD COLUMN notes TEXT NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='wager_home_player_id'),'SELECT 1','ALTER TABLE matches ADD COLUMN wager_home_player_id VARCHAR(36) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='wager_away_player_id'),'SELECT 1','ALTER TABLE matches ADD COLUMN wager_away_player_id VARCHAR(36) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='source_fixture_id'),'SELECT 1','ALTER TABLE matches ADD COLUMN source_fixture_id VARCHAR(36) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='source_fixture_type'),'SELECT 1','ALTER TABLE matches ADD COLUMN source_fixture_type VARCHAR(30) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='competition_context'),'SELECT 1','ALTER TABLE matches ADD COLUMN competition_context VARCHAR(255) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='home_goal_events'),'SELECT 1','ALTER TABLE matches ADD COLUMN home_goal_events JSON NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='away_goal_events'),'SELECT 1','ALTER TABLE matches ADD COLUMN away_goal_events JSON NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ============================================================
-- live_matches
-- ============================================================

SET @t='live_matches';

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='home_club_name'),'SELECT 1','ALTER TABLE live_matches ADD COLUMN home_club_name VARCHAR(100) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='away_club_name'),'SELECT 1','ALTER TABLE live_matches ADD COLUMN away_club_name VARCHAR(100) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='home_player_id'),'SELECT 1','ALTER TABLE live_matches ADD COLUMN home_player_id VARCHAR(36) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='home_player_name'),'SELECT 1','ALTER TABLE live_matches ADD COLUMN home_player_name VARCHAR(100) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='away_player_id'),'SELECT 1','ALTER TABLE live_matches ADD COLUMN away_player_id VARCHAR(36) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='away_player_name'),'SELECT 1','ALTER TABLE live_matches ADD COLUMN away_player_name VARCHAR(100) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='match_type'),'SELECT 1','ALTER TABLE live_matches ADD COLUMN match_type VARCHAR(20) NULL DEFAULT ''friendly'''));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='tournament_id'),'SELECT 1','ALTER TABLE live_matches ADD COLUMN tournament_id VARCHAR(36) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='stats_processed'),'SELECT 1','ALTER TABLE live_matches ADD COLUMN stats_processed TINYINT(1) NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='home_confirmed'),'SELECT 1','ALTER TABLE live_matches ADD COLUMN home_confirmed TINYINT(1) NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='away_confirmed'),'SELECT 1','ALTER TABLE live_matches ADD COLUMN away_confirmed TINYINT(1) NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='started_at'),'SELECT 1','ALTER TABLE live_matches ADD COLUMN started_at DATETIME NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='ended_at'),'SELECT 1','ALTER TABLE live_matches ADD COLUMN ended_at DATETIME NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='home_formation'),'SELECT 1','ALTER TABLE live_matches ADD COLUMN home_formation VARCHAR(20) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='away_formation'),'SELECT 1','ALTER TABLE live_matches ADD COLUMN away_formation VARCHAR(20) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='player_or_clubs'),'SELECT 1','ALTER TABLE live_matches ADD COLUMN player_or_clubs VARCHAR(10) NULL DEFAULT ''clubs'''));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='home_lineup'),'SELECT 1','ALTER TABLE live_matches ADD COLUMN home_lineup JSON NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='away_lineup'),'SELECT 1','ALTER TABLE live_matches ADD COLUMN away_lineup JSON NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='home_ready_players'),'SELECT 1','ALTER TABLE live_matches ADD COLUMN home_ready_players JSON NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='away_ready_players'),'SELECT 1','ALTER TABLE live_matches ADD COLUMN away_ready_players JSON NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ============================================================
-- lifestyle_items
-- ============================================================

SET @t='lifestyle_items';

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='category'),'SELECT 1','ALTER TABLE lifestyle_items ADD COLUMN category VARCHAR(30) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='subcategory'),'SELECT 1','ALTER TABLE lifestyle_items ADD COLUMN subcategory VARCHAR(100) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='description'),'SELECT 1','ALTER TABLE lifestyle_items ADD COLUMN description TEXT NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='price_stc'),'SELECT 1','ALTER TABLE lifestyle_items ADD COLUMN price_stc BIGINT NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='rent_price_stc'),'SELECT 1','ALTER TABLE lifestyle_items ADD COLUMN rent_price_stc BIGINT NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='can_rent'),'SELECT 1','ALTER TABLE lifestyle_items ADD COLUMN can_rent TINYINT(1) NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='passive_income_stc'),'SELECT 1','ALTER TABLE lifestyle_items ADD COLUMN passive_income_stc BIGINT NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='passive_income_interval_days'),'SELECT 1','ALTER TABLE lifestyle_items ADD COLUMN passive_income_interval_days INT NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='image_url'),'SELECT 1','ALTER TABLE lifestyle_items ADD COLUMN image_url TEXT NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='emoji'),'SELECT 1','ALTER TABLE lifestyle_items ADD COLUMN emoji VARCHAR(10) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='tier'),'SELECT 1','ALTER TABLE lifestyle_items ADD COLUMN tier VARCHAR(20) NULL DEFAULT ''starter'''));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='max_upgrade_level'),'SELECT 1','ALTER TABLE lifestyle_items ADD COLUMN max_upgrade_level INT NULL DEFAULT 5'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='upgrade_base_cost_stc'),'SELECT 1','ALTER TABLE lifestyle_items ADD COLUMN upgrade_base_cost_stc BIGINT NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='weekly_maintenance_stc'),'SELECT 1','ALTER TABLE lifestyle_items ADD COLUMN weekly_maintenance_stc BIGINT NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='allows_multiple'),'SELECT 1','ALTER TABLE lifestyle_items ADD COLUMN allows_multiple TINYINT(1) NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='available_cities'),'SELECT 1','ALTER TABLE lifestyle_items ADD COLUMN available_cities JSON NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ============================================================
-- lifestyle_purchases
-- ============================================================

SET @t='lifestyle_purchases';

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='player_email'),'SELECT 1','ALTER TABLE lifestyle_purchases ADD COLUMN player_email VARCHAR(255) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='player_gamertag'),'SELECT 1','ALTER TABLE lifestyle_purchases ADD COLUMN player_gamertag VARCHAR(100) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='item_name'),'SELECT 1','ALTER TABLE lifestyle_purchases ADD COLUMN item_name VARCHAR(255) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='item_category'),'SELECT 1','ALTER TABLE lifestyle_purchases ADD COLUMN item_category VARCHAR(30) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='item_subcategory'),'SELECT 1','ALTER TABLE lifestyle_purchases ADD COLUMN item_subcategory VARCHAR(100) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='item_emoji'),'SELECT 1','ALTER TABLE lifestyle_purchases ADD COLUMN item_emoji VARCHAR(10) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='price_paid_stc'),'SELECT 1','ALTER TABLE lifestyle_purchases ADD COLUMN price_paid_stc BIGINT NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='purchase_type'),'SELECT 1','ALTER TABLE lifestyle_purchases ADD COLUMN purchase_type VARCHAR(20) NULL DEFAULT ''invest'''));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='monthly_rent_stc'),'SELECT 1','ALTER TABLE lifestyle_purchases ADD COLUMN monthly_rent_stc BIGINT NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='last_rent_paid_at'),'SELECT 1','ALTER TABLE lifestyle_purchases ADD COLUMN last_rent_paid_at DATETIME NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='last_passive_collected_at'),'SELECT 1','ALTER TABLE lifestyle_purchases ADD COLUMN last_passive_collected_at DATETIME NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='upgrade_level'),'SELECT 1','ALTER TABLE lifestyle_purchases ADD COLUMN upgrade_level INT NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='current_value_stc'),'SELECT 1','ALTER TABLE lifestyle_purchases ADD COLUMN current_value_stc BIGINT NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='location_city'),'SELECT 1','ALTER TABLE lifestyle_purchases ADD COLUMN location_city VARCHAR(100) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='location_country'),'SELECT 1','ALTER TABLE lifestyle_purchases ADD COLUMN location_country VARCHAR(100) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='location_emoji'),'SELECT 1','ALTER TABLE lifestyle_purchases ADD COLUMN location_emoji VARCHAR(10) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='custom_name'),'SELECT 1','ALTER TABLE lifestyle_purchases ADD COLUMN custom_name VARCHAR(255) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='weekly_maintenance_stc'),'SELECT 1','ALTER TABLE lifestyle_purchases ADD COLUMN weekly_maintenance_stc BIGINT NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='last_maintenance_paid_at'),'SELECT 1','ALTER TABLE lifestyle_purchases ADD COLUMN last_maintenance_paid_at DATETIME NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='is_defaulted'),'SELECT 1','ALTER TABLE lifestyle_purchases ADD COLUMN is_defaulted TINYINT(1) NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='upgrade_slots'),'SELECT 1','ALTER TABLE lifestyle_purchases ADD COLUMN upgrade_slots JSON NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ============================================================
-- news_items
-- ============================================================

SET @t='news_items';

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='type'),'SELECT 1','ALTER TABLE news_items ADD COLUMN type VARCHAR(30) NULL DEFAULT ''announcement'''));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='category'),'SELECT 1','ALTER TABLE news_items ADD COLUMN category VARCHAR(30) NULL DEFAULT ''general'''));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='image_url'),'SELECT 1','ALTER TABLE news_items ADD COLUMN image_url TEXT NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='club_id'),'SELECT 1','ALTER TABLE news_items ADD COLUMN club_id VARCHAR(36) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='club_name'),'SELECT 1','ALTER TABLE news_items ADD COLUMN club_name VARCHAR(100) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='club_logo_url'),'SELECT 1','ALTER TABLE news_items ADD COLUMN club_logo_url TEXT NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='player_id'),'SELECT 1','ALTER TABLE news_items ADD COLUMN player_id VARCHAR(36) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='player_name'),'SELECT 1','ALTER TABLE news_items ADD COLUMN player_name VARCHAR(100) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='player_avatar_url'),'SELECT 1','ALTER TABLE news_items ADD COLUMN player_avatar_url TEXT NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='tournament_id'),'SELECT 1','ALTER TABLE news_items ADD COLUMN tournament_id VARCHAR(36) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='tournament_name'),'SELECT 1','ALTER TABLE news_items ADD COLUMN tournament_name VARCHAR(255) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='is_featured'),'SELECT 1','ALTER TABLE news_items ADD COLUMN is_featured TINYINT(1) NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='is_global'),'SELECT 1','ALTER TABLE news_items ADD COLUMN is_global TINYINT(1) NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='transfer_fee_stc'),'SELECT 1','ALTER TABLE news_items ADD COLUMN transfer_fee_stc BIGINT NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='tags'),'SELECT 1','ALTER TABLE news_items ADD COLUMN tags JSON NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='visible_to_club_ids'),'SELECT 1','ALTER TABLE news_items ADD COLUMN visible_to_club_ids JSON NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='visible_to_player_ids'),'SELECT 1','ALTER TABLE news_items ADD COLUMN visible_to_player_ids JSON NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

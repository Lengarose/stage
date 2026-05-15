-- Migration: ChatMessage, Comment, DirectMessage, JoinRequest, InboxMessage,
--            MatchPlayerStat, Notification, PlayerContract, Post, Prediction,
--            PressArticle, PressConference, PressQuestion, STCTransaction,
--            TrophyItem, TrophyPlacement, UserPurchase
-- All statements are idempotent (safe to run multiple times)

-- ============================================================
-- chat_messages
-- ============================================================

SET @t='chat_messages';

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='channel'),'SELECT 1','ALTER TABLE chat_messages ADD COLUMN channel VARCHAR(30) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='club_id'),'SELECT 1','ALTER TABLE chat_messages ADD COLUMN club_id VARCHAR(36) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='sender_name'),'SELECT 1','ALTER TABLE chat_messages ADD COLUMN sender_name VARCHAR(100) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='sender_avatar'),'SELECT 1','ALTER TABLE chat_messages ADD COLUMN sender_avatar TEXT NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ============================================================
-- comments
-- ============================================================

SET @t='comments';

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='author_name'),'SELECT 1','ALTER TABLE comments ADD COLUMN author_name VARCHAR(100) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='author_avatar'),'SELECT 1','ALTER TABLE comments ADD COLUMN author_avatar TEXT NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ============================================================
-- direct_messages
-- ============================================================

SET @t='direct_messages';

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='sender_name'),'SELECT 1','ALTER TABLE direct_messages ADD COLUMN sender_name VARCHAR(100) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='recipient_name'),'SELECT 1','ALTER TABLE direct_messages ADD COLUMN recipient_name VARCHAR(100) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='read'),'SELECT 1','ALTER TABLE direct_messages ADD COLUMN `read` TINYINT(1) NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='media_url'),'SELECT 1','ALTER TABLE direct_messages ADD COLUMN media_url TEXT NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ============================================================
-- join_requests
-- ============================================================

SET @t='join_requests';

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='player_gamertag'),'SELECT 1','ALTER TABLE join_requests ADD COLUMN player_gamertag VARCHAR(100) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='message'),'SELECT 1','ALTER TABLE join_requests ADD COLUMN message TEXT NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ============================================================
-- inbox_messages
-- ============================================================

SET @t='inbox_messages';

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='is_system'),'SELECT 1','ALTER TABLE inbox_messages ADD COLUMN is_system TINYINT(1) NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ============================================================
-- match_player_stats
-- ============================================================

SET @t='match_player_stats';

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='player_gamertag'),'SELECT 1','ALTER TABLE match_player_stats ADD COLUMN player_gamertag VARCHAR(100) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='own_goals'),'SELECT 1','ALTER TABLE match_player_stats ADD COLUMN own_goals INT NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ============================================================
-- notifications
-- ============================================================

SET @t='notifications';

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='related_id'),'SELECT 1','ALTER TABLE notifications ADD COLUMN related_id VARCHAR(36) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ============================================================
-- player_contracts
-- ============================================================

SET @t='player_contracts';

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='games_played'),'SELECT 1','ALTER TABLE player_contracts ADD COLUMN games_played INT NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='transfer_window_id'),'SELECT 1','ALTER TABLE player_contracts ADD COLUMN transfer_window_id VARCHAR(36) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='salary_per_game_stc'),'SELECT 1','ALTER TABLE player_contracts ADD COLUMN salary_per_game_stc BIGINT NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='is_loan'),'SELECT 1','ALTER TABLE player_contracts ADD COLUMN is_loan TINYINT(1) NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='loan_return_date'),'SELECT 1','ALTER TABLE player_contracts ADD COLUMN loan_return_date DATE NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='last_salary_paid_at'),'SELECT 1','ALTER TABLE player_contracts ADD COLUMN last_salary_paid_at DATETIME NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ============================================================
-- posts
-- ============================================================

SET @t='posts';

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='tournament_id'),'SELECT 1','ALTER TABLE posts ADD COLUMN tournament_id VARCHAR(36) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='tags'),'SELECT 1','ALTER TABLE posts ADD COLUMN tags JSON NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ============================================================
-- predictions (add JSONC fields; keep legacy columns)
-- ============================================================

SET @t='predictions';

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='live_match_id'),'SELECT 1','ALTER TABLE predictions ADD COLUMN live_match_id VARCHAR(36) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='predictor_email'),'SELECT 1','ALTER TABLE predictions ADD COLUMN predictor_email VARCHAR(255) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='predictor_name'),'SELECT 1','ALTER TABLE predictions ADD COLUMN predictor_name VARCHAR(100) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='predicted_home_score'),'SELECT 1','ALTER TABLE predictions ADD COLUMN predicted_home_score INT NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='predicted_away_score'),'SELECT 1','ALTER TABLE predictions ADD COLUMN predicted_away_score INT NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='predicted_scorer_email'),'SELECT 1','ALTER TABLE predictions ADD COLUMN predicted_scorer_email VARCHAR(255) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='predicted_assist_email'),'SELECT 1','ALTER TABLE predictions ADD COLUMN predicted_assist_email VARCHAR(255) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='predicted_motm_email'),'SELECT 1','ALTER TABLE predictions ADD COLUMN predicted_motm_email VARCHAR(255) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='score_correct'),'SELECT 1','ALTER TABLE predictions ADD COLUMN score_correct TINYINT(1) NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='scorer_correct'),'SELECT 1','ALTER TABLE predictions ADD COLUMN scorer_correct TINYINT(1) NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='assist_correct'),'SELECT 1','ALTER TABLE predictions ADD COLUMN assist_correct TINYINT(1) NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='motm_correct'),'SELECT 1','ALTER TABLE predictions ADD COLUMN motm_correct TINYINT(1) NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='score_points'),'SELECT 1','ALTER TABLE predictions ADD COLUMN score_points INT NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='scorer_points'),'SELECT 1','ALTER TABLE predictions ADD COLUMN scorer_points INT NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='assist_motm_points'),'SELECT 1','ALTER TABLE predictions ADD COLUMN assist_motm_points INT NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='total_points'),'SELECT 1','ALTER TABLE predictions ADD COLUMN total_points INT NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='match_status'),'SELECT 1','ALTER TABLE predictions ADD COLUMN match_status VARCHAR(20) NULL DEFAULT ''pending'''));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ============================================================
-- press_articles
-- ============================================================

SET @t='press_articles';

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='headline'),'SELECT 1','ALTER TABLE press_articles ADD COLUMN headline VARCHAR(500) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='match_name'),'SELECT 1','ALTER TABLE press_articles ADD COLUMN match_name VARCHAR(255) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='tournament_name'),'SELECT 1','ALTER TABLE press_articles ADD COLUMN tournament_name VARCHAR(255) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='tournament_id'),'SELECT 1','ALTER TABLE press_articles ADD COLUMN tournament_id VARCHAR(36) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='photo_url'),'SELECT 1','ALTER TABLE press_articles ADD COLUMN photo_url TEXT NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='photo_position'),'SELECT 1','ALTER TABLE press_articles ADD COLUMN photo_position VARCHAR(30) NULL DEFAULT ''50%% 50%%'''));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='photo_zoom'),'SELECT 1','ALTER TABLE press_articles ADD COLUMN photo_zoom INT NULL DEFAULT 120'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='visibility'),'SELECT 1','ALTER TABLE press_articles ADD COLUMN visibility VARCHAR(20) NULL DEFAULT ''public'''));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='quotes'),'SELECT 1','ALTER TABLE press_articles ADD COLUMN quotes JSON NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='registered_clubs'),'SELECT 1','ALTER TABLE press_articles ADD COLUMN registered_clubs JSON NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ============================================================
-- press_conferences
-- ============================================================

SET @t='press_conferences';

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='context'),'SELECT 1','ALTER TABLE press_conferences ADD COLUMN context VARCHAR(30) NULL DEFAULT ''match'''));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='tournament_id'),'SELECT 1','ALTER TABLE press_conferences ADD COLUMN tournament_id VARCHAR(36) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='club_name'),'SELECT 1','ALTER TABLE press_conferences ADD COLUMN club_name VARCHAR(100) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='club_logo_url'),'SELECT 1','ALTER TABLE press_conferences ADD COLUMN club_logo_url TEXT NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='player_id'),'SELECT 1','ALTER TABLE press_conferences ADD COLUMN player_id VARCHAR(36) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='player_name'),'SELECT 1','ALTER TABLE press_conferences ADD COLUMN player_name VARCHAR(100) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='player_avatar_url'),'SELECT 1','ALTER TABLE press_conferences ADD COLUMN player_avatar_url TEXT NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='opponent_name'),'SELECT 1','ALTER TABLE press_conferences ADD COLUMN opponent_name VARCHAR(100) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='match_name'),'SELECT 1','ALTER TABLE press_conferences ADD COLUMN match_name VARCHAR(255) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='tournament_name'),'SELECT 1','ALTER TABLE press_conferences ADD COLUMN tournament_name VARCHAR(255) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ============================================================
-- press_questions
-- ============================================================

SET @t='press_questions';

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='question'),'SELECT 1','ALTER TABLE press_questions ADD COLUMN question TEXT NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='answer_a'),'SELECT 1','ALTER TABLE press_questions ADD COLUMN answer_a TEXT NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='answer_b'),'SELECT 1','ALTER TABLE press_questions ADD COLUMN answer_b TEXT NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='answer_c'),'SELECT 1','ALTER TABLE press_questions ADD COLUMN answer_c TEXT NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='answer_d'),'SELECT 1','ALTER TABLE press_questions ADD COLUMN answer_d TEXT NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ============================================================
-- stc_transactions
-- ============================================================

SET @t='stc_transactions';

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='player_id'),'SELECT 1','ALTER TABLE stc_transactions ADD COLUMN player_id VARCHAR(36) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='player_email'),'SELECT 1','ALTER TABLE stc_transactions ADD COLUMN player_email VARCHAR(255) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ============================================================
-- trophy_items
-- ============================================================

SET @t='trophy_items';

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='competition_name'),'SELECT 1','ALTER TABLE trophy_items ADD COLUMN competition_name VARCHAR(255) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='tournament_id'),'SELECT 1','ALTER TABLE trophy_items ADD COLUMN tournament_id VARCHAR(36) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='tournament_type'),'SELECT 1','ALTER TABLE trophy_items ADD COLUMN tournament_type VARCHAR(30) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='is_official'),'SELECT 1','ALTER TABLE trophy_items ADD COLUMN is_official TINYINT(1) NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='admin_only'),'SELECT 1','ALTER TABLE trophy_items ADD COLUMN admin_only TINYINT(1) NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='sort_order'),'SELECT 1','ALTER TABLE trophy_items ADD COLUMN sort_order INT NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ============================================================
-- trophy_placements
-- ============================================================

SET @t='trophy_placements';

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='trophy_image_url'),'SELECT 1','ALTER TABLE trophy_placements ADD COLUMN trophy_image_url TEXT NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='trophy_name'),'SELECT 1','ALTER TABLE trophy_placements ADD COLUMN trophy_name VARCHAR(255) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='x_percent'),'SELECT 1','ALTER TABLE trophy_placements ADD COLUMN x_percent DECIMAL(6,2) NULL DEFAULT 50'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='y_percent'),'SELECT 1','ALTER TABLE trophy_placements ADD COLUMN y_percent DECIMAL(6,2) NULL DEFAULT 50'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='scale'),'SELECT 1','ALTER TABLE trophy_placements ADD COLUMN scale DECIMAL(5,3) NULL DEFAULT 1'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='won_tournament_ids'),'SELECT 1','ALTER TABLE trophy_placements ADD COLUMN won_tournament_ids JSON NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='win_count'),'SELECT 1','ALTER TABLE trophy_placements ADD COLUMN win_count INT NULL DEFAULT 1'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ============================================================
-- user_purchases
-- ============================================================

SET @t='user_purchases';

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='buyer_email'),'SELECT 1','ALTER TABLE user_purchases ADD COLUMN buyer_email VARCHAR(255) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='item_name'),'SELECT 1','ALTER TABLE user_purchases ADD COLUMN item_name VARCHAR(255) NULL'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='price_paid'),'SELECT 1','ALTER TABLE user_purchases ADD COLUMN price_paid BIGINT NULL DEFAULT 0'));
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

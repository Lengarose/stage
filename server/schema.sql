-- Stage League — Full Database Schema
-- Run once to initialise: mysql -u root -p stage_league < schema.sql

CREATE DATABASE IF NOT EXISTS stage_league CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE stage_league;

-- ── users ─────────────────────────────────────────────────────
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
  id                    VARCHAR(36)  PRIMARY KEY,
  email                 VARCHAR(255) NOT NULL UNIQUE,
  password_hash         VARCHAR(255),
  role_id               INT          DEFAULT 1,
  player_id             VARCHAR(36),
  owner_id              VARCHAR(36),
  created_date          DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_date          DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ── players ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS players (
  id                    VARCHAR(36)  PRIMARY KEY,
  user_id               VARCHAR(36),
  email                 VARCHAR(255) NOT NULL UNIQUE,
  gamertag              VARCHAR(100),
  position              VARCHAR(50),
  platform              VARCHAR(50),
  country               VARCHAR(100),
  country_code          VARCHAR(10),
  bio                   TEXT,
  avatar_url            TEXT,
  avatar_zoom           INT          DEFAULT 150,
  avatar_position       VARCHAR(50)  DEFAULT '50% 50%',
  shirt_number          INT,
  overall_rating        DECIMAL(4,1) DEFAULT 0,
  goals                 INT          DEFAULT 0,
  assists               INT          DEFAULT 0,
  credits               INT          DEFAULT 0,
  stc                   DECIMAL(12,2) DEFAULT 0,
  subscription          VARCHAR(50)  DEFAULT 'rookie',
  role                  VARCHAR(50),
  dressing_room_seat    INT,
  is_ready              TINYINT(1)   DEFAULT 0,
  club_id               VARCHAR(36),
  notification_settings JSON,
  club_roles            JSON,
  created_date          DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_date          DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ── clubs ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clubs (
  id                  VARCHAR(36)  PRIMARY KEY,
  user_id             VARCHAR(36),
  owner_email         VARCHAR(255) NOT NULL,
  name                VARCHAR(150) NOT NULL,
  tag                 VARCHAR(20),
  platform            VARCHAR(50),
  region              VARCHAR(100),
  country_code        VARCHAR(10),
  logo_url            TEXT,
  logo_position       VARCHAR(50),
  description         TEXT,
  wins                INT          DEFAULT 0,
  losses              INT          DEFAULT 0,
  draws               INT          DEFAULT 0,
  goals_scored        INT          DEFAULT 0,
  goals_conceded      INT          DEFAULT 0,
  rating              DECIMAL(5,1) DEFAULT 0,
  peak_rating         DECIMAL(5,1) DEFAULT 0,
  matches_ranked      INT          DEFAULT 0,
  is_provisional      TINYINT(1)   DEFAULT 1,
  credits             INT          DEFAULT 0,
  stc                 DECIMAL(12,2) DEFAULT 0,
  wage_budget_stc     DECIMAL(12,2) DEFAULT 0,
  transfer_budget_stc DECIMAL(12,2) DEFAULT 0,
  stadium_level       INT          DEFAULT 1,
  stadium_capacity    INT          DEFAULT 10000,
  tier                VARCHAR(50)  DEFAULT 'bronze',
  form                VARCHAR(20),
  win_streak          INT          DEFAULT 0,
  loss_streak         INT          DEFAULT 0,
  status              VARCHAR(50)  DEFAULT 'active',
  formation           VARCHAR(20),
  lineup              JSON,
  trophies            JSON,
  created_date        DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_date        DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ── matches ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS matches (
  id                  VARCHAR(36)  PRIMARY KEY,
  home_club_id        VARCHAR(36),
  away_club_id        VARCHAR(36),
  home_player_id      VARCHAR(36),
  away_player_id      VARCHAR(36),
  home_club_name      VARCHAR(150),
  away_club_name      VARCHAR(150),
  home_player_name    VARCHAR(150),
  away_player_name    VARCHAR(150),
  home_score          INT          DEFAULT 0,
  away_score          INT          DEFAULT 0,
  status              VARCHAR(50)  DEFAULT 'scheduled',
  mode                VARCHAR(50),
  type                VARCHAR(50),
  round               INT,
  tournament_id       VARCHAR(36),
  scheduled_date      DATETIME,
  wager_stc             DECIMAL(12,2) DEFAULT 0,
  wager_status          VARCHAR(50),
  wager_home_locked     TINYINT(1)   DEFAULT 0,
  wager_away_locked     TINYINT(1)   DEFAULT 0,
  stream_url            TEXT,
  stream_embed_html     TEXT,
  competition_context   VARCHAR(255),
  -- result submission
  result_home_submitted TINYINT(1)   DEFAULT 0,
  result_away_submitted TINYINT(1)   DEFAULT 0,
  home_submission       TEXT,
  away_submission       TEXT,
  home_goal_events      TEXT,
  away_goal_events      TEXT,
  stats_processed       TINYINT(1)   DEFAULT 0,
  created_date          DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_date          DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ── tournaments ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tournaments (
  id                  VARCHAR(36)  PRIMARY KEY,
  name                VARCHAR(200) NOT NULL,
  status              VARCHAR(50)  DEFAULT 'open',
  current_round       INT          DEFAULT 0,
  num_groups          INT          DEFAULT 4,
  winner_club_id      VARCHAR(36),
  winner_club_name    VARCHAR(150),
  trophy_url          TEXT,
  registered_players  JSON,
  registered_clubs    JSON,
  created_date        DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_date        DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ── posts ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS posts (
  id                  VARCHAR(36)  PRIMARY KEY,
  author_email        VARCHAR(255) NOT NULL,
  author_name         VARCHAR(150),
  author_avatar       TEXT,
  content             TEXT,
  media_url           TEXT,
  media_cover_url     TEXT,
  media_type          VARCHAR(50),
  club_id             VARCHAR(36),
  club_name           VARCHAR(150),
  likes               JSON,
  likes_count         INT          DEFAULT 0,
  comments_count      INT          DEFAULT 0,
  created_date        DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_date        DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ── comments ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comments (
  id           VARCHAR(36)  PRIMARY KEY,
  post_id      VARCHAR(36)  NOT NULL,
  author_email VARCHAR(255) NOT NULL,
  content      TEXT         NOT NULL,
  created_date DATETIME     DEFAULT CURRENT_TIMESTAMP
);

-- ── match_player_stats ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS match_player_stats (
  id              VARCHAR(36)  PRIMARY KEY,
  match_id        VARCHAR(36)  NOT NULL,
  tournament_id   VARCHAR(36),
  club_id         VARCHAR(36),
  player_id       VARCHAR(36),
  player_email    VARCHAR(255),
  player_gamertag VARCHAR(255),
  goals           INT          DEFAULT 0,
  assists         INT          DEFAULT 0,
  rating          DECIMAL(3,1) DEFAULT 0,
  created_date    DATETIME     DEFAULT CURRENT_TIMESTAMP
);

-- ── notifications ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id              VARCHAR(36)  PRIMARY KEY,
  recipient_email VARCHAR(255) NOT NULL,
  type            VARCHAR(100),
  title           VARCHAR(255),
  body            TEXT,
  `read`          TINYINT(1)   DEFAULT 0,
  link            VARCHAR(500),
  created_date    DATETIME     DEFAULT CURRENT_TIMESTAMP
);

-- ── player_contracts ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS player_contracts (
  id                    VARCHAR(36)  PRIMARY KEY,
  team_id               VARCHAR(36)  NOT NULL,
  user_id               VARCHAR(36)  NOT NULL,
  contract_type         VARCHAR(50),
  status                VARCHAR(50)  DEFAULT 'pending',
  offered_by            VARCHAR(255),
  max_games             INT,
  max_days              INT,
  weekly_salary_stc     DECIMAL(12,2) DEFAULT 0,
  signing_bonus_stc     DECIMAL(12,2) DEFAULT 0,
  transfer_fee_stc      DECIMAL(12,2) DEFAULT 0,
  offer_note            TEXT,
  captaincy_offered     TINYINT(1)   DEFAULT 0,
  last_negotiated_by    VARCHAR(255),
  negotiation_round     INT          DEFAULT 0,
  start_date            DATETIME,
  end_date              DATETIME,
  performance_targets   JSON,
  last_salary_paid_at   DATETIME,
  created_date          DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_date          DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ── inbox_messages ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inbox_messages (
  id                  VARCHAR(36)  PRIMARY KEY,
  recipient_email     VARCHAR(255) NOT NULL,
  sender_email        VARCHAR(255),
  subject             VARCHAR(500),
  body                TEXT,
  message_type        VARCHAR(100),
  status              VARCHAR(50)  DEFAULT 'unread',
  is_read             TINYINT(1)   DEFAULT 0,
  related_entity_id   VARCHAR(36),
  related_entity_type VARCHAR(100),
  created_date        DATETIME     DEFAULT CURRENT_TIMESTAMP
);

-- ── predictions ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS predictions (
  id               VARCHAR(36)  PRIMARY KEY,
  live_match_id    VARCHAR(36)  NOT NULL,
  predictor_email  VARCHAR(255) NOT NULL,
  prediction_score VARCHAR(20),
  result           VARCHAR(50),
  created_date     DATETIME     DEFAULT CURRENT_TIMESTAMP
);

-- ── press_conferences ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS press_conferences (
  id                   VARCHAR(36) PRIMARY KEY,
  match_id             VARCHAR(36),
  club_id              VARCHAR(36),
  status               VARCHAR(50) DEFAULT 'pending',
  selected_question_ids JSON,
  answers               JSON,
  created_date          DATETIME   DEFAULT CURRENT_TIMESTAMP,
  updated_date          DATETIME   DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ── press_questions ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS press_questions (
  id         VARCHAR(36)  PRIMARY KEY,
  category   VARCHAR(100),
  text       TEXT         NOT NULL,
  sort_order INT          DEFAULT 0
);

-- ── press_articles ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS press_articles (
  id                   VARCHAR(36)  PRIMARY KEY,
  title                VARCHAR(500),
  body                 TEXT,
  club_name            VARCHAR(150),
  club_logo_url        TEXT,
  player_name          VARCHAR(150),
  player_avatar_url    TEXT,
  link                 VARCHAR(500),
  press_conference_id  VARCHAR(36),
  published_at         DATETIME     DEFAULT CURRENT_TIMESTAMP
);

-- ── direct_messages ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS direct_messages (
  id              VARCHAR(36)  PRIMARY KEY,
  conversation_id VARCHAR(36)  NOT NULL,
  sender_email    VARCHAR(255) NOT NULL,
  recipient_email VARCHAR(255) NOT NULL,
  content         TEXT         NOT NULL,
  created_date    DATETIME     DEFAULT CURRENT_TIMESTAMP
);

-- ── stc_transactions ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stc_transactions (
  id           VARCHAR(36)   PRIMARY KEY,
  club_id      VARCHAR(36)   NOT NULL,
  amount       DECIMAL(12,2) NOT NULL,
  type         VARCHAR(100),
  description  TEXT,
  reference_id VARCHAR(36),
  created_date DATETIME      DEFAULT CURRENT_TIMESTAMP
);

-- ── shirt_sales ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shirt_sales (
  id              VARCHAR(36)   PRIMARY KEY,
  player_id       VARCHAR(36)   NOT NULL,
  player_gamertag VARCHAR(100),
  shirt_number    INT,
  club_id         VARCHAR(36),
  buyer_email     VARCHAR(255),
  price_stc       DECIMAL(12,2) DEFAULT 0,
  created_date    DATETIME      DEFAULT CURRENT_TIMESTAMP
);

-- ── dressing_rooms ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dressing_rooms (
  id             VARCHAR(36) PRIMARY KEY,
  match_id       VARCHAR(36) NOT NULL,
  club_id        VARCHAR(36) NOT NULL,
  seated_players JSON,
  created_date   DATETIME    DEFAULT CURRENT_TIMESTAMP,
  updated_date   DATETIME    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ── follows ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS follows (
  id                VARCHAR(36)  PRIMARY KEY,
  follower_email    VARCHAR(255) NOT NULL,
  follower_player_id VARCHAR(36),
  target_id         VARCHAR(36)  NOT NULL,
  target_type       VARCHAR(100),
  target_name       VARCHAR(200),
  created_date      DATETIME     DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_follow (follower_email, target_id, target_type)
);

-- ── join_requests ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS join_requests (
  id           VARCHAR(36)  PRIMARY KEY,
  player_id    VARCHAR(36)  NOT NULL,
  player_email VARCHAR(255) NOT NULL,
  club_id      VARCHAR(36)  NOT NULL,
  club_name    VARCHAR(150),
  status       VARCHAR(50)  DEFAULT 'pending',
  created_date DATETIME     DEFAULT CURRENT_TIMESTAMP
);

-- ── lifestyle_items ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lifestyle_items (
  id                           VARCHAR(36)   PRIMARY KEY,
  name                         VARCHAR(200)  NOT NULL,
  is_active                    TINYINT(1)    DEFAULT 1,
  sort_order                   INT           DEFAULT 0,
  category                     VARCHAR(50)   DEFAULT 'fashion',
  subcategory                  VARCHAR(100),
  description                  TEXT,
  image_url                    VARCHAR(500),
  tier                         VARCHAR(50)   DEFAULT 'standard',
  price_stc                    BIGINT        DEFAULT 0,
  rent_price_stc               BIGINT        DEFAULT 0,
  rent_duration_days           INT           DEFAULT 30,
  invest_price_stc             BIGINT        DEFAULT 0,
  invest_return_rate           DECIMAL(5,2)  DEFAULT 0,
  invest_duration_days         INT           DEFAULT 30,
  passive_income_stc           BIGINT        DEFAULT 0,
  passive_income_interval_days INT           DEFAULT 7,
  weekly_maintenance_stc       BIGINT        DEFAULT 0,
  can_buy                      TINYINT(1)    DEFAULT 1,
  can_rent                     TINYINT(1)    DEFAULT 0,
  can_invest                   TINYINT(1)    DEFAULT 0,
  can_sell                     TINYINT(1)    DEFAULT 1,
  sell_value_percent           INT           DEFAULT 60,
  allows_multiple              TINYINT(1)    DEFAULT 1
);

-- ── lifestyle_purchases ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS lifestyle_purchases (
  id                    VARCHAR(36)  PRIMARY KEY,
  player_id             VARCHAR(36)  NOT NULL,
  player_email          VARCHAR(255),
  item_id               VARCHAR(36)  NOT NULL,
  item_type             VARCHAR(100),
  item_tier             VARCHAR(50),
  rent_active           TINYINT(1)   DEFAULT 0,
  is_residence          TINYINT(1)   DEFAULT 0,
  purchase_type         VARCHAR(20)  DEFAULT 'buy',
  price_paid_stc        BIGINT       DEFAULT 0,
  rent_end_date         DATETIME,
  invest_end_date       DATETIME,
  invest_return_amount  BIGINT       DEFAULT 0,
  status                VARCHAR(20)  DEFAULT 'active',
  current_value_stc     BIGINT       DEFAULT 0,
  upgrade_level         INT          DEFAULT 0,
  last_passive_collected DATETIME,
  base_upgrade_cost_stc BIGINT       DEFAULT 0,
  created_date          DATETIME     DEFAULT CURRENT_TIMESTAMP
);

-- ── user_purchases ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_purchases (
  id           VARCHAR(36)  PRIMARY KEY,
  buyer_email  VARCHAR(255) NOT NULL,
  item_type    VARCHAR(100),
  item_id      VARCHAR(36),
  created_date DATETIME     DEFAULT CURRENT_TIMESTAMP
);

-- ── trophy_items ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trophy_items (
  id         VARCHAR(36) PRIMARY KEY,
  name       VARCHAR(200),
  sort_order INT         DEFAULT 0
);

-- ── trophy_placements ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trophy_placements (
  id            VARCHAR(36) PRIMARY KEY,
  owner_id      VARCHAR(36) NOT NULL,
  owner_type    VARCHAR(100),
  trophy_item_id VARCHAR(36),
  position      INT         DEFAULT 0
);

-- ── chat_messages ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
  id           VARCHAR(36)  PRIMARY KEY,
  match_id     VARCHAR(36)  NOT NULL,
  sender_email VARCHAR(255) NOT NULL,
  content      TEXT         NOT NULL,
  created_date DATETIME     DEFAULT CURRENT_TIMESTAMP
);

-- ── news_items ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS news_items (
  id           VARCHAR(36)  PRIMARY KEY,
  title        VARCHAR(500) NOT NULL,
  body         TEXT,
  link         VARCHAR(500),
  published_at DATETIME     DEFAULT CURRENT_TIMESTAMP
);

-- ── live_matches ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS live_matches (
  id             VARCHAR(36) PRIMARY KEY,
  match_id       VARCHAR(36),
  home_club_id   VARCHAR(36),
  away_club_id   VARCHAR(36),
  home_score     INT         DEFAULT 0,
  away_score     INT         DEFAULT 0,
  minute         INT         DEFAULT 0,
  status         VARCHAR(50) DEFAULT 'live',
  events         JSON,
  created_date   DATETIME    DEFAULT CURRENT_TIMESTAMP,
  updated_date   DATETIME    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ── auth_tokens (refresh token store) ────────────────────────
CREATE TABLE IF NOT EXISTS auth_tokens (
  id            VARCHAR(36)  PRIMARY KEY,
  email         VARCHAR(255) NOT NULL,
  refresh_token TEXT         NOT NULL,
  created_date  DATETIME     DEFAULT CURRENT_TIMESTAMP
);

-- ── player_stc_transactions ──────────────────────────────────
CREATE TABLE IF NOT EXISTS player_stc_transactions (
  id            VARCHAR(36)    PRIMARY KEY,
  player_id     VARCHAR(36)    NOT NULL,
  player_email  VARCHAR(255),
  amount        DECIMAL(12,2)  NOT NULL,
  balance_after DECIMAL(12,2),
  type          VARCHAR(20),
  category      VARCHAR(100),
  source        VARCHAR(255),
  description   TEXT,
  reference_id  VARCHAR(36),
  created_date  DATETIME       DEFAULT CURRENT_TIMESTAMP
);

-- ── indexes ───────────────────────────────────────────────────
CREATE INDEX idx_players_club        ON players(club_id);
CREATE INDEX idx_players_email       ON players(email);
CREATE INDEX idx_players_user        ON players(user_id);
CREATE INDEX idx_clubs_owner         ON clubs(owner_email);
CREATE INDEX idx_clubs_user          ON clubs(user_id);
CREATE INDEX idx_matches_home        ON matches(home_club_id);
CREATE INDEX idx_matches_away        ON matches(away_club_id);
CREATE INDEX idx_matches_tournament  ON matches(tournament_id);
CREATE INDEX idx_posts_club          ON posts(club_id);
CREATE INDEX idx_posts_author        ON posts(author_email);
CREATE INDEX idx_comments_post       ON comments(post_id);
CREATE INDEX idx_notifications_rcpt  ON notifications(recipient_email);
CREATE INDEX idx_inbox_rcpt          ON inbox_messages(recipient_email);
CREATE INDEX idx_contracts_team      ON player_contracts(team_id);
CREATE INDEX idx_contracts_user      ON player_contracts(user_id);
CREATE INDEX idx_chat_match          ON chat_messages(match_id);
CREATE INDEX idx_stats_match         ON match_player_stats(match_id);
CREATE INDEX idx_follows_email       ON follows(follower_email);
CREATE INDEX idx_stc_club            ON stc_transactions(club_id);
CREATE INDEX idx_player_tx_player   ON player_stc_transactions(player_id);
CREATE INDEX idx_player_tx_email    ON player_stc_transactions(player_email);
CREATE INDEX idx_player_tx_category ON player_stc_transactions(category);

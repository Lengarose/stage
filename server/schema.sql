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
  role                  VARCHAR(50)  DEFAULT 'user',
  player_id             VARCHAR(36),
  owner_id              VARCHAR(36),
  access_mode           VARCHAR(32)  DEFAULT 'standard',
  limited_tournament_id VARCHAR(36),
  limited_mode_expires_at DATETIME,
  credits               INT          DEFAULT 0,
  credits_refreshed_at  DATETIME     NULL,
  timezone              VARCHAR(80)  DEFAULT 'Europe/Brussels',
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
  secondary_position    VARCHAR(50),
  -- The position the player wants to be scouted for on their showcase, which may
  -- differ from the one they currently play at their club.
  showcase_position     VARCHAR(40),
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
  subscription          VARCHAR(50)  DEFAULT 'free',
  is_verified           TINYINT(1)   DEFAULT 0,
  verified_platform     VARCHAR(50),
  verified_platform_handle VARCHAR(150),
  identity_verified_at  DATETIME,
  ranking_points        INT          DEFAULT 0,
  global_rank           INT,
  regional_rank         INT,
  country_rank          INT,
  position_rank         INT,
  ranking_matches       INT          DEFAULT 0,
  ranking_wins          INT          DEFAULT 0,
  ranking_draws         INT          DEFAULT 0,
  ranking_losses        INT          DEFAULT 0,
  ranking_win_rate      DECIMAL(5,2) DEFAULT 0,
  ranking_goals         INT          DEFAULT 0,
  ranking_assists       INT          DEFAULT 0,
  ranking_clean_sheets  INT          DEFAULT 0,
  ranking_motm          INT          DEFAULT 0,
  ranking_avg_rating    DECIMAL(4,2) DEFAULT 0,
  ranking_competition_wins INT       DEFAULT 0,
  ranking_finishes_score INT         DEFAULT 0,
  role                  VARCHAR(50),
  dressing_room_seat    INT,
  is_ready              TINYINT(1)   DEFAULT 0,
  club_id               VARCHAR(36),
  notification_settings JSON,
  club_roles            JSON,
  market_value_stc      BIGINT       DEFAULT 250000,
  matches_played        INT          DEFAULT 0,
  avg_match_rating      DECIMAL(4,2) DEFAULT 0,
  wins_count            INT          DEFAULT 0,
  man_of_the_match      INT          DEFAULT 0,
  clean_sheets          INT          DEFAULT 0,
  form_last10           TEXT         NULL,
  value_updated_at      DATETIME     NULL,
  archetype             VARCHAR(64)  NULL,
  sacrificed_at         DATETIME     NULL,
  eafc_club_id          VARCHAR(36)  NULL,
  eafc_club_name        VARCHAR(255) NULL,
  stream_url            TEXT         NULL,
  oauth_provider        VARCHAR(50)  NULL,
  oauth_id              VARCHAR(255) NULL,
  created_date          DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_date          DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ── presidents ────────────────────────────────────────────────
-- First-class president profile (like players). A club points at its
-- current president via clubs.president_id; the president points back
-- via presidents.club_id. Auth still uses clubs.president_user_id.
CREATE TABLE IF NOT EXISTS presidents (
  id                  VARCHAR(36)  PRIMARY KEY,
  user_id             VARCHAR(36)  NOT NULL,
  club_id             VARCHAR(36),
  email               VARCHAR(255),
  display_name        VARCHAR(150),
  role_title          VARCHAR(100),
  avatar_url          TEXT,
  avatar_position     VARCHAR(50)  DEFAULT '50% 50%',
  avatar_zoom         INT          DEFAULT 150,
  banner_url          VARCHAR(500),
  banner_position     VARCHAR(50),
  banner_zoom         INT,
  bio                 TEXT,
  success_level       VARCHAR(50),
  country_code        VARCHAR(10),
  quote               VARCHAR(255),
  management_style    VARCHAR(100),
  started_at          DATETIME,
  social_links        JSON,
  status              VARCHAR(50)  DEFAULT 'active',
  created_date        DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_date        DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_presidents_user (user_id),
  INDEX idx_presidents_club (club_id),
  INDEX idx_presidents_email (email)
);

-- Tenure history for presidents across clubs (shown on president profile).
CREATE TABLE IF NOT EXISTS president_club_history (
  id                  VARCHAR(36)  PRIMARY KEY,
  president_id        VARCHAR(36)  NOT NULL,
  club_id             VARCHAR(36)  NOT NULL,
  club_name           VARCHAR(150),
  started_at          DATETIME     NOT NULL,
  ended_at            DATETIME     NULL,
  reason              VARCHAR(255) NULL,
  created_date        DATETIME     DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pch_president (president_id),
  INDEX idx_pch_club (club_id),
  INDEX idx_pch_open (president_id, ended_at)
);

-- ── clubs ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clubs (
  id                  VARCHAR(36)  PRIMARY KEY,
  user_id             VARCHAR(36),
  president_user_id   VARCHAR(36) NOT NULL,
  president_id        VARCHAR(36),
  president_player_id VARCHAR(36),
  owner_email         VARCHAR(255) NOT NULL,
  name                VARCHAR(150) NOT NULL,
  tag                 VARCHAR(20),
  platform            VARCHAR(50),
  region              VARCHAR(100),
  country_code        VARCHAR(10),
  logo_url            TEXT,
  logo_position       VARCHAR(50),
  logo_zoom           INT,
  description         TEXT,
  wins                INT          DEFAULT 0,
  losses              INT          DEFAULT 0,
  draws               INT          DEFAULT 0,
  goals_scored        INT          DEFAULT 0,
  goals_conceded      INT          DEFAULT 0,
  ranking_points      INT          DEFAULT 0,
  global_rank         INT,
  regional_rank       INT,
  country_rank        INT,
  rating              DECIMAL(5,1) DEFAULT 0,
  peak_rating         DECIMAL(5,1) DEFAULT 0,
  matches_ranked      INT          DEFAULT 0,
  is_provisional      TINYINT(1)   DEFAULT 1,
  credits             INT          DEFAULT 0,
  stc                 DECIMAL(12,2) DEFAULT 2500000,
  wage_budget_stc     DECIMAL(12,2) DEFAULT 250000,
  transfer_budget_stc DECIMAL(12,2) DEFAULT 1000000,
  transfer_locked_stc DECIMAL(12,2) DEFAULT 0,
  finance_warning     VARCHAR(100)  NULL,
  stadium_level       INT          DEFAULT 0,
  stadium_capacity    INT          DEFAULT 5000,
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
  id                     VARCHAR(36)  PRIMARY KEY,
  home_club_id           VARCHAR(36),
  away_club_id           VARCHAR(36),
  home_player_id         VARCHAR(36),
  away_player_id         VARCHAR(36),
  home_club_name         VARCHAR(150),
  away_club_name         VARCHAR(150),
  home_owner_email       VARCHAR(255),
  away_owner_email       VARCHAR(255),
  home_player_name       VARCHAR(150),
  away_player_name       VARCHAR(150),
  home_player_email      VARCHAR(255),
  away_player_email      VARCHAR(255),
  home_score             INT          DEFAULT 0,
  away_score             INT          DEFAULT 0,
  status                 VARCHAR(50)  DEFAULT 'scheduled',
  mode                   VARCHAR(50),
  type                   VARCHAR(50),
  round                  INT,
  group_number           INT,
  bracket_side           VARCHAR(20),
  tournament_id          VARCHAR(36),
  scheduled_date         DATETIME,
  -- result submission
  home_goal_events       TEXT,
  away_goal_events       TEXT,
  home_submission        TEXT,
  away_submission        TEXT,
  result_home_submitted  TINYINT(1)   DEFAULT 0,
  result_away_submitted  TINYINT(1)   DEFAULT 0,
  home_submitted_score   VARCHAR(20),
  away_submitted_score   VARCHAR(20),
  first_submission_at    DATETIME,
  first_submitter_club_id VARCHAR(36),
  stats_processed        TINYINT(1)   DEFAULT 0,
  competition_context    VARCHAR(255),
  -- winner / loser
  winner_club_id         VARCHAR(36),
  winner_club_name       VARCHAR(150),
  winner_player_id       VARCHAR(36),
  winner_player_name     VARCHAR(150),
  loser_club_id          VARCHAR(36),
  loser_club_name        VARCHAR(150),
  loser_player_id        VARCHAR(36),
  loser_player_name      VARCHAR(150),
  -- media / proof / streaming
  video_url              TEXT,
  proof_url              TEXT,
  stream_url             TEXT,
  home_stream_url        TEXT,
  away_stream_url        TEXT,
  stream_embed_html      TEXT,
  -- forfeit workflow
  forfeit_claimed_by     VARCHAR(255),
  forfeit_proof_url      TEXT,
  forfeit_status         VARCHAR(50),
  -- notes
  admin_notes            TEXT,
  notes                  TEXT,
  -- admin score correction trail (the full before/after lives in admin_audit_log;
  -- these two exist so the match itself can show it was corrected by hand)
  score_corrected_at     DATETIME,
  score_corrected_by     VARCHAR(36),
  -- wagers
  wager_stc              DECIMAL(12,2) DEFAULT 0,
  wager_status           VARCHAR(50),
  wager_home_locked      TINYINT(1)   DEFAULT 0,
  wager_away_locked      TINYINT(1)   DEFAULT 0,
  wager_home_player_id   VARCHAR(36),
  wager_away_player_id   VARCHAR(36),
  -- origin (which league fixture / cup tie / friendly produced this match)
  source_fixture_id      VARCHAR(36),
  source_fixture_type    VARCHAR(50),
  -- ticket revenue (populated by stadium engine after match completion)
  home_ticket_revenue    DECIMAL(12,2) NULL,
  home_ticket_attendance INT          NULL,
  home_ticket_capacity   INT          NULL,
  home_ticket_price      DECIMAL(8,2) NULL,
  home_ticket_pct        DECIMAL(5,2) NULL,
  created_date           DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_date           DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
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
  winner_player_id    VARCHAR(36),
  winner_player_name  VARCHAR(150),
  -- Runner-up earns ranking points too (see rankingController); without this
  -- column the whole ranking query fails, not just the runner-up part.
  runner_up_club_id   VARCHAR(36),
  trophy_url          TEXT,
  registered_players  JSON,
  registered_clubs    JSON,
  registration_proofs JSON,
  created_date        DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_date        DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS international_tournaments (
  id                  VARCHAR(36) PRIMARY KEY,
  name                VARCHAR(200) NOT NULL,
  tournament_type     VARCHAR(50)  NOT NULL,
  region              VARCHAR(100) NULL,
  status              VARCHAR(40)  NOT NULL DEFAULT 'draft',
  voting_opens_at     DATETIME     NULL,
  voting_closes_at    DATETIME     NULL,
  squad_locks_at      DATETIME     NULL,
  starts_at           DATETIME     NULL,
  max_squad_size      INT          NOT NULL DEFAULT 26,
  max_teams           INT          NOT NULL DEFAULT 32,
  matchday_squad_size INT          NOT NULL DEFAULT 18,
  starters_size       INT          NOT NULL DEFAULT 11,
  bench_size          INT          NOT NULL DEFAULT 7,
  eligible_countries  JSON         NULL,
  created_by_user_id  VARCHAR(36)  NULL,
  created_by_email    VARCHAR(255) NULL,
  created_date        DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_date        DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_it_status (status),
  INDEX idx_it_type_region (tournament_type, region),
  INDEX idx_it_dates (voting_opens_at, voting_closes_at, starts_at)
);

CREATE TABLE IF NOT EXISTS national_team_elections (
  id                          VARCHAR(36) PRIMARY KEY,
  international_tournament_id VARCHAR(36) NOT NULL,
  country_code                VARCHAR(10) NOT NULL,
  country_name                VARCHAR(100) NULL,
  status                      VARCHAR(40) NOT NULL DEFAULT 'draft',
  voting_opens_at             DATETIME NULL,
  voting_closes_at            DATETIME NULL,
  winner_player_id            VARCHAR(36) NULL,
  winner_owner_user_id        VARCHAR(36) NULL,
  winner_owner_club_id        VARCHAR(36) NULL,
  winner_vote_count           INT DEFAULT 0,
  created_date                DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_date                DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_nte_tournament_country (international_tournament_id, country_code),
  INDEX idx_nte_tournament (international_tournament_id),
  INDEX idx_nte_country_status (country_code, status)
);

CREATE TABLE IF NOT EXISTS national_team_votes (
  id                  VARCHAR(36) PRIMARY KEY,
  election_id          VARCHAR(36) NOT NULL,
  tournament_id        VARCHAR(36) NOT NULL,
  country_code         VARCHAR(10) NOT NULL,
  voter_player_id      VARCHAR(36) NOT NULL,
  candidate_player_id  VARCHAR(36) NOT NULL,
  voter_owner_club_id  VARCHAR(36) NULL,
  candidate_owner_club_id VARCHAR(36) NULL,
  candidate_owner_user_id VARCHAR(36) NULL,
  created_date         DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_ntv_election_voter (election_id, voter_player_id),
  INDEX idx_ntv_election_candidate (election_id, candidate_player_id),
  INDEX idx_ntv_tournament_country (tournament_id, country_code)
);

CREATE TABLE IF NOT EXISTS national_team_representatives (
  id                  VARCHAR(36) PRIMARY KEY,
  tournament_id        VARCHAR(36) NOT NULL,
  election_id          VARCHAR(36) NOT NULL,
  country_code         VARCHAR(10) NOT NULL,
  player_id            VARCHAR(36) NOT NULL,
  owner_user_id         VARCHAR(36) NULL,
  owner_club_id         VARCHAR(36) NULL,
  vote_count           INT DEFAULT 0,
  status               VARCHAR(40) DEFAULT 'active',
  created_date         DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_ntr_tournament_country (tournament_id, country_code),
  INDEX idx_ntr_player (player_id),
  INDEX idx_ntr_election (election_id)
);

CREATE TABLE IF NOT EXISTS national_team_squads (
  id                     VARCHAR(36) PRIMARY KEY,
  tournament_id           VARCHAR(36) NOT NULL,
  country_code            VARCHAR(10) NOT NULL,
  representative_id       VARCHAR(36) NULL,
  status                  VARCHAR(40) DEFAULT 'draft',
  locked_at               DATETIME NULL,
  submitted_by_player_id  VARCHAR(36) NULL,
  submitted_by_owner_user_id VARCHAR(36) NULL,
  created_date            DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_date            DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_nts_tournament_country (tournament_id, country_code),
  INDEX idx_nts_rep (representative_id),
  INDEX idx_nts_status (status)
);

CREATE TABLE IF NOT EXISTS national_team_squad_players (
  id                  VARCHAR(36) PRIMARY KEY,
  squad_id             VARCHAR(36) NOT NULL,
  tournament_id        VARCHAR(36) NOT NULL,
  country_code         VARCHAR(10) NOT NULL,
  player_id            VARCHAR(36) NOT NULL,
  position             VARCHAR(50) NULL,
  overall_rating       DECIMAL(4,1) DEFAULT 0,
  created_date         DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_ntsp_squad_player (squad_id, player_id),
  INDEX idx_ntsp_tournament_country (tournament_id, country_code),
  INDEX idx_ntsp_player (player_id)
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
  media_position      VARCHAR(50),
  media_zoom          INT          DEFAULT 100,
  media_aspect        VARCHAR(30)  DEFAULT 'square',
  club_id             VARCHAR(36),
  club_name           VARCHAR(150),
  tournament_id       VARCHAR(36),
  likes               JSON,
  likes_count         INT          DEFAULT 0,
  comments_count      INT          DEFAULT 0,
  tags                JSON,
  created_date        DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_date        DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS post_likes (
  id           VARCHAR(36)  PRIMARY KEY,
  post_id      VARCHAR(36)  NOT NULL,
  user_email   VARCHAR(255) NOT NULL,
  created_date DATETIME     DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_post_likes_post_user (post_id, user_email),
  INDEX idx_post_likes_post (post_id)
);

-- ── comments ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comments (
  id           VARCHAR(36)  PRIMARY KEY,
  post_id      VARCHAR(36)  NOT NULL,
  author_email VARCHAR(255) NOT NULL,
  author_name  VARCHAR(100),
  author_avatar TEXT,
  content      TEXT         NOT NULL,
  created_date DATETIME     DEFAULT CURRENT_TIMESTAMP
);

-- ── match_player_stats ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS match_player_stats (
  id             VARCHAR(36)  PRIMARY KEY,
  match_id       VARCHAR(36)  NOT NULL,
  tournament_id  VARCHAR(36),
  club_id        VARCHAR(36),
  player_id      VARCHAR(36),
  player_email   VARCHAR(255) NOT NULL,
  player_gamertag VARCHAR(255),
  position       VARCHAR(50),
  goals          INT          DEFAULT 0,
  assists        INT          DEFAULT 0,
  clean_sheet    TINYINT(1)   DEFAULT 0,
  is_motm        TINYINT(1)   DEFAULT 0,
  rating         DECIMAL(3,1) DEFAULT 0,
  created_date   DATETIME     DEFAULT CURRENT_TIMESTAMP
);

-- ── player_fut_matches ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS player_fut_matches (
  id             VARCHAR(36)  PRIMARY KEY,
  player_id      VARCHAR(36)  NOT NULL,
  player_email   VARCHAR(255) NULL,
  played_at      DATETIME     NOT NULL,
  result         VARCHAR(10)  NOT NULL,
  goals_for      INT          DEFAULT 0,
  goals_against  INT          DEFAULT 0,
  mode           VARCHAR(50)  DEFAULT 'rivals',
  opponent_note  VARCHAR(255) NULL,
  notes          TEXT         NULL,
  proof_url      TEXT         NULL,
  created_date   DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_date   DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_fut_match_player (player_id),
  INDEX idx_fut_match_played (played_at)
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
  related_id      VARCHAR(36),
  idempotency_key VARCHAR(190),
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
  offered_by_user_id    VARCHAR(36) NULL,
  offered_by_club_id    VARCHAR(36) NULL,
  offered_by_president_id VARCHAR(36) NULL,
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
  created_date          DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_date          DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ── player_identity_claims ───────────────────────────────────
CREATE TABLE IF NOT EXISTS player_identity_claims (
  id                    VARCHAR(36)  PRIMARY KEY,
  player_id             VARCHAR(36)  NOT NULL,
  user_id               VARCHAR(36),
  email                 VARCHAR(255),
  gamertag              VARCHAR(150),
  platform              VARCHAR(50)  NOT NULL,
  platform_handle       VARCHAR(150) NOT NULL,
  ea_id                 VARCHAR(150),
  discord_handle        VARCHAR(150),
  proof_url             TEXT,
  notes                 TEXT,
  status                VARCHAR(30)  NOT NULL DEFAULT 'pending',
  review_notes          TEXT,
  rejection_reason      TEXT,
  reviewed_by           VARCHAR(36),
  reviewed_by_email     VARCHAR(255),
  reviewed_at           DATETIME,
  created_date          DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_date          DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ── inbox_messages ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inbox_messages (
  id                  VARCHAR(36)  PRIMARY KEY,
  recipient_email     VARCHAR(255) NOT NULL,
  sender_email        VARCHAR(255),
  sender_gamertag     VARCHAR(100),
  sender_avatar_url   TEXT,
  sender_club_name    VARCHAR(150),
  subject             VARCHAR(500),
  body                TEXT,
  message_type        VARCHAR(100),
  action_type         VARCHAR(100),
  status              VARCHAR(50)  DEFAULT 'unread',
  is_read             TINYINT(1)   DEFAULT 0,
  is_system           TINYINT(1)   DEFAULT 0,
  metadata            JSON,
  related_entity_id   VARCHAR(36),
  related_entity_type VARCHAR(100),
  idempotency_key     VARCHAR(190),
  created_date        DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_date        DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
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
  id            VARCHAR(36)   PRIMARY KEY,
  player_id     VARCHAR(36)   NULL,
  player_email  VARCHAR(255)  NULL,
  club_id       VARCHAR(36)   NULL,
  amount        DECIMAL(12,2) NOT NULL,
  balance_after DECIMAL(12,2) NULL,
  type          VARCHAR(100),
  category      VARCHAR(100)  NULL,
  description   TEXT,
  related_entity_type VARCHAR(100) NULL,
  related_entity_id VARCHAR(36) NULL,
  reference_id  VARCHAR(36),
  created_date  DATETIME      DEFAULT CURRENT_TIMESTAMP
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

-- ── recruitment_posts ────────────────────────────────────────
-- FROZEN. The recruitment board was replaced by club scouting (scouting_reports).
-- Nothing writes these two tables any more; they are kept only so existing rows
-- stay readable and recoverable. Deleting them is a separate, deliberate decision.
CREATE TABLE IF NOT EXISTS recruitment_posts (
  id                  VARCHAR(36) PRIMARY KEY,
  author_user_id      VARCHAR(36),
  author_player_id    VARCHAR(36),
  author_club_id      VARCHAR(36),
  post_type           VARCHAR(30) NOT NULL,
  title               VARCHAR(255) NOT NULL,
  body                TEXT,
  positions_needed    JSON,
  preferred_positions JSON,
  platform            VARCHAR(50),
  region              VARCHAR(100),
  availability_text   VARCHAR(255),
  discord_handle      VARCHAR(150),
  mic_required        TINYINT(1) DEFAULT 0,
  verified_only       TINYINT(1) DEFAULT 0,
  status              VARCHAR(30) DEFAULT 'open',
  expires_at          DATETIME,
  created_date        DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_date        DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ── recruitment_interests ────────────────────────────────────
CREATE TABLE IF NOT EXISTS recruitment_interests (
  id                   VARCHAR(36) PRIMARY KEY,
  recruitment_post_id  VARCHAR(36) NOT NULL,
  sender_user_id       VARCHAR(36),
  sender_player_id     VARCHAR(36),
  sender_club_id       VARCHAR(36),
  recipient_user_id    VARCHAR(36),
  recipient_player_id  VARCHAR(36),
  recipient_club_id    VARCHAR(36),
  message              TEXT,
  status               VARCHAR(30) DEFAULT 'pending',
  created_date         DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_date         DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ── player_showcase_videos ───────────────────────────────────
-- A player's own shop window: clips they publish so clubs can judge how they
-- play. Owned by the player, not by whoever scouts them — a scout can only look.
-- Public, like the rest of the profile: the point is to be found.
CREATE TABLE IF NOT EXISTS player_showcase_videos (
  id           VARCHAR(36) PRIMARY KEY,
  player_id    VARCHAR(36) NOT NULL,
  url          TEXT NOT NULL,
  title        VARCHAR(120),
  description  VARCHAR(500),
  duration_seconds DECIMAL(5,2),
  likes_count INT DEFAULT 0,
  comments_count INT DEFAULT 0,
  sort_order   INT DEFAULT 0,
  created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_date DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS player_showcase_video_likes (
  id         VARCHAR(36) PRIMARY KEY,
  video_id   VARCHAR(36) NOT NULL,
  user_email VARCHAR(255) NOT NULL,
  created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_psv_likes_video_user (video_id, user_email),
  INDEX idx_psv_likes_video (video_id)
);

CREATE TABLE IF NOT EXISTS player_showcase_video_comments (
  id                VARCHAR(36) PRIMARY KEY,
  video_id          VARCHAR(36) NOT NULL,
  author_email      VARCHAR(255) NOT NULL,
  author_player_id  VARCHAR(36),
  author_name       VARCHAR(150),
  author_avatar_url TEXT,
  content           TEXT NOT NULL,
  created_date      DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_psv_comments_video (video_id)
);

-- ── scouting_reports ─────────────────────────────────────────
-- A club member ("scout") flags a player they think the club should sign, with
-- video links as evidence. Private to the club: only members of `club_id` may
-- read or write its reports. `target_player_id` may be any player on the
-- platform, including one already under contract elsewhere — contract rules are
-- enforced later, when an offer is actually sent, not at scouting time.
CREATE TABLE IF NOT EXISTS scouting_reports (
  id                   VARCHAR(36) PRIMARY KEY,
  club_id              VARCHAR(36) NOT NULL,
  scouted_by_player_id VARCHAR(36),
  scouted_by_user_id   VARCHAR(36),
  target_player_id     VARCHAR(36) NOT NULL,
  video_links          JSON,
  notes                TEXT,
  status               VARCHAR(30) DEFAULT 'open',
  -- Consultative member vote: {"<player_id>": "for" | "against"}. Keyed by player
  -- so one member holds exactly one vote and re-voting overwrites rather than
  -- accumulates. Written with JSON_SET so simultaneous voters can't clobber each
  -- other. Advisory only — the president's decision is never gated on the tally.
  votes                JSON,
  -- The contract offer this report led to, if the president signed off. The
  -- scouting pipeline stops here: what happens to that offer afterwards is the
  -- ordinary contract flow's business, not ours.
  offered_contract_id  VARCHAR(36),
  created_date         DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_date         DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ── club_applicants ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS club_applicants (
  id                 VARCHAR(36) PRIMARY KEY,
  club_id            VARCHAR(36) NOT NULL,
  player_id          VARCHAR(36),
  user_id            VARCHAR(36),
  source_type        VARCHAR(40) DEFAULT 'manual',
  source_id          VARCHAR(36),
  status             VARCHAR(40) DEFAULT 'new',
  preferred_position VARCHAR(40),
  platform           VARCHAR(50),
  message            TEXT,
  notes              TEXT,
  created_date       DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_date       DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ca_source (source_type, source_id)
);

-- ── club_memberships ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS club_memberships (
  id            VARCHAR(36) PRIMARY KEY,
  club_id       VARCHAR(36) NOT NULL,
  player_id     VARCHAR(36) NOT NULL,
  user_id       VARCHAR(36),
  status        VARCHAR(30) DEFAULT 'active',
  primary_role  VARCHAR(40) DEFAULT 'member',
  source        VARCHAR(40) DEFAULT 'manual',
  created_date  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_date  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_cm_player_club (club_id, player_id),
  INDEX idx_cm_club_status (club_id, status),
  INDEX idx_cm_player_status (player_id, status),
  INDEX idx_cm_user_status (user_id, status)
);

-- ── club_staff_roles ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS club_staff_roles (
  id                  VARCHAR(36) PRIMARY KEY,
  club_id             VARCHAR(36) NOT NULL,
  player_id           VARCHAR(36) NOT NULL,
  user_id             VARCHAR(36),
  role                VARCHAR(40) NOT NULL,
  permissions         JSON,
  assigned_by_user_id VARCHAR(36),
  created_date        DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_date        DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_csr_role (club_id, player_id, role)
);

-- ── club_fixture_availability ────────────────────────────────
CREATE TABLE IF NOT EXISTS club_fixture_availability (
  id           VARCHAR(36) PRIMARY KEY,
  club_id      VARCHAR(36) NOT NULL,
  fixture_id   VARCHAR(36) NOT NULL,
  fixture_type VARCHAR(50),
  player_id    VARCHAR(36) NOT NULL,
  user_id      VARCHAR(36),
  status       VARCHAR(30) DEFAULT 'no_response',
  note         TEXT,
  created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_date DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_cfa_player_fixture (club_id, fixture_id, player_id)
);

-- ── club_fixture_lineups ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS club_fixture_lineups (
  id                 VARCHAR(36) PRIMARY KEY,
  club_id            VARCHAR(36) NOT NULL,
  fixture_id         VARCHAR(36) NOT NULL,
  fixture_type       VARCHAR(50),
  formation          VARCHAR(50),
  starting_players   JSON,
  bench_players      JSON,
  captain_player_id  VARCHAR(36),
  notes              TEXT,
  status             VARCHAR(30) DEFAULT 'draft',
  created_by_user_id VARCHAR(36),
  created_date       DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_date       DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_cfl_fixture (club_id, fixture_id)
);

-- ── club_operation_audit_logs ────────────────────────────────
CREATE TABLE IF NOT EXISTS club_operation_audit_logs (
  id            VARCHAR(36) PRIMARY KEY,
  club_id       VARCHAR(36) NOT NULL,
  actor_user_id VARCHAR(36),
  actor_email   VARCHAR(255),
  action        VARCHAR(100) NOT NULL,
  entity_type   VARCHAR(100),
  entity_id     VARCHAR(36),
  old_value     JSON,
  new_value     JSON,
  reason        TEXT,
  created_date  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── lifestyle_items ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lifestyle_items (
  id                           VARCHAR(36)  PRIMARY KEY,
  name                         VARCHAR(200) NOT NULL,
  category                     VARCHAR(50)  DEFAULT 'fashion',
  subcategory                  VARCHAR(100),
  description                  TEXT,
  image_url                    VARCHAR(500),
  emoji                        VARCHAR(10)  DEFAULT '',
  available_cities             JSON,
  tier                         VARCHAR(50)  DEFAULT 'standard',
  price_stc                    BIGINT       DEFAULT 0,
  rent_price_stc               BIGINT       DEFAULT 0,
  rent_duration_days           INT          DEFAULT 30,
  invest_price_stc             BIGINT       DEFAULT 0,
  invest_return_rate           DECIMAL(5,2) DEFAULT 0,
  invest_duration_days         INT          DEFAULT 30,
  passive_income_stc           BIGINT       DEFAULT 0,
  passive_income_interval_days INT          DEFAULT 7,
  weekly_maintenance_stc       BIGINT       DEFAULT 0,
  max_upgrade_level            INT          DEFAULT 0,
  upgrade_base_cost_stc        BIGINT       DEFAULT 0,
  can_buy                      TINYINT(1)   DEFAULT 1,
  can_rent                     TINYINT(1)   DEFAULT 0,
  can_invest                   TINYINT(1)   DEFAULT 0,
  can_sell                     TINYINT(1)   DEFAULT 1,
  sell_value_percent           INT          DEFAULT 60,
  allows_multiple              TINYINT(1)   DEFAULT 1,
  is_active                    TINYINT(1)   DEFAULT 1,
  sort_order                   INT          DEFAULT 0
);

-- ── lifestyle_purchases ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS lifestyle_purchases (
  id                         VARCHAR(36)  PRIMARY KEY,
  player_id                  VARCHAR(36)  NOT NULL,
  player_email               VARCHAR(255),
  player_gamertag            VARCHAR(100),
  item_id                    VARCHAR(36)  NOT NULL,
  item_name                  VARCHAR(255),
  item_category              VARCHAR(50),
  item_subcategory           VARCHAR(100),
  item_emoji                 VARCHAR(10),
  item_type                  VARCHAR(100),
  item_tier                  VARCHAR(50),
  purchase_type              VARCHAR(20)  DEFAULT 'buy',
  price_paid_stc             BIGINT       DEFAULT 0,
  rent_end_date              DATETIME,
  invest_end_date            DATETIME,
  invest_return_amount       BIGINT       DEFAULT 0,
  current_value_stc          BIGINT       DEFAULT 0,
  monthly_rent_stc           BIGINT       DEFAULT 0,
  weekly_maintenance_stc     BIGINT       DEFAULT 0,
  last_rent_paid_at          DATETIME,
  last_passive_collected_at  DATETIME,
  last_maintenance_paid_at   DATETIME,
  is_defaulted               TINYINT(1)   DEFAULT 0,
  upgrade_slots              JSON,
  location_city              VARCHAR(120),
  location_country           VARCHAR(120),
  location_emoji             VARCHAR(10),
  custom_name                VARCHAR(255),
  rent_active                TINYINT(1)   DEFAULT 0,
  is_residence               TINYINT(1)   DEFAULT 0,
  status                     VARCHAR(20)  DEFAULT 'active',
  last_passive_collected     DATETIME,
  upgrade_level              INT          DEFAULT 0,
  base_upgrade_cost_stc      BIGINT       DEFAULT 0,
  created_date               DATETIME     DEFAULT CURRENT_TIMESTAMP
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
  id                  VARCHAR(36)  PRIMARY KEY,
  name                VARCHAR(200),
  description         TEXT         NULL,
  image_url           TEXT         NULL,
  competition_name    VARCHAR(255) NULL,
  tournament_id       VARCHAR(36)  NULL,
  tournament_type     VARCHAR(30)  NULL,
  is_official         TINYINT(1)   NULL DEFAULT 0,
  rarity              VARCHAR(20)  NULL DEFAULT 'common',
  admin_only          TINYINT(1)   NULL DEFAULT 0,
  sort_order          INT          NULL DEFAULT 0,
  price               INT          NULL DEFAULT 0,
  linked_source_type  VARCHAR(50)  NULL,
  linked_source_id    VARCHAR(36)  NULL,
  linked_source_name  VARCHAR(255) NULL,
  created_date        DATETIME     NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── trophy_placements ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trophy_placements (
  id            VARCHAR(36) PRIMARY KEY,
  owner_id      VARCHAR(36) NOT NULL,
  owner_type    VARCHAR(100),
  trophy_item_id VARCHAR(36),
  position      INT         DEFAULT 0,
  created_date  DATETIME    DEFAULT CURRENT_TIMESTAMP,
  updated_date  DATETIME    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ── chat_messages ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
  id           VARCHAR(36)  PRIMARY KEY,
  -- VARCHAR(64) to support namespaced channels like `club:<uuid>` (not just match UUIDs).
  match_id     VARCHAR(64)  NOT NULL,
  sender_email VARCHAR(255) NOT NULL,
  content      TEXT         NOT NULL,
  created_date DATETIME     DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_chat_messages_match_created (match_id, created_date)
);

-- ── chat_reads — per-user last-read marker per chat channel ─────────
CREATE TABLE IF NOT EXISTS chat_reads (
  id            VARCHAR(36)  PRIMARY KEY,
  user_email    VARCHAR(255) NOT NULL,
  channel_id    VARCHAR(64)  NOT NULL,
  last_read_at  DATETIME     NOT NULL,
  created_date  DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_date  DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_chat_reads_user_channel (user_email, channel_id),
  INDEX idx_chat_reads_user (user_email)
);

-- ── processed_stripe_sessions ─────────────────────────────────
-- Idempotency guard: a Stripe checkout session is fulfilled exactly once,
-- whether the webhook or the client-return path reports it first.
CREATE TABLE IF NOT EXISTS processed_stripe_sessions (
  session_id    VARCHAR(255) NOT NULL,
  kind          VARCHAR(32)  NOT NULL,
  processed_at  DATETIME     NOT NULL,
  PRIMARY KEY (session_id, kind)
);

-- ── news_items ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS news_items (
  id                    VARCHAR(36)   PRIMARY KEY,
  type                  VARCHAR(30)   NULL DEFAULT 'announcement',
  category              VARCHAR(30)   NULL DEFAULT 'general',
  title                 VARCHAR(500)  NOT NULL,
  body                  TEXT,
  image_url             TEXT,
  club_id               VARCHAR(36)   NULL,
  club_name             VARCHAR(100)  NULL,
  club_logo_url         TEXT,
  player_id             VARCHAR(36)   NULL,
  player_name           VARCHAR(100)  NULL,
  player_avatar_url     TEXT,
  tournament_id         VARCHAR(36)   NULL,
  tournament_name       VARCHAR(255)  NULL,
  is_featured           TINYINT(1)    NULL DEFAULT 0,
  is_global             TINYINT(1)    NULL DEFAULT 0,
  published_at          DATETIME      DEFAULT CURRENT_TIMESTAMP,
  link                  VARCHAR(500),
  transfer_fee_stc      BIGINT        NULL DEFAULT 0,
  tags                  JSON          NULL,
  visible_to_club_ids   JSON          NULL,
  visible_to_player_ids JSON          NULL
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

-- ── unified competition engine ───────────────────────────────
CREATE TABLE IF NOT EXISTS competition_instances (
  id                  VARCHAR(36) PRIMARY KEY,
  product_type        VARCHAR(50) NOT NULL,
  legacy_source_type  VARCHAR(50) NOT NULL,
  legacy_source_id    VARCHAR(36) NOT NULL,
  name                VARCHAR(150) NOT NULL,
  slug                VARCHAR(180),
  region              VARCHAR(80),
  platform            VARCHAR(50),
  status              VARCHAR(50) DEFAULT 'draft',
  starts_at           DATETIME,
  ends_at             DATETIME,
  created_by_user_id  VARCHAR(36),
  created_date        DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_date        DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_comp_instances_source (product_type, legacy_source_type, legacy_source_id),
  INDEX idx_comp_instances_status (product_type, status, starts_at),
  INDEX idx_comp_instances_region (region, platform, status)
);

CREATE TABLE IF NOT EXISTS competition_participants (
  id                       VARCHAR(36) PRIMARY KEY,
  competition_instance_id  VARCHAR(36) NOT NULL,
  participant_type         VARCHAR(20) NOT NULL,
  club_id                  VARCHAR(36),
  player_id                VARCHAR(36),
  user_id                  VARCHAR(36),
  status                   VARCHAR(50) DEFAULT 'pending',
  seed                     INT,
  registered_at            DATETIME,
  approved_at              DATETIME,
  created_date             DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_date             DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_comp_participant_club (competition_instance_id, participant_type, club_id),
  UNIQUE KEY uq_comp_participant_player (competition_instance_id, participant_type, player_id),
  INDEX idx_comp_participants_club (club_id, status),
  INDEX idx_comp_participants_player (player_id, status),
  INDEX idx_comp_participants_instance (competition_instance_id, status, seed)
);

CREATE TABLE IF NOT EXISTS competition_fixtures (
  id                       VARCHAR(36) PRIMARY KEY,
  competition_instance_id  VARCHAR(36) NOT NULL,
  legacy_fixture_type      VARCHAR(50),
  legacy_fixture_id        VARCHAR(36),
  match_id                 VARCHAR(36),
  participant_type         VARCHAR(20) NOT NULL,
  format                   VARCHAR(50),
  phase                    VARCHAR(50),
  round                    INT,
  matchday                 INT,
  group_number             INT,
  tie_id                   VARCHAR(36),
  leg                      INT,
  bracket_side             VARCHAR(20),
  home_participant_id      VARCHAR(36),
  away_participant_id      VARCHAR(36),
  home_club_id             VARCHAR(36),
  home_club_name           VARCHAR(150),
  home_owner_email         VARCHAR(255),
  away_club_id             VARCHAR(36),
  away_club_name           VARCHAR(150),
  away_owner_email         VARCHAR(255),
  player_home_id           VARCHAR(36),
  player_home_gamertag     VARCHAR(150),
  player_home_email        VARCHAR(255),
  player_away_id           VARCHAR(36),
  player_away_gamertag     VARCHAR(150),
  player_away_email        VARCHAR(255),
  status                   VARCHAR(50) DEFAULT 'unscheduled',
  scheduling_status        VARCHAR(50) DEFAULT 'open',
  window_start             DATETIME,
  window_end               DATETIME,
  scheduled_at             DATETIME,
  confirmed_at             DATETIME,
  home_score               INT,
  away_score               INT,
  winner_participant_id    VARCHAR(36),
  stats_processed          TINYINT(1) DEFAULT 0,
  idempotency_key          VARCHAR(190),
  created_date             DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_date             DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_comp_fixture_legacy (legacy_fixture_type, legacy_fixture_id),
  UNIQUE KEY uq_comp_fixture_match (match_id),
  UNIQUE KEY uq_comp_fixture_idempotency (idempotency_key),
  INDEX idx_comp_fixtures_schedule (competition_instance_id, status, scheduled_at),
  INDEX idx_comp_fixtures_round (competition_instance_id, phase, round, group_number),
  INDEX idx_comp_fixtures_home (home_participant_id, status),
  INDEX idx_comp_fixtures_away (away_participant_id, status),
  INDEX idx_comp_fixtures_window (scheduling_status, window_end)
);

CREATE TABLE IF NOT EXISTS competition_schedule_proposals (
  id                         VARCHAR(36) PRIMARY KEY,
  fixture_id                 VARCHAR(36) NOT NULL,
  proposer_participant_id    VARCHAR(36),
  recipient_participant_id   VARCHAR(36),
  proposed_at                DATETIME DEFAULT CURRENT_TIMESTAMP,
  proposed_for               DATETIME NOT NULL,
  status                     VARCHAR(50) DEFAULT 'pending',
  message_id                 VARCHAR(36),
  notification_id            VARCHAR(36),
  idempotency_key            VARCHAR(190),
  created_date               DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_comp_schedule_idempotency (idempotency_key),
  INDEX idx_comp_schedule_fixture (fixture_id, status, created_date),
  INDEX idx_comp_schedule_recipient (recipient_participant_id, status)
);

CREATE TABLE IF NOT EXISTS competition_result_submissions (
  id                    VARCHAR(36) PRIMARY KEY,
  fixture_id            VARCHAR(36) NOT NULL,
  match_id              VARCHAR(36),
  side                  VARCHAR(10) NOT NULL,
  submitted_by_user_id  VARCHAR(36),
  score_home            INT NOT NULL,
  score_away            INT NOT NULL,
  payload_json          JSON,
  proof_url             VARCHAR(500),
  idempotency_key       VARCHAR(190),
  created_date          DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_comp_result_match_side (match_id, side),
  UNIQUE KEY uq_comp_result_fixture_side (fixture_id, side),
  UNIQUE KEY uq_comp_result_idempotency (idempotency_key),
  INDEX idx_comp_result_fixture (fixture_id, created_date)
);

CREATE TABLE IF NOT EXISTS competition_standings (
  competition_instance_id  VARCHAR(36) NOT NULL,
  participant_id           VARCHAR(36) NOT NULL,
  played                   INT DEFAULT 0,
  wins                     INT DEFAULT 0,
  draws                    INT DEFAULT 0,
  losses                   INT DEFAULT 0,
  goals_for                INT DEFAULT 0,
  goals_against            INT DEFAULT 0,
  goal_difference          INT DEFAULT 0,
  points                   INT DEFAULT 0,
  rank                     INT,
  final_position           INT,
  is_promoted              TINYINT(1) DEFAULT 0,
  is_relegated             TINYINT(1) DEFAULT 0,
  is_eliminated            TINYINT(1) DEFAULT 0,
  updated_date             DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (competition_instance_id, participant_id),
  INDEX idx_comp_standings_rank (competition_instance_id, rank),
  INDEX idx_comp_standings_participant (participant_id)
);

CREATE TABLE IF NOT EXISTS competition_phase_states (
  id                       VARCHAR(36) PRIMARY KEY,
  competition_instance_id  VARCHAR(36) NOT NULL,
  format                   VARCHAR(50),
  phase                    VARCHAR(50) NOT NULL,
  round                    INT DEFAULT 1,
  status                   VARCHAR(50) DEFAULT 'pending',
  ready_to_advance         TINYINT(1) DEFAULT 0,
  generated_at             DATETIME,
  generated_by_user_id     VARCHAR(36),
  idempotency_key          VARCHAR(190),
  created_date             DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_date             DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_comp_phase_round (competition_instance_id, phase, round),
  UNIQUE KEY uq_comp_phase_idempotency (idempotency_key),
  INDEX idx_comp_phase_status (competition_instance_id, status)
);

CREATE TABLE IF NOT EXISTS competition_payouts (
  id                       VARCHAR(36) PRIMARY KEY,
  competition_instance_id  VARCHAR(36) NOT NULL,
  fixture_id               VARCHAR(36),
  match_id                 VARCHAR(36),
  recipient_type           VARCHAR(20) NOT NULL,
  club_id                  VARCHAR(36),
  player_id                VARCHAR(36),
  amount_stc               DECIMAL(12,2) DEFAULT 0,
  category                 VARCHAR(80),
  status                   VARCHAR(50) DEFAULT 'pending',
  idempotency_key          VARCHAR(190),
  ledger_transaction_id    VARCHAR(36),
  created_date             DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_date             DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_comp_payout_idempotency (idempotency_key),
  INDEX idx_comp_payout_instance (competition_instance_id, status),
  INDEX idx_comp_payout_club (club_id, created_date),
  INDEX idx_comp_payout_player (player_id, created_date)
);

-- ── indexes ───────────────────────────────────────────────────
CREATE INDEX idx_players_club        ON players(club_id);
CREATE INDEX idx_players_email       ON players(email);
CREATE INDEX idx_players_user        ON players(user_id);
CREATE INDEX idx_clubs_owner         ON clubs(owner_email);
CREATE INDEX idx_clubs_user          ON clubs(user_id);
CREATE INDEX idx_clubs_president_user ON clubs(president_user_id);
CREATE INDEX idx_clubs_president_id  ON clubs(president_id);
CREATE INDEX idx_clubs_president_player ON clubs(president_player_id);
CREATE INDEX idx_matches_home        ON matches(home_club_id);
CREATE INDEX idx_matches_away        ON matches(away_club_id);
CREATE INDEX idx_matches_tournament  ON matches(tournament_id);
CREATE INDEX idx_matches_home_owner_email ON matches(home_owner_email);
CREATE INDEX idx_matches_away_owner_email ON matches(away_owner_email);
CREATE INDEX idx_posts_club          ON posts(club_id);
CREATE INDEX idx_posts_author        ON posts(author_email);
CREATE INDEX idx_comments_post       ON comments(post_id);
CREATE INDEX idx_notifications_rcpt  ON notifications(recipient_email);
CREATE INDEX idx_notifications_type_related ON notifications(type, related_id);
CREATE INDEX idx_notifications_idempotency ON notifications(idempotency_key);
CREATE INDEX idx_inbox_rcpt          ON inbox_messages(recipient_email);
CREATE INDEX idx_inbox_type_related  ON inbox_messages(message_type, related_entity_id);
CREATE INDEX idx_inbox_idempotency   ON inbox_messages(idempotency_key);
CREATE INDEX idx_contracts_team      ON player_contracts(team_id);
CREATE INDEX idx_contracts_user      ON player_contracts(user_id);
CREATE INDEX idx_contracts_offered_by_user ON player_contracts(offered_by_user_id);
CREATE INDEX idx_contracts_offered_by_club ON player_contracts(offered_by_club_id);
CREATE INDEX idx_contracts_offered_by_president ON player_contracts(offered_by_president_id);
CREATE INDEX idx_pic_player          ON player_identity_claims(player_id);
CREATE INDEX idx_pic_user            ON player_identity_claims(user_id);
CREATE INDEX idx_pic_status          ON player_identity_claims(status);
CREATE INDEX idx_pic_created         ON player_identity_claims(created_date);
CREATE INDEX idx_chat_match          ON chat_messages(match_id);
CREATE INDEX idx_stats_match         ON match_player_stats(match_id);
CREATE INDEX idx_stc_club            ON stc_transactions(club_id);
CREATE INDEX idx_rp_type_status      ON recruitment_posts(post_type, status);
CREATE INDEX idx_rp_player           ON recruitment_posts(author_player_id);
CREATE INDEX idx_rp_club             ON recruitment_posts(author_club_id);
CREATE INDEX idx_rp_platform_region  ON recruitment_posts(platform, region);
CREATE INDEX idx_ri_post             ON recruitment_interests(recruitment_post_id);
CREATE INDEX idx_ri_sender_user      ON recruitment_interests(sender_user_id);
CREATE INDEX idx_ri_recipient_user   ON recruitment_interests(recipient_user_id);
CREATE INDEX idx_ri_status           ON recruitment_interests(status);
CREATE INDEX idx_psv_player          ON player_showcase_videos(player_id, sort_order);
CREATE INDEX idx_psv_created         ON player_showcase_videos(created_date);
CREATE INDEX idx_sr_club_status      ON scouting_reports(club_id, status);
CREATE INDEX idx_sr_target           ON scouting_reports(target_player_id);
CREATE INDEX idx_sr_scout            ON scouting_reports(scouted_by_player_id);
CREATE INDEX idx_ca_club_status      ON club_applicants(club_id, status);
CREATE INDEX idx_ca_player           ON club_applicants(player_id);
CREATE INDEX idx_csr_club            ON club_staff_roles(club_id);
CREATE INDEX idx_csr_player          ON club_staff_roles(player_id);
CREATE INDEX idx_cfa_fixture         ON club_fixture_availability(club_id, fixture_id);
CREATE INDEX idx_cfa_player          ON club_fixture_availability(player_id);
CREATE INDEX idx_cfl_fixture         ON club_fixture_lineups(club_id, fixture_id);
CREATE INDEX idx_coal_club_created   ON club_operation_audit_logs(club_id, created_date);

-- ── model/schema alignment migrations ──────────────────────────
-- Keep schema.sql aligned with all model files in server/src/server/models.
-- These migrations are idempotent and safe to re-run.
-- BEGIN inlined: user_identity_migration.sql
-- Base roles/users definitions are already declared at file top.
-- Keep only identity backfill/alignment logic here to avoid duplicate DDL/seed logic.

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

INSERT INTO users (id, email, created_date, updated_date)
SELECT p.id, p.email, NOW(), NOW()
FROM players p
LEFT JOIN users u ON u.email = p.email
WHERE p.email IS NOT NULL AND p.email <> '' AND u.id IS NULL;

UPDATE players p
JOIN users u ON u.email = p.email
SET p.user_id = u.id
WHERE p.user_id IS NULL;

UPDATE clubs c
JOIN users u ON u.email = c.owner_email
SET c.user_id = u.id
WHERE c.user_id IS NULL;

UPDATE users u
LEFT JOIN players p ON p.user_id = u.id
LEFT JOIN clubs c ON c.user_id = u.id
SET u.player_id = p.id,
    u.owner_id = c.id,
    u.role_id = CASE
      WHEN p.id IS NOT NULL OR c.id IS NOT NULL THEN 1
      ELSE COALESCE(u.role_id, 1)
    END;
-- END inlined: user_identity_migration.sql

-- BEGIN inlined: oauth_migration.sql
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

ALTER TABLE players MODIFY COLUMN email VARCHAR(255) DEFAULT NULL;

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
-- END inlined: oauth_migration.sql

-- BEGIN inlined: player_club_tournament_migration.sql
SET @t='players';
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='stc'),'SELECT 1','ALTER TABLE players ADD COLUMN stc BIGINT NULL DEFAULT 0')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='goals_player'),'SELECT 1','ALTER TABLE players ADD COLUMN goals_player INT NULL DEFAULT 0')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='matches_played'),'SELECT 1','ALTER TABLE players ADD COLUMN matches_played INT NULL DEFAULT 0')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='matches_played_club'),'SELECT 1','ALTER TABLE players ADD COLUMN matches_played_club INT NULL DEFAULT 0')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='wins_count'),'SELECT 1','ALTER TABLE players ADD COLUMN wins_count INT NULL DEFAULT 0')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='wins_club'),'SELECT 1','ALTER TABLE players ADD COLUMN wins_club INT NULL DEFAULT 0')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='losses_count'),'SELECT 1','ALTER TABLE players ADD COLUMN losses_count INT NULL DEFAULT 0')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='losses_club'),'SELECT 1','ALTER TABLE players ADD COLUMN losses_club INT NULL DEFAULT 0')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='draws_count'),'SELECT 1','ALTER TABLE players ADD COLUMN draws_count INT NULL DEFAULT 0')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='draws_club'),'SELECT 1','ALTER TABLE players ADD COLUMN draws_club INT NULL DEFAULT 0')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='clean_sheets'),'SELECT 1','ALTER TABLE players ADD COLUMN clean_sheets INT NULL DEFAULT 0')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='man_of_the_match'),'SELECT 1','ALTER TABLE players ADD COLUMN man_of_the_match INT NULL DEFAULT 0')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='avg_match_rating'),'SELECT 1','ALTER TABLE players ADD COLUMN avg_match_rating DECIMAL(4,2) NULL DEFAULT 6.00')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='status'),'SELECT 1','ALTER TABLE players ADD COLUMN status VARCHAR(20) NULL DEFAULT ''active''')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='is_verified'),'SELECT 1','ALTER TABLE players ADD COLUMN is_verified TINYINT(1) NULL DEFAULT 0')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='verified_platform'),'SELECT 1','ALTER TABLE players ADD COLUMN verified_platform VARCHAR(50) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='verified_platform_handle'),'SELECT 1','ALTER TABLE players ADD COLUMN verified_platform_handle VARCHAR(150) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='identity_verified_at'),'SELECT 1','ALTER TABLE players ADD COLUMN identity_verified_at DATETIME NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='ranking_points'),'SELECT 1','ALTER TABLE players ADD COLUMN ranking_points INT NULL DEFAULT 0')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='global_rank'),'SELECT 1','ALTER TABLE players ADD COLUMN global_rank INT NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='regional_rank'),'SELECT 1','ALTER TABLE players ADD COLUMN regional_rank INT NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='country_rank'),'SELECT 1','ALTER TABLE players ADD COLUMN country_rank INT NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='position_rank'),'SELECT 1','ALTER TABLE players ADD COLUMN position_rank INT NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='ranking_matches'),'SELECT 1','ALTER TABLE players ADD COLUMN ranking_matches INT NULL DEFAULT 0')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='ranking_wins'),'SELECT 1','ALTER TABLE players ADD COLUMN ranking_wins INT NULL DEFAULT 0')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='ranking_draws'),'SELECT 1','ALTER TABLE players ADD COLUMN ranking_draws INT NULL DEFAULT 0')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='ranking_losses'),'SELECT 1','ALTER TABLE players ADD COLUMN ranking_losses INT NULL DEFAULT 0')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='ranking_win_rate'),'SELECT 1','ALTER TABLE players ADD COLUMN ranking_win_rate DECIMAL(5,2) NULL DEFAULT 0')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='ranking_goals'),'SELECT 1','ALTER TABLE players ADD COLUMN ranking_goals INT NULL DEFAULT 0')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='ranking_assists'),'SELECT 1','ALTER TABLE players ADD COLUMN ranking_assists INT NULL DEFAULT 0')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='ranking_clean_sheets'),'SELECT 1','ALTER TABLE players ADD COLUMN ranking_clean_sheets INT NULL DEFAULT 0')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='ranking_motm'),'SELECT 1','ALTER TABLE players ADD COLUMN ranking_motm INT NULL DEFAULT 0')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='ranking_avg_rating'),'SELECT 1','ALTER TABLE players ADD COLUMN ranking_avg_rating DECIMAL(4,2) NULL DEFAULT 0')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='ranking_competition_wins'),'SELECT 1','ALTER TABLE players ADD COLUMN ranking_competition_wins INT NULL DEFAULT 0')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='ranking_finishes_score'),'SELECT 1','ALTER TABLE players ADD COLUMN ranking_finishes_score INT NULL DEFAULT 0')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='subscription_expires_at'),'SELECT 1','ALTER TABLE players ADD COLUMN subscription_expires_at DATETIME NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='subscription_billing'),'SELECT 1','ALTER TABLE players ADD COLUMN subscription_billing VARCHAR(20) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='stripe_subscription_id'),'SELECT 1','ALTER TABLE players ADD COLUMN stripe_subscription_id VARCHAR(255) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='stripe_customer_id'),'SELECT 1','ALTER TABLE players ADD COLUMN stripe_customer_id VARCHAR(255) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @t='clubs';
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='logo_frame_id'),'SELECT 1','ALTER TABLE clubs ADD COLUMN logo_frame_id VARCHAR(100) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='ranking_points'),'SELECT 1','ALTER TABLE clubs ADD COLUMN ranking_points INT NULL DEFAULT 0')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='global_rank'),'SELECT 1','ALTER TABLE clubs ADD COLUMN global_rank INT NULL DEFAULT 0')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='regional_rank'),'SELECT 1','ALTER TABLE clubs ADD COLUMN regional_rank INT NULL DEFAULT 0')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='country_rank'),'SELECT 1','ALTER TABLE clubs ADD COLUMN country_rank INT NULL DEFAULT 0')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='stadium_name'),'SELECT 1','ALTER TABLE clubs ADD COLUMN stadium_name VARCHAR(255) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='achievements'),'SELECT 1','ALTER TABLE clubs ADD COLUMN achievements JSON NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @t='tournaments';
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='description'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN description TEXT NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='type'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN type VARCHAR(30) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='participant_type'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN participant_type VARCHAR(10) NULL DEFAULT ''club''')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='platform'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN platform VARCHAR(20) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='region'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN region VARCHAR(30) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='max_teams'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN max_teams INT NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='entry_credits'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN entry_credits INT NULL DEFAULT 50')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='entry_fee_stc'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN entry_fee_stc BIGINT NULL DEFAULT 0')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='prize_description'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN prize_description TEXT NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='prize_pool_stc'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN prize_pool_stc BIGINT NULL DEFAULT 0')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='prize_winner_stc'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN prize_winner_stc BIGINT NULL DEFAULT 0')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='prize_runner_up_stc'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN prize_runner_up_stc BIGINT NULL DEFAULT 0')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='prize_semi_final_stc'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN prize_semi_final_stc BIGINT NULL DEFAULT 0')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='prize_participation_stc'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN prize_participation_stc BIGINT NULL DEFAULT 0')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='custom_rules'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN custom_rules TEXT NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='rules_file_url'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN rules_file_url VARCHAR(500) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='country_code'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN country_code VARCHAR(10) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='start_date'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN start_date DATETIME NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='end_date'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN end_date DATETIME NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='organizer_email'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN organizer_email VARCHAR(255) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='creator_email'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN creator_email VARCHAR(255) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='creator_id'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN creator_id VARCHAR(36) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='creator_gamertag'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN creator_gamertag VARCHAR(100) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='win_credits'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN win_credits INT NULL DEFAULT 150')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='win_credits_awarded'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN win_credits_awarded TINYINT(1) NULL DEFAULT 0')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='total_rounds'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN total_rounds INT NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='swiss_rounds'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN swiss_rounds INT NULL DEFAULT 5')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='season'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN season VARCHAR(50) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='ucl_phase'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN ucl_phase VARCHAR(20) NULL DEFAULT ''league''')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='banner_url'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN banner_url VARCHAR(500) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='banner_color'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN banner_color VARCHAR(20) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='banner_position'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN banner_position VARCHAR(50) NULL DEFAULT ''50% 50%''')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='trophy_item_id'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN trophy_item_id VARCHAR(36) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='registration_proofs'),'SELECT 1','ALTER TABLE tournaments ADD COLUMN registration_proofs JSON NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
-- END inlined: player_club_tournament_migration.sql

-- BEGIN inlined: new_tables_migration.sql
-- Structured formatting: same definitions, improved readability.

CREATE TABLE IF NOT EXISTS challenges (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  challenger_id VARCHAR(36),
  challenger_club_id VARCHAR(36),
  challenger_club_name VARCHAR(255),
  opponent_club_id VARCHAR(36),
  opponent_club_name VARCHAR(255),
  opponent_player_id VARCHAR(36),
  opponent_player_name VARCHAR(255),
  type VARCHAR(50) DEFAULT 'friendly',
  scheduled_date DATETIME,
  message TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  home_score INT,
  away_score INT,
  winner_club_id VARCHAR(36),
  winner_player_id VARCHAR(36),
  wager_credits DECIMAL(10,2) DEFAULT 0,
  challenger_wager_paid TINYINT(1) DEFAULT 0,
  opponent_wager_paid TINYINT(1) DEFAULT 0,
  live_match_id VARCHAR(36),
  created_date DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS club_achievements (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  club_id VARCHAR(36),
  club_name VARCHAR(255),
  club_logo_url TEXT,
  club_tag VARCHAR(50),
  source_id VARCHAR(36),
  source_type VARCHAR(50),
  source_name VARCHAR(255),
  season_id VARCHAR(36),
  season_number INT,
  season_label VARCHAR(100),
  position INT,
  position_label VARCHAR(100),
  badge_type VARCHAR(50) DEFAULT 'participant',
  stc_awarded DECIMAL(10,2) DEFAULT 0,
  trophy_image_url TEXT,
  awarded_at DATETIME,
  created_date DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS live_match_events (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  live_match_id VARCHAR(36),
  club_id VARCHAR(36),
  club_name VARCHAR(255),
  scorer_email VARCHAR(255),
  scorer_gamertag VARCHAR(100),
  assist_email VARCHAR(255),
  assist_gamertag VARCHAR(100),
  is_penalty TINYINT(1) DEFAULT 0,
  is_own_goal TINYINT(1) DEFAULT 0,
  minute INT,
  created_date DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS player_achievements (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  player_id VARCHAR(36),
  player_email VARCHAR(255),
  player_gamertag VARCHAR(100),
  club_id VARCHAR(36),
  club_name VARCHAR(255),
  source_id VARCHAR(36),
  source_type VARCHAR(50),
  source_name VARCHAR(255),
  season_id VARCHAR(36),
  season_number INT,
  season_label VARCHAR(100),
  position INT,
  position_label VARCHAR(100),
  badge_type VARCHAR(50) DEFAULT 'participant',
  trophy_image_url TEXT,
  awarded_at DATETIME,
  created_date DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS player_contract_history (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  contract_id VARCHAR(36),
  action_type VARCHAR(50),
  action_by VARCHAR(36),
  action_note TEXT,
  created_date DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rating_history (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  club_id VARCHAR(36),
  club_name VARCHAR(255),
  opponent_club_id VARCHAR(36),
  opponent_club_name VARCHAR(255),
  match_id VARCHAR(36),
  competition_type VARCHAR(50) DEFAULT 'tournament',
  competition_slug VARCHAR(50),
  division INT,
  phase VARCHAR(50),
  result VARCHAR(1),
  home_score INT DEFAULT 0,
  away_score INT DEFAULT 0,
  points_before DECIMAL(10,2) DEFAULT 0,
  points_after DECIMAL(10,2) DEFAULT 0,
  points_change DECIMAL(10,2) DEFAULT 0,
  opponent_rank INT DEFAULT 0,
  opp_strength_multiplier DECIMAL(5,2) DEFAULT 1.0,
  competition_multiplier DECIMAL(5,2) DEFAULT 1.0,
  stage_multiplier DECIMAL(5,2) DEFAULT 1.0,
  voided TINYINT(1) DEFAULT 0,
  void_reason TEXT,
  played_at DATETIME,
  created_date DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reward_configs (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  source_id VARCHAR(36),
  source_type VARCHAR(50),
  source_name VARCHAR(255),
  position INT,
  position_label VARCHAR(100),
  badge_type VARCHAR(50) DEFAULT 'participant',
  stc_amount DECIMAL(10,2) DEFAULT 0,
  created_date DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transfer_windows (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  status VARCHAR(20) DEFAULT 'closed',
  start_date DATETIME,
  end_date DATETIME,
  label VARCHAR(100),
  notes TEXT,
  transfers_executed INT DEFAULT 0,
  created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_date DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
-- END inlined: new_tables_migration.sql

-- BEGIN inlined: remaining_models_migration.sql
SET @t='chat_messages'; SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='channel'),'SELECT 1','ALTER TABLE chat_messages ADD COLUMN channel VARCHAR(30) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='club_id'),'SELECT 1','ALTER TABLE chat_messages ADD COLUMN club_id VARCHAR(36) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='sender_name'),'SELECT 1','ALTER TABLE chat_messages ADD COLUMN sender_name VARCHAR(100) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='sender_avatar'),'SELECT 1','ALTER TABLE chat_messages ADD COLUMN sender_avatar TEXT NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @t='comments'; SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='author_name'),'SELECT 1','ALTER TABLE comments ADD COLUMN author_name VARCHAR(100) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='author_avatar'),'SELECT 1','ALTER TABLE comments ADD COLUMN author_avatar TEXT NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @t='direct_messages'; SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='sender_name'),'SELECT 1','ALTER TABLE direct_messages ADD COLUMN sender_name VARCHAR(100) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='recipient_name'),'SELECT 1','ALTER TABLE direct_messages ADD COLUMN recipient_name VARCHAR(100) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='read'),'SELECT 1','ALTER TABLE direct_messages ADD COLUMN `read` TINYINT(1) NULL DEFAULT 0')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='media_url'),'SELECT 1','ALTER TABLE direct_messages ADD COLUMN media_url TEXT NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @t='join_requests'; SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='player_gamertag'),'SELECT 1','ALTER TABLE join_requests ADD COLUMN player_gamertag VARCHAR(100) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='message'),'SELECT 1','ALTER TABLE join_requests ADD COLUMN message TEXT NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @t='inbox_messages'; SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='is_system'),'SELECT 1','ALTER TABLE inbox_messages ADD COLUMN is_system TINYINT(1) NULL DEFAULT 0')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @t='match_player_stats'; SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='player_gamertag'),'SELECT 1','ALTER TABLE match_player_stats ADD COLUMN player_gamertag VARCHAR(100) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='own_goals'),'SELECT 1','ALTER TABLE match_player_stats ADD COLUMN own_goals INT NULL DEFAULT 0')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='player_id'),'SELECT 1','ALTER TABLE match_player_stats ADD COLUMN player_id VARCHAR(36) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='position'),'SELECT 1','ALTER TABLE match_player_stats ADD COLUMN position VARCHAR(50) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='clean_sheet'),'SELECT 1','ALTER TABLE match_player_stats ADD COLUMN clean_sheet TINYINT(1) NULL DEFAULT 0')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='is_motm'),'SELECT 1','ALTER TABLE match_player_stats ADD COLUMN is_motm TINYINT(1) NULL DEFAULT 0')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @t='notifications'; SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='related_id'),'SELECT 1','ALTER TABLE notifications ADD COLUMN related_id VARCHAR(36) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @t='player_contracts'; SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='games_played'),'SELECT 1','ALTER TABLE player_contracts ADD COLUMN games_played INT NULL DEFAULT 0')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='transfer_window_id'),'SELECT 1','ALTER TABLE player_contracts ADD COLUMN transfer_window_id VARCHAR(36) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='salary_per_game_stc'),'SELECT 1','ALTER TABLE player_contracts ADD COLUMN salary_per_game_stc BIGINT NULL DEFAULT 0')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='is_loan'),'SELECT 1','ALTER TABLE player_contracts ADD COLUMN is_loan TINYINT(1) NULL DEFAULT 0')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='loan_return_date'),'SELECT 1','ALTER TABLE player_contracts ADD COLUMN loan_return_date DATE NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='last_salary_paid_at'),'SELECT 1','ALTER TABLE player_contracts ADD COLUMN last_salary_paid_at DATETIME NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @t='posts'; SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='tournament_id'),'SELECT 1','ALTER TABLE posts ADD COLUMN tournament_id VARCHAR(36) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='tags'),'SELECT 1','ALTER TABLE posts ADD COLUMN tags JSON NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='media_position'),'SELECT 1','ALTER TABLE posts ADD COLUMN media_position VARCHAR(50) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='media_zoom'),'SELECT 1','ALTER TABLE posts ADD COLUMN media_zoom INT NULL DEFAULT 100')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='media_aspect'),'SELECT 1','ALTER TABLE posts ADD COLUMN media_aspect VARCHAR(30) NULL DEFAULT ''square''')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @t='predictions'; SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='live_match_id'),'SELECT 1','ALTER TABLE predictions ADD COLUMN live_match_id VARCHAR(36) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='predictor_email'),'SELECT 1','ALTER TABLE predictions ADD COLUMN predictor_email VARCHAR(255) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='predictor_name'),'SELECT 1','ALTER TABLE predictions ADD COLUMN predictor_name VARCHAR(100) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='predicted_home_score'),'SELECT 1','ALTER TABLE predictions ADD COLUMN predicted_home_score INT NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='predicted_away_score'),'SELECT 1','ALTER TABLE predictions ADD COLUMN predicted_away_score INT NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='predicted_scorer_email'),'SELECT 1','ALTER TABLE predictions ADD COLUMN predicted_scorer_email VARCHAR(255) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='predicted_assist_email'),'SELECT 1','ALTER TABLE predictions ADD COLUMN predicted_assist_email VARCHAR(255) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='predicted_motm_email'),'SELECT 1','ALTER TABLE predictions ADD COLUMN predicted_motm_email VARCHAR(255) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='score_correct'),'SELECT 1','ALTER TABLE predictions ADD COLUMN score_correct TINYINT(1) NULL DEFAULT 0')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='scorer_correct'),'SELECT 1','ALTER TABLE predictions ADD COLUMN scorer_correct TINYINT(1) NULL DEFAULT 0')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='assist_correct'),'SELECT 1','ALTER TABLE predictions ADD COLUMN assist_correct TINYINT(1) NULL DEFAULT 0')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='motm_correct'),'SELECT 1','ALTER TABLE predictions ADD COLUMN motm_correct TINYINT(1) NULL DEFAULT 0')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='score_points'),'SELECT 1','ALTER TABLE predictions ADD COLUMN score_points INT NULL DEFAULT 0')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='scorer_points'),'SELECT 1','ALTER TABLE predictions ADD COLUMN scorer_points INT NULL DEFAULT 0')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='assist_motm_points'),'SELECT 1','ALTER TABLE predictions ADD COLUMN assist_motm_points INT NULL DEFAULT 0')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='total_points'),'SELECT 1','ALTER TABLE predictions ADD COLUMN total_points INT NULL DEFAULT 0')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='match_status'),'SELECT 1','ALTER TABLE predictions ADD COLUMN match_status VARCHAR(20) NULL DEFAULT ''pending''')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @t='press_articles'; SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='headline'),'SELECT 1','ALTER TABLE press_articles ADD COLUMN headline VARCHAR(500) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='match_name'),'SELECT 1','ALTER TABLE press_articles ADD COLUMN match_name VARCHAR(255) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='tournament_name'),'SELECT 1','ALTER TABLE press_articles ADD COLUMN tournament_name VARCHAR(255) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='tournament_id'),'SELECT 1','ALTER TABLE press_articles ADD COLUMN tournament_id VARCHAR(36) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='photo_url'),'SELECT 1','ALTER TABLE press_articles ADD COLUMN photo_url TEXT NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='photo_position'),'SELECT 1','ALTER TABLE press_articles ADD COLUMN photo_position VARCHAR(30) NULL DEFAULT ''50%% 50%%''')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='photo_zoom'),'SELECT 1','ALTER TABLE press_articles ADD COLUMN photo_zoom INT NULL DEFAULT 120')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='visibility'),'SELECT 1','ALTER TABLE press_articles ADD COLUMN visibility VARCHAR(20) NULL DEFAULT ''public''')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='quotes'),'SELECT 1','ALTER TABLE press_articles ADD COLUMN quotes JSON NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='registered_clubs'),'SELECT 1','ALTER TABLE press_articles ADD COLUMN registered_clubs JSON NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @t='press_conferences'; SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='context'),'SELECT 1','ALTER TABLE press_conferences ADD COLUMN context VARCHAR(30) NULL DEFAULT ''match''')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='tournament_id'),'SELECT 1','ALTER TABLE press_conferences ADD COLUMN tournament_id VARCHAR(36) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='club_name'),'SELECT 1','ALTER TABLE press_conferences ADD COLUMN club_name VARCHAR(100) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='club_logo_url'),'SELECT 1','ALTER TABLE press_conferences ADD COLUMN club_logo_url TEXT NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='player_id'),'SELECT 1','ALTER TABLE press_conferences ADD COLUMN player_id VARCHAR(36) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='player_name'),'SELECT 1','ALTER TABLE press_conferences ADD COLUMN player_name VARCHAR(100) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='player_avatar_url'),'SELECT 1','ALTER TABLE press_conferences ADD COLUMN player_avatar_url TEXT NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='opponent_name'),'SELECT 1','ALTER TABLE press_conferences ADD COLUMN opponent_name VARCHAR(100) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='match_name'),'SELECT 1','ALTER TABLE press_conferences ADD COLUMN match_name VARCHAR(255) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='tournament_name'),'SELECT 1','ALTER TABLE press_conferences ADD COLUMN tournament_name VARCHAR(255) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @t='press_questions'; SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='question'),'SELECT 1','ALTER TABLE press_questions ADD COLUMN question TEXT NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='answer_a'),'SELECT 1','ALTER TABLE press_questions ADD COLUMN answer_a TEXT NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='answer_b'),'SELECT 1','ALTER TABLE press_questions ADD COLUMN answer_b TEXT NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='answer_c'),'SELECT 1','ALTER TABLE press_questions ADD COLUMN answer_c TEXT NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='answer_d'),'SELECT 1','ALTER TABLE press_questions ADD COLUMN answer_d TEXT NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @t='stc_transactions'; SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='player_id'),'SELECT 1','ALTER TABLE stc_transactions ADD COLUMN player_id VARCHAR(36) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='player_email'),'SELECT 1','ALTER TABLE stc_transactions ADD COLUMN player_email VARCHAR(255) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @t='trophy_items'; SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='competition_name'),'SELECT 1','ALTER TABLE trophy_items ADD COLUMN competition_name VARCHAR(255) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='tournament_id'),'SELECT 1','ALTER TABLE trophy_items ADD COLUMN tournament_id VARCHAR(36) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='tournament_type'),'SELECT 1','ALTER TABLE trophy_items ADD COLUMN tournament_type VARCHAR(30) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='is_official'),'SELECT 1','ALTER TABLE trophy_items ADD COLUMN is_official TINYINT(1) NULL DEFAULT 0')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='admin_only'),'SELECT 1','ALTER TABLE trophy_items ADD COLUMN admin_only TINYINT(1) NULL DEFAULT 0')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='sort_order'),'SELECT 1','ALTER TABLE trophy_items ADD COLUMN sort_order INT NULL DEFAULT 0')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='description'),'SELECT 1','ALTER TABLE trophy_items ADD COLUMN description TEXT NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='image_url'),'SELECT 1','ALTER TABLE trophy_items ADD COLUMN image_url TEXT NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='rarity'),'SELECT 1','ALTER TABLE trophy_items ADD COLUMN rarity VARCHAR(20) NULL DEFAULT ''common''')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='price'),'SELECT 1','ALTER TABLE trophy_items ADD COLUMN price INT NULL DEFAULT 0')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='created_date'),'SELECT 1','ALTER TABLE trophy_items ADD COLUMN created_date DATETIME NULL DEFAULT CURRENT_TIMESTAMP')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @t='trophy_placements'; SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='trophy_image_url'),'SELECT 1','ALTER TABLE trophy_placements ADD COLUMN trophy_image_url TEXT NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='trophy_name'),'SELECT 1','ALTER TABLE trophy_placements ADD COLUMN trophy_name VARCHAR(255) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='x_percent'),'SELECT 1','ALTER TABLE trophy_placements ADD COLUMN x_percent DECIMAL(6,2) NULL DEFAULT 50')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='y_percent'),'SELECT 1','ALTER TABLE trophy_placements ADD COLUMN y_percent DECIMAL(6,2) NULL DEFAULT 50')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='scale'),'SELECT 1','ALTER TABLE trophy_placements ADD COLUMN scale DECIMAL(5,3) NULL DEFAULT 1')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='won_tournament_ids'),'SELECT 1','ALTER TABLE trophy_placements ADD COLUMN won_tournament_ids JSON NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='win_count'),'SELECT 1','ALTER TABLE trophy_placements ADD COLUMN win_count INT NULL DEFAULT 1')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @t='user_purchases'; SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='buyer_email'),'SELECT 1','ALTER TABLE user_purchases ADD COLUMN buyer_email VARCHAR(255) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='item_name'),'SELECT 1','ALTER TABLE user_purchases ADD COLUMN item_name VARCHAR(255) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='price_paid'),'SELECT 1','ALTER TABLE user_purchases ADD COLUMN price_paid BIGINT NULL DEFAULT 0')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
-- END inlined: remaining_models_migration.sql

-- BEGIN inlined: match_lifestyle_news_migration.sql (summary subset)
SET @t='matches';
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='stats_processed'),'SELECT 1','ALTER TABLE matches ADD COLUMN stats_processed TINYINT(1) NULL DEFAULT 0')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='winner_club_id'),'SELECT 1','ALTER TABLE matches ADD COLUMN winner_club_id VARCHAR(36) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='winner_club_name'),'SELECT 1','ALTER TABLE matches ADD COLUMN winner_club_name VARCHAR(100) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='winner_player_id'),'SELECT 1','ALTER TABLE matches ADD COLUMN winner_player_id VARCHAR(36) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='winner_player_name'),'SELECT 1','ALTER TABLE matches ADD COLUMN winner_player_name VARCHAR(100) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='loser_club_id'),'SELECT 1','ALTER TABLE matches ADD COLUMN loser_club_id VARCHAR(36) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='loser_club_name'),'SELECT 1','ALTER TABLE matches ADD COLUMN loser_club_name VARCHAR(100) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='loser_player_id'),'SELECT 1','ALTER TABLE matches ADD COLUMN loser_player_id VARCHAR(36) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='loser_player_name'),'SELECT 1','ALTER TABLE matches ADD COLUMN loser_player_name VARCHAR(100) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='group_number'),'SELECT 1','ALTER TABLE matches ADD COLUMN group_number INT NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='bracket_side'),'SELECT 1','ALTER TABLE matches ADD COLUMN bracket_side VARCHAR(20) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @t='live_matches';
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='home_club_name'),'SELECT 1','ALTER TABLE live_matches ADD COLUMN home_club_name VARCHAR(100) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='away_club_name'),'SELECT 1','ALTER TABLE live_matches ADD COLUMN away_club_name VARCHAR(100) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='home_player_id'),'SELECT 1','ALTER TABLE live_matches ADD COLUMN home_player_id VARCHAR(36) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='home_player_name'),'SELECT 1','ALTER TABLE live_matches ADD COLUMN home_player_name VARCHAR(100) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='away_player_id'),'SELECT 1','ALTER TABLE live_matches ADD COLUMN away_player_id VARCHAR(36) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='away_player_name'),'SELECT 1','ALTER TABLE live_matches ADD COLUMN away_player_name VARCHAR(100) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @t='lifestyle_items';
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='category'),'SELECT 1','ALTER TABLE lifestyle_items ADD COLUMN category VARCHAR(30) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='subcategory'),'SELECT 1','ALTER TABLE lifestyle_items ADD COLUMN subcategory VARCHAR(100) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='description'),'SELECT 1','ALTER TABLE lifestyle_items ADD COLUMN description TEXT NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='price_stc'),'SELECT 1','ALTER TABLE lifestyle_items ADD COLUMN price_stc BIGINT NULL DEFAULT 0')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @t='lifestyle_purchases';
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='player_email'),'SELECT 1','ALTER TABLE lifestyle_purchases ADD COLUMN player_email VARCHAR(255) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='player_gamertag'),'SELECT 1','ALTER TABLE lifestyle_purchases ADD COLUMN player_gamertag VARCHAR(100) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='item_name'),'SELECT 1','ALTER TABLE lifestyle_purchases ADD COLUMN item_name VARCHAR(255) NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @t='news_items';
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='type'),'SELECT 1','ALTER TABLE news_items ADD COLUMN type VARCHAR(30) NULL DEFAULT ''announcement''')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='category'),'SELECT 1','ALTER TABLE news_items ADD COLUMN category VARCHAR(30) NULL DEFAULT ''general''')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql=(SELECT IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=@t AND column_name='image_url'),'SELECT 1','ALTER TABLE news_items ADD COLUMN image_url TEXT NULL')); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
-- END inlined: match_lifestyle_news_migration.sql

-- BEGIN inlined: stage_entity_changes_20260505.sql (summary subset)
SET @db = DATABASE();
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'matches' AND COLUMN_NAME = 'source_fixture_id') = 0,'ALTER TABLE matches ADD COLUMN source_fixture_id VARCHAR(36)','SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'matches' AND COLUMN_NAME = 'source_fixture_type') = 0,'ALTER TABLE matches ADD COLUMN source_fixture_type VARCHAR(50)','SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'matches' AND COLUMN_NAME = 'competition_context') = 0,'ALTER TABLE matches ADD COLUMN competition_context VARCHAR(255)','SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'matches' AND COLUMN_NAME = 'home_goal_events') = 0,'ALTER TABLE matches ADD COLUMN home_goal_events JSON','SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'matches' AND COLUMN_NAME = 'away_goal_events') = 0,'ALTER TABLE matches ADD COLUMN away_goal_events JSON','SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'matches' AND INDEX_NAME = 'idx_matches_source_fx') = 0,'CREATE INDEX idx_matches_source_fx ON matches(source_fixture_id)','SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'reward_configs' AND INDEX_NAME = 'idx_reward_source') = 0,'CREATE INDEX idx_reward_source ON reward_configs(source_type, source_id, position)','SELECT 1'); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
-- END inlined: stage_entity_changes_20260505.sql

-- BEGIN inlined: banner_migration.sql
SET @sql = (SELECT IF(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'players' AND column_name = 'banner_url'),'SELECT 1','ALTER TABLE players ADD COLUMN banner_url VARCHAR(500) NULL')); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'players' AND column_name = 'banner_position'),'SELECT 1','ALTER TABLE players ADD COLUMN banner_position VARCHAR(50) NULL')); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'players' AND column_name = 'banner_zoom'),'SELECT 1','ALTER TABLE players ADD COLUMN banner_zoom INT NULL')); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'clubs' AND column_name = 'banner_url'),'SELECT 1','ALTER TABLE clubs ADD COLUMN banner_url VARCHAR(500) NULL')); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'clubs' AND column_name = 'banner_position'),'SELECT 1','ALTER TABLE clubs ADD COLUMN banner_position VARCHAR(50) NULL')); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'clubs' AND column_name = 'banner_zoom'),'SELECT 1','ALTER TABLE clubs ADD COLUMN banner_zoom INT NULL')); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = (SELECT IF(EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'clubs' AND column_name = 'logo_zoom'),'SELECT 1','ALTER TABLE clubs ADD COLUMN logo_zoom INT NULL')); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
-- END inlined: banner_migration.sql

-- BEGIN inlined: landing_page_content_migration.sql
CREATE TABLE IF NOT EXISTS landing_page_contents (
  id VARCHAR(64) PRIMARY KEY,
  hero_title VARCHAR(255) NULL,
  hero_subtitle VARCHAR(255) NULL,
  hero_description TEXT NULL,
  hero_image_url VARCHAR(500) NULL,
  hero_cta_1_label VARCHAR(255) NULL,
  hero_cta_1_url VARCHAR(500) NULL,
  hero_cta_2_label VARCHAR(255) NULL,
  hero_cta_2_url VARCHAR(500) NULL,
  hero_cta_3_label VARCHAR(255) NULL,
  hero_cta_3_url VARCHAR(500) NULL,
  section1_title VARCHAR(255) NULL,
  section1_text TEXT NULL,
  section1_image_url VARCHAR(500) NULL,
  section2_title VARCHAR(255) NULL,
  section2_text TEXT NULL,
  section2_image_url VARCHAR(500) NULL,
  section3_title VARCHAR(255) NULL,
  section3_text TEXT NULL,
  section3_image_url VARCHAR(500) NULL,
  faq_items LONGTEXT NULL,
  contact_email VARCHAR(255) NULL,
  footer_tagline TEXT NULL,
  created_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
-- END inlined: landing_page_content_migration.sql

-- Pre-login landing page config. Edited via LandingPageEditor.jsx.
-- Kept separate from home_page_contents so the marketing site can evolve independently.
CREATE TABLE IF NOT EXISTS landing_config (
  id                 VARCHAR(36)  NOT NULL PRIMARY KEY,
  hero_title         VARCHAR(255) NULL,
  hero_description   TEXT         NULL,
  hero_image_url     VARCHAR(500) NULL,
  stats_json         TEXT         NULL,
  section1_tag       VARCHAR(100) NULL,
  section1_title     VARCHAR(255) NULL,
  section1_text      TEXT         NULL,
  section1_image_url VARCHAR(500) NULL,
  section2_tag       VARCHAR(100) NULL,
  section2_title     VARCHAR(255) NULL,
  section2_text      TEXT         NULL,
  section2_image_url VARCHAR(500) NULL,
  section3_tag       VARCHAR(100) NULL,
  section3_title     VARCHAR(255) NULL,
  section3_text      TEXT         NULL,
  section3_image_url VARCHAR(500) NULL,
  footer_tagline     VARCHAR(255) NULL,
  created_date       DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_date       DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Home page content (post-login). Edited via HomePageEditor.jsx. Mirrors landing_page_contents
-- but stays independent so admins can change the home page without touching the marketing site.
CREATE TABLE IF NOT EXISTS home_page_contents (
  id                 VARCHAR(64)  PRIMARY KEY,
  hero_title         VARCHAR(255) NULL,
  hero_subtitle      VARCHAR(255) NULL,
  hero_description   TEXT         NULL,
  hero_image_url     VARCHAR(500) NULL,
  hero_cta_1_label   VARCHAR(255) NULL,
  hero_cta_1_url     VARCHAR(500) NULL,
  hero_cta_2_label   VARCHAR(255) NULL,
  hero_cta_2_url     VARCHAR(500) NULL,
  hero_cta_3_label   VARCHAR(255) NULL,
  hero_cta_3_url     VARCHAR(500) NULL,
  section1_title     VARCHAR(255) NULL,
  section1_text      TEXT         NULL,
  section1_image_url VARCHAR(500) NULL,
  section2_title     VARCHAR(255) NULL,
  section2_text      TEXT         NULL,
  section2_image_url VARCHAR(500) NULL,
  section3_title     VARCHAR(255) NULL,
  section3_text      TEXT         NULL,
  section3_image_url VARCHAR(500) NULL,
  faq_items          LONGTEXT     NULL,
  contact_email      VARCHAR(255) NULL,
  footer_tagline     TEXT         NULL,
  created_date       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_date       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Platform FAQ (home page accordion). Managed via FaqItem entity / admin Home Page Editor.
CREATE TABLE IF NOT EXISTS faq_items (
  id           VARCHAR(36)  NOT NULL PRIMARY KEY,
  question     VARCHAR(500) NOT NULL,
  answer       TEXT         NOT NULL,
  sort_order   INT          NOT NULL DEFAULT 0,
  is_active    TINYINT(1)   NOT NULL DEFAULT 1,
  created_date DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_date DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_faq_sort (sort_order),
  INDEX idx_faq_active (is_active)
);

-- Store / STAGE Plus settings. Admin-editable source for the Store page and
-- subscription credit refresh values.
CREATE TABLE IF NOT EXISTS store_configs (
  id                         VARCHAR(36)   NOT NULL PRIMARY KEY,
  name                       VARCHAR(100)  NULL,
  stage_plus_monthly_price   DECIMAL(10,2) NOT NULL DEFAULT 4.99,
  stage_plus_yearly_price    DECIMAL(10,2) NOT NULL DEFAULT 49.99,
  monthly_credits            INT           NOT NULL DEFAULT 150,
  starter_credits            INT           NOT NULL DEFAULT 50,
  tournament_entry_credits   INT           NOT NULL DEFAULT 50,
  community_tournament_limit INT           NOT NULL DEFAULT 0,
  headline                   VARCHAR(255)  NULL,
  description                TEXT          NULL,
  badge_image_url            VARCHAR(500)  NULL,
  perks                      JSON          NULL,
  is_active                  TINYINT(1)    NOT NULL DEFAULT 1,
  created_date               DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_date               DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_store_configs_active (is_active)
);

-- Fixture admin actions — audit log for admin interventions on expired fixtures
-- (force-schedule, forfeit declaration, flag for review). Written by
-- fixtureAdminActionController.js POST endpoints; consumed by the disputes tab
-- via the FixtureAdminAction entity.
CREATE TABLE IF NOT EXISTS fixture_admin_actions (
  id                 VARCHAR(36)   NOT NULL PRIMARY KEY,
  fixture_id         VARCHAR(36)   NOT NULL,
  fixture_type       VARCHAR(30)   NOT NULL,
  action_type        VARCHAR(30)   NOT NULL,
  performed_by       VARCHAR(36)   NULL,
  performed_by_name  VARCHAR(150)  NULL,
  home_club_id       VARCHAR(36)   NULL,
  away_club_id       VARCHAR(36)   NULL,
  payload            LONGTEXT      NULL,
  admin_note         TEXT          NULL,
  created_date       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_fixture (fixture_id),
  INDEX idx_action (action_type),
  INDEX idx_performed_by (performed_by),
  INDEX idx_created (created_date)
);

-- ── runtime-migrated tables (mirrored here for fresh installs) ──────────────
-- The tables below are also created idempotently at server startup via
-- migrations in server/src/server.js. They are duplicated here so a clean
-- `mysql < schema.sql` install reaches the same shape as a running database.
-- Keep both copies in sync when adding columns.

-- Player wallet ledger — append-only transaction history per player wallet
CREATE TABLE IF NOT EXISTS player_stc_transactions (
  id            VARCHAR(36)   PRIMARY KEY,
  player_id     VARCHAR(36)   NOT NULL,
  player_email  VARCHAR(255),
  amount        DECIMAL(12,2) NOT NULL,
  balance_after DECIMAL(12,2),
  type          VARCHAR(20),
  category      VARCHAR(100),
  source        VARCHAR(255),
  description   TEXT,
  reference_id  VARCHAR(36),
  created_date  DATETIME      DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pst_player  (player_id),
  INDEX idx_pst_created (created_date)
);

-- Competition & league entity store — single flexible table that backs the
-- competition, regional league, qualification, ranking, and season-registration
-- /api/stage/* routes exposed via leagueEntityController.makeRouter().
-- The `entity_type` discriminator selects which logical entity a row represents;
-- remaining structured data lives in `data_json`.
CREATE TABLE IF NOT EXISTS league_entities (
  id                VARCHAR(36)  NOT NULL PRIMARY KEY,
  entity_type       VARCHAR(50)  NOT NULL,
  data_json         MEDIUMTEXT,
  status            VARCHAR(50)  DEFAULT NULL,
  scheduling_status VARCHAR(50)  DEFAULT NULL,
  slug              VARCHAR(100) DEFAULT NULL,
  league_id         VARCHAR(36)  DEFAULT NULL,
  season_id         VARCHAR(36)  DEFAULT NULL,
  competition_id    VARCHAR(36)  DEFAULT NULL,
  club_id           VARCHAR(36)  DEFAULT NULL,
  is_active         TINYINT(1)   DEFAULT NULL,
  tier              INT          DEFAULT NULL,
  division          INT          DEFAULT NULL,
  region            VARCHAR(100) DEFAULT NULL,
  platform          VARCHAR(50)  DEFAULT NULL,
  season_number     INT          DEFAULT NULL,
  created_date      DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_date      DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_le_type        (entity_type),
  INDEX idx_le_type_status (entity_type, status),
  INDEX idx_le_slug        (entity_type, slug),
  INDEX idx_le_league      (entity_type, league_id),
  INDEX idx_le_season      (entity_type, season_id),
  INDEX idx_le_comp        (entity_type, competition_id)
);

-- Admin audit log — records moderation/admin actions across all entities.
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id            VARCHAR(36)  PRIMARY KEY,
  admin_user_id VARCHAR(36),
  admin_email   VARCHAR(255),
  action        VARCHAR(100),
  entity_type   VARCHAR(50),
  entity_id     VARCHAR(36),
  entity_name   VARCHAR(255),
  old_value     TEXT,
  new_value     TEXT,
  reason        TEXT,
  created_date  DATETIME     DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_aal_entity  (entity_type, entity_id),
  INDEX idx_aal_admin   (admin_user_id),
  INDEX idx_aal_created (created_date)
);

-- Market value config — admin-tunable weights for the player market-value engine.
-- Seeded with a default row by the startup migration in server.js.
CREATE TABLE IF NOT EXISTS market_value_config (
  id           VARCHAR(36)  PRIMARY KEY,
  name         VARCHAR(100) DEFAULT 'default',
  weights      JSON,
  is_active    TINYINT(1)   DEFAULT 1,
  created_date DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_date DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Shirt sales config — admin-tunable demand/price weights for shirt-sales economy.
-- Seeded with a default row by the startup migration in server.js.
CREATE TABLE IF NOT EXISTS shirt_sales_config (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(100) DEFAULT 'default',
  weights      JSON,
  is_active    TINYINT(1)   DEFAULT 1,
  created_date DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_date DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Stadium config — per-tier stadium settings (capacity, ticket price, upgrade cost).
-- Seeded with tiers 0–3 by the startup migration in server.js.
CREATE TABLE IF NOT EXISTS stadium_config (
  id               INT          AUTO_INCREMENT PRIMARY KEY,
  level            INT          NOT NULL UNIQUE,
  name             VARCHAR(100),
  capacity         INT          DEFAULT 5000,
  ticket_price_stc DECIMAL(8,2) DEFAULT 15,
  upgrade_cost_stc BIGINT       DEFAULT 0,
  max_wage_budget_stc DECIMAL(12,2) DEFAULT 250000,
  max_transfer_budget_stc DECIMAL(12,2) DEFAULT 1000000,
  monthly_maintenance_stc DECIMAL(12,2) DEFAULT 50000,
  description      TEXT,
  updated_date     DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ── EAFC-inspired modules ──────────────────────────────────────────────────
-- Mirrored in server/src/server.js startup migrations. Keep both in sync.

CREATE TABLE IF NOT EXISTS objective_definitions (
  id            VARCHAR(36)   NOT NULL PRIMARY KEY,
  scope         VARCHAR(20)   NOT NULL DEFAULT 'daily',
  code          VARCHAR(100)  NULL,
  title         VARCHAR(255)  NOT NULL,
  description   TEXT          NULL,
  metric        VARCHAR(50)   NOT NULL,
  target_value  INT           NOT NULL DEFAULT 1,
  reward_stc    DECIMAL(12,2) DEFAULT 0,
  reward_xp     INT           DEFAULT 0,
  active_from   DATETIME      NULL,
  active_until  DATETIME      NULL,
  is_active     TINYINT(1)    DEFAULT 1,
  created_date  DATETIME      DEFAULT CURRENT_TIMESTAMP,
  updated_date  DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_obj_scope_active (scope, is_active),
  INDEX idx_obj_metric (metric),
  INDEX idx_obj_code (code)
);

CREATE TABLE IF NOT EXISTS objective_progress (
  id            VARCHAR(36)  NOT NULL PRIMARY KEY,
  player_id     VARCHAR(36)  NOT NULL,
  player_email  VARCHAR(255) NULL,
  objective_id  VARCHAR(36)  NOT NULL,
  scope         VARCHAR(20)  NULL,
  current_value INT          DEFAULT 0,
  target_value  INT          NULL,
  completed_at  DATETIME     NULL,
  claimed_at    DATETIME     NULL,
  created_date  DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_date  DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_op_player_obj (player_id, objective_id),
  INDEX idx_op_player (player_id),
  INDEX idx_op_objective (objective_id),
  INDEX idx_op_unclaimed (player_id, completed_at, claimed_at)
);

CREATE TABLE IF NOT EXISTS archetypes (
  id                    VARCHAR(36)  NOT NULL PRIMARY KEY,
  code                  VARCHAR(64)  NOT NULL UNIQUE,
  name                  VARCHAR(100) NOT NULL,
  position              VARCHAR(20)  NULL,
  description           TEXT         NULL,
  base_modifiers        JSON         NULL,
  signature_playstyles  JSON         NULL,
  icon_inspiration      VARCHAR(100) NULL,
  sort_order            INT          DEFAULT 0,
  is_active             TINYINT(1)   DEFAULT 1,
  created_date          DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_date          DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_arch_position (position),
  INDEX idx_arch_active (is_active)
);

CREATE TABLE IF NOT EXISTS chemistry_links (
  id            VARCHAR(36)  NOT NULL PRIMARY KEY,
  player_a_id   VARCHAR(36)  NOT NULL,
  player_b_id   VARCHAR(36)  NOT NULL,
  link_type     VARCHAR(30)  NOT NULL,
  bonus_factor  DECIMAL(4,3) DEFAULT 1.000,
  source        VARCHAR(100) NULL,
  description   VARCHAR(255) NULL,
  is_active     TINYINT(1)   DEFAULT 1,
  created_date  DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_date  DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_chem_pair_type (player_a_id, player_b_id, link_type),
  INDEX idx_chem_player_a (player_a_id),
  INDEX idx_chem_player_b (player_b_id),
  INDEX idx_chem_type (link_type)
);

CREATE TABLE IF NOT EXISTS sbcs (
  id              VARCHAR(36)  NOT NULL PRIMARY KEY,
  name            VARCHAR(255) NOT NULL,
  description     TEXT         NULL,
  category        VARCHAR(50)  DEFAULT 'general',
  requirements    JSON         NULL,
  reward          JSON         NULL,
  image_url       VARCHAR(500) NULL,
  max_completions INT          NULL,
  expires_at      DATETIME     NULL,
  is_active       TINYINT(1)   DEFAULT 1,
  created_date    DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_date    DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sbc_active (is_active, expires_at),
  INDEX idx_sbc_category (category)
);

CREATE TABLE IF NOT EXISTS sbc_submissions (
  id                    VARCHAR(36)   NOT NULL PRIMARY KEY,
  sbc_id                VARCHAR(36)   NOT NULL,
  player_id             VARCHAR(36)   NOT NULL,
  player_email          VARCHAR(255)  NULL,
  player_gamertag       VARCHAR(150)  NULL,
  club_id               VARCHAR(36)   NULL,
  sacrificed_player_ids JSON          NULL,
  reward_payload        JSON          NULL,
  stc_credited          DECIMAL(12,2) DEFAULT 0,
  status                VARCHAR(20)   DEFAULT 'pending',
  failure_reason        TEXT          NULL,
  submitted_at          DATETIME      NULL,
  completed_at          DATETIME      NULL,
  created_date          DATETIME      DEFAULT CURRENT_TIMESTAMP,
  updated_date          DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sbcsub_sbc (sbc_id),
  INDEX idx_sbcsub_player (player_id),
  INDEX idx_sbcsub_status (status, created_date)
);

-- ── relational integrity (safe/idempotent foreign keys) ─────────────────────
-- Adds FK constraints only when:
-- 1) constraint does not already exist
-- 2) child table has no orphan rows for that relationship
-- This keeps schema.sql re-runnable on partially-migrated databases.

SET @db = DATABASE();

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema=@db AND table_name='users' AND constraint_name='fk_users_role_id') = 0
  AND (SELECT COUNT(*) FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.role_id IS NOT NULL AND r.id IS NULL) = 0,
  'ALTER TABLE users ADD CONSTRAINT fk_users_role_id FOREIGN KEY (role_id) REFERENCES roles(id)',
  'SELECT 1'
); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema=@db AND table_name='players' AND constraint_name='fk_players_user_id') = 0
  AND (SELECT COUNT(*) FROM players p LEFT JOIN users u ON u.id = p.user_id WHERE p.user_id IS NOT NULL AND u.id IS NULL) = 0,
  'ALTER TABLE players ADD CONSTRAINT fk_players_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL',
  'SELECT 1'
); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema=@db AND table_name='clubs' AND constraint_name='fk_clubs_user_id') = 0
  AND (SELECT COUNT(*) FROM clubs c LEFT JOIN users u ON u.id = c.user_id WHERE c.user_id IS NOT NULL AND u.id IS NULL) = 0,
  'ALTER TABLE clubs ADD CONSTRAINT fk_clubs_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL',
  'SELECT 1'
); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema=@db AND table_name='players' AND constraint_name='fk_players_club_id') = 0
  AND (SELECT COUNT(*) FROM players p LEFT JOIN clubs c ON c.id = p.club_id WHERE p.club_id IS NOT NULL AND c.id IS NULL) = 0,
  'ALTER TABLE players ADD CONSTRAINT fk_players_club_id FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE SET NULL',
  'SELECT 1'
); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- President ↔ club: same link pattern as players.club_id.
SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema=@db AND table_name='presidents' AND constraint_name='fk_presidents_club_id') = 0
  AND (SELECT COUNT(*) FROM presidents p LEFT JOIN clubs c ON c.id = p.club_id WHERE p.club_id IS NOT NULL AND c.id IS NULL) = 0,
  'ALTER TABLE presidents ADD CONSTRAINT fk_presidents_club_id FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE SET NULL',
  'SELECT 1'
); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema=@db AND table_name='presidents' AND constraint_name='fk_presidents_user_id') = 0
  AND (SELECT COUNT(*) FROM presidents p LEFT JOIN users u ON u.id = p.user_id WHERE p.user_id IS NOT NULL AND u.id IS NULL) = 0,
  'ALTER TABLE presidents ADD CONSTRAINT fk_presidents_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE',
  'SELECT 1'
); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema=@db AND table_name='clubs' AND constraint_name='fk_clubs_president_id') = 0
  AND (SELECT COUNT(*) FROM clubs c LEFT JOIN presidents p ON p.id = c.president_id WHERE c.president_id IS NOT NULL AND p.id IS NULL) = 0,
  'ALTER TABLE clubs ADD CONSTRAINT fk_clubs_president_id FOREIGN KEY (president_id) REFERENCES presidents(id) ON DELETE SET NULL',
  'SELECT 1'
); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema=@db AND table_name='clubs' AND constraint_name='fk_clubs_president_player_id') = 0
  AND (SELECT COUNT(*) FROM clubs c LEFT JOIN players p ON p.id = c.president_player_id WHERE c.president_player_id IS NOT NULL AND p.id IS NULL) = 0,
  'ALTER TABLE clubs ADD CONSTRAINT fk_clubs_president_player_id FOREIGN KEY (president_player_id) REFERENCES players(id) ON DELETE SET NULL',
  'SELECT 1'
); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema=@db AND table_name='player_contracts' AND constraint_name='fk_contracts_offered_by_president') = 0
  AND (SELECT COUNT(*) FROM player_contracts pc LEFT JOIN presidents p ON p.id = pc.offered_by_president_id WHERE pc.offered_by_president_id IS NOT NULL AND p.id IS NULL) = 0,
  'ALTER TABLE player_contracts ADD CONSTRAINT fk_contracts_offered_by_president FOREIGN KEY (offered_by_president_id) REFERENCES presidents(id) ON DELETE SET NULL',
  'SELECT 1'
); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema=@db AND table_name='matches' AND constraint_name='fk_matches_tournament_id') = 0
  AND (SELECT COUNT(*) FROM matches m LEFT JOIN tournaments t ON t.id = m.tournament_id WHERE m.tournament_id IS NOT NULL AND t.id IS NULL) = 0,
  'ALTER TABLE matches ADD CONSTRAINT fk_matches_tournament_id FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE SET NULL',
  'SELECT 1'
); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema=@db AND table_name='matches' AND constraint_name='fk_matches_home_club_id') = 0
  AND (SELECT COUNT(*) FROM matches m LEFT JOIN clubs c ON c.id = m.home_club_id WHERE m.home_club_id IS NOT NULL AND c.id IS NULL) = 0,
  'ALTER TABLE matches ADD CONSTRAINT fk_matches_home_club_id FOREIGN KEY (home_club_id) REFERENCES clubs(id) ON DELETE SET NULL',
  'SELECT 1'
); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema=@db AND table_name='matches' AND constraint_name='fk_matches_away_club_id') = 0
  AND (SELECT COUNT(*) FROM matches m LEFT JOIN clubs c ON c.id = m.away_club_id WHERE m.away_club_id IS NOT NULL AND c.id IS NULL) = 0,
  'ALTER TABLE matches ADD CONSTRAINT fk_matches_away_club_id FOREIGN KEY (away_club_id) REFERENCES clubs(id) ON DELETE SET NULL',
  'SELECT 1'
); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema=@db AND table_name='matches' AND constraint_name='fk_matches_home_player_id') = 0
  AND (SELECT COUNT(*) FROM matches m LEFT JOIN players p ON p.id = m.home_player_id WHERE m.home_player_id IS NOT NULL AND p.id IS NULL) = 0,
  'ALTER TABLE matches ADD CONSTRAINT fk_matches_home_player_id FOREIGN KEY (home_player_id) REFERENCES players(id) ON DELETE SET NULL',
  'SELECT 1'
); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema=@db AND table_name='matches' AND constraint_name='fk_matches_away_player_id') = 0
  AND (SELECT COUNT(*) FROM matches m LEFT JOIN players p ON p.id = m.away_player_id WHERE m.away_player_id IS NOT NULL AND p.id IS NULL) = 0,
  'ALTER TABLE matches ADD CONSTRAINT fk_matches_away_player_id FOREIGN KEY (away_player_id) REFERENCES players(id) ON DELETE SET NULL',
  'SELECT 1'
); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema=@db AND table_name='comments' AND constraint_name='fk_comments_post_id') = 0
  AND (SELECT COUNT(*) FROM comments c LEFT JOIN posts p ON p.id = c.post_id WHERE c.post_id IS NOT NULL AND p.id IS NULL) = 0,
  'ALTER TABLE comments ADD CONSTRAINT fk_comments_post_id FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE',
  'SELECT 1'
); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema=@db AND table_name='match_player_stats' AND constraint_name='fk_mps_match_id') = 0
  AND (SELECT COUNT(*) FROM match_player_stats s LEFT JOIN matches m ON m.id = s.match_id WHERE s.match_id IS NOT NULL AND m.id IS NULL) = 0,
  'ALTER TABLE match_player_stats ADD CONSTRAINT fk_mps_match_id FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE',
  'SELECT 1'
); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema=@db AND table_name='join_requests' AND constraint_name='fk_join_requests_player_id') = 0
  AND (SELECT COUNT(*) FROM join_requests jr LEFT JOIN players p ON p.id = jr.player_id WHERE jr.player_id IS NOT NULL AND p.id IS NULL) = 0,
  'ALTER TABLE join_requests ADD CONSTRAINT fk_join_requests_player_id FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE',
  'SELECT 1'
); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema=@db AND table_name='join_requests' AND constraint_name='fk_join_requests_club_id') = 0
  AND (SELECT COUNT(*) FROM join_requests jr LEFT JOIN clubs c ON c.id = jr.club_id WHERE jr.club_id IS NOT NULL AND c.id IS NULL) = 0,
  'ALTER TABLE join_requests ADD CONSTRAINT fk_join_requests_club_id FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE',
  'SELECT 1'
); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema=@db AND table_name='lifestyle_purchases' AND constraint_name='fk_lifestyle_purchases_player_id') = 0
  AND (SELECT COUNT(*) FROM lifestyle_purchases lp LEFT JOIN players p ON p.id = lp.player_id WHERE lp.player_id IS NOT NULL AND p.id IS NULL) = 0,
  'ALTER TABLE lifestyle_purchases ADD CONSTRAINT fk_lifestyle_purchases_player_id FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE',
  'SELECT 1'
); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema=@db AND table_name='lifestyle_purchases' AND constraint_name='fk_lifestyle_purchases_item_id') = 0
  AND (SELECT COUNT(*) FROM lifestyle_purchases lp LEFT JOIN lifestyle_items li ON li.id = lp.item_id WHERE lp.item_id IS NOT NULL AND li.id IS NULL) = 0,
  'ALTER TABLE lifestyle_purchases ADD CONSTRAINT fk_lifestyle_purchases_item_id FOREIGN KEY (item_id) REFERENCES lifestyle_items(id) ON DELETE CASCADE',
  'SELECT 1'
); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema=@db AND table_name='trophy_placements' AND constraint_name='fk_trophy_placements_trophy_item_id') = 0
  AND (SELECT COUNT(*) FROM trophy_placements tp LEFT JOIN trophy_items ti ON ti.id = tp.trophy_item_id WHERE tp.trophy_item_id IS NOT NULL AND ti.id IS NULL) = 0,
  'ALTER TABLE trophy_placements ADD CONSTRAINT fk_trophy_placements_trophy_item_id FOREIGN KEY (trophy_item_id) REFERENCES trophy_items(id) ON DELETE SET NULL',
  'SELECT 1'
); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema=@db AND table_name='live_matches' AND constraint_name='fk_live_matches_match_id') = 0
  AND (SELECT COUNT(*) FROM live_matches lm LEFT JOIN matches m ON m.id = lm.match_id WHERE lm.match_id IS NOT NULL AND m.id IS NULL) = 0,
  'ALTER TABLE live_matches ADD CONSTRAINT fk_live_matches_match_id FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE SET NULL',
  'SELECT 1'
); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema=@db AND table_name='shirt_sales' AND constraint_name='fk_shirt_sales_player_id') = 0
  AND (SELECT COUNT(*) FROM shirt_sales ss LEFT JOIN players p ON p.id = ss.player_id WHERE ss.player_id IS NOT NULL AND p.id IS NULL) = 0,
  'ALTER TABLE shirt_sales ADD CONSTRAINT fk_shirt_sales_player_id FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE SET NULL',
  'SELECT 1'
); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema=@db AND table_name='shirt_sales' AND constraint_name='fk_shirt_sales_club_id') = 0
  AND (SELECT COUNT(*) FROM shirt_sales ss LEFT JOIN clubs c ON c.id = ss.club_id WHERE ss.club_id IS NOT NULL AND c.id IS NULL) = 0,
  'ALTER TABLE shirt_sales ADD CONSTRAINT fk_shirt_sales_club_id FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE SET NULL',
  'SELECT 1'
); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema=@db AND table_name='dressing_rooms' AND constraint_name='fk_dressing_rooms_match_id') = 0
  AND (SELECT COUNT(*) FROM dressing_rooms dr LEFT JOIN matches m ON m.id = dr.match_id WHERE dr.match_id IS NOT NULL AND m.id IS NULL) = 0,
  'ALTER TABLE dressing_rooms ADD CONSTRAINT fk_dressing_rooms_match_id FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE',
  'SELECT 1'
); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema=@db AND table_name='dressing_rooms' AND constraint_name='fk_dressing_rooms_club_id') = 0
  AND (SELECT COUNT(*) FROM dressing_rooms dr LEFT JOIN clubs c ON c.id = dr.club_id WHERE dr.club_id IS NOT NULL AND c.id IS NULL) = 0,
  'ALTER TABLE dressing_rooms ADD CONSTRAINT fk_dressing_rooms_club_id FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE',
  'SELECT 1'
); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema=@db AND table_name='predictions' AND constraint_name='fk_predictions_live_match_id') = 0
  AND (SELECT COUNT(*) FROM predictions pr LEFT JOIN live_matches lm ON lm.id = pr.live_match_id WHERE pr.live_match_id IS NOT NULL AND lm.id IS NULL) = 0,
  'ALTER TABLE predictions ADD CONSTRAINT fk_predictions_live_match_id FOREIGN KEY (live_match_id) REFERENCES live_matches(id) ON DELETE CASCADE',
  'SELECT 1'
); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── data checks (safe/idempotent CHECK constraints) ─────────────────────────
-- Guarded: only add when constraint missing and existing rows already satisfy.

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema=@db AND table_name='matches' AND constraint_name='chk_matches_scores_nonneg') = 0
  AND (SELECT COUNT(*) FROM matches WHERE (home_score IS NOT NULL AND home_score < 0) OR (away_score IS NOT NULL AND away_score < 0)) = 0,
  'ALTER TABLE matches ADD CONSTRAINT chk_matches_scores_nonneg CHECK (home_score >= 0 AND away_score >= 0)',
  'SELECT 1'
); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema=@db AND table_name='match_player_stats' AND constraint_name='chk_mps_nonneg') = 0
  AND (SELECT COUNT(*) FROM match_player_stats WHERE (goals IS NOT NULL AND goals < 0) OR (assists IS NOT NULL AND assists < 0) OR (rating IS NOT NULL AND rating < 0)) = 0,
  'ALTER TABLE match_player_stats ADD CONSTRAINT chk_mps_nonneg CHECK (goals >= 0 AND assists >= 0 AND rating >= 0)',
  'SELECT 1'
); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema=@db AND table_name='clubs' AND constraint_name='chk_clubs_nonneg_core') = 0
  AND (SELECT COUNT(*) FROM clubs WHERE (wins IS NOT NULL AND wins < 0) OR (losses IS NOT NULL AND losses < 0) OR (draws IS NOT NULL AND draws < 0) OR (goals_scored IS NOT NULL AND goals_scored < 0) OR (goals_conceded IS NOT NULL AND goals_conceded < 0) OR (matches_ranked IS NOT NULL AND matches_ranked < 0) OR (stc IS NOT NULL AND stc < 0)) = 0,
  'ALTER TABLE clubs ADD CONSTRAINT chk_clubs_nonneg_core CHECK (wins >= 0 AND losses >= 0 AND draws >= 0 AND goals_scored >= 0 AND goals_conceded >= 0 AND matches_ranked >= 0 AND stc >= 0)',
  'SELECT 1'
); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema=@db AND table_name='players' AND constraint_name='chk_players_nonneg_core') = 0
  AND (SELECT COUNT(*) FROM players WHERE (goals IS NOT NULL AND goals < 0) OR (assists IS NOT NULL AND assists < 0) OR (matches_played IS NOT NULL AND matches_played < 0) OR (wins_count IS NOT NULL AND wins_count < 0) OR (losses_count IS NOT NULL AND losses_count < 0) OR (draws_count IS NOT NULL AND draws_count < 0) OR (man_of_the_match IS NOT NULL AND man_of_the_match < 0) OR (stc IS NOT NULL AND stc < 0)) = 0,
  'ALTER TABLE players ADD CONSTRAINT chk_players_nonneg_core CHECK (goals >= 0 AND assists >= 0 AND matches_played >= 0 AND wins_count >= 0 AND losses_count >= 0 AND draws_count >= 0 AND man_of_the_match >= 0 AND stc >= 0)',
  'SELECT 1'
); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema=@db AND table_name='notifications' AND constraint_name='chk_notifications_read_bool') = 0
  AND (SELECT COUNT(*) FROM notifications WHERE `read` NOT IN (0,1) OR `read` IS NULL) = 0,
  'ALTER TABLE notifications ADD CONSTRAINT chk_notifications_read_bool CHECK (`read` IN (0,1))',
  'SELECT 1'
); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema=@db AND table_name='inbox_messages' AND constraint_name='chk_inbox_is_read_bool') = 0
  AND (SELECT COUNT(*) FROM inbox_messages WHERE is_read NOT IN (0,1) OR is_read IS NULL) = 0,
  'ALTER TABLE inbox_messages ADD CONSTRAINT chk_inbox_is_read_bool CHECK (is_read IN (0,1))',
  'SELECT 1'
); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- new_tables_migration.sql
-- CREATE TABLE IF NOT EXISTS for dedicated-table entities.
-- League and competition concepts now live in league_entities.

CREATE TABLE IF NOT EXISTS challenges (
  id                    VARCHAR(36)   NOT NULL PRIMARY KEY,
  challenger_id         VARCHAR(36),
  challenger_club_id    VARCHAR(36),
  challenger_club_name  VARCHAR(255),
  opponent_club_id      VARCHAR(36),
  opponent_club_name    VARCHAR(255),
  opponent_player_id    VARCHAR(36),
  opponent_player_name  VARCHAR(255),
  type                  VARCHAR(50)   DEFAULT 'friendly',
  scheduled_date        DATETIME,
  message               TEXT,
  status                VARCHAR(50)   DEFAULT 'pending',
  home_score            INT,
  away_score            INT,
  winner_club_id        VARCHAR(36),
  winner_player_id      VARCHAR(36),
  wager_credits         DECIMAL(10,2) DEFAULT 0,
  challenger_wager_paid TINYINT(1)    DEFAULT 0,
  opponent_wager_paid   TINYINT(1)    DEFAULT 0,
  live_match_id         VARCHAR(36),
  created_date          DATETIME      DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS club_achievements (
  id              VARCHAR(36)   NOT NULL PRIMARY KEY,
  club_id         VARCHAR(36),
  club_name       VARCHAR(255),
  club_logo_url   TEXT,
  club_tag        VARCHAR(50),
  source_id       VARCHAR(36),
  source_type     VARCHAR(50),
  source_name     VARCHAR(255),
  season_id       VARCHAR(36),
  season_number   INT,
  season_label    VARCHAR(100),
  position        INT,
  position_label  VARCHAR(100),
  badge_type      VARCHAR(50)   DEFAULT 'participant',
  stc_awarded     DECIMAL(10,2) DEFAULT 0,
  trophy_image_url TEXT,
  awarded_at      DATETIME,
  created_date    DATETIME      DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS live_match_events (
  id               VARCHAR(36)  NOT NULL PRIMARY KEY,
  live_match_id    VARCHAR(36),
  club_id          VARCHAR(36),
  club_name        VARCHAR(255),
  scorer_email     VARCHAR(255),
  scorer_gamertag  VARCHAR(100),
  assist_email     VARCHAR(255),
  assist_gamertag  VARCHAR(100),
  is_penalty       TINYINT(1)   DEFAULT 0,
  is_own_goal      TINYINT(1)   DEFAULT 0,
  minute           INT,
  created_date     DATETIME     DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS player_achievements (
  id               VARCHAR(36)   NOT NULL PRIMARY KEY,
  player_id        VARCHAR(36),
  player_email     VARCHAR(255),
  player_gamertag  VARCHAR(100),
  club_id          VARCHAR(36),
  club_name        VARCHAR(255),
  source_id        VARCHAR(36),
  source_type      VARCHAR(50),
  source_name      VARCHAR(255),
  season_id        VARCHAR(36),
  season_number    INT,
  season_label     VARCHAR(100),
  position         INT,
  position_label   VARCHAR(100),
  badge_type       VARCHAR(50)   DEFAULT 'participant',
  trophy_image_url TEXT,
  awarded_at       DATETIME,
  created_date     DATETIME      DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS player_contract_history (
  id           VARCHAR(36)  NOT NULL PRIMARY KEY,
  contract_id  VARCHAR(36),
  action_type  VARCHAR(50),
  action_by    VARCHAR(36),
  action_note  TEXT,
  created_date DATETIME     DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rating_history (
  id                      VARCHAR(36)   NOT NULL PRIMARY KEY,
  club_id                 VARCHAR(36),
  club_name               VARCHAR(255),
  opponent_club_id        VARCHAR(36),
  opponent_club_name      VARCHAR(255),
  match_id                VARCHAR(36),
  competition_type        VARCHAR(50)   DEFAULT 'tournament',
  competition_slug        VARCHAR(50),
  division                INT,
  phase                   VARCHAR(50),
  result                  VARCHAR(1),
  home_score              INT           DEFAULT 0,
  away_score              INT           DEFAULT 0,
  points_before           DECIMAL(10,2) DEFAULT 0,
  points_after            DECIMAL(10,2) DEFAULT 0,
  points_change           DECIMAL(10,2) DEFAULT 0,
  opponent_rank           INT           DEFAULT 0,
  opp_strength_multiplier DECIMAL(5,2)  DEFAULT 1.0,
  competition_multiplier  DECIMAL(5,2)  DEFAULT 1.0,
  stage_multiplier        DECIMAL(5,2)  DEFAULT 1.0,
  voided                  TINYINT(1)    DEFAULT 0,
  void_reason             TEXT,
  played_at               DATETIME,
  created_date            DATETIME      DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reward_configs (
  id             VARCHAR(36)   NOT NULL PRIMARY KEY,
  source_id      VARCHAR(36),
  source_type    VARCHAR(50),
  source_name    VARCHAR(255),
  position       INT,
  position_label VARCHAR(100),
  badge_type     VARCHAR(50)   DEFAULT 'participant',
  stc_amount     DECIMAL(10,2) DEFAULT 0,
  created_date   DATETIME      DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transfer_windows (
  id                 VARCHAR(36)  NOT NULL PRIMARY KEY,
  status             VARCHAR(20)  DEFAULT 'closed',
  start_date         DATETIME,
  end_date           DATETIME,
  label              VARCHAR(100),
  notes              TEXT,
  transfers_executed INT          DEFAULT 0,
  created_date       DATETIME     DEFAULT CURRENT_TIMESTAMP
);

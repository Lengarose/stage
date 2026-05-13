require('./constants/env').applyToProcessEnv();

const { app, server } = require('./server/express/index');
const { PORT } = require('./constants/constants');
const { verifyToken } = require('./server/authMiddleware');
const { errorHandler } = require('./server/middleware/errorHandler');
const { notFoundHandler } = require('./server/middleware/notFoundHandler');
const { passport } = require('./server/oauth/passportConfig');

app.use(require('express').json());
app.use(require('express').urlencoded({ extended: true })); // needed for Apple POST callback
app.use(passport.initialize());

const { ensureUploadsDir } = require('./constants/paths');

// Auth (public) — email/password + OAuth
app.use('/api/stage/auth', require('./server/controllers/authController'));
app.use('/api/stage/auth', require('./server/controllers/oauthController'));

// File upload + server functions (protected)
app.use('/api/stage/upload',    verifyToken, require('./server/controllers/uploadController'));
app.use('/api/stage/functions', verifyToken, require('./server/controllers/functionsController'));

// Protected routes
app.use('/api/stage/players',           verifyToken, require('./server/controllers/playerController'));
app.use('/api/stage/clubs',             verifyToken, require('./server/controllers/clubController'));
app.use('/api/stage/matches',           verifyToken, require('./server/controllers/matchController'));
app.use('/api/stage/tournaments',       verifyToken, require('./server/controllers/tournamentController'));
app.use('/api/stage/posts',             verifyToken, require('./server/controllers/postController'));
app.use('/api/stage/comments',          verifyToken, require('./server/controllers/commentController'));
app.use('/api/stage/match-player-stats',verifyToken, require('./server/controllers/matchPlayerStatController'));
app.use('/api/stage/notifications',     verifyToken, require('./server/controllers/notificationController'));
app.use('/api/stage/player-contracts',  verifyToken, require('./server/controllers/playerContractController'));
app.use('/api/stage/inbox-messages',    verifyToken, require('./server/controllers/inboxMessageController'));
app.use('/api/stage/predictions',       verifyToken, require('./server/controllers/predictionController'));
app.use('/api/stage/press-conferences', verifyToken, require('./server/controllers/pressConferenceController'));
app.use('/api/stage/press-questions',   verifyToken, require('./server/controllers/pressQuestionController'));
app.use('/api/stage/press-articles',    verifyToken, require('./server/controllers/pressArticleController'));
app.use('/api/stage/direct-messages',   verifyToken, require('./server/controllers/directMessageController'));
app.use('/api/stage/stc-transactions',  verifyToken, require('./server/controllers/stcTransactionController'));
app.use('/api/stage/shirt-sales',       verifyToken, require('./server/controllers/shirtSaleController'));
app.use('/api/stage/dressing-rooms',    verifyToken, require('./server/controllers/dressingRoomController'));
app.use('/api/stage/follows',           verifyToken, require('./server/controllers/followController'));
app.use('/api/stage/join-requests',     verifyToken, require('./server/controllers/joinRequestController'));
app.use('/api/stage/lifestyle-items',   verifyToken, require('./server/controllers/lifestyleItemController'));
app.use('/api/stage/lifestyle-purchases', verifyToken, require('./server/controllers/lifestylePurchaseController'));
app.use('/api/stage/user-purchases',    verifyToken, require('./server/controllers/userPurchaseController'));
app.use('/api/stage/trophy-items',      verifyToken, require('./server/controllers/trophyItemController'));
app.use('/api/stage/trophy-placements', verifyToken, require('./server/controllers/trophyPlacementController'));
app.use('/api/stage/chat-messages',     verifyToken, require('./server/controllers/chatMessageController'));
app.use('/api/stage/news-items',        verifyToken, require('./server/controllers/newsItemController'));
app.use('/api/stage/live-matches',              verifyToken, require('./server/controllers/liveMatchController'));
app.use('/api/stage/landing-page-contents',     verifyToken, require('./server/controllers/landingPageContentController'));
app.use('/api/stage/home-page-contents',        verifyToken, require('./server/controllers/homePageContentController'));
app.use('/api/stage/landing-configs',           verifyToken, require('./server/controllers/landingConfigController'));
app.use('/api/stage/transfer-windows',          verifyToken, require('./server/controllers/transferWindowController'));
app.use('/api/stage/fixture-admin-actions',     verifyToken, require('./server/controllers/fixtureAdminActionController'));
app.use('/api/stage/reward-configs',             verifyToken, require('./server/controllers/rewardConfigController'));
app.use('/api/stage/club-achievements',          verifyToken, require('./server/controllers/clubAchievementController'));
app.use('/api/stage/player-achievements',        verifyToken, require('./server/controllers/playerAchievementController'));
app.use('/api/stage/player-stc-transactions',   verifyToken, require('./server/controllers/playerStcTransactionController'));

// EAFC-inspired modules
app.use('/api/stage/objective-definitions',     verifyToken, require('./server/controllers/objectiveDefinitionController'));
app.use('/api/stage/objective-progresses',      verifyToken, require('./server/controllers/objectiveProgressController'));
app.use('/api/stage/archetypes',                verifyToken, require('./server/controllers/archetypeController'));
app.use('/api/stage/chemistry-links',           verifyToken, require('./server/controllers/chemistryLinkController'));
app.use('/api/stage/sbcs',                      verifyToken, require('./server/controllers/sbcController'));
app.use('/api/stage/sbc-submissions',           verifyToken, require('./server/controllers/sbcSubmissionController'));

// Competition & league entity stack (generic CRUD via single league_entities table)
const { makeRouter: makeLeagueRouter } = require('./server/controllers/leagueEntityController');
app.use('/api/stage/competitions',               verifyToken, makeLeagueRouter('competition'));
app.use('/api/stage/competition-seasons',        verifyToken, makeLeagueRouter('competition_season'));
app.use('/api/stage/competition-fixtures',       verifyToken, makeLeagueRouter('competition_fixture'));
app.use('/api/stage/competition-standings',      verifyToken, makeLeagueRouter('competition_standing'));
app.use('/api/stage/regional-leagues',           verifyToken, makeLeagueRouter('regional_league'));
app.use('/api/stage/regional-league-fixtures',   verifyToken, makeLeagueRouter('regional_league_fixture'));
app.use('/api/stage/regional-league-standings',  verifyToken, makeLeagueRouter('regional_league_standing'));
app.use('/api/stage/qualification-entries',      verifyToken, makeLeagueRouter('qualification_entry'));
app.use('/api/stage/ranking-configs',            verifyToken, makeLeagueRouter('ranking_config'));
app.use('/api/stage/season-registrations',       verifyToken, makeLeagueRouter('season_registration'));

// Static `/uploads` — same folder as multer (see constants/paths.js); created if missing
const uploadsStaticDir = ensureUploadsDir();
app.use('/uploads', require('express').static(uploadsStaticDir));

// OAuth error landing page (used when FRONTEND_URL points to this backend host)
app.get('/auth/error', (_req, res) => {
  res.status(200).send(
    '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Authentication failed</title></head><body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:24px;line-height:1.5"><h2>Authentication failed</h2><p>Your sign-in attempt could not be completed. Please go back and try again.</p><p><a href="/" style="color:#2563eb">Return to home</a></p></body></html>'
  );
});

// OAuth callback fallback for hosts where frontend route /auth/callback is not directly served.
// It mirrors stageClient token keys, then navigates to home.
app.get('/auth/callback', (req, res) => {
  const {
    accessToken = '',
    refreshToken = '',
    userId = '',
    playerId = '',
    ownerId = '',
  } = req.query || {};

  const j = (v) => JSON.stringify(String(v || ''));
  res.status(200).send(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Signing in...</title>
  </head>
  <body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:24px">
    <p>Finishing sign-in...</p>
    <script>
      (function () {
        try {
          var accessToken = ${j(accessToken)};
          var refreshToken = ${j(refreshToken)};
          var userId = ${j(userId)};
          var playerId = ${j(playerId)};
          var ownerId = ${j(ownerId)};
          if (accessToken)  localStorage.setItem('stage_access_token', accessToken);
          if (refreshToken) localStorage.setItem('stage_refresh_token', refreshToken);
          if (userId)       localStorage.setItem('stage_user_id', userId);
          if (playerId)     localStorage.setItem('stage_player_id', playerId);
          if (ownerId)      localStorage.setItem('stage_owner_id', ownerId);
        } catch (e) {}
        window.location.replace('/');
      })();
    </script>
  </body>
</html>`);
});

// Health checks
app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true, service: 'stage-server' });
});
app.get('/api/stage/health', (_req, res) => {
  res.status(200).json({ ok: true, service: 'stage-server' });
});

// Public pre-login landing page config — no auth
app.get('/api/stage/public/landing-content', async (_req, res) => {
  try {
    const LC = require('./server/models/landingConfigModel');
    const rows = await new LC().selectAll(1);
    res.json(rows[0] || {});
  } catch { res.json({}); }
});

app.use(notFoundHandler);
app.use(errorHandler);

// ── Startup migrations ────────────────────────────────────────────────────────
const { EXECUTESQL } = require('./server/db/database');

async function runStartupMigrations() {
  const addCol = async (table, column, definition) => {
    try {
      const rows = await EXECUTESQL(
        'SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1',
        [table, column]
      );
      if (!rows.length) {
        await EXECUTESQL(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
        console.log(`[migration] Added ${table}.${column}`);
      }
    } catch (err) {
      console.error(`[migration] Failed to add ${table}.${column}:`, err.message);
    }
  };

  await addCol('players', 'stc', 'DECIMAL(12,2) DEFAULT 0');
  await addCol('players', 'home_player_email', 'VARCHAR(255) NULL');
  await addCol('matches', 'home_player_email', 'VARCHAR(255) NULL');
  await addCol('matches', 'away_player_email', 'VARCHAR(255) NULL');

  // Match result submission fields
  await addCol('matches', 'home_goal_events', 'TEXT NULL');
  await addCol('matches', 'away_goal_events', 'TEXT NULL');
  await addCol('matches', 'result_home_submitted', 'TINYINT(1) DEFAULT 0');
  await addCol('matches', 'result_away_submitted', 'TINYINT(1) DEFAULT 0');
  await addCol('matches', 'home_submission', 'TEXT NULL');
  await addCol('matches', 'away_submission', 'TEXT NULL');
  await addCol('matches', 'stats_processed', 'TINYINT(1) DEFAULT 0');
  await addCol('matches', 'competition_context', 'VARCHAR(255) NULL');

  // Submitted-score reconciliation (used when home and away submit separately
  // and need to agree before the match is finalised).
  await addCol('matches', 'home_submitted_score',  'VARCHAR(20) NULL');
  await addCol('matches', 'away_submitted_score',  'VARCHAR(20) NULL');
  await addCol('matches', 'first_submission_at',   'DATETIME NULL');
  await addCol('matches', 'first_submitter_club_id', 'VARCHAR(36) NULL');

  // Winner / loser denormalisation — populated when the match finishes so
  // standings / rankings can read without an extra join.
  await addCol('matches', 'winner_club_id',     'VARCHAR(36) NULL');
  await addCol('matches', 'winner_club_name',   'VARCHAR(150) NULL');
  await addCol('matches', 'winner_player_id',   'VARCHAR(36) NULL');
  await addCol('matches', 'winner_player_name', 'VARCHAR(150) NULL');
  await addCol('matches', 'loser_club_id',      'VARCHAR(36) NULL');
  await addCol('matches', 'loser_club_name',    'VARCHAR(150) NULL');
  await addCol('matches', 'loser_player_id',    'VARCHAR(36) NULL');
  await addCol('matches', 'loser_player_name',  'VARCHAR(150) NULL');

  // Tournament bracket bookkeeping
  await addCol('matches', 'group_number', 'INT NULL');
  await addCol('matches', 'bracket_side', 'VARCHAR(20) NULL');

  // Media / proof / streaming
  await addCol('matches', 'video_url',         'TEXT NULL');
  await addCol('matches', 'proof_url',         'TEXT NULL');
  await addCol('matches', 'home_stream_url',   'TEXT NULL');
  await addCol('matches', 'away_stream_url',   'TEXT NULL');

  // Forfeit workflow
  await addCol('matches', 'forfeit_claimed_by', 'VARCHAR(255) NULL');
  await addCol('matches', 'forfeit_proof_url',  'TEXT NULL');
  await addCol('matches', 'forfeit_status',     'VARCHAR(50) NULL');

  // Admin / note fields
  await addCol('matches', 'admin_notes', 'TEXT NULL');
  await addCol('matches', 'notes',       'TEXT NULL');

  // Wager identity (which players staked each side, separate from the
  // match itself which can be club-level).
  await addCol('matches', 'wager_home_player_id', 'VARCHAR(36) NULL');
  await addCol('matches', 'wager_away_player_id', 'VARCHAR(36) NULL');

  // Where this match came from (league fixture, knockout tie, friendly, …)
  await addCol('matches', 'source_fixture_id',   'VARCHAR(36) NULL');
  await addCol('matches', 'source_fixture_type', 'VARCHAR(50) NULL');

  // match_player_stats — add player_id and gamertag (schema v2)
  await addCol('match_player_stats', 'player_id', 'VARCHAR(36) NULL');
  await addCol('match_player_stats', 'player_gamertag', 'VARCHAR(255) NULL');

  // Player wallet transaction table
  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS player_stc_transactions (
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
  )`).catch(err => console.error('[migration] player_stc_transactions:', err.message));

  // Salary tracking on contracts
  await addCol('player_contracts', 'last_salary_paid_at', 'DATETIME NULL');

  // Lifestyle items expanded schema (v2)
  await addCol('lifestyle_items', 'category',                    "VARCHAR(50) DEFAULT 'fashion'");
  await addCol('lifestyle_items', 'subcategory',                 'VARCHAR(100)');
  await addCol('lifestyle_items', 'description',                 'TEXT');
  await addCol('lifestyle_items', 'image_url',                   'VARCHAR(500)');
  await addCol('lifestyle_items', 'tier',                        "VARCHAR(50) DEFAULT 'standard'");
  await addCol('lifestyle_items', 'price_stc',                   'BIGINT DEFAULT 0');
  await addCol('lifestyle_items', 'rent_price_stc',              'BIGINT DEFAULT 0');
  await addCol('lifestyle_items', 'rent_duration_days',          'INT DEFAULT 30');
  await addCol('lifestyle_items', 'invest_price_stc',            'BIGINT DEFAULT 0');
  await addCol('lifestyle_items', 'invest_return_rate',          'DECIMAL(5,2) DEFAULT 0');
  await addCol('lifestyle_items', 'invest_duration_days',        'INT DEFAULT 30');
  await addCol('lifestyle_items', 'passive_income_stc',          'BIGINT DEFAULT 0');
  await addCol('lifestyle_items', 'passive_income_interval_days','INT DEFAULT 7');
  await addCol('lifestyle_items', 'weekly_maintenance_stc',      'BIGINT DEFAULT 0');
  await addCol('lifestyle_items', 'can_buy',                     'TINYINT(1) DEFAULT 1');
  await addCol('lifestyle_items', 'can_rent',                    'TINYINT(1) DEFAULT 0');
  await addCol('lifestyle_items', 'can_invest',                  'TINYINT(1) DEFAULT 0');
  await addCol('lifestyle_items', 'can_sell',                    'TINYINT(1) DEFAULT 1');
  await addCol('lifestyle_items', 'sell_value_percent',          'INT DEFAULT 60');
  await addCol('lifestyle_items', 'allows_multiple',             'TINYINT(1) DEFAULT 1');

  // Club finance: enrich stc_transactions
  await addCol('stc_transactions', 'category',      'VARCHAR(100)');
  await addCol('stc_transactions', 'balance_after',  'DECIMAL(12,2)');

  // Player market value system (v1)
  await addCol('players', 'market_value_stc',  'BIGINT DEFAULT 250000');
  await addCol('players', 'matches_played',    'INT DEFAULT 0');
  await addCol('players', 'avg_match_rating',  'DECIMAL(4,2) DEFAULT 0');
  await addCol('players', 'wins_count',        'INT DEFAULT 0');
  await addCol('players', 'man_of_the_match',  'INT DEFAULT 0');
  await addCol('players', 'clean_sheets',      'INT DEFAULT 0');
  await addCol('players', 'form_last10',       'TEXT NULL');
  await addCol('players', 'value_updated_at',  'DATETIME NULL');

  // Market value config table
  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS market_value_config (
    id            VARCHAR(36)  PRIMARY KEY,
    name          VARCHAR(100) DEFAULT 'default',
    weights       JSON,
    is_active     TINYINT(1)   DEFAULT 1,
    created_date  DATETIME     DEFAULT CURRENT_TIMESTAMP,
    updated_date  DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`).catch(err => console.error('[migration] market_value_config:', err.message));

  // Seed default config if none exists
  const cfgCount = await EXECUTESQL('SELECT COUNT(*) as n FROM market_value_config', []).catch(() => [{ n: 1 }]);
  if (Number(cfgCount[0]?.n || 0) === 0) {
    const { v4: _uuid } = require('uuid');
    const defaultWeights = {
      base_per_match: 60000,
      max_base: 8000000,
      goal_rate_bonus: 2000000,
      assist_rate_bonus: 1000000,
      clean_sheet_rate_bonus: 2500000,
      motm_bonus: 300000,
      consistency_boost: 0.15,
      form_boost: 0.20,
      form_penalty: 0.12,
      win_rate_boost: 0.10,
      ovr_weight: 0.08,
      spike_cap_up: 0.50,
      spike_cap_down: 0.35,
    };
    await EXECUTESQL(
      "INSERT INTO market_value_config (id, name, weights, is_active) VALUES (?, 'default', ?, 1)",
      [_uuid(), JSON.stringify(defaultWeights)]
    ).catch(() => {});
  }

  // Shirt sales system (v2) — aggregated per-player-per-match records
  await addCol('shirt_sales', 'match_id', 'VARCHAR(36) NULL');
  await addCol('shirt_sales', 'quantity', 'INT DEFAULT 1');

  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS shirt_sales_config (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(100) DEFAULT 'default',
    weights       JSON,
    is_active     TINYINT(1) DEFAULT 1,
    created_date  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_date  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`).catch(err => console.error('[migration] shirt_sales_config:', err.message));

  const shirtCfgCount = await EXECUTESQL('SELECT COUNT(*) as n FROM shirt_sales_config', []).catch(() => [{ n: 1 }]);
  if (Number(shirtCfgCount[0]?.n || 0) === 0) {
    await EXECUTESQL(
      "INSERT INTO shirt_sales_config (name, weights, is_active) VALUES ('default', ?, 1)",
      [JSON.stringify({
        base_per_mv_1m: 0.5, goal_demand: 4, assist_demand: 2,
        rating_demand_per_point: 1.5, motm_demand: 6, clean_sheet_demand: 2,
        form_influence: 0.12, contract_boost: 0.10, max_per_match: 12,
        price_base: 3000, price_per_ovr_above_70: 800,
        price_per_goal: 300, price_per_assist: 200, price_per_rating_point: 1500,
      })]
    ).catch(() => {});
  }

  // Stadium economy — match-level ticket data + stadium name on clubs
  await addCol('clubs',   'stadium_name',           'VARCHAR(150) NULL');
  await addCol('matches', 'home_ticket_revenue',     'DECIMAL(12,2) DEFAULT 0');
  await addCol('matches', 'home_ticket_attendance',  'INT DEFAULT 0');
  await addCol('matches', 'home_ticket_capacity',    'INT DEFAULT 0');
  await addCol('matches', 'home_ticket_price',       'DECIMAL(8,2) DEFAULT 0');
  await addCol('matches', 'home_ticket_pct',         'TINYINT DEFAULT 0');

  // Stadium config table — admin-configurable tier values
  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS stadium_config (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    level            INT NOT NULL UNIQUE,
    name             VARCHAR(100),
    capacity         INT DEFAULT 5000,
    ticket_price_stc DECIMAL(8,2) DEFAULT 15,
    upgrade_cost_stc BIGINT DEFAULT 0,
    description      TEXT,
    updated_date     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`).catch(err => console.error('[migration] stadium_config:', err.message));

  const stadiumCfgCount = await EXECUTESQL('SELECT COUNT(*) as n FROM stadium_config', []).catch(() => [{ n: 1 }]);
  if (Number(stadiumCfgCount[0]?.n || 0) === 0) {
    const defaults = [
      [0, 'Local Ground',  5000,  15,  0,           'A humble but passionate home ground. Every great club starts somewhere.'],
      [1, 'Pro Stadium',   20000, 50,  50000000,    'Professional-grade facilities. The home ground for serious clubs.'],
      [2, 'Elite Ground',  45000, 130, 120000000,   'State-of-the-art stadium. Champions League ready.'],
      [3, 'Iconic Arena',  80000, 180, 250000000,   'A legendary venue. The world\'s eyes are on you.'],
    ];
    for (const [level, name, capacity, price, cost, desc] of defaults) {
      await EXECUTESQL(
        'INSERT IGNORE INTO stadium_config (level, name, capacity, ticket_price_stc, upgrade_cost_stc, description) VALUES (?, ?, ?, ?, ?, ?)',
        [level, name, capacity, price, cost, desc]
      ).catch(() => {});
    }
  }

  // Competition & league entity store (single flexible table for all league/comp entities)
  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS league_entities (
    id               VARCHAR(36)  NOT NULL PRIMARY KEY,
    entity_type      VARCHAR(50)  NOT NULL,
    data_json        MEDIUMTEXT,
    status           VARCHAR(50)  DEFAULT NULL,
    scheduling_status VARCHAR(50) DEFAULT NULL,
    slug             VARCHAR(100) DEFAULT NULL,
    league_id        VARCHAR(36)  DEFAULT NULL,
    season_id        VARCHAR(36)  DEFAULT NULL,
    competition_id   VARCHAR(36)  DEFAULT NULL,
    club_id          VARCHAR(36)  DEFAULT NULL,
    is_active        TINYINT(1)   DEFAULT NULL,
    tier             INT          DEFAULT NULL,
    division         INT          DEFAULT NULL,
    region           VARCHAR(100) DEFAULT NULL,
    platform         VARCHAR(50)  DEFAULT NULL,
    season_number    INT          DEFAULT NULL,
    created_date     DATETIME     DEFAULT CURRENT_TIMESTAMP,
    updated_date     DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_le_type        (entity_type),
    INDEX idx_le_type_status (entity_type, status),
    INDEX idx_le_slug        (entity_type, slug),
    INDEX idx_le_league      (entity_type, league_id),
    INDEX idx_le_season      (entity_type, season_id),
    INDEX idx_le_comp        (entity_type, competition_id)
  )`).catch(() => {});

  // Admin audit log
  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS admin_audit_log (
    id          VARCHAR(36) PRIMARY KEY,
    admin_user_id VARCHAR(36),
    admin_email VARCHAR(255),
    action      VARCHAR(100),
    entity_type VARCHAR(50),
    entity_id   VARCHAR(36),
    entity_name VARCHAR(255),
    old_value   TEXT,
    new_value   TEXT,
    reason      TEXT,
    created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_aal_entity  (entity_type, entity_id),
    INDEX idx_aal_admin   (admin_user_id),
    INDEX idx_aal_created (created_date)
  )`).catch(() => {});

  // Pre-login landing page config table
  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS landing_config (
    id               VARCHAR(36)  NOT NULL PRIMARY KEY,
    hero_title       VARCHAR(255) NULL,
    hero_description TEXT         NULL,
    hero_image_url   VARCHAR(500) NULL,
    stats_json       TEXT         NULL,
    section1_tag     VARCHAR(100) NULL,
    section1_title   VARCHAR(255) NULL,
    section1_text    TEXT         NULL,
    section1_image_url VARCHAR(500) NULL,
    section2_tag     VARCHAR(100) NULL,
    section2_title   VARCHAR(255) NULL,
    section2_text    TEXT         NULL,
    section2_image_url VARCHAR(500) NULL,
    section3_tag     VARCHAR(100) NULL,
    section3_title   VARCHAR(255) NULL,
    section3_text    TEXT         NULL,
    section3_image_url VARCHAR(500) NULL,
    footer_tagline   VARCHAR(255) NULL,
    created_date     DATETIME     DEFAULT CURRENT_TIMESTAMP,
    updated_date     DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`).catch(err => console.error('[migration] landing_config:', err.message));

  // Landing page content — extra fields for dynamic sections
  await addCol('landing_page_contents', 'stats_json',   'TEXT NULL');
  await addCol('landing_page_contents', 'section1_tag', 'VARCHAR(100) NULL');
  await addCol('landing_page_contents', 'section2_tag', 'VARCHAR(100) NULL');
  await addCol('landing_page_contents', 'section3_tag', 'VARCHAR(100) NULL');

  // Home page content — post-login home page editor (HomePageEditor.jsx)
  // Kept separate from landing_page_contents so the two pages can be edited independently.
  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS home_page_contents (
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
  )`).catch(err => console.error('[migration] home_page_contents:', err.message));

  // Fixture admin actions — audit log for admin interventions on expired
  // fixtures (force schedule, forfeit declaration, flag for review). Each row
  // captures who did what, when, and on which fixture, with a JSON payload of
  // the action-specific parameters. See fixtureAdminActionController.js.
  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS fixture_admin_actions (
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
  )`).catch(err => console.error('[migration] fixture_admin_actions:', err.message));

  // Trophy items table
  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS trophy_items (
    id               VARCHAR(36)   NOT NULL PRIMARY KEY,
    name             VARCHAR(255)  NOT NULL,
    description      TEXT          NULL,
    image_url        TEXT          NULL,
    competition_name VARCHAR(255)  NULL,
    tournament_id    VARCHAR(36)   NULL,
    tournament_type  VARCHAR(100)  NULL,
    is_official      TINYINT(1)    DEFAULT 0,
    admin_only       TINYINT(1)    DEFAULT 0,
    rarity           VARCHAR(50)   DEFAULT 'common',
    sort_order       INT           DEFAULT 0,
    price            DECIMAL(12,2) DEFAULT 0,
    created_date     DATETIME      DEFAULT CURRENT_TIMESTAMP,
    updated_date     DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`).catch(err => console.error('[migration] trophy_items:', err.message));
  // addCol guards for tables that existed before this migration was updated
  await addCol('trophy_items', 'description',      'TEXT NULL');
  await addCol('trophy_items', 'image_url',         'VARCHAR(500) NULL');
  await addCol('trophy_items', 'competition_name',  'VARCHAR(255) NULL');
  await addCol('trophy_items', 'tournament_id',     'VARCHAR(36) NULL');
  await addCol('trophy_items', 'tournament_type',   'VARCHAR(100) NULL');
  await addCol('trophy_items', 'is_official',       'TINYINT(1) DEFAULT 0');
  await addCol('trophy_items', 'admin_only',        'TINYINT(1) DEFAULT 0');
  await addCol('trophy_items', 'rarity',            "VARCHAR(50) DEFAULT 'common'");
  await addCol('trophy_items', 'sort_order',        'INT DEFAULT 0');
  await addCol('trophy_items', 'price',             'DECIMAL(12,2) DEFAULT 0');
  await addCol('trophy_items', 'created_date',      'DATETIME NULL DEFAULT CURRENT_TIMESTAMP');
  await addCol('trophy_items', 'updated_date',      'DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
  await addCol('trophy_items', 'linked_source_type', "VARCHAR(50) NULL");
  await addCol('trophy_items', 'linked_source_id',   "VARCHAR(36) NULL");
  await addCol('trophy_items', 'linked_source_name', "VARCHAR(255) NULL");
  // Legacy installs used VARCHAR(500) for image URLs; long CDN/signed URLs caused PATCH 500s.
  await EXECUTESQL(
    'ALTER TABLE trophy_items MODIFY COLUMN image_url TEXT NULL'
  ).catch((err) => console.error('[migration] trophy_items.image_url→TEXT:', err.message));

  // Trophy placements table
  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS trophy_placements (
    id             VARCHAR(36)  NOT NULL PRIMARY KEY,
    owner_id       VARCHAR(36)  NULL,
    owner_type     VARCHAR(50)  NULL,
    trophy_item_id VARCHAR(36)  NULL,
    position       INT          DEFAULT 0,
    created_date   DATETIME     DEFAULT CURRENT_TIMESTAMP,
    updated_date   DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tp_owner (owner_id, owner_type),
    INDEX idx_tp_item  (trophy_item_id)
  )`).catch(err => console.error('[migration] trophy_placements:', err.message));

  // Lifestyle purchases expanded schema (v2)
  await addCol('lifestyle_purchases', 'purchase_type',           "VARCHAR(20) DEFAULT 'buy'");
  await addCol('lifestyle_purchases', 'price_paid_stc',          'BIGINT DEFAULT 0');
  await addCol('lifestyle_purchases', 'rent_end_date',           'DATETIME NULL');
  await addCol('lifestyle_purchases', 'invest_end_date',         'DATETIME NULL');
  await addCol('lifestyle_purchases', 'invest_return_amount',    'BIGINT DEFAULT 0');
  await addCol('lifestyle_purchases', 'status',                  "VARCHAR(20) DEFAULT 'active'");
  await addCol('lifestyle_purchases', 'player_email',            'VARCHAR(255) NULL');
  await addCol('lifestyle_purchases', 'current_value_stc',       'BIGINT DEFAULT 0');
  await addCol('lifestyle_purchases', 'upgrade_level',           'INT DEFAULT 0');
  await addCol('lifestyle_purchases', 'last_passive_collected',  'DATETIME NULL');
  await addCol('lifestyle_purchases', 'base_upgrade_cost_stc',   'BIGINT DEFAULT 0');

  // ───────────────────────────────────────────────────────────────────────────
  //  EAFC-inspired modules: Daily/Weekly Objectives, Archetypes, Chemistry, SBC
  // ───────────────────────────────────────────────────────────────────────────

  // 1) Daily / Weekly Objectives — catalogue + per-player progress
  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS objective_definitions (
    id            VARCHAR(36)  NOT NULL PRIMARY KEY,
    scope         VARCHAR(20)  NOT NULL DEFAULT 'daily',
    code          VARCHAR(100) NULL,
    title         VARCHAR(255) NOT NULL,
    description   TEXT         NULL,
    metric        VARCHAR(50)  NOT NULL,
    target_value  INT          NOT NULL DEFAULT 1,
    reward_stc    DECIMAL(12,2) DEFAULT 0,
    reward_xp     INT          DEFAULT 0,
    active_from   DATETIME     NULL,
    active_until  DATETIME     NULL,
    is_active     TINYINT(1)   DEFAULT 1,
    created_date  DATETIME     DEFAULT CURRENT_TIMESTAMP,
    updated_date  DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_obj_scope_active (scope, is_active),
    INDEX idx_obj_metric (metric),
    INDEX idx_obj_code (code)
  )`).catch(err => console.error('[migration] objective_definitions:', err.message));

  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS objective_progress (
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
  )`).catch(err => console.error('[migration] objective_progress:', err.message));

  // 2) Archetypes — catalogue + players.archetype column + sacrificed_at (used by SBC)
  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS archetypes (
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
  )`).catch(err => console.error('[migration] archetypes:', err.message));

  await addCol('players', 'archetype', 'VARCHAR(64) NULL');
  await addCol('players', 'sacrificed_at', 'DATETIME NULL');

  // Seed default archetypes (only if empty) — 13 archetypes inspired by EAFC 26 Clubs Pro
  const archCount = await EXECUTESQL('SELECT COUNT(*) AS n FROM archetypes', []).catch(() => [{ n: 1 }]);
  if (Number(archCount[0]?.n || 0) === 0) {
    const { v4: _uuid } = require('uuid');
    const SEED = [
      ['poacher',       'Poacher',              'ST',  'Inzaghi',     'Penalty-box predator, lives off through-balls.',
        { shooting: 1.08, positioning: 1.10, pace: 1.04 }, ['Finesse Shot', 'Power Header']],
      ['target_man',    'Target Man',           'ST',  'Crouch',      'Aerial pivot who holds up play for runners.',
        { physical: 1.10, heading: 1.12, shooting: 1.05 }, ['Aerial Threat', 'Press Proven']],
      ['false_nine',    'False Nine',           'ST',  'Messi',       'Drops deep to dribble and create.',
        { dribbling: 1.08, passing: 1.07, agility: 1.05 }, ['Trickster', 'Incisive Pass']],
      ['speedster',     'Speedster',            'LW',  'Mbappé',      'Pure pace and direct running.',
        { pace: 1.12, dribbling: 1.05, shooting: 1.03 }, ['Quickstep', 'Rapid']],
      ['wing_wizard',   'Wing Wizard',          'RW',  'Ronaldinho',  'Trickster wide forward with flair.',
        { dribbling: 1.10, flair: 1.10, shooting: 1.04 }, ['Flair', 'Trivela', 'Trickster']],
      ['playmaker',     'Playmaker',            'CAM', 'Iniesta',     'Vision-led tempo controller.',
        { passing: 1.10, vision: 1.10, dribbling: 1.05 }, ['Incisive Pass', 'Tiki Taka']],
      ['box_to_box',    'Box-to-Box',           'CM',  'Vieira',      'Engine that covers both boxes.',
        { physical: 1.07, passing: 1.05, stamina: 1.10 }, ['Press Proven', 'Long Ball Pass']],
      ['deep_lying',    'Deep-Lying Playmaker', 'CDM', 'Pirlo',       'Deep conductor, long-range distribution.',
        { passing: 1.10, vision: 1.10, defending: 1.03 }, ['Long Ball Pass', 'Pinged Pass']],
      ['anchor',        'Anchor',               'CDM', 'Makelele',    'Defensive shield in front of the back four.',
        { defending: 1.10, physical: 1.08, interceptions: 1.10 }, ['Intercept', 'Block', 'Bruiser']],
      ['ball_player_cb','Ball-Playing CB',      'CB',  'Beckenbauer', 'CB comfortable bringing it out.',
        { defending: 1.05, passing: 1.08, composure: 1.10 }, ['Long Ball Pass', 'Anticipate']],
      ['stopper',       'Stopper',              'CB',  'Maldini',     'Old-school defender, wins his duels.',
        { defending: 1.12, heading: 1.10, physical: 1.06 }, ['Aerial Threat', 'Slide Tackle', 'Bruiser']],
      ['attacking_fb',  'Attacking Full-Back',  'LB',  'Cafu',        'Modern overlapping full-back.',
        { pace: 1.08, dribbling: 1.05, crossing: 1.08 }, ['Whipped Pass', 'Quickstep']],
      ['shot_stopper',  'Shot Stopper',         'GK',  'Buffon',      'Pure goalkeeping reflexes.',
        { reflexes: 1.12, diving: 1.08, handling: 1.05 }, ['Acrobatic', 'Far Throw']],
    ];
    let order = 0;
    for (const [code, name, position, icon, description, mods, playstyles] of SEED) {
      await EXECUTESQL(
        `INSERT IGNORE INTO archetypes
           (id, code, name, position, description, base_modifiers, signature_playstyles, icon_inspiration, sort_order, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [_uuid(), code, name, position, description, JSON.stringify(mods), JSON.stringify(playstyles), icon, order++]
      ).catch(() => {});
    }
  }

  // 3) Chemistry links — pairwise relationships
  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS chemistry_links (
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
  )`).catch(err => console.error('[migration] chemistry_links:', err.message));

  // 4) Squad Building Challenges + submissions
  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS sbcs (
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
  )`).catch(err => console.error('[migration] sbcs:', err.message));

  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS sbc_submissions (
    id                    VARCHAR(36)  NOT NULL PRIMARY KEY,
    sbc_id                VARCHAR(36)  NOT NULL,
    player_id             VARCHAR(36)  NOT NULL,
    player_email          VARCHAR(255) NULL,
    player_gamertag       VARCHAR(150) NULL,
    club_id               VARCHAR(36)  NULL,
    sacrificed_player_ids JSON         NULL,
    reward_payload        JSON         NULL,
    stc_credited          DECIMAL(12,2) DEFAULT 0,
    status                VARCHAR(20)  DEFAULT 'pending',
    failure_reason        TEXT         NULL,
    submitted_at          DATETIME     NULL,
    completed_at          DATETIME     NULL,
    created_date          DATETIME     DEFAULT CURRENT_TIMESTAMP,
    updated_date          DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_sbcsub_sbc (sbc_id),
    INDEX idx_sbcsub_player (player_id),
    INDEX idx_sbcsub_status (status, created_date)
  )`).catch(err => console.error('[migration] sbc_submissions:', err.message));
}

runStartupMigrations().catch(err => console.error('[migration] startup error:', err));

server.listen(PORT, () => console.log(`[stage] server running on port ${PORT}`));

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
app.use('/api/stage/player-stc-transactions',   verifyToken, require('./server/controllers/playerStcTransactionController'));

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

// Public landing page content — no auth, served to logged-out visitors
app.get('/api/stage/public/landing-content', async (_req, res) => {
  try {
    const LPC = require('./server/models/landingPageContentModel');
    const rows = await new LPC().selectAll(1);
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

  // Landing page content — extra fields for dynamic sections
  await addCol('landing_page_contents', 'stats_json',   'TEXT NULL');
  await addCol('landing_page_contents', 'section1_tag', 'VARCHAR(100) NULL');
  await addCol('landing_page_contents', 'section2_tag', 'VARCHAR(100) NULL');
  await addCol('landing_page_contents', 'section3_tag', 'VARCHAR(100) NULL');

  // Trophy items table
  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS trophy_items (
    id           VARCHAR(36)   NOT NULL PRIMARY KEY,
    name         VARCHAR(255)  NOT NULL,
    description  TEXT          NULL,
    image_url    VARCHAR(500)  NULL,
    rarity       VARCHAR(50)   DEFAULT 'common',
    price        DECIMAL(12,2) DEFAULT 0,
    created_date DATETIME      DEFAULT CURRENT_TIMESTAMP,
    updated_date DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`).catch(err => console.error('[migration] trophy_items:', err.message));
  await addCol('trophy_items', 'description', 'TEXT NULL');
  await addCol('trophy_items', 'image_url',   'VARCHAR(500) NULL');
  await addCol('trophy_items', 'rarity',      "VARCHAR(50) DEFAULT 'common'");
  await addCol('trophy_items', 'price',       'DECIMAL(12,2) DEFAULT 0');

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
}

runStartupMigrations().catch(err => console.error('[migration] startup error:', err));

server.listen(PORT, () => console.log(`[stage] server running on port ${PORT}`));

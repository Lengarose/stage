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
app.use('/api/stage/international-tournaments', verifyToken, require('./server/controllers/internationalTournamentController'));
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
app.use('/api/stage/faq-items',                 verifyToken, require('./server/controllers/faqItemController'));
app.use('/api/stage/landing-configs',           verifyToken, require('./server/controllers/landingConfigController'));
app.use('/api/stage/transfer-windows',          verifyToken, require('./server/controllers/transferWindowController'));
app.use('/api/stage/fixture-admin-actions',     verifyToken, require('./server/controllers/fixtureAdminActionController'));
app.use('/api/stage/reward-configs',             verifyToken, require('./server/controllers/rewardConfigController'));
app.use('/api/stage/club-achievements',          verifyToken, require('./server/controllers/clubAchievementController'));
app.use('/api/stage/player-achievements',        verifyToken, require('./server/controllers/playerAchievementController'));
app.use('/api/stage/player-stc-transactions',   verifyToken, require('./server/controllers/playerStcTransactionController'));
app.use('/api/stage/player-identity-claims',    verifyToken, require('./server/controllers/playerIdentityClaimController'));
app.use('/api/stage/recruitment-posts',         verifyToken, require('./server/controllers/recruitmentPostController'));
app.use('/api/stage/recruitment-interests',     verifyToken, require('./server/controllers/recruitmentInterestController'));
app.use('/api/stage/club-applicants',           verifyToken, require('./server/controllers/clubApplicantController'));
app.use('/api/stage/club-staff-roles',          verifyToken, require('./server/controllers/clubStaffRoleController'));
app.use('/api/stage/club-fixture-availability', verifyToken, require('./server/controllers/clubFixtureAvailabilityController'));
app.use('/api/stage/club-fixture-availabilities', verifyToken, require('./server/controllers/clubFixtureAvailabilityController'));
app.use('/api/stage/club-fixture-lineups',      verifyToken, require('./server/controllers/clubFixtureLineupController'));
app.use('/api/stage/club-operation-audit-logs', verifyToken, require('./server/controllers/clubOperationAuditLogController'));

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
  await addCol('players', 'secondary_position', 'VARCHAR(50) NULL');
  await addCol('players', 'is_verified', 'TINYINT(1) DEFAULT 0');
  await addCol('players', 'verified_platform', 'VARCHAR(50) NULL');
  await addCol('players', 'verified_platform_handle', 'VARCHAR(150) NULL');
  await addCol('players', 'identity_verified_at', 'DATETIME NULL');
  await addCol('players', 'home_player_email', 'VARCHAR(255) NULL');
  // Legacy DBs sometimes marked club_id NOT NULL; kicks / account deletion must clear it.
  await EXECUTESQL(
    'ALTER TABLE players MODIFY COLUMN club_id VARCHAR(36) NULL'
  ).catch((err) => console.error('[migration] players.club_id nullable:', err.message));

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

  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS international_tournaments (
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
  )`).catch(err => console.error('[migration] international_tournaments:', err.message));
  await addCol('international_tournaments', 'max_teams', 'INT NOT NULL DEFAULT 32');

  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS national_team_elections (
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
  )`).catch(err => console.error('[migration] national_team_elections:', err.message));
  await addCol('national_team_elections', 'winner_owner_user_id', 'VARCHAR(36) NULL');
  await addCol('national_team_elections', 'winner_owner_club_id', 'VARCHAR(36) NULL');

  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS national_team_votes (
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
  )`).catch(err => console.error('[migration] national_team_votes:', err.message));
  await addCol('national_team_votes', 'voter_owner_club_id', 'VARCHAR(36) NULL');
  await addCol('national_team_votes', 'candidate_owner_club_id', 'VARCHAR(36) NULL');
  await addCol('national_team_votes', 'candidate_owner_user_id', 'VARCHAR(36) NULL');

  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS national_team_representatives (
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
  )`).catch(err => console.error('[migration] national_team_representatives:', err.message));
  await addCol('national_team_representatives', 'owner_user_id', 'VARCHAR(36) NULL');
  await addCol('national_team_representatives', 'owner_club_id', 'VARCHAR(36) NULL');

  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS national_team_squads (
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
  )`).catch(err => console.error('[migration] national_team_squads:', err.message));
  await addCol('national_team_squads', 'submitted_by_owner_user_id', 'VARCHAR(36) NULL');

  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS national_team_squad_players (
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
  )`).catch(err => console.error('[migration] national_team_squad_players:', err.message));

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

  // Player identity claiming / verification workflow.
  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS player_identity_claims (
    id                    VARCHAR(36)  PRIMARY KEY,
    player_id             VARCHAR(36)  NOT NULL,
    user_id               VARCHAR(36)  NULL,
    email                 VARCHAR(255) NULL,
    gamertag              VARCHAR(150) NULL,
    platform              VARCHAR(50)  NOT NULL,
    platform_handle       VARCHAR(150) NOT NULL,
    ea_id                 VARCHAR(150) NULL,
    discord_handle        VARCHAR(150) NULL,
    proof_url             TEXT         NULL,
    notes                 TEXT         NULL,
    status                VARCHAR(30)  NOT NULL DEFAULT 'pending',
    review_notes          TEXT         NULL,
    rejection_reason      TEXT         NULL,
    reviewed_by           VARCHAR(36)  NULL,
    reviewed_by_email     VARCHAR(255) NULL,
    reviewed_at           DATETIME     NULL,
    created_date          DATETIME     DEFAULT CURRENT_TIMESTAMP,
    updated_date          DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_pic_player  (player_id),
    INDEX idx_pic_user    (user_id),
    INDEX idx_pic_status  (status),
    INDEX idx_pic_created (created_date)
  )`).catch(err => console.error('[migration] player_identity_claims:', err.message));

  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS recruitment_posts (
    id                  VARCHAR(36) PRIMARY KEY,
    author_user_id      VARCHAR(36) NULL,
    author_player_id    VARCHAR(36) NULL,
    author_club_id      VARCHAR(36) NULL,
    post_type           VARCHAR(30) NOT NULL,
    title               VARCHAR(255) NOT NULL,
    body                TEXT NULL,
    positions_needed    JSON NULL,
    preferred_positions JSON NULL,
    platform            VARCHAR(50) NULL,
    region              VARCHAR(100) NULL,
    availability_text   VARCHAR(255) NULL,
    discord_handle      VARCHAR(150) NULL,
    mic_required        TINYINT(1) DEFAULT 0,
    verified_only       TINYINT(1) DEFAULT 0,
    status              VARCHAR(30) DEFAULT 'open',
    expires_at          DATETIME NULL,
    created_date        DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_date        DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_rp_type_status (post_type, status),
    INDEX idx_rp_player (author_player_id),
    INDEX idx_rp_club (author_club_id),
    INDEX idx_rp_platform_region (platform, region),
    INDEX idx_rp_created (created_date)
  )`).catch(err => console.error('[migration] recruitment_posts:', err.message));

  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS recruitment_interests (
    id                   VARCHAR(36) PRIMARY KEY,
    recruitment_post_id  VARCHAR(36) NOT NULL,
    sender_user_id       VARCHAR(36) NULL,
    sender_player_id     VARCHAR(36) NULL,
    sender_club_id       VARCHAR(36) NULL,
    recipient_user_id    VARCHAR(36) NULL,
    recipient_player_id  VARCHAR(36) NULL,
    recipient_club_id    VARCHAR(36) NULL,
    message              TEXT NULL,
    status               VARCHAR(30) DEFAULT 'pending',
    created_date         DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_date         DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_ri_post (recruitment_post_id),
    INDEX idx_ri_sender_user (sender_user_id),
    INDEX idx_ri_recipient_user (recipient_user_id),
    INDEX idx_ri_status (status)
  )`).catch(err => console.error('[migration] recruitment_interests:', err.message));

  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS club_applicants (
    id                 VARCHAR(36) PRIMARY KEY,
    club_id            VARCHAR(36) NOT NULL,
    player_id          VARCHAR(36) NULL,
    user_id            VARCHAR(36) NULL,
    source_type        VARCHAR(40) DEFAULT 'manual',
    source_id          VARCHAR(36) NULL,
    status             VARCHAR(40) DEFAULT 'new',
    preferred_position VARCHAR(40) NULL,
    platform           VARCHAR(50) NULL,
    message            TEXT NULL,
    notes              TEXT NULL,
    created_date       DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_date       DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_ca_source (source_type, source_id),
    INDEX idx_ca_club_status (club_id, status),
    INDEX idx_ca_player (player_id)
  )`).catch(err => console.error('[migration] club_applicants:', err.message));

  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS club_staff_roles (
    id                  VARCHAR(36) PRIMARY KEY,
    club_id             VARCHAR(36) NOT NULL,
    player_id           VARCHAR(36) NOT NULL,
    user_id             VARCHAR(36) NULL,
    role                VARCHAR(40) NOT NULL,
    permissions         JSON NULL,
    assigned_by_user_id VARCHAR(36) NULL,
    created_date        DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_date        DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_csr_role (club_id, player_id, role),
    INDEX idx_csr_club (club_id),
    INDEX idx_csr_player (player_id)
  )`).catch(err => console.error('[migration] club_staff_roles:', err.message));

  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS club_fixture_availability (
    id           VARCHAR(36) PRIMARY KEY,
    club_id      VARCHAR(36) NOT NULL,
    fixture_id   VARCHAR(36) NOT NULL,
    fixture_type VARCHAR(50) NULL,
    player_id    VARCHAR(36) NOT NULL,
    user_id      VARCHAR(36) NULL,
    status       VARCHAR(30) DEFAULT 'no_response',
    note         TEXT NULL,
    created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_date DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_cfa_player_fixture (club_id, fixture_id, player_id),
    INDEX idx_cfa_fixture (club_id, fixture_id),
    INDEX idx_cfa_player (player_id)
  )`).catch(err => console.error('[migration] club_fixture_availability:', err.message));

  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS club_fixture_lineups (
    id                 VARCHAR(36) PRIMARY KEY,
    club_id            VARCHAR(36) NOT NULL,
    fixture_id         VARCHAR(36) NOT NULL,
    fixture_type       VARCHAR(50) NULL,
    formation          VARCHAR(50) NULL,
    starting_players   JSON NULL,
    bench_players      JSON NULL,
    captain_player_id  VARCHAR(36) NULL,
    notes              TEXT NULL,
    status             VARCHAR(30) DEFAULT 'draft',
    created_by_user_id VARCHAR(36) NULL,
    created_date       DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_date       DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_cfl_fixture (club_id, fixture_id),
    INDEX idx_cfl_fixture (club_id, fixture_id)
  )`).catch(err => console.error('[migration] club_fixture_lineups:', err.message));

  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS club_operation_audit_logs (
    id            VARCHAR(36) PRIMARY KEY,
    club_id       VARCHAR(36) NOT NULL,
    actor_user_id VARCHAR(36) NULL,
    actor_email   VARCHAR(255) NULL,
    action        VARCHAR(100) NOT NULL,
    entity_type   VARCHAR(100) NULL,
    entity_id     VARCHAR(36) NULL,
    old_value     JSON NULL,
    new_value     JSON NULL,
    reason        TEXT NULL,
    created_date  DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_coal_club_created (club_id, created_date)
  )`).catch(err => console.error('[migration] club_operation_audit_logs:', err.message));

  await EXECUTESQL(`
    UPDATE clubs c
    JOIN users u ON LOWER(TRIM(u.email)) = LOWER(TRIM(c.owner_email))
    SET c.user_id = COALESCE(c.user_id, u.id),
        u.owner_id = c.id,
        u.role_id = 1,
        c.updated_date = NOW(),
        u.updated_date = NOW()
    WHERE c.owner_email IS NOT NULL
      AND c.owner_email <> ''
  `).catch(err => console.error('[migration] club_owner_user_link:', err.message));

  await EXECUTESQL(`
    UPDATE players p
    JOIN clubs c ON LOWER(TRIM(p.email)) = LOWER(TRIM(c.owner_email))
    LEFT JOIN users u ON u.id = c.user_id OR LOWER(TRIM(u.email)) = LOWER(TRIM(c.owner_email))
    SET p.user_id = COALESCE(p.user_id, u.id),
        p.club_id = c.id,
        p.role = 'president',
        p.club_roles = JSON_ARRAY('president'),
        p.status = 'active',
        p.updated_date = NOW()
    WHERE c.owner_email IS NOT NULL
      AND c.owner_email <> ''
  `).catch(err => console.error('[migration] club_owner_president_link:', err.message));

  await EXECUTESQL(`
    UPDATE players p
    JOIN clubs c ON p.club_id = c.id
    SET p.role = 'president',
        p.club_roles = JSON_ARRAY('president')
    WHERE (LOWER(p.email) = LOWER(c.owner_email) OR (p.user_id IS NOT NULL AND p.user_id = c.user_id))
      AND (
        p.role IN ('captain', 'owner')
        OR JSON_CONTAINS(p.club_roles, JSON_QUOTE('captain'))
        OR JSON_CONTAINS(p.club_roles, JSON_QUOTE('owner'))
      )
  `).catch(err => console.error('[migration] creator_role_cleanup:', err.message));

  await EXECUTESQL(`
    UPDATE players p
    JOIN player_contracts pc ON pc.user_id = p.id
    JOIN clubs c ON c.id = pc.team_id
    SET p.club_id = c.id,
        p.role = 'president',
        p.club_roles = JSON_ARRAY('president'),
        p.status = 'active'
    WHERE pc.contract_type = 'ownership'
      AND pc.status = 'active'
      AND (
        p.club_id IS NULL
        OR p.club_id = ''
        OR p.club_id <> c.id
        OR p.role IN ('captain', 'owner')
        OR JSON_CONTAINS(p.club_roles, JSON_QUOTE('captain'))
        OR JSON_CONTAINS(p.club_roles, JSON_QUOTE('owner'))
      )
  `).catch(err => console.error('[migration] ownership_contract_squad_link:', err.message));

  await EXECUTESQL(`
    UPDATE players p
    JOIN player_contracts pc ON pc.user_id = p.id AND pc.team_id = p.club_id
    LEFT JOIN player_contracts active_pc
      ON active_pc.user_id = p.id
     AND active_pc.team_id = p.club_id
     AND active_pc.status = 'active'
    LEFT JOIN club_staff_roles csr
      ON csr.player_id = p.id
     AND csr.club_id = p.club_id
    SET p.club_id = NULL,
        p.role = 'member',
        p.club_roles = JSON_ARRAY('member'),
        p.status = 'free_agent',
        p.updated_date = NOW()
    WHERE pc.status IN ('pending', 'pending_window', 'negotiating')
      AND IFNULL(pc.contract_type, '') <> 'ownership'
      AND active_pc.id IS NULL
      AND csr.id IS NULL
  `).catch(err => console.error('[migration] pending_contract_membership_cleanup:', err.message));

  await EXECUTESQL(`
    UPDATE players p
    LEFT JOIN clubs c ON c.id = p.club_id
    LEFT JOIN player_contracts owner_pc
      ON owner_pc.user_id = p.id
     AND owner_pc.team_id = p.club_id
     AND owner_pc.contract_type = 'ownership'
     AND owner_pc.status = 'active'
    LEFT JOIN club_staff_roles president_role
      ON president_role.player_id = p.id
     AND president_role.club_id = p.club_id
     AND president_role.role = 'president'
    SET p.role = 'member',
        p.club_roles = JSON_ARRAY('member'),
        p.updated_date = NOW()
    WHERE (p.role = 'president' OR JSON_CONTAINS(p.club_roles, JSON_QUOTE('president')))
      AND (
        c.id IS NULL
        OR (
          NOT (LOWER(TRIM(IFNULL(p.email, ''))) = LOWER(TRIM(IFNULL(c.owner_email, '')))
               OR (p.user_id IS NOT NULL AND p.user_id = c.user_id))
          AND owner_pc.id IS NULL
          AND president_role.id IS NULL
        )
      )
  `).catch(err => console.error('[migration] invalid_president_role_cleanup:', err.message));

  await EXECUTESQL(`
    UPDATE player_contracts pc
    JOIN clubs c ON c.id = pc.team_id
    LEFT JOIN players p ON p.id = pc.user_id
       SET pc.status = 'cancelled',
           pc.start_date = NULL,
           pc.end_date = NULL
     WHERE pc.status IN ('pending', 'pending_window', 'negotiating')
       AND LOWER(TRIM(c.name)) IN ('fc longue vie', 'longue vie fc')
       AND (
         LOWER(TRIM(IFNULL(p.gamertag, ''))) = 'callmewes'
         OR LOWER(TRIM(IFNULL(p.email, ''))) LIKE '%callmewes%'
         OR p.id IS NULL
       )
  `).catch(err => console.error('[migration] cancel_callmewes_pending_offer:', err.message));

  await EXECUTESQL(`
    UPDATE inbox_messages im
    JOIN player_contracts pc ON pc.id = im.related_entity_id
    JOIN clubs c ON c.id = pc.team_id
       SET im.status = 'cancelled',
           im.is_read = 1
     WHERE im.message_type = 'contract_offer'
       AND pc.status = 'cancelled'
       AND LOWER(TRIM(c.name)) IN ('fc longue vie', 'longue vie fc')
  `).catch(err => console.error('[migration] cancel_callmewes_pending_inbox:', err.message));

  await EXECUTESQL(`
    UPDATE notifications n
    JOIN player_contracts pc ON pc.id = n.related_id
    JOIN clubs c ON c.id = pc.team_id
       SET n.\`read\` = 1
     WHERE n.type = 'contract_offer'
       AND pc.status = 'cancelled'
       AND LOWER(TRIM(c.name)) IN ('fc longue vie', 'longue vie fc')
  `).catch(err => console.error('[migration] cancel_callmewes_pending_notification:', err.message));

  await EXECUTESQL(`
    UPDATE inbox_messages im
    JOIN player_contracts pc ON pc.id = im.related_entity_id
    JOIN players p ON p.id = pc.user_id
    LEFT JOIN users u ON u.id = p.user_id OR u.player_id = p.id
       SET im.recipient_email = LOWER(TRIM(COALESCE(NULLIF(p.email, ''), NULLIF(u.email, '')))),
           im.status = 'pending',
           im.is_read = 0
     WHERE im.message_type = 'contract_offer'
       AND pc.status IN ('pending', 'pending_window', 'negotiating')
       AND COALESCE(NULLIF(p.email, ''), NULLIF(u.email, '')) IS NOT NULL
       AND LOWER(TRIM(IFNULL(im.recipient_email, ''))) <> LOWER(TRIM(COALESCE(NULLIF(p.email, ''), NULLIF(u.email, ''))))
  `).catch(err => console.error('[migration] repair_contract_inbox_recipient:', err.message));

  await EXECUTESQL(`
    UPDATE notifications n
    JOIN player_contracts pc ON pc.id = n.related_id
    JOIN players p ON p.id = pc.user_id
    LEFT JOIN users u ON u.id = p.user_id OR u.player_id = p.id
       SET n.recipient_email = LOWER(TRIM(COALESCE(NULLIF(p.email, ''), NULLIF(u.email, '')))),
           n.\`read\` = 0,
           n.link = '/inbox'
     WHERE n.type = 'contract_offer'
       AND pc.status IN ('pending', 'pending_window', 'negotiating')
       AND COALESCE(NULLIF(p.email, ''), NULLIF(u.email, '')) IS NOT NULL
       AND LOWER(TRIM(IFNULL(n.recipient_email, ''))) <> LOWER(TRIM(COALESCE(NULLIF(p.email, ''), NULLIF(u.email, ''))))
  `).catch(err => console.error('[migration] repair_contract_notification_recipient:', err.message));

  await EXECUTESQL(`
    INSERT INTO inbox_messages
      (id, recipient_email, sender_email, sender_gamertag, sender_avatar_url, sender_club_name,
       subject, body, message_type, action_type, status, is_read, is_system, metadata,
       related_entity_id, related_entity_type, created_date)
    SELECT UUID(),
           LOWER(TRIM(COALESCE(p.email, u.email))),
           COALESCE(c.owner_email, 'system@stage.com'),
           COALESCE(c.name, 'Club Management'),
           COALESCE(c.logo_url, ''),
           COALESCE(c.name, ''),
           CONCAT('Contract Offer from ', COALESCE(c.name, 'Club')),
           CONCAT(
             COALESCE(c.name, 'A club'), ' has sent you a ', REPLACE(COALESCE(pc.contract_type, 'squad'), '_', ' '), ' contract offer.\\n\\n',
             'Duration: ', COALESCE(pc.max_games, 0), ' games / ', COALESCE(pc.max_days, 0), ' days\\n',
             'Weekly Salary: ', COALESCE(pc.weekly_salary_stc, 0), ' STC / week\\n',
             'Signing Bonus: ', COALESCE(pc.signing_bonus_stc, 0), ' STC\\n\\n',
             'Please respond using the buttons below. You can accept the offer, send a counter-offer, or decline it.'
           ),
           'contract_offer',
           'contract_negotiation',
           'pending',
           0,
           0,
           JSON_OBJECT('contract_id', pc.id, 'club_id', pc.team_id, 'club_name', c.name, 'contract_type', pc.contract_type),
           pc.id,
           'player_contract',
           NOW()
      FROM player_contracts pc
      JOIN players p ON p.id = pc.user_id
      LEFT JOIN users u ON u.player_id = p.id OR u.id = p.user_id
      LEFT JOIN clubs c ON c.id = pc.team_id
     WHERE pc.status IN ('pending', 'pending_window', 'negotiating')
       AND COALESCE(p.email, u.email) IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM inbox_messages im
          WHERE im.related_entity_id = pc.id
            AND im.message_type = 'contract_offer'
       )
  `).catch(err => console.error('[migration] missing_contract_inbox_delivery:', err.message));

  await EXECUTESQL(`
    INSERT INTO notifications
      (id, recipient_email, type, title, body, \`read\`, link, related_id, created_date)
    SELECT UUID(),
           LOWER(TRIM(COALESCE(p.email, u.email))),
           'contract_offer',
           CONCAT('Contract Offer from ', COALESCE(c.name, 'Club')),
           CONCAT(COALESCE(c.name, 'A club'), ' has sent you a ', COALESCE(pc.contract_type, 'squad'), ' contract offer.'),
           0,
           '/inbox',
           pc.id,
           NOW()
      FROM player_contracts pc
      JOIN players p ON p.id = pc.user_id
      LEFT JOIN users u ON u.player_id = p.id OR u.id = p.user_id
      LEFT JOIN clubs c ON c.id = pc.team_id
     WHERE pc.status IN ('pending', 'pending_window', 'negotiating')
       AND COALESCE(p.email, u.email) IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM notifications n
          WHERE n.related_id = pc.id
            AND n.type = 'contract_offer'
       )
  `).catch(err => console.error('[migration] missing_contract_notification_delivery:', err.message));

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
  await addCol('lifestyle_items', 'max_upgrade_level',           'INT DEFAULT 0');
  await addCol('lifestyle_items', 'upgrade_base_cost_stc',       'BIGINT DEFAULT 0');
  await addCol('lifestyle_items', 'can_buy',                     'TINYINT(1) DEFAULT 1');
  await addCol('lifestyle_items', 'can_rent',                    'TINYINT(1) DEFAULT 0');
  await addCol('lifestyle_items', 'can_invest',                  'TINYINT(1) DEFAULT 0');
  await addCol('lifestyle_items', 'can_sell',                    'TINYINT(1) DEFAULT 1');
  await addCol('lifestyle_items', 'sell_value_percent',          'INT DEFAULT 60');
  await addCol('lifestyle_items', 'allows_multiple',             'TINYINT(1) DEFAULT 1');
  await addCol('lifestyle_items', 'emoji',                       "VARCHAR(10) DEFAULT ''");
  await addCol('lifestyle_items', 'available_cities',            'JSON NULL');

  // Club finance: enrich stc_transactions
  await addCol('stc_transactions', 'category',      'VARCHAR(100)');
  await addCol('stc_transactions', 'balance_after',  'DECIMAL(12,2)');
  // Legacy schema had NOT NULL; player-only rows omit club_id; account purge nulls or removes club refs.
  await EXECUTESQL(
    'ALTER TABLE stc_transactions MODIFY COLUMN club_id VARCHAR(36) NULL'
  ).catch((err) => console.error('[migration] stc_transactions.club_id nullable:', err.message));

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
    hero_image_position VARCHAR(50) NULL,
    hero_image_zoom  INT          NULL,
    stats_json       TEXT         NULL,
    section1_tag     VARCHAR(100) NULL,
    section1_title   VARCHAR(255) NULL,
    section1_text    TEXT         NULL,
    section1_image_url VARCHAR(500) NULL,
    section1_image_position VARCHAR(50) NULL,
    section1_image_zoom INT          NULL,
    section2_tag     VARCHAR(100) NULL,
    section2_title   VARCHAR(255) NULL,
    section2_text    TEXT         NULL,
    section2_image_url VARCHAR(500) NULL,
    section2_image_position VARCHAR(50) NULL,
    section2_image_zoom INT          NULL,
    section3_tag     VARCHAR(100) NULL,
    section3_title   VARCHAR(255) NULL,
    section3_text    TEXT         NULL,
    section3_image_url VARCHAR(500) NULL,
    section3_image_position VARCHAR(50) NULL,
    section3_image_zoom INT          NULL,
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
    hero_image_position VARCHAR(50) NULL,
    hero_image_zoom    INT          NULL,
    hero_cta_1_label   VARCHAR(255) NULL,
    hero_cta_1_url     VARCHAR(500) NULL,
    hero_cta_2_label   VARCHAR(255) NULL,
    hero_cta_2_url     VARCHAR(500) NULL,
    hero_cta_3_label   VARCHAR(255) NULL,
    hero_cta_3_url     VARCHAR(500) NULL,
    section1_title     VARCHAR(255) NULL,
    section1_text      TEXT         NULL,
    section1_image_url VARCHAR(500) NULL,
    section1_image_position VARCHAR(50) NULL,
    section1_image_zoom INT          NULL,
    section2_title     VARCHAR(255) NULL,
    section2_text      TEXT         NULL,
    section2_image_url VARCHAR(500) NULL,
    section2_image_position VARCHAR(50) NULL,
    section2_image_zoom INT          NULL,
    section3_title     VARCHAR(255) NULL,
    section3_text      TEXT         NULL,
    section3_image_url VARCHAR(500) NULL,
    section3_image_position VARCHAR(50) NULL,
    section3_image_zoom INT          NULL,
    faq_items          LONGTEXT     NULL,
    contact_email      VARCHAR(255) NULL,
    footer_tagline     TEXT         NULL,
    created_date       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`).catch(err => console.error('[migration] home_page_contents:', err.message));
  await addCol('home_page_contents', 'hero_image_position', 'VARCHAR(50) NULL');
  await addCol('home_page_contents', 'hero_image_zoom', 'INT NULL');
  await addCol('home_page_contents', 'section1_image_position', 'VARCHAR(50) NULL');
  await addCol('home_page_contents', 'section1_image_zoom', 'INT NULL');
  await addCol('home_page_contents', 'section2_image_position', 'VARCHAR(50) NULL');
  await addCol('home_page_contents', 'section2_image_zoom', 'INT NULL');
  await addCol('home_page_contents', 'section3_image_position', 'VARCHAR(50) NULL');
  await addCol('home_page_contents', 'section3_image_zoom', 'INT NULL');

  await addCol('landing_config', 'hero_image_position', 'VARCHAR(50) NULL');
  await addCol('landing_config', 'hero_image_zoom', 'INT NULL');
  await addCol('landing_config', 'section1_image_position', 'VARCHAR(50) NULL');
  await addCol('landing_config', 'section1_image_zoom', 'INT NULL');
  await addCol('landing_config', 'section2_image_position', 'VARCHAR(50) NULL');
  await addCol('landing_config', 'section2_image_zoom', 'INT NULL');
  await addCol('landing_config', 'section3_image_position', 'VARCHAR(50) NULL');
  await addCol('landing_config', 'section3_image_zoom', 'INT NULL');

  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS faq_items (
    id           VARCHAR(36)  NOT NULL PRIMARY KEY,
    question     VARCHAR(500) NOT NULL,
    answer       TEXT         NOT NULL,
    sort_order   INT          NOT NULL DEFAULT 0,
    is_active    TINYINT(1)   NOT NULL DEFAULT 1,
    created_date DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_faq_sort (sort_order),
    INDEX idx_faq_active (is_active)
  )`).catch(err => console.error('[migration] faq_items:', err.message));

  const faqCount = await EXECUTESQL('SELECT COUNT(*) AS n FROM faq_items', []).catch(() => [{ n: 1 }]);
  if (Number(faqCount[0]?.n) === 0) {
    const seed = [
      {
        id: 'faq-seed-join-stage',
        question: 'How do I join STAGE?',
        answer: 'Create your account, complete your player profile, and either create a club or join an existing one. From there you can register for leagues and competitions.',
        sort_order: 1,
      },
      {
        id: 'faq-seed-game',
        question: 'What game does STAGE support?',
        answer: 'STAGE is built around EA FC (formerly FIFA). We support all major platforms including PlayStation and Xbox.',
        sort_order: 2,
      },
      {
        id: 'faq-seed-leagues',
        question: 'How do leagues and competitions work?',
        answer: 'Leagues are seasonal competitions where clubs compete over multiple rounds. Competitions include knockout-style cups. Results are tracked and standings update in real time.',
        sort_order: 3,
      },
      {
        id: 'faq-seed-stc',
        question: 'What are STC points?',
        answer: 'STC (STAGE Coins) are the platform currency. Earn them through match rewards, seasonal prizes, and achievements. Use them in the Lifestyle store or on premium features.',
        sort_order: 4,
      },
      {
        id: 'faq-seed-free',
        question: 'Is STAGE free to use?',
        answer: 'Yes — STAGE is free to join. Some premium features and store items require STC, which can be earned through gameplay.',
        sort_order: 5,
      },
    ];
    for (const row of seed) {
      await EXECUTESQL(
        `INSERT INTO faq_items (id, question, answer, sort_order, is_active)
         VALUES (?,?,?,?,1)`,
        [row.id, row.question, row.answer, row.sort_order]
      ).catch(err => console.error('[migration] faq_items seed:', err.message));
    }
    console.log('[migration] faq_items: seeded default FAQ');
  }

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
  await addCol('lifestyle_purchases', 'player_gamertag',         'VARCHAR(100) NULL');
  await addCol('lifestyle_purchases', 'item_name',               'VARCHAR(255) NULL');
  await addCol('lifestyle_purchases', 'item_category',           'VARCHAR(50) NULL');
  await addCol('lifestyle_purchases', 'item_subcategory',        'VARCHAR(100) NULL');
  await addCol('lifestyle_purchases', 'item_emoji',              'VARCHAR(10) NULL');
  await addCol('lifestyle_purchases', 'monthly_rent_stc',        'BIGINT DEFAULT 0');
  await addCol('lifestyle_purchases', 'location_city',           'VARCHAR(120) NULL');
  await addCol('lifestyle_purchases', 'location_country',        'VARCHAR(120) NULL');
  await addCol('lifestyle_purchases', 'location_emoji',          'VARCHAR(10) NULL');
  await addCol('lifestyle_purchases', 'custom_name',             'VARCHAR(255) NULL');
  await addCol('lifestyle_purchases', 'weekly_maintenance_stc',  'BIGINT DEFAULT 0');
  await addCol('lifestyle_purchases', 'last_rent_paid_at',       'DATETIME NULL');
  await addCol('lifestyle_purchases', 'last_passive_collected_at','DATETIME NULL');
  await addCol('lifestyle_purchases', 'last_maintenance_paid_at','DATETIME NULL');
  await addCol('lifestyle_purchases', 'is_defaulted',            'TINYINT(1) DEFAULT 0');
  await addCol('lifestyle_purchases', 'upgrade_slots',           'JSON NULL');
  await addCol('lifestyle_purchases', 'current_value_stc',       'BIGINT DEFAULT 0');
  await addCol('lifestyle_purchases', 'upgrade_level',           'INT DEFAULT 0');
  await addCol('lifestyle_purchases', 'last_passive_collected',  'DATETIME NULL');
  await addCol('lifestyle_purchases', 'base_upgrade_cost_stc',   'BIGINT DEFAULT 0');

  // news_items — feed rows (contracts, transfers, etc.); older DBs only had title/body/link.
  await addCol('news_items', 'type', "VARCHAR(30) NULL DEFAULT 'announcement'");
  await addCol('news_items', 'category', "VARCHAR(30) NULL DEFAULT 'general'");
  await addCol('news_items', 'image_url', 'TEXT NULL');
  await addCol('news_items', 'club_id', 'VARCHAR(36) NULL');
  await addCol('news_items', 'club_name', 'VARCHAR(100) NULL');
  await addCol('news_items', 'club_logo_url', 'TEXT NULL');
  await addCol('news_items', 'player_id', 'VARCHAR(36) NULL');
  await addCol('news_items', 'player_name', 'VARCHAR(100) NULL');
  await addCol('news_items', 'player_avatar_url', 'TEXT NULL');
  await addCol('news_items', 'tournament_id', 'VARCHAR(36) NULL');
  await addCol('news_items', 'tournament_name', 'VARCHAR(255) NULL');
  await addCol('news_items', 'is_featured', 'TINYINT(1) NULL DEFAULT 0');
  await addCol('news_items', 'is_global', 'TINYINT(1) NULL DEFAULT 0');
  await addCol('news_items', 'transfer_fee_stc', 'BIGINT NULL DEFAULT 0');
  await addCol('news_items', 'tags', 'JSON NULL');
  await addCol('news_items', 'visible_to_club_ids', 'JSON NULL');
  await addCol('news_items', 'visible_to_player_ids', 'JSON NULL');

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

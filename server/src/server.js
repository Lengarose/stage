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
app.use('/api/stage/live-matches',      verifyToken, require('./server/controllers/liveMatchController'));
app.use('/api/stage/landing-page-contents', verifyToken, require('./server/controllers/landingPageContentController'));

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
}

runStartupMigrations().catch(err => console.error('[migration] startup error:', err));

server.listen(PORT, () => console.log(`[stage] server running on port ${PORT}`));

require('./constants/env').applyToProcessEnv();

const { app, server,express } = require('./server/express/index');
const { PORT } = require('./constants/constants');
const { verifyToken } = require('./server/authMiddleware');
const { errorHandler } = require('./server/middleware/errorHandler');
const { notFoundHandler } = require('./server/middleware/notFoundHandler');
const { rateLimiter } = require('./server/middleware/rateLimiter');
const { securityHeaders } = require('./server/middleware/securityHeaders');
const { passport } = require('./server/oauth/passportConfig');
const path = require("path");

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(securityHeaders());

// Stripe webhook MUST see the raw body for signature verification, so it is
// mounted BEFORE the JSON body parser. (Public route — auth is the signature.)
app.use(
  '/api/stage/stripe/webhook',
  require('express').raw({ type: 'application/json' }),
  require('./server/controllers/stripeWebhookController'),
);

app.use(require('express').json({ limit: '2mb' }));
app.use(require('express').urlencoded({ extended: true }));
app.use(passport.initialize());

const { ensureUploadsDir } = require('./constants/paths');

// Rate-limit only brute-force-sensitive auth routes (login/register/password).
// `/me`, `/refresh`, `/logout` are called on every page load — never throttle them.
const authLimiter = rateLimiter({ windowMs: 15 * 60 * 1000, max: 30 });
const publicReadLimiter = rateLimiter({ windowMs: 60 * 1000, max: 120 });
const uploadLimiter = rateLimiter({ windowMs: 15 * 60 * 1000, max: 60 });
const apiLimiter = rateLimiter({ windowMs: 60 * 1000, max: 600 });
app.use('/api/stage/auth/login',           authLimiter);
app.use('/api/stage/auth/register',        authLimiter);
app.use('/api/stage/auth/forgot-password', authLimiter);
app.use('/api/stage/auth/reset-password',  authLimiter);
app.use('/api/stage/public',               publicReadLimiter);
app.use('/api/stage/upload',               uploadLimiter);
app.use('/api/stage',                      apiLimiter);

const { registerStageRoutes } = require('./server/routes/registerStageRoutes');
registerStageRoutes(app, { verifyToken });

// Static `/uploads` — same folder as multer (see constants/paths.js); created if missing
const uploadsStaticDir = ensureUploadsDir();
app.use('/uploads', require('express').static(uploadsStaticDir));

app.use(express.static(path.join(__dirname, "build")));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "build", "index.html"));
});

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
    ownedClubId = '',
    isNewUser = '',
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
        var next = '/';
        try {
          var accessToken = ${j(accessToken)};
          var refreshToken = ${j(refreshToken)};
          var userId = ${j(userId)};
          var playerId = ${j(playerId)};
          var ownerId = ${j(ownerId)};
          var ownedClubId = ${j(ownedClubId)};
          var isNewUser = ${j(isNewUser)};
          if (accessToken)  localStorage.setItem('stage_access_token', accessToken);
          if (refreshToken) localStorage.setItem('stage_refresh_token', refreshToken);
          if (userId)       localStorage.setItem('stage_user_id', userId);
          if (playerId)     localStorage.setItem('stage_player_id', playerId);
          if (ownedClubId || ownerId) localStorage.setItem('stage_owner_id', ownedClubId || ownerId);
          if (isNewUser === '1' && userId) {
            sessionStorage.setItem('stage_needs_onboarding_' + userId, '1');
            localStorage.setItem('stage_needs_onboarding_' + userId, '1');
            localStorage.removeItem('stage_onboarding_completed_' + userId);
          }
          var stored = sessionStorage.getItem('stage_oauth_return') || '';
          if (stored && stored.charAt(0) === '/' && stored.indexOf('//') !== 0) next = stored;
        } catch (e) {}
        window.location.replace(next);
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
    const content = { ...(rows[0] || {}) };
    delete content.intro_video_url;
    delete content.video_url;
    delete content.section1_video_url;
    delete content.section2_video_url;
    delete content.section3_video_url;
    res.json(content);
  } catch { res.json({}); }
});

// ── SPA fallback ──────────────────────────────────────────────────────────
// Only `/api/...` is the backend API surface. Every other URL is a React
// Router page route (e.g. /tournaments/entrance/<token>/signin, /game-day,
// /clubs/<id>, …) and must serve the React shell so react-router-dom can
// resolve it in the browser. Without this, deep-linking or refreshing on
// any non-`/` path falls through to `notFoundHandler` and returns JSON 404.
//
// Placed AFTER all routes (including the static asset middleware and the
// `/auth/*` OAuth helpers above) so existing handlers still win, and BEFORE
// `notFoundHandler` so true 404s on `/api/...` and missing static assets
// still 404.
app.get('*', (req, res, next) => {
  // Only `/api/...` is real backend — everything else is a SPA page route.
  if (req.path.startsWith('/api/'))   return next();
  // A path with a file extension that reached this point is a missing
  // static asset (express.static didn't find it). Don't mask asset 404s
  // by returning the HTML shell — that breaks caching and troubleshooting.
  if (/\.[a-z0-9]+$/i.test(req.path)) return next();

  res.sendFile(path.join(__dirname, 'build', 'index.html'), (err) => {
    if (err) next(err);
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

const { runStartupMigrations } = require('./server/migrations/startupMigrations');

runStartupMigrations().catch(err => console.error('[migration] startup error:', err));

server.listen(PORT, () => console.log(`[stage] server running on port ${PORT}`));

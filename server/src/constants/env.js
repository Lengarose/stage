/**
 * Application environment (replaces server/.env).
 * applyToProcessEnv() runs first in server.js so existing process.env reads keep working.
 */

const ENV = {
  // Server
  PORT: '8080',
  SERVER_URL: 'https://stageleagues.com',
  FRONTEND_URL: 'https://stageleagues.com',
  BASE_URL: 'https://stageleagues.com',
  // eafc-app deep link after OAuth (when client=mobile)
  MOBILE_OAUTH_CALLBACK: 'stage://auth/callback',
  // Optional: override uploads dir (default: <entry script dir>/uploads, e.g. …/vhosts/default/uploads)
  UPLOADS_DIR: '',

  // Database
  // MySQL host only (no http/https prefix)
  DB_HOST: 'localhost',
  DB_PORT: '3306',
  // Gandi Web Hosting uses Unix socket MySQL access
  DB_SOCKET_PATH: '/srv/run/mysqld/mysqld.sock',
  DB_USER: 'root',
  DB_PASSWORD: '',
  DB_NAME: 'stage_league',

  // JWT — secrets live in env.local.js (git-ignored) or host env vars, NEVER here.
  // The server refuses to boot without them (see applyToProcessEnv below).
  ACCESS_TOKEN_SECRET: '',
  REFRESH_TOKEN_SECRET: '',

  // Socket server on Render (socket-server/). URL = https://<service>.onrender.com (no trailing slash).
  // SECRET must match EMIT_SECRET on the Render socket service. Value in env.local.js.
  SOCKET_SERVER_URL:    'https://stage-7osn.onrender.com',
  SOCKET_SERVER_SECRET: '',

  // Google OAuth — redirect: https://stageleagues.com/api/stage/auth/google/callback
  // Secret lives in env.local.js.
  GOOGLE_CLIENT_ID: '163642598978-bl0ldq16coinp32hpqigmbb3744a2qp6.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: '',

  // Microsoft — Azure app "Stage League" (multitenant + personal accounts)
  // Redirect: https://stageleagues.com/api/stage/auth/microsoft/callback
  // Secret lives in env.local.js (expires 2028-07-22 — regenerate in portal.azure.com).
  MICROSOFT_CLIENT_ID: 'bc4b9286-b4ad-49f3-a3fd-e74aa00b20c6',
  MICROSOFT_CLIENT_SECRET: '',

  // Twitch — app "stageleagues-web" (Confidential) on dev.twitch.tv/console/apps
  // Redirect: https://stageleagues.com/api/stage/auth/twitch/callback
  // Secret lives in env.local.js.
  TWITCH_CLIENT_ID: 'c62t540445m5n12uatyjjpd3czrvwi',
  TWITCH_CLIENT_SECRET: '',

  // Kick — app registered at kick.com/settings/developer (2FA required)
  // Redirect: https://stageleagues.com/api/stage/auth/kick/callback
  // Secret lives in env.local.js.
  KICK_CLIENT_ID: '01KY6TJV8WCWJ0KYM52B77W1EA',
  KICK_CLIENT_SECRET: '',

  // ── Stripe ────────────────────────────────────────────────────
  // Secret keys (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET) live in env.local.js.
  // Subscription checkout uses the active StoreConfig price as Stripe price_data,
  // so visible Store/Admin pricing and Stripe billing stay aligned.
  STRIPE_SECRET_KEY: '',
  // checkout.session.completed / invoice.paid / customer.subscription.deleted
  // webhook signing secret (whsec_...). Set in env.local.js.
  STRIPE_WEBHOOK_SECRET: '',

  // ── Email (SMTP) ──────────────────────────────────────────────
  // Transactional emails (sign-in, updates, match day, tournament, results).
  // Uses Gandi mail by default. SMTP_USER/SMTP_PASS are secrets → env.local.js.
  // Without SMTP_USER + SMTP_PASS the app runs fine but sends no email.
  SMTP_HOST: 'mail.gandi.net',
  SMTP_PORT: '465',
  SMTP_USER: 'info@stageleagues.com',   // Gandi mailbox used to send
  SMTP_PASS: '',                        // that mailbox's password — set in env.local.js
  MAIL_FROM: 'STAGE  <info@stageleagues.com>',

  // ── OneSignal push ────────────────────────────────────────────
  // Same App ID as EXPO_PUBLIC_ONESIGNAL_APP_ID / VITE_ONESIGNAL_APP_ID.
  // REST API key is a secret → env.local.js
  ONESIGNAL_APP_ID: '577f63db-851f-491b-8ade-9defb3f569a0',
  ONESIGNAL_REST_API_KEY: '',
};

// Local overrides (secrets) — env.local.js is git-ignored and lives only on
// dev machines and the production host. Copy env.local.example.js to start.
try {
  // eslint-disable-next-line global-require
  Object.assign(ENV, require('./env.local'));
} catch (err) {
  if (err.code !== 'MODULE_NOT_FOUND') throw err;
}

/** Sets missing process.env keys from ENV. Existing vars (e.g. host dashboard) win. */
function applyToProcessEnv() {
  for (const [key, value] of Object.entries(ENV)) {
    if (process.env[key] !== undefined) continue;
    process.env[key] = value == null ? '' : String(value);
  }
  // Fail fast: without JWT secrets every issued token would be forgeable.
  for (const key of ['ACCESS_TOKEN_SECRET', 'REFRESH_TOKEN_SECRET']) {
    if (!process.env[key]) {
      console.error(
        `[env] FATAL: ${key} is not set. Create server/src/constants/env.local.js ` +
        '(see env.local.example.js) or set it as a host environment variable.'
      );
      process.exit(1);
    }
  }
  if (!process.env.SOCKET_SERVER_SECRET) {
    console.warn('[env] WARNING: SOCKET_SERVER_SECRET not set — realtime /emit calls will fail.');
  }
}

/** Resolved value: shell/host `process.env` wins, then `ENV`, then `undefined`. */
function get(key) {
  return ENV[key]//process.env[key] !== undefined ? process.env[key] : ENV[key];
}

module.exports = {
  ENV,
  applyToProcessEnv,
  get,
  ...ENV,
};

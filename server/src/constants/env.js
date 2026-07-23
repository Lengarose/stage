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

  // Microsoft — redirect: https://stageleagues.com/api/stage/auth/microsoft/callback
  MICROSOFT_CLIENT_ID: '',
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
  return process.env[key] !== undefined ? process.env[key] : ENV[key];
}

module.exports = {
  ENV,
  applyToProcessEnv,
  get,
  ...ENV,
};

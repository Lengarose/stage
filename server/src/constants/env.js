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

  // JWT
  ACCESS_TOKEN_SECRET:
    'SKLQMJKSDpooapeosdfqhjgfhjkaeErpuaurJLMFQ334JSLKD34J43FMQLKDSJFFjkdhsjkfhdskqljsdfqsf',
  REFRESH_TOKEN_SECRET:
    'PAZEJFNSWJSIDAOEZRAOZERJAJ?FSLDK?FSDLFKQSLDKFLQSDKFHAZEFNEARARarrabjhsdbhjfsqsdf',

  // Socket server on Render (socket-server/). URL = https://<service>.onrender.com (no trailing slash).
  // SECRET must match EMIT_SECRET on the Render socket service.
  SOCKET_SERVER_URL:    'https://stage-7osn.onrender.com',
  SOCKET_SERVER_SECRET: 'srv-#1?BCJw[JrZ}Y|>?6CVpCHrSCm$6><#)1O_{mRgIdlw',

  // Google OAuth — redirect: https://stageleagues.com/api/stage/auth/google/callback
  GOOGLE_CLIENT_ID: '',
  GOOGLE_CLIENT_SECRET: '',

  // Microsoft — redirect: https://stageleagues.com/api/stage/auth/microsoft/callback
  MICROSOFT_CLIENT_ID: '',
  MICROSOFT_CLIENT_SECRET: '',

  // Apple — return URL: https://stageleagues.com/api/stage/auth/apple/callback
  APPLE_CLIENT_ID: 'com.stageleagues.web',
  APPLE_TEAM_ID: '',
  APPLE_KEY_ID: '',
  APPLE_PRIVATE_KEY: '',
};

/** Sets missing process.env keys from ENV. Existing vars (e.g. host dashboard) win. */
function applyToProcessEnv() {
  for (const [key, value] of Object.entries(ENV)) {
    if (process.env[key] !== undefined) continue;
    process.env[key] = value == null ? '' : String(value);
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

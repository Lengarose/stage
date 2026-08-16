/**
 * Template for env.local.js (git-ignored — copy this file, fill in real values).
 *   cp env.local.example.js env.local.js
 * Generate secrets:
 *   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
 */
module.exports = {
  // Local smoke/development DB. Leave DB_SOCKET_PATH set on Gandi; set it to
  // an empty string locally to use DB_HOST/DB_PORT over TCP.
  DB_SOCKET_PATH: '',
  DB_HOST: '127.0.0.1',
  DB_PORT: '3306',
  DB_USER: 'root',
  DB_PASSWORD: '',
  DB_NAME: 'stage_league',

  ACCESS_TOKEN_SECRET: '<generate-96-hex-chars>',
  REFRESH_TOKEN_SECRET: '<generate-96-hex-chars>',
  // Must match EMIT_SECRET on the Render socket service.
  SOCKET_SERVER_SECRET: '<generate-64-hex-chars>',
  // Twitch OAuth client secret — dev.twitch.tv/console/apps -> your app -> New Secret.
  TWITCH_CLIENT_SECRET: '<twitch-client-secret>',
  // Kick OAuth client secret — kick.com/settings/developer -> your app.
  KICK_CLIENT_SECRET: '<kick-client-secret>',
  // Microsoft OAuth client secret — portal.azure.com -> App registrations -> Certificats & secrets.
  MICROSOFT_CLIENT_SECRET: '<microsoft-client-secret>',
  // Google OAuth client secret — console.cloud.google.com -> Credentials.
  GOOGLE_CLIENT_SECRET: '<google-client-secret>',
  // OneSignal dashboard → Settings → Keys & IDs
  ONESIGNAL_APP_ID: '<onesignal-app-id>',
  ONESIGNAL_REST_API_KEY: '<onesignal-rest-api-key>',
};

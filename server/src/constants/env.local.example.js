/**
 * Template for env.local.js (git-ignored — copy this file, fill in real values).
 *   cp env.local.example.js env.local.js
 * Generate secrets:
 *   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
 */
module.exports = {
  ACCESS_TOKEN_SECRET: '<generate-96-hex-chars>',
  REFRESH_TOKEN_SECRET: '<generate-96-hex-chars>',
  // Must match EMIT_SECRET on the Render socket service.
  SOCKET_SERVER_SECRET: '<generate-64-hex-chars>',
};

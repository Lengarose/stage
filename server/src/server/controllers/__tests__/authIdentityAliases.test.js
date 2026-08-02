const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const authController = fs.readFileSync(path.resolve(__dirname, '../authController.js'), 'utf8');
const oauthController = fs.readFileSync(path.resolve(__dirname, '../oauthController.js'), 'utf8');

test('auth responses expose owned club id alias alongside legacy owner id', () => {
  assert.match(authController, /ownedClubId/);
  assert.match(authController, /presidentClubId/);
  assert.match(authController, /AS president_club_id/);
  assert.match(authController, /president_club_id:/);
  assert.match(authController, /AS owned_club_id/);
  assert.match(authController, /owned_club_id:/);
  assert.match(oauthController, /ownedClubId/);
});

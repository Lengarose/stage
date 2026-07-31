const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('club memberships table is present in schema and startup migrations', () => {
  const root = path.resolve(__dirname, '../../../../..');
  const schema = fs.readFileSync(path.join(root, 'server/schema.sql'), 'utf8');
  const startupMigrations = fs.readFileSync(path.join(root, 'server/src/server/migrations/startupMigrations.js'), 'utf8');
  const stageClient = fs.readFileSync(path.join(root, 'src/api/stageClient.js'), 'utf8');

  assert.match(schema, /CREATE TABLE IF NOT EXISTS club_memberships/);
  assert.doesNotMatch(schema, /UNIQUE KEY uq_cm_active_player_club/);
  assert.match(schema, /INDEX idx_cm_player_club/);
  assert.match(startupMigrations, /CREATE TABLE IF NOT EXISTS club_memberships/);
  assert.match(startupMigrations, /DROP INDEX uq_cm_active_player_club/);
  assert.match(startupMigrations, /NOT EXISTS \(\s*SELECT 1\s*FROM club_memberships cm/s);
  assert.match(startupMigrations, /legacy_player_club_id/);
  assert.match(startupMigrations, /legacy_owner_link/);
  assert.match(stageClient, /'ClubMembership'/);
});

test('club membership controller accepts operational staff roles', () => {
  const root = path.resolve(__dirname, '../../../../..');
  const controller = fs.readFileSync(path.join(root, 'server/src/server/controllers/clubMembershipController.js'), 'utf8');

  assert.match(controller, /recruiter/);
  assert.match(controller, /finance_manager/);
  assert.match(controller, /match_coordinator/);
});

test('admin club deletion cleans club memberships', () => {
  const root = path.resolve(__dirname, '../../../../..');
  const legacyFunctions = fs.readFileSync(path.join(root, 'server/src/server/functions/legacyFunctions.js'), 'utf8');

  assert.match(legacyFunctions, /DELETE FROM club_memberships WHERE club_id = \?/);
});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('club memberships table is present in schema and startup migrations', () => {
  const root = path.resolve(__dirname, '../../../../..');
  const schema = fs.readFileSync(path.join(root, 'server/schema.sql'), 'utf8');
  const server = fs.readFileSync(path.join(root, 'server/src/server.js'), 'utf8');
  const stageClient = fs.readFileSync(path.join(root, 'src/api/stageClient.js'), 'utf8');

  assert.match(schema, /CREATE TABLE IF NOT EXISTS club_memberships/);
  assert.doesNotMatch(schema, /UNIQUE KEY uq_cm_active_player_club/);
  assert.match(schema, /INDEX idx_cm_player_club/);
  assert.match(server, /CREATE TABLE IF NOT EXISTS club_memberships/);
  assert.match(server, /DROP INDEX uq_cm_active_player_club/);
  assert.match(server, /NOT EXISTS \(\s*SELECT 1\s*FROM club_memberships cm/s);
  assert.match(server, /legacy_player_club_id/);
  assert.match(server, /legacy_owner_link/);
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
  const functionsController = fs.readFileSync(path.join(root, 'server/src/server/controllers/functionsController.js'), 'utf8');

  assert.match(functionsController, /DELETE FROM club_memberships WHERE club_id = \?/);
});

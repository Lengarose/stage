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
  assert.match(startupMigrations, /pending_window_free_agent_activation/);
  assert.match(startupMigrations, /active_contract_player_link/);
  assert.match(startupMigrations, /active_contract_membership_backfill/);
  assert.match(stageClient, /'ClubMembership'/);
});

test('fresh club schema and startup migrations preserve the required president link', () => {
  const root = path.resolve(__dirname, '../../../../..');
  const schema = fs.readFileSync(path.join(root, 'server/schema.sql'), 'utf8');
  const startupMigrations = fs.readFileSync(path.join(root, 'server/src/server/migrations/startupMigrations.js'), 'utf8');

  assert.match(schema, /president_user_id\s+VARCHAR\(36\)\s+NOT NULL/);
  assert.match(startupMigrations, /club_president_user_link/);
  assert.match(startupMigrations, /WHERE c\.president_user_id IS NULL/);
  assert.match(startupMigrations, /club_president_placeholder_users/);
  assert.match(startupMigrations, /club_president_orphans/);
  assert.match(startupMigrations, /ALTER TABLE clubs MODIFY COLUMN president_user_id VARCHAR\(36\) NOT NULL/);
});

test('legacy direct club inserts include the required president link', () => {
  const root = path.resolve(__dirname, '../../../../..');
  const legacyFunctions = fs.readFileSync(path.join(root, 'server/src/server/functions/legacyFunctions.js'), 'utf8');
  const directClubInserts = [...legacyFunctions.matchAll(/INSERT INTO clubs\s*\(([\s\S]*?)\)\s*VALUES/g)];

  assert.ok(directClubInserts.length > 0, 'Expected legacyFunctions.js to contain direct club inserts');
  for (const insert of directClubInserts) {
    assert.match(insert[1], /president_user_id/, `Missing president_user_id near character ${insert.index}`);
  }
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

test('message delivery tables include idempotency fields in schema and startup migrations', () => {
  const root = path.resolve(__dirname, '../../../../..');
  const schema = fs.readFileSync(path.join(root, 'server/schema.sql'), 'utf8');
  const startupMigrations = fs.readFileSync(path.join(root, 'server/src/server/migrations/startupMigrations.js'), 'utf8');

  assert.match(schema, /CREATE TABLE IF NOT EXISTS notifications \([\s\S]*related_id\s+VARCHAR\(36\)/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS notifications \([\s\S]*idempotency_key\s+VARCHAR\(190\)/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS inbox_messages \([\s\S]*sender_gamertag\s+VARCHAR\(100\)/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS inbox_messages \([\s\S]*sender_avatar_url\s+TEXT/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS inbox_messages \([\s\S]*sender_club_name\s+VARCHAR\(150\)/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS inbox_messages \([\s\S]*action_type\s+VARCHAR\(100\)/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS inbox_messages \([\s\S]*is_system\s+TINYINT\(1\)/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS inbox_messages \([\s\S]*metadata\s+JSON/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS inbox_messages \([\s\S]*idempotency_key\s+VARCHAR\(190\)/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS inbox_messages \([\s\S]*updated_date\s+DATETIME\s+DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP/);
  assert.match(schema, /CREATE INDEX idx_notifications_type_related\s+ON notifications\(type, related_id\)/);
  assert.match(schema, /CREATE INDEX idx_notifications_idempotency\s+ON notifications\(idempotency_key\)/);
  assert.match(schema, /CREATE INDEX idx_inbox_type_related\s+ON inbox_messages\(message_type, related_entity_id\)/);
  assert.match(schema, /CREATE INDEX idx_inbox_idempotency\s+ON inbox_messages\(idempotency_key\)/);
  assert.match(startupMigrations, /addCol\('notifications', 'related_id', 'VARCHAR\(36\) NULL'\)/);
  assert.match(startupMigrations, /addCol\('notifications', 'idempotency_key', 'VARCHAR\(190\) NULL'\)/);
  assert.match(startupMigrations, /addCol\('inbox_messages', 'sender_gamertag', 'VARCHAR\(100\) NULL'\)/);
  assert.match(startupMigrations, /addCol\('inbox_messages', 'sender_avatar_url', 'TEXT NULL'\)/);
  assert.match(startupMigrations, /addCol\('inbox_messages', 'sender_club_name', 'VARCHAR\(150\) NULL'\)/);
  assert.match(startupMigrations, /addCol\('inbox_messages', 'action_type', 'VARCHAR\(100\) NULL'\)/);
  assert.match(startupMigrations, /addCol\('inbox_messages', 'is_system', 'TINYINT\(1\) NULL DEFAULT 0'\)/);
  assert.match(startupMigrations, /addCol\('inbox_messages', 'metadata', 'JSON NULL'\)/);
  assert.match(startupMigrations, /addCol\('inbox_messages', 'idempotency_key', 'VARCHAR\(190\) NULL'\)/);
  assert.match(startupMigrations, /addCol\('inbox_messages', 'updated_date', 'DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'\)/);
  assert.match(startupMigrations, /match_invite_status_backfill/);
  assert.match(startupMigrations, /JSON_EXTRACT\(metadata, '\$\.created_match_id'\)\) = related_entity_id/);
  assert.match(startupMigrations, /addIndex\('notifications', 'idx_notifications_idempotency', '\(idempotency_key\)'\)/);
  assert.match(startupMigrations, /addIndex\('inbox_messages', 'idx_inbox_idempotency', '\(idempotency_key\)'\)/);
});

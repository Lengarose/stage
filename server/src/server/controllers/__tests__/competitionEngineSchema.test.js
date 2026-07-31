const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../../../..');
const schema = fs.readFileSync(path.join(root, 'schema.sql'), 'utf8');
const startupMigrations = fs.readFileSync(path.join(root, 'src/server/migrations/startupMigrations.js'), 'utf8');

const requiredTables = [
  'competition_instances',
  'competition_participants',
  'competition_fixtures',
  'competition_schedule_proposals',
  'competition_result_submissions',
  'competition_standings',
  'competition_phase_states',
  'competition_payouts',
];

test('competition engine tables are present in schema and startup migrations', () => {
  for (const table of requiredTables) {
    assert.match(schema, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
    assert.match(startupMigrations, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  }
});

test('competition fixtures enforce typed participant snapshots', () => {
  for (const column of [
    'participant_type',
    'home_participant_id',
    'away_participant_id',
    'home_owner_email',
    'away_owner_email',
    'player_home_gamertag',
    'player_away_gamertag',
  ]) {
    assert.match(schema, new RegExp(column));
  }
});

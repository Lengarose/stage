const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../../../../..');

const LEGACY_CLUB_PRESIDENT_FIELDS = [
  'president_name',
  'president_role_title',
  'president_avatar_url',
  'president_banner_url',
  'president_banner_position',
  'president_banner_zoom',
  'president_bio',
  'president_success_level',
  'president_country_code',
  'president_quote',
  'president_management_style',
  'president_started_at',
  'president_social_links',
];

const PRESIDENT_ENTITY_FIELDS = [
  'display_name',
  'role_title',
  'avatar_url',
  'avatar_position',
  'avatar_zoom',
  'banner_url',
  'banner_position',
  'banner_zoom',
  'bio',
  'success_level',
  'country_code',
  'quote',
  'management_style',
  'started_at',
  'social_links',
];

function readRepoFile(...parts) {
  return fs.readFileSync(path.join(root, ...parts), 'utf8');
}

test('president profile lives on presidents entity, not clubs', () => {
  const schema = readRepoFile('server/schema.sql');
  const migrations = readRepoFile('server/src/server/migrations/startupMigrations.js');
  const clubModel = readRepoFile('server/src/server/models/clubModel.js');
  const clubController = readRepoFile('server/src/server/controllers/clubController.js');
  const presidentModel = readRepoFile('server/src/server/models/presidentModel.js');
  const presidentController = readRepoFile('server/src/server/controllers/presidentController.js');
  const routes = readRepoFile('server/src/server/routes/registerStageRoutes.js');
  const stageClient = readRepoFile('src/api/stageClient.js');
  const clubEntityMeta = readRepoFile('base44/entities/Club.jsonc');
  const presidentEntityMeta = readRepoFile('base44/entities/President.jsonc');

  assert.match(schema, /CREATE TABLE IF NOT EXISTS presidents\s*\(/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS president_club_history/);
  assert.match(schema, /president_id\s+VARCHAR\(36\)/);
  assert.match(migrations, /CREATE TABLE IF NOT EXISTS presidents/);
  assert.match(migrations, /CREATE TABLE IF NOT EXISTS president_club_history/);
  assert.match(migrations, /addCol\('clubs', 'president_id'/);
  assert.match(migrations, /dropCol\('clubs', 'president_name'\)|Dropped clubs\.president_name|dropCol\('clubs', column\)/);
  assert.match(routes, /\/api\/stage\/presidents/);
  assert.match(stageClient, /'President'/);

  for (const field of LEGACY_CLUB_PRESIDENT_FIELDS) {
    assert.doesNotMatch(
      schema,
      new RegExp(`^\\s*${field}\\s+`, 'm'),
      `schema.sql clubs table should not declare ${field}`
    );
    assert.doesNotMatch(clubModel, new RegExp(`'${field}'`), `Club model should not persist ${field}`);
    assert.doesNotMatch(clubController, new RegExp(`'${field}'`), `Club controller should not whitelist ${field}`);
    assert.doesNotMatch(clubEntityMeta, new RegExp(`"${field}"`), `Club entity metadata should not expose ${field}`);
  }

  for (const field of PRESIDENT_ENTITY_FIELDS) {
    assert.match(presidentModel, new RegExp(`'${field}'`), `President model is missing ${field}`);
    assert.match(presidentEntityMeta, new RegExp(`"${field}"`), `President entity metadata is missing ${field}`);
  }

  assert.match(presidentController, /extractPresidentProfileFromClubBody/);
  assert.match(clubController, /extractPresidentProfileFromClubBody/);
  assert.match(clubModel, /'president_id'/);
  assert.match(schema, /offered_by_president_id/);
  assert.match(schema, /fk_presidents_club_id/);
  assert.match(schema, /fk_clubs_president_id/);
});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../../../../..');

const PRESIDENT_FIELDS = [
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

function readRepoFile(...parts) {
  return fs.readFileSync(path.join(root, ...parts), 'utf8');
}

test('club president profile fields are persisted and editable through Club', () => {
  const schema = readRepoFile('server/schema.sql');
  const migrations = readRepoFile('server/src/server/migrations/startupMigrations.js');
  const model = readRepoFile('server/src/server/models/clubModel.js');
  const controller = readRepoFile('server/src/server/controllers/clubController.js');
  const entityMeta = readRepoFile('base44/entities/Club.jsonc');

  for (const field of PRESIDENT_FIELDS) {
    assert.match(schema, new RegExp(`${field}\\s+`), `schema.sql is missing ${field}`);
    assert.match(migrations, new RegExp(`addCol\\('clubs', '${field}'`), `startup migrations are missing ${field}`);
    assert.match(model, new RegExp(`\\b${field}\\b`), `Club model SQL is missing ${field}`);
    assert.match(controller, new RegExp(`'${field}'`), `Club controller whitelist is missing ${field}`);
    assert.match(entityMeta, new RegExp(`"${field}"`), `Club entity metadata is missing ${field}`);
  }
});

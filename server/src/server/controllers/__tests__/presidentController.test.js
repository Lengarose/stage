const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const test = require('node:test');

const {
  extractPresidentProfileFromClubBody,
  LEGACY_CLUB_FIELD_MAP,
} = require('../presidentController');

const controllerSrc = readFileSync(resolve(__dirname, '../presidentController.js'), 'utf8');

test('extractPresidentProfileFromClubBody maps nested president object', () => {
  const body = {
    name: 'FC Test',
    president: {
      display_name: 'Ada',
      bio: 'Builds clubs',
      success_level: 'boss',
    },
  };
  const profile = extractPresidentProfileFromClubBody(body);
  assert.equal(profile.display_name, 'Ada');
  assert.equal(profile.bio, 'Builds clubs');
  assert.equal(profile.success_level, 'boss');
  assert.equal(body.president, undefined);
  assert.equal(body.name, 'FC Test');
});

test('extractPresidentProfileFromClubBody maps legacy flat president_* fields and strips them', () => {
  const body = {
    name: 'FC Legacy',
    president_name: 'Legacy Prez',
    president_avatar_url: 'https://cdn.example/a.png',
    president_social_links: { x: 'https://x.com/a' },
  };
  const profile = extractPresidentProfileFromClubBody(body);
  assert.equal(profile.display_name, 'Legacy Prez');
  assert.equal(profile.avatar_url, 'https://cdn.example/a.png');
  assert.deepEqual(profile.social_links, { x: 'https://x.com/a' });
  for (const legacyKey of Object.keys(LEGACY_CLUB_FIELD_MAP)) {
    assert.equal(body[legacyKey], undefined, `${legacyKey} should be stripped from club body`);
  }
  assert.equal(body.name, 'FC Legacy');
});

test('nested president fields win over legacy flat keys', () => {
  const body = {
    president: { display_name: 'Nested' },
    president_name: 'Flat',
  };
  const profile = extractPresidentProfileFromClubBody(body);
  assert.equal(profile.display_name, 'Nested');
});

test('president controller exposes audited transfer POST and blocks club_id via PATCH', () => {
  assert.match(controllerSrc, /router\.post\('\/:id\/transfer'/);
  assert.match(controllerSrc, /transferPresidentToClub/);
  assert.match(controllerSrc, /Use POST \/presidents\/:id\/transfer/);
  assert.match(controllerSrc, /field === 'club_id'\) continue/);
});

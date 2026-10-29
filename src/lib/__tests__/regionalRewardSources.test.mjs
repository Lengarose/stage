import test from 'node:test';
import assert from 'node:assert/strict';
import { regionalRewardSources, loadRegionalRewardSources } from '../regionalRewardSources.js';
test('duplicate response IDs appear once; conflicting distinct IDs remain visible and flagged', () => {
  const first = { id: 'a', name: 'Same name', region_slug: 'north-america', division: 1, season_number: 1, platform: 'Cross-Platform' };
  const sources = regionalRewardSources([first, first, { ...first, id: 'b' }, { ...first, id: 'c', division: 2 }, { ...first, id: 'd', platform: 'PlayStation' }, { ...first, id: 'e', season_number: 2 }]);
  assert.equal(sources.length, 5);
  assert.deepEqual(sources.filter(row => row.identity_conflict).map(row => row.id), ['a', 'b', 'e']);
});
test('catalogue reward sources retain permanent defaults and attach current/history metadata separately', async () => {
  const paths = [];
  const editions = [{ id: 'original', season_number: 1 }, { id: 'second', permanent_league_id: 'original', season_number: 2, trophy_item_id: 'snapshot-trophy' }];
  const rows = await loadRegionalRewardSources({ http: { get: async path => {
    paths.push(path);
    return { leagues: [{ id: 'second', permanent_league_id: 'original', stable_slug: 'original-slug', name: 'Edition name', trophy_item_id: 'snapshot-trophy', max_clubs: 12, editions }], definitions: [{ id: 'original', name: 'Permanent name', slug: 'original-slug', trophy_item_id: 'default-trophy', max_clubs: 20, rules: { legs: 2 }, reward_defaults: { budget: 100 } }], editions };
  } } });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 'original');
  assert.equal(rows[0].current_edition_id, 'second');
  assert.equal(rows[0].name, 'Permanent name');
  assert.equal(rows[0].trophy_item_id, 'default-trophy');
  assert.equal(rows[0].max_clubs, 20);
  assert.deepEqual(rows[0].rules, { legs: 2 });
  assert.deepEqual(rows[0].reward_defaults, { budget: 100 });
  assert.equal(rows[0].current_edition.trophy_item_id, 'snapshot-trophy');
  assert.deepEqual(rows[0].editions, editions);
  assert.deepEqual(paths, ['/regional-leagues/catalogue']);
});
test('explicit null current edition remains null without selecting Season 1 evidence', () => {
  const definition = { id: 'root', current_edition_id: 'stale', season_number: 1 };
  const current = { id: 'root', permanent_league_id: 'root', current_edition_id: null, identity_conflict: true };
  const [source] = regionalRewardSources([definition], [current], [{ id: 'root', season_number: 1 }]);
  assert.equal(source.current_edition_id, null);
  assert.equal(source.current_edition, null);
  assert.equal(source.identity_conflict, true);
  assert.equal(regionalRewardSources([{ ...definition, current_edition_id: null }])[0].current_edition_id, null);
  assert.equal(regionalRewardSources([{ ...definition, current_edition_id: null }], [{ id: 'root' }])[0].current_edition_id, null);
});
test('orphan edition rows cannot become independent reward or trophy sources', () => {
  const sources = regionalRewardSources([{ id: 'original', name: 'Default' }], [{ id: 'orphan', permanent_league_id: 'missing' }], [{ id: 'orphan', permanent_league_id: 'missing' }]);
  assert.deepEqual(sources.map(row => row.id), ['original']);
  assert.deepEqual(sources[0].editions, []);
});
test('explicit permanent ancestry deduplicates sources, including future Division 3', () => {
  const base = { region_slug: 'north-america', division: 3, platform: 'Cross-Platform', season_number: 1 };
  const sources = regionalRewardSources([{ ...base, id: 'root' }, { ...base, id: 's2', permanent_league_id: 'root', season_number: 2 }]);
  assert.equal(sources.length, 1);
  assert.equal(sources[0].id, 'root');
  assert.equal(sources[0].division, 3);
  assert.equal(sources[0].identity_conflict, false);
});
test('catalogue identity conflicts remain visible even across different seasons', () => {
  assert.equal(regionalRewardSources([{ id: 'root', region_slug: 'north-america', platform: 'cross-platform', division: 1, season_number: 2, identity_conflict: true }])[0].identity_conflict, true);
});
test('missing or malformed catalogue fails without falling back to raw editions', async () => {
  const paths = [];
  await assert.rejects(loadRegionalRewardSources({ http: { get: async path => { paths.push(path); throw new Error('Not Found'); } } }), /Not Found/);
  assert.deepEqual(paths, ['/regional-leagues/catalogue']);
  await assert.rejects(loadRegionalRewardSources({ http: { get: async () => [] } }), /invalid/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { regionalRewardSources, loadRegionalRewardSources } from '../regionalRewardSources.js';
test('duplicate response IDs appear once; conflicting distinct IDs remain visible and flagged', () => {
  const first = { id: 'a', name: 'Same name', region_slug: 'north-america', division: 1, season_number: 1, platform: 'Cross-Platform' };
  const sources = regionalRewardSources([first, first, { ...first, id: 'b' }, { ...first, id: 'c', division: 2 }, { ...first, id: 'd', platform: 'PlayStation' }, { ...first, id: 'e', season_number: 2 }]);
  assert.equal(sources.length, 5);
  assert.deepEqual(sources.filter(row => row.identity_conflict).map(row => row.id), ['a', 'b']);
});
test('all pages of regional sources are requested without using a total-count seed shortcut', async () => {
  const offsets = [];
  const rows = await loadRegionalRewardSources({ http: { get: async (_path, query) => { offsets.push(query.offset); return query.offset === 0 ? Array.from({ length: 500 }, (_, i) => ({ id: String(i) })) : [{ id: 'last' }]; } } });
  assert.equal(rows.length, 501);
  assert.deepEqual(offsets, [0, 500]);
});

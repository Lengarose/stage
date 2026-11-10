import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCollectionEntries, filterTrophyEntries, trophyCategory, findOpenSpot } from '../trophyCollection.js';

const design = { id: 'cup', name: 'Cup Design', image_url: '/cup.png', rarity: 'rare' };

test('official linked and Admin-only designs remain visible, but only earned copies unlock', () => {
  const designs = ['competition', 'regional_league', 'regional_cup'].map((source, i) => ({ ...design, id: `official-${i}`, admin_only: 1, linked_source_type: source }));
  const rows = buildCollectionEntries(designs, [{ id: 'award', trophy_item_id: 'official-2', status: 'earned', persisted: true, competition_name: 'UK Cup', edition_label: 'Season 2' }]);
  assert.equal(rows.length, 3);
  assert.equal(rows.find(r => r.id === 'official-0').state, 'locked');
  assert.equal(rows.find(r => r.id === 'official-1').state, 'locked');
  assert.equal(rows.find(r => r.id === 'official-2').state, 'available');
  assert.deepEqual(filterTrophyEntries(rows, { status: 'available' }).map(r => r.id), ['official-2']);
  assert.deepEqual(filterTrophyEntries(rows, { source: 'gost' }).map(r => r.id), ['official-0']);
  assert.deepEqual(filterTrophyEntries(rows, { search: 'season 2', source: 'regional_cup' }).map(r => r.id), ['official-2']);
  assert.equal(filterTrophyEntries(rows, { search: 'missing' }).length, 0);
});

test('earned official copies keep their category when the catalogue page is unavailable', () => {
  const [row] = buildCollectionEntries([], [{ id: 'award', trophy_item_id: 'historical', persisted: true, source_type: 'regional_cup_edition' }]);
  assert.equal(trophyCategory(row), 'regional_cup');
});

test('collection shows locked catalogue designs with no earned awards', () => {
  const rows = buildCollectionEntries([design], [], []);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].state, 'locked');
  assert.equal(rows[0].statusLabel, 'Win to unlock.');
  assert.equal(rows[0].availableCount, 0);
});

test('collection stays visible after every earned copy is permanently placed', () => {
  const award = {
    id: 'a1', persisted: true, trophy_item_id: 'cup',
    display_name: 'Cup — 2026', competition_name: 'Cup', edition_label: '2026',
  };
  const placement = { id: 'p1', award_id: 'a1', trophy_item_id: 'cup', locked_at: '2026-01-01' };
  const rows = buildCollectionEntries([design], [award], [placement]);
  assert.equal(rows[0].state, 'placed');
  assert.match(rows[0].statusLabel, /Placed/);
  assert.equal(rows[0].availableCount, 0);
});

test('available copy count excludes drafts and permanent placements', () => {
  const awards = [
    { id: 'a1', persisted: true, trophy_item_id: 'cup', display_name: 'Cup — 2025' },
    { id: 'a2', persisted: true, trophy_item_id: 'cup', display_name: 'Cup — 2026' },
    { id: 'a3', persisted: true, trophy_item_id: 'cup', display_name: 'Cup — 2027' },
  ];
  const placements = [
    { id: 'p1', award_id: 'a1', trophy_item_id: 'cup', locked_at: '2026-01-01' },
    { id: 'p2', award_id: 'a2', trophy_item_id: 'cup', locked_at: null },
  ];
  const rows = buildCollectionEntries([design], awards, placements);
  assert.equal(rows[0].state, 'available');
  assert.equal(rows[0].availableCount, 1);
  assert.equal(rows[0].availableAwards[0].id, 'a3');
  assert.equal(rows[0].statusLabel, '1 copy available.');
});

test('draft-only designs show draft in cabinet without offering a duplicate place', () => {
  const award = { id: 'a1', persisted: true, trophy_item_id: 'cup', display_name: 'Cup — 2026' };
  const placement = { id: 'p1', award_id: 'a1', trophy_item_id: 'cup', locked_at: null };
  const rows = buildCollectionEntries([design], [award], [placement]);
  assert.equal(rows[0].state, 'draft');
  assert.equal(rows[0].statusLabel, 'Draft in cabinet.');
  assert.equal(rows[0].availableCount, 0);
});

test('unpersisted legacy awards do not unlock placement availability', () => {
  const award = { id: null, persisted: false, trophy_item_id: 'cup', display_name: 'Legacy' };
  const rows = buildCollectionEntries([design], [award], []);
  assert.equal(rows[0].state, 'locked');
});

test('findOpenSpot avoids colliding with existing placements', () => {
  const spot = findOpenSpot([{ x_percent: 20, y_percent: 40 }]);
  assert.ok(Math.abs(spot.x - 20) > 12 || Math.abs(spot.y - 40) > 15);
});

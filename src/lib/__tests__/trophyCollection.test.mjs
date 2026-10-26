import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCollectionEntries, findOpenSpot } from '../trophyCollection.js';

const design = { id: 'cup', name: 'Cup Design', image_url: '/cup.png', rarity: 'rare' };

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

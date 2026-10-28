import test from 'node:test';
import assert from 'node:assert/strict';
import { directoryRows, editionSelection, editionProgress, seasonLocation, detailTabs } from '../gostDetail.js';

test('directory combines complete-field search, league and stable alphabetical sorting without reordering own club', () => {
  const clubs = Array.from({ length: 36 }, (_, i) => ({ id: String(i), name: `Club ${String(i).padStart(2, '0')}`, regional_league_id: i % 2 ? 'a' : 'b' }));
  assert.equal(directoryRows(clubs).length, 36);
  assert.deepEqual(directoryRows(clubs, 'Club 3', 'a', 'desc').map(c => c.id), ['35', '33', '31']);
  assert.equal(directoryRows(clubs, 'missing').length, 0);
  assert.deepEqual(directoryRows([{ id: 'b', name: 'Same' }, { id: 'a', name: 'Same' }]).map(c => c.id), ['a', 'b']);
});
test('season selection is scoped to its source, never substitutes another edition for a missing requested ID', () => {
  const editions = [{ id: 'new', status: 'draft' }, { id: 'old', status: 'archived' }];
  assert.equal(editionSelection(editions).id, 'new');
  assert.equal(editionSelection(editions, 'old').id, 'old');
  assert.equal(editionSelection(editions, 'another-source'), null);
  const old = new URLSearchParams('tab=clubs&filter=x');
  assert.equal(seasonLocation(old, 'old').get('tab'), 'clubs');
  assert.equal(seasonLocation(old, 'old', true).get('tab'), 'overview');
  assert.equal(old.has('season'), false);
  assert.deepEqual(detailTabs, ['overview', 'clubs', 'stages', 'table', 'stats', 'rewards', 'history']);
});
test('state uses actual participants and matches, confirmed results and real schedules', () => {
  const season = { status: 'draft' };
  assert.equal(editionProgress(season, [], []).title, 'Awaiting regional qualification');
  assert.equal(editionProgress(season, [{ id: 'c' }], []).title, 'Qualified clubs confirmed');
  const matches = [
    { id: 'scheduled', status: 'scheduled', scheduling_status: 'confirmed', scheduled_date: '2026-11-01' },
    { id: 'proposed', status: 'scheduled', scheduling_status: 'home_proposed', scheduled_date: '2026-10-31' },
    { id: 'unconfirmed', status: 'completed', result_state: 'DISPUTED', scheduling_status: 'confirmed', scheduled_date: '2026-11-02' },
    { id: 'cancelled', status: 'cancelled' },
    { id: 'bye', status: 'bye' },
    { id: 'final', type: 'knockout_final', status: 'completed', result_state: 'CONFIRMED' },
  ];
  const progress = editionProgress(season, [], matches);
  assert.equal(progress.title, 'Competition in progress');
  assert.deepEqual(progress.played.map(m => m.id), ['final']);
  assert.deepEqual(progress.upcoming.map(m => m.id), ['scheduled']);
  assert.equal(progress.required.length, 4);
  assert.equal(editionProgress(season, [{ id: 'club' }], [matches[0]]).title, 'Fixtures ready', 'a generated draw is not proof the season started');
  assert.equal(editionProgress({ status: 'archived' }, [], matches).title, 'Archived edition');
});

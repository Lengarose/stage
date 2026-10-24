import test from 'node:test';
import assert from 'node:assert/strict';
import { loadDirectoryRows, searchDirectory } from '../directoryData.js';

test('participant directory includes players beyond the first 200 records', async () => {
  const players = Array.from({ length: 451 }, (_, index) => ({ id: `player-${index}`, overall_rating: 99 - index / 100 }));
  const offsets = [];
  const entity = { async filter(filters, order, limit) {
    assert.equal(order, '-overall_rating');
    offsets.push(filters.offset);
    return players.slice(filters.offset, filters.offset + limit);
  } };
  const result = await loadDirectoryRows(entity, { orderBy: '-overall_rating' });
  assert.equal(result.length, 451);
  assert.equal(result.at(-1).id, 'player-450');
  assert.deepEqual(offsets, [0, 200, 400]);
});

test('search sends its query to the API and resolves presidents through matching clubs', async () => {
  const player = { id: 'president-player', gamertag: 'Captain', country_code: 'BE' };
  const club = { id: 'club-1', name: 'Needle United', president_player_id: player.id };
  let hydrated = false;
  const client = { entities: {
    Player: { filter: async filters => { assert.equal(filters.search, 'Needle'); return []; }, get: async id => { assert.equal(id, player.id); hydrated = true; return player; } },
    Club: { filter: async filters => { assert.equal(filters.search, 'Needle'); return [club]; } },
  } };
  const result = await searchDirectory(client, 'Needle');
  assert.equal(hydrated, true);
  assert.equal(result.clubs[0].id, club.id);
  assert.equal(result.presidents[0].id, player.id);
});

test('pagination fails explicitly if a full page repeats instead of advancing', async () => {
  const entity = { filter: async () => [{ id: 'same-player' }] };
  await assert.rejects(loadDirectoryRows(entity, { pageSize: 1 }), /did not advance/);
  await assert.rejects(loadDirectoryRows(entity, { pageSize: 0 }), /page size/);
});

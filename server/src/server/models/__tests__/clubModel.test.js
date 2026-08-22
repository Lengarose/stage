const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

function loadModelWithDbMock(executesql) {
  const modelPath = path.resolve(__dirname, '../clubModel.js');
  const dbPath = path.resolve(__dirname, '../../db/database.js');

  delete require.cache[modelPath];
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { EXECUTESQL: executesql },
  };

  return require(modelPath);
}

test('Club create derives president_user_id from user_id before insert', async () => {
  const calls = [];
  const executesql = async (sql, params = []) => {
    calls.push({ sql, params });
    return { affectedRows: 1 };
  };
  const Club = loadModelWithDbMock(executesql);
  const club = new Club({
    id: 'club-1',
    user_id: 'president-user',
    owner_email: 'president@example.test',
    name: 'President FC',
  });

  await club.create();

  assert.match(calls[0].sql, /INSERT INTO clubs/);
  assert.equal(calls[0].params[1], 'president-user');
  assert.equal(calls[0].params[2], 'president-user');
  assert.equal(club.president_user_id, 'president-user');
});

test('Club create persists canonical president_player_id when provided', async () => {
  const calls = [];
  const executesql = async (sql, params = []) => {
    calls.push({ sql, params });
    return { affectedRows: 1 };
  };
  const Club = loadModelWithDbMock(executesql);
  const club = new Club({
    id: 'club-1',
    user_id: 'president-user',
    president_user_id: 'president-user',
    president_player_id: 'player-president-1',
    owner_email: 'president@example.test',
    name: 'President FC',
  });

  await club.create();

  assert.match(calls[0].sql, /president_player_id/);
  assert.equal(calls[0].params[4], 'player-president-1');
});

test('Club create rejects persisted clubs without a president user link', () => {
  const Club = loadModelWithDbMock(async () => {
    throw new Error('insert should not run');
  });
  const club = new Club({
    id: 'club-1',
    owner_email: 'orphan@example.test',
    name: 'Orphan FC',
  });

  assert.throws(
    () => club.create(),
    /Club president_user_id is required/
  );
});

test('Club can select by canonical president player id', async () => {
  const calls = [];
  const executesql = async (sql, params = []) => {
    calls.push({ sql, params });
    return [];
  };
  const Club = loadModelWithDbMock(executesql);

  await new Club().selectByPresidentPlayerId('player-president-1');

  assert.match(calls[0].sql, /WHERE president_player_id = \?/);
  assert.deepEqual(calls[0].params, ['player-president-1']);
});

test('Club selectAll respects directory page size and offset', async () => {
  const calls = [];
  const executesql = async (sql, params = []) => {
    calls.push({ sql, params });
    return [];
  };
  const Club = loadModelWithDbMock(executesql);

  await new Club().selectAll({ page: 3, limit: 25 });

  assert.match(calls[0].sql, /ORDER BY name ASC LIMIT \? OFFSET \?/);
  assert.deepEqual(calls[0].params, [25, 50]);
});

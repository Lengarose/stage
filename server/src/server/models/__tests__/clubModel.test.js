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

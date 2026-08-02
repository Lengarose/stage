const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

function loadModelWithDbMock(executesql) {
  const modelPath = path.resolve(__dirname, '../internationalTournamentModel.js');
  const dbPath = path.resolve(__dirname, '../../db/database.js');

  delete require.cache[modelPath];
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { EXECUTESQL: executesql, withTransaction: async (fn) => fn(executesql) },
  };

  return require(modelPath);
}

test('international owner candidate queries prefer canonical club president user links', async () => {
  const calls = [];
  const executesql = async (sql, params = []) => {
    calls.push({ sql, params });
    return [];
  };
  const InternationalTournamentModel = loadModelWithDbMock(executesql);
  const model = new InternationalTournamentModel();

  await model.getOwnerForUser({ id: 'president-user', email: 'president@example.test' });
  await model.listOwnerCandidates('BE');
  await model.getOwnerCandidate('BE', 'club-1');

  assert.match(calls[0].sql, /COALESCE\(c\.president_user_id, c\.user_id, u\.id\) AS owner_user_id/);
  assert.match(calls[0].sql, /u\.id = c\.president_user_id/);
  assert.match(calls[0].sql, /c\.president_user_id = \?/);
  assert.match(calls[0].sql, /ORDER BY c\.president_user_id = \? DESC/);

  assert.match(calls[1].sql, /COALESCE\(c\.president_user_id, c\.user_id, u\.id\) AS owner_user_id/);
  assert.match(calls[1].sql, /COALESCE\(c\.president_user_id, c\.user_id, u\.id\) IS NOT NULL/);

  assert.match(calls[2].sql, /COALESCE\(c\.president_user_id, c\.user_id, u\.id\) AS owner_user_id/);
  assert.match(calls[2].sql, /COALESCE\(c\.president_user_id, c\.user_id, u\.id\) IS NOT NULL/);
});

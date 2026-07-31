const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

function loadModelWithDbMock(executesql) {
  const modelPath = path.resolve(__dirname, '../playerContractModel.js');
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

test('PlayerContract maps target_player_id to legacy user_id column on create', async () => {
  const calls = [];
  const executesql = async (sql, params = []) => {
    calls.push({ sql, params });
    return { affectedRows: 1 };
  };
  const PlayerContract = loadModelWithDbMock(executesql);
  const model = new PlayerContract({
    id: 'contract-1',
    team_id: 'club-1',
    target_player_id: 'player-1',
    contract_type: 'squad',
    status: 'pending',
  });

  await model.create();

  assert.match(calls[0].sql, /id, team_id, user_id/);
  assert.equal(calls[0].params[2], 'player-1');
  assert.equal(model.user_id, 'player-1');
  assert.equal(model.target_player_id, 'player-1');
});

test('PlayerContract selectors expose target_player_id alias', async () => {
  const calls = [];
  const executesql = async (sql, params = []) => {
    calls.push({ sql, params });
    return [];
  };
  const PlayerContract = loadModelWithDbMock(executesql);
  const model = new PlayerContract();

  await model.selectByUser('player-1');
  await model.selectByUserAndStatus('player-1', 'active');

  assert.match(calls[0].sql, /user_id AS target_player_id/);
  assert.match(calls[0].sql, /WHERE user_id = \?/);
  assert.match(calls[1].sql, /user_id AS target_player_id/);
  assert.deepEqual(calls[1].params, ['player-1', 'active']);
});

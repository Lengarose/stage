const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

function loadFunctionsRouterWithDbMock(executesql) {
  const controllerPath = path.resolve(__dirname, '../functionsController.js');
  const dbPath = path.resolve(__dirname, '../../db/database.js');

  delete require.cache[controllerPath];
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { EXECUTESQL: executesql, pool: {} },
  };

  return require(controllerPath);
}

function postFunctionHandler(router) {
  const layer = router.stack.find((entry) => entry.route?.path === '/:name');
  return layer.route.stack[0].handle;
}

test('playerWallet get_balance resolves player linked by users.player_id', async () => {
  const player = { id: 'player-1', email: 'player@example.test', stc: 1234 };
  const executesql = async (sql, params) => {
    if (/FROM users WHERE id = \?/.test(sql)) {
      return [{ id: params[0], email: player.email, player_id: player.id, owner_id: null }];
    }
    if (/FROM players WHERE id = \?/.test(sql)) return [player];
    if (/FROM players WHERE user_id = \?/.test(sql)) return [];
    if (/FROM clubs WHERE/.test(sql)) return [];
    if (/FROM player_contracts/.test(sql)) return [];
    if (/FROM player_stc_transactions/.test(sql)) return [];
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const router = loadFunctionsRouterWithDbMock(executesql);
  const handle = postFunctionHandler(router);
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
    },
  };

  await handle(
    { params: { name: 'playerWallet' }, body: { action: 'get_balance' }, user: { id: 'user-1' } },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.data.balance, 1234);
});

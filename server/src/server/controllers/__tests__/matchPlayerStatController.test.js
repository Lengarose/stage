const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');

const originalLoad = Module._load;

function makeExpressMock() {
  return {
    Router() {
      const router = { stack: [] };
      for (const method of ['get', 'post', 'patch', 'delete']) {
        router[method] = (routePath, handle) => {
          router.stack.push({
            route: {
              path: routePath,
              methods: { [method]: true },
              stack: [{ method, handle }],
            },
          });
        };
      }
      return router;
    },
  };
}

Module._load = function patchedLoad(request, parent, isMain) {
  if (request === 'express') return makeExpressMock();
  return originalLoad.call(this, request, parent, isMain);
};

test.after(() => {
  Module._load = originalLoad;
});

function loadMatchPlayerStatRouterWithDbMock(executesql) {
  const controllerPath = path.resolve(__dirname, '../matchPlayerStatController.js');
  const modelPath = path.resolve(__dirname, '../../models/matchPlayerStatModel.js');
  const dbPath = path.resolve(__dirname, '../../db/database.js');

  delete require.cache[controllerPath];
  delete require.cache[modelPath];
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { EXECUTESQL: executesql },
  };

  return require(controllerPath);
}

function getHandler(router, pathPattern, method = 'get') {
  const layer = router.stack.find((entry) =>
    entry.route?.path === pathPattern && entry.route.methods?.[method]
  );
  return layer.route.stack.find((entry) => entry.method === method).handle;
}

function makeJsonResponse() {
  return {
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
}

test('GET / filters match-player stats by club_id', async () => {
  let captured = null;
  const executesql = async (sql, params = []) => {
    captured = { sql, params };
    return [{ id: 'stat-1', club_id: params[0], player_id: 'player-1', match_id: 'match-1' }];
  };
  const router = loadMatchPlayerStatRouterWithDbMock(executesql);
  const response = makeJsonResponse();

  await getHandler(router, '/')({ query: { club_id: 'club-stage' } }, response);

  assert.equal(response.statusCode, 200);
  assert.match(captured.sql, /WHERE club_id = \?/);
  assert.deepEqual(captured.params, ['club-stage']);
  assert.deepEqual(response.body, [
    { id: 'stat-1', club_id: 'club-stage', player_id: 'player-1', match_id: 'match-1' },
  ]);
});

test('GET / can filter match-player stats by club_id and player_id together', async () => {
  let captured = null;
  const executesql = async (sql, params = []) => {
    captured = { sql, params };
    return [];
  };
  const router = loadMatchPlayerStatRouterWithDbMock(executesql);
  const response = makeJsonResponse();

  await getHandler(router, '/')({ query: { club_id: 'club-stage', player_id: 'lengarose' } }, response);

  assert.equal(response.statusCode, 200);
  assert.match(captured.sql, /WHERE club_id = \? AND player_id = \?/);
  assert.deepEqual(captured.params, ['club-stage', 'lengarose']);
});

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

function loadRouter(serviceMock = {}) {
  const routerPath = path.resolve(__dirname, '../competitionEngineController.js');
  const servicePath = path.resolve(__dirname, '../../services/competitionEngineService.js');
  const modelPath = path.resolve(__dirname, '../../models/competitionEngineModel.js');
  const dbPath = path.resolve(__dirname, '../../db/database.js');
  delete require.cache[routerPath];
  delete require.cache[modelPath];
  require.cache[servicePath] = {
    id: servicePath,
    filename: servicePath,
    loaded: true,
    exports: serviceMock,
  };
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { EXECUTESQL: async () => [], pool: {} },
  };
  return require(routerPath);
}

function findHandler(router, routePath, method) {
  const layer = router.stack.find((entry) => entry.route?.path === routePath && entry.route.methods[method]);
  return layer.route.stack[0].handle;
}

test('POST /fixtures/:id/match/create delegates to service', async () => {
  const router = loadRouter({
    createMatchFromFixture: async (id) => ({ id: 'match-1', source_fixture_id: id }),
  });
  const handle = findHandler(router, '/fixtures/:id/match/create', 'post');
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
  await handle({ params: { id: 'fixture-1' }, user: { id: 'user-1' } }, response);
  assert.equal(response.statusCode, 201);
  assert.equal(response.body.source_fixture_id, 'fixture-1');
});

test('POST /matches/:id/results/submit validates side', async () => {
  const router = loadRouter({
    submitResult: async () => ({ status: 'pending_confirmation' }),
  });
  const handle = findHandler(router, '/matches/:id/results/submit', 'post');
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
  await handle({
    params: { id: 'match-1' },
    body: { side: 'middle', score_home: 1, score_away: 0 },
    user: { id: 'user-1' },
  }, response);
  assert.equal(response.statusCode, 400);
});

test('POST /instances/backfill delegates community tournament backfill to service', async () => {
  const router = loadRouter({
    backfillCommunityTournaments: async ({ status }) => ({
      status,
      tournaments: 1,
      instances: 1,
      participants: 2,
      fixtures: 3,
    }),
  });
  const handle = findHandler(router, '/instances/backfill', 'post');
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
  await handle({
    body: { product_type: 'community_tournament', status: 'in_progress' },
    user: { id: 'user-1' },
  }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.tournaments, 1);
  assert.equal(response.body.participants, 2);
});

test('POST /instances/backfill delegates official competition backfill to service', async () => {
  const router = loadRouter({
    backfillLeagueEntities: async ({ productType, status }) => ({
      product_type: productType,
      status,
      parents: 1,
      instances: 1,
      participants: 4,
      fixtures: 8,
    }),
  });
  const handle = findHandler(router, '/instances/backfill', 'post');
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
  await handle({
    body: { product_type: 'official_competition', status: 'in_progress' },
    user: { id: 'user-1' },
  }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.product_type, 'official_competition');
  assert.equal(response.body.fixtures, 8);
});

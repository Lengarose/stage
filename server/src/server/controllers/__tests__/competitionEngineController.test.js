const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

function loadRouter(serviceMock = {}, executesql = async () => [{ id: 'admin-1', email: 'admin@example.test', role_id: 0 }]) {
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
    exports: { EXECUTESQL: executesql, pool: {} },
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
  const auditWrites = [];
  const router = loadRouter({
    backfillCommunityTournaments: async ({ status }) => ({
      status,
      tournaments: 1,
      instances: 1,
      participants: 2,
      fixtures: 3,
    }),
  }, async (sql, params = []) => {
    if (/SELECT id, email, role_id FROM users WHERE id = \?/.test(sql)) {
      return [{ id: 'admin-1', email: 'admin@example.test', role_id: 0 }];
    }
    if (/INSERT INTO admin_audit_log/.test(sql)) {
      auditWrites.push(params);
      return { affectedRows: 1 };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
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
  assert.equal(auditWrites.length, 1);
  assert.equal(auditWrites[0][3], 'competition_engine_backfill');
  assert.equal(auditWrites[0][4], 'competition_engine');
  assert.equal(auditWrites[0][5], 'community_tournament');
});

test('POST /instances/backfill rejects non-admin users', async () => {
  let called = false;
  const router = loadRouter({
    backfillCommunityTournaments: async () => {
      called = true;
      return {};
    },
  }, async () => [{ id: 'user-1', email: 'player@example.test', role_id: 1 }]);
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
  assert.equal(response.statusCode, 403);
  assert.equal(response.body.code, 'admin_required');
  assert.equal(called, false);
});

test('POST /instances/backfill allows conservative admin role 2', async () => {
  const router = loadRouter({
    backfillCommunityTournaments: async () => ({ tournaments: 1 }),
  }, async (sql) => {
    if (/SELECT id, email, role_id FROM users WHERE id = \?/.test(sql)) {
      return [{ id: 'user-2', email: 'organizer@example.test', role_id: 2 }];
    }
    if (/INSERT INTO admin_audit_log/.test(sql)) return { affectedRows: 1 };
    throw new Error(`Unexpected SQL: ${sql}`);
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
    body: { product_type: 'community_tournament' },
    user: { id: 'user-2' },
  }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.tournaments, 1);
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
  }, async (sql) => {
    if (/SELECT id, email, role_id FROM users WHERE id = \?/.test(sql)) {
      return [{ id: 'admin-1', email: 'admin@example.test', role_id: 0 }];
    }
    if (/INSERT INTO admin_audit_log/.test(sql)) return { affectedRows: 1 };
    throw new Error(`Unexpected SQL: ${sql}`);
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

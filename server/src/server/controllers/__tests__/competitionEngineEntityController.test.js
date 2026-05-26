const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

function loadRouter(executesql) {
  const controllerPath = path.resolve(__dirname, '../competitionEngineEntityController.js');
  const dbPath = path.resolve(__dirname, '../../db/database.js');
  delete require.cache[controllerPath];
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { EXECUTESQL: executesql, pool: {} },
  };
  return require(controllerPath).makeRouter({
    table: 'competition_phase_states',
    columns: ['competition_instance_id', 'phase', 'round', 'status', 'ready_to_advance', 'updated_date'],
  });
}

function handler(router, path, method) {
  const layer = router.stack.find((entry) => entry.route?.path === path && entry.route.methods[method]);
  return layer.route.stack[0].handle;
}

test('engine entity GET filters only allow known columns', async () => {
  const calls = [];
  const router = loadRouter(async (sql, params = []) => {
    calls.push({ sql, params });
    if (/SELECT \*/.test(sql)) return [{ id: 'phase-1', phase: 'league' }];
    return [];
  });
  const response = {
    body: null,
    json(body) { this.body = body; },
    status(code) { this.statusCode = code; return this; },
  };

  await handler(router, '/', 'get')({
    query: { phase: 'league', unsafe_column: 'ignored', limit: '10' },
  }, response);

  assert.equal(response.body[0].id, 'phase-1');
  assert.match(calls[0].sql, /`phase` = \?/);
  assert.doesNotMatch(calls[0].sql, /unsafe_column/);
  assert.deepEqual(calls[0].params, ['league', 10]);
});

test('engine entity mutations require admin role', async () => {
  const router = loadRouter(async (sql) => {
    if (/FROM users WHERE id = \?/.test(sql)) return [{ id: 'user-1', email: 'user@example.test', role_id: 1 }];
    return [];
  });
  const response = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; },
  };

  await handler(router, '/', 'post')({
    user: { id: 'user-1' },
    body: { competition_instance_id: 'instance-1', phase: 'league' },
  }, response);

  assert.equal(response.statusCode, 403);
  assert.equal(response.body.code, 'admin_required');
});

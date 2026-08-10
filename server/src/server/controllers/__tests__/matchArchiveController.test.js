const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

/**
 * The match archive is the admin's dispute-settling tool: every match ever played,
 * searchable by whatever they have to hand (an email, a gamertag, a club name).
 * It exposes player emails, so the admin gate is the point of these tests.
 */

function loadArchiveRouterWithMocks(executesql) {
  const controllerPath = path.resolve(__dirname, '../matchArchiveController.js');
  const dbPath = path.resolve(__dirname, '../../db/database.js');
  delete require.cache[controllerPath];
  delete require.cache[dbPath];
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { EXECUTESQL: executesql } };
  return require(controllerPath);
}

function routeHandler(router, method, pathName) {
  const layer = router.stack.find((e) => e.route?.path === pathName && e.route.methods[method]);
  return layer.route.stack[0].handle;
}

function makeResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; },
  };
}

function isUserLookup(sql) {
  return /SELECT id, email, role_id FROM users WHERE id = \? LIMIT 1/.test(sql);
}

/** @param {{ roleId: number, onSelect?: Function, rows?: Array }} opts */
function mockFor({ roleId, onSelect, rows = [] }) {
  return async (sql, params = []) => {
    if (isUserLookup(sql)) return [{ id: 'caller', email: 'caller@example.test', role_id: roleId }];
    if (/SELECT COUNT/.test(sql)) return [{ total: rows.length }];
    if (/FROM matches/.test(sql)) { onSelect?.({ sql, params }); return rows; }
    return [];
  };
}

test('an ordinary account cannot read the archive — it exposes player emails', async () => {
  const router = loadArchiveRouterWithMocks(mockFor({
    roleId: 1,
    onSelect: () => { throw new Error('a non-admin must never reach the match query'); },
  }));
  const response = makeResponse();

  await routeHandler(router, 'get', '/')({ query: {}, user: { id: 'caller' } }, response);

  assert.equal(response.statusCode, 403);
});

test('an unauthenticated caller is refused', async () => {
  const router = loadArchiveRouterWithMocks(mockFor({ roleId: 1 }));
  const response = makeResponse();

  await routeHandler(router, 'get', '/')({ query: {}, user: {} }, response);

  assert.equal(response.statusCode, 401);
});

test('an admin gets matches newest first, with no lower bound on how far back', async () => {
  let seen = null;
  const router = loadArchiveRouterWithMocks(mockFor({
    roleId: 0,
    onSelect: (q) => { seen = q; },
    rows: [{ id: 'match-1', home_score: 2, away_score: 1 }],
  }));
  const response = makeResponse();

  await routeHandler(router, 'get', '/')({ query: {}, user: { id: 'caller' } }, response);

  assert.equal(response.statusCode, 200);
  assert.match(seen.sql, /ORDER BY/);
  assert.match(seen.sql, /DESC/);
  assert.doesNotMatch(seen.sql, /INTERVAL/, 'the archive must not silently cut off old matches');
  assert.equal(response.body.matches.length, 1);
});

test('search matches on email, gamertag and club name at once', async () => {
  let seen = null;
  const router = loadArchiveRouterWithMocks(mockFor({ roleId: 2, onSelect: (q) => { seen = q; } }));
  const response = makeResponse();

  await routeHandler(router, 'get', '/')(
    { query: { search: 'krikke' }, user: { id: 'caller' } },
    response
  );

  assert.equal(response.statusCode, 200);
  // An admin chasing a complaint has one string and does not know which field it is.
  for (const column of ['home_player_email', 'away_player_email', 'home_player_name', 'away_player_name', 'home_club_name', 'away_club_name']) {
    assert.match(seen.sql, new RegExp(column), `search must cover ${column}`);
  }
  assert.ok(seen.params.includes('%krikke%'), 'the term is passed as a bound parameter, not interpolated');
});

test('a match id can be searched directly', async () => {
  let seen = null;
  const router = loadArchiveRouterWithMocks(mockFor({ roleId: 0, onSelect: (q) => { seen = q; } }));
  const response = makeResponse();

  await routeHandler(router, 'get', '/')(
    { query: { search: 'abc-123' }, user: { id: 'caller' } },
    response
  );

  assert.match(seen.sql, /m\.id/, 'searching the match id is how an admin follows up a report');
});

test('type, status and date range narrow the result', async () => {
  let seen = null;
  const router = loadArchiveRouterWithMocks(mockFor({ roleId: 0, onSelect: (q) => { seen = q; } }));
  const response = makeResponse();

  await routeHandler(router, 'get', '/')(
    {
      query: { type: 'league', status: 'completed', from: '2026-01-01', to: '2026-02-01' },
      user: { id: 'caller' },
    },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.ok(seen.params.includes('league'));
  assert.ok(seen.params.includes('completed'));
  assert.ok(seen.params.some((p) => String(p).startsWith('2026-01-01')));
  assert.ok(seen.params.some((p) => String(p).startsWith('2026-02-01')));
});

test('player-vs-player and club-vs-club can be told apart', async () => {
  let seen = null;
  const router = loadArchiveRouterWithMocks(mockFor({ roleId: 0, onSelect: (q) => { seen = q; } }));
  const response = makeResponse();

  await routeHandler(router, 'get', '/')(
    { query: { participants: 'player' }, user: { id: 'caller' } },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.match(seen.sql, /home_player_id/, 'a pvp filter keys off the player columns');
});

test('the page size is capped so one request cannot pull the whole history', async () => {
  let seen = null;
  const router = loadArchiveRouterWithMocks(mockFor({ roleId: 0, onSelect: (q) => { seen = q; } }));
  const response = makeResponse();

  await routeHandler(router, 'get', '/')(
    { query: { limit: '100000' }, user: { id: 'caller' } },
    response
  );

  const limitParam = seen.params[seen.params.length - 2];
  assert.ok(Number(limitParam) <= 200, `page size must be capped, got ${limitParam}`);
});

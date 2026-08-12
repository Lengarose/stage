const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

/**
 * Correcting a score is the one destructive thing an admin does in the archive.
 * Two guarantees carry these tests: every correction leaves an audit trail that
 * answers "why did this change" months later, and a correction never moves money.
 * A wrong score fixed by hand must not be able to empty someone's wallet as a
 * side effect.
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

const MATCH = {
  id: 'match-1',
  status: 'completed',
  home_score: 2,
  away_score: 1,
  wager_stc: 500,
  wager_status: 'settled',
};

function mockFor({ roleId = 0, match = MATCH, onWrite } = {}) {
  return async (sql, params = []) => {
    if (/FROM users WHERE id = \? LIMIT 1/.test(sql)) {
      return [{ id: 'admin-1', email: 'admin@example.test', role_id: roleId }];
    }
    if (/WHERE m\.id = \?/.test(sql)) return match ? [match] : [];
    if (/UPDATE matches/.test(sql)) { onWrite?.({ kind: 'update', sql, params }); return { affectedRows: 1 }; }
    if (/INSERT INTO admin_audit_log/.test(sql)) { onWrite?.({ kind: 'audit', sql, params }); return { affectedRows: 1 }; }
    return [];
  };
}

test('an admin corrects the score and the change is written to the audit log', async () => {
  const writes = [];
  const router = loadArchiveRouterWithMocks(mockFor({ onWrite: (w) => writes.push(w) }));
  const response = makeResponse();

  await routeHandler(router, 'post', '/:id/correct-score')(
    {
      params: { id: 'match-1' },
      body: { home_score: 3, away_score: 0, reason: 'Proof shows 3-0, away side mis-submitted' },
      user: { id: 'admin-1' },
    },
    response
  );

  assert.equal(response.statusCode, 200);

  const update = writes.find((w) => w.kind === 'update');
  assert.ok(update, 'the score must be written');
  assert.equal(update.params[0], 3);
  assert.equal(update.params[1], 0);

  const audit = writes.find((w) => w.kind === 'audit');
  assert.ok(audit, 'a correction without a trail is unauditable');
  const jsonParams = audit.params.filter((p) => typeof p === 'string' && p.startsWith('{'));
  const [oldValue, newValue] = jsonParams.map((p) => JSON.parse(p));
  assert.deepEqual(oldValue, { home_score: 2, away_score: 1 }, 'the old score is recorded');
  assert.deepEqual(newValue, { home_score: 3, away_score: 0 }, 'the new score is recorded');
  assert.ok(audit.params.includes('admin@example.test'), 'who did it is recorded');
  assert.ok(audit.params.some((p) => String(p).includes('mis-submitted')), 'the reason is kept');
});

test('correcting a score never touches the wager', async () => {
  const writes = [];
  const router = loadArchiveRouterWithMocks(mockFor({ onWrite: (w) => writes.push(w) }));
  const response = makeResponse();

  await routeHandler(router, 'post', '/:id/correct-score')(
    { params: { id: 'match-1' }, body: { home_score: 0, away_score: 5, reason: 'r' }, user: { id: 'admin-1' } },
    response
  );

  assert.equal(response.statusCode, 200);
  const update = writes.find((w) => w.kind === 'update');
  // Money only moves on an explicit, separate action — a mistyped correction must
  // not be able to settle, reverse or re-settle a wager.
  assert.doesNotMatch(update.sql, /wager_stc/, 'the wager amount must not be rewritten');
  assert.doesNotMatch(update.sql, /wager_status/, 'the wager settlement must not be rewritten');
});

test('a reason is required — an untraceable correction is worse than none', async () => {
  const router = loadArchiveRouterWithMocks(mockFor({
    onWrite: () => { throw new Error('must not write without a reason'); },
  }));

  for (const reason of ['', '   ', undefined]) {
    const response = makeResponse();
    await routeHandler(router, 'post', '/:id/correct-score')(
      { params: { id: 'match-1' }, body: { home_score: 1, away_score: 1, reason }, user: { id: 'admin-1' } },
      response
    );
    assert.equal(response.statusCode, 400, `reason ${JSON.stringify(reason)} must be refused`);
  }
});

test('impossible scores are refused with a clear message', async () => {
  const router = loadArchiveRouterWithMocks(mockFor({
    onWrite: () => { throw new Error('must not write an invalid score'); },
  }));

  const cases = [
    { home_score: -1, away_score: 0 },
    { home_score: 1, away_score: -2 },
    { home_score: 'two', away_score: 0 },
    { home_score: 1.5, away_score: 0 },
    { home_score: null, away_score: 0 },
  ];

  for (const body of cases) {
    const response = makeResponse();
    await routeHandler(router, 'post', '/:id/correct-score')(
      { params: { id: 'match-1' }, body: { ...body, reason: 'r' }, user: { id: 'admin-1' } },
      response
    );
    assert.equal(response.statusCode, 400, `${JSON.stringify(body)} must be refused`);
    assert.match(String(response.body.error), /score/i);
  }
});

test('a non-admin cannot correct a score', async () => {
  const router = loadArchiveRouterWithMocks(mockFor({
    roleId: 1,
    onWrite: () => { throw new Error('a non-admin must never write a score') },
  }));
  const response = makeResponse();

  await routeHandler(router, 'post', '/:id/correct-score')(
    { params: { id: 'match-1' }, body: { home_score: 9, away_score: 0, reason: 'r' }, user: { id: 'admin-1' } },
    response
  );

  assert.equal(response.statusCode, 403);
});

test('correcting a match that does not exist gives 404, not a silent no-op', async () => {
  const router = loadArchiveRouterWithMocks(mockFor({ match: null }));
  const response = makeResponse();

  await routeHandler(router, 'post', '/:id/correct-score')(
    { params: { id: 'ghost' }, body: { home_score: 1, away_score: 0, reason: 'r' }, user: { id: 'admin-1' } },
    response
  );

  assert.equal(response.statusCode, 404);
});

test('the correction is stamped so the detail can show the score was changed by hand', async () => {
  const writes = [];
  const router = loadArchiveRouterWithMocks(mockFor({ onWrite: (w) => writes.push(w) }));
  const response = makeResponse();

  await routeHandler(router, 'post', '/:id/correct-score')(
    { params: { id: 'match-1' }, body: { home_score: 4, away_score: 4, reason: 'agreed replay result' }, user: { id: 'admin-1' } },
    response
  );

  const update = writes.find((w) => w.kind === 'update');
  assert.match(update.sql, /score_corrected_at/, 'when it was corrected');
  assert.match(update.sql, /score_corrected_by/, 'and by whom');
});

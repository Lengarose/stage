const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

/**
 * The detail view is what an admin actually reads to settle a dispute. Two things
 * matter more than the rest: the score each side *claimed* must stay separable from
 * the official score, and every proof must be reachable — proofs are scattered
 * across four places in the schema, and a missed one is evidence lost.
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
  type: 'league',
  status: 'disputed',
  home_club_name: 'Club A',
  away_club_name: 'Club B',
  home_player_email: 'home@example.test',
  away_player_email: 'away@example.test',
  home_score: 2,
  away_score: 1,
  home_submitted_score: '2-1',
  away_submitted_score: '1-2',
  scheduled_date: '2026-02-01 20:00:00',
  first_submission_at: '2026-02-01 21:47:00',
  wager_stc: 500,
  wager_status: 'settled',
  stats_processed: 1,
  proof_url: 'https://cdn.test/legacy-proof.png',
  forfeit_proof_url: 'https://cdn.test/forfeit.png',
  home_submission: JSON.stringify({
    home_score: 2, away_score: 1,
    proof_url: 'https://cdn.test/home-shot.png',
    submitted_at: '2026-02-01T21:47:00Z',
  }),
  away_submission: JSON.stringify({
    home_score: 1, away_score: 2,
    proof_url: 'https://cdn.test/away-shot.png',
    submitted_at: '2026-02-01T21:52:00Z',
  }),
};

function mockFor({ roleId = 0, match = MATCH } = {}) {
  return async (sql, params = []) => {
    if (/FROM users WHERE id = \? LIMIT 1/.test(sql)) {
      return [{ id: 'caller', email: 'a@b.c', role_id: roleId }];
    }
    if (/FROM matches m\s+WHERE m\.id = \?/.test(sql) || /WHERE m\.id = \?/.test(sql)) {
      return match ? [match] : [];
    }
    return [];
  };
}

test('a non-admin cannot open a match detail', async () => {
  const router = loadArchiveRouterWithMocks(mockFor({ roleId: 1 }));
  const response = makeResponse();
  await routeHandler(router, 'get', '/:id')({ params: { id: 'match-1' }, user: { id: 'caller' } }, response);
  assert.equal(response.statusCode, 403);
});

test('an unknown match id gives a clean 404, not an empty shell', async () => {
  const router = loadArchiveRouterWithMocks(mockFor({ match: null }));
  const response = makeResponse();
  await routeHandler(router, 'get', '/:id')({ params: { id: 'nope' }, user: { id: 'caller' } }, response);
  assert.equal(response.statusCode, 404);
});

test('what each side claimed stays separable from the official score', async () => {
  const router = loadArchiveRouterWithMocks(mockFor());
  const response = makeResponse();
  await routeHandler(router, 'get', '/:id')({ params: { id: 'match-1' }, user: { id: 'caller' } }, response);

  assert.equal(response.statusCode, 200);
  const { match } = response.body;
  // The disagreement is the whole point of the screen: 2-1 against 1-2.
  assert.equal(match.home_submission.home_score, 2);
  assert.equal(match.home_submission.away_score, 1);
  assert.equal(match.away_submission.home_score, 1);
  assert.equal(match.away_submission.away_score, 2);
  assert.equal(match.home_score, 2, 'the official score is reported separately');
  assert.equal(match.away_score, 1);
});

test('every proof is collected, from all four places they can hide', async () => {
  const router = loadArchiveRouterWithMocks(mockFor());
  const response = makeResponse();
  await routeHandler(router, 'get', '/:id')({ params: { id: 'match-1' }, user: { id: 'caller' } }, response);

  const urls = response.body.proofs.map((p) => p.url);
  assert.ok(urls.includes('https://cdn.test/home-shot.png'), 'home submission proof');
  assert.ok(urls.includes('https://cdn.test/away-shot.png'), 'away submission proof');
  assert.ok(urls.includes('https://cdn.test/legacy-proof.png'), 'top-level proof_url');
  assert.ok(urls.includes('https://cdn.test/forfeit.png'), 'forfeit proof');
  assert.equal(new Set(urls).size, urls.length, 'no duplicates');
});

test('each proof says which side it came from, so an admin knows whose evidence it is', async () => {
  const router = loadArchiveRouterWithMocks(mockFor());
  const response = makeResponse();
  await routeHandler(router, 'get', '/:id')({ params: { id: 'match-1' }, user: { id: 'caller' } }, response);

  const bySide = Object.fromEntries(response.body.proofs.map((p) => [p.url, p.side]));
  assert.equal(bySide['https://cdn.test/home-shot.png'], 'home');
  assert.equal(bySide['https://cdn.test/away-shot.png'], 'away');
});

test('a match with no proof reports an empty list rather than nulls', async () => {
  const bare = { id: 'match-2', status: 'completed', home_score: 0, away_score: 0 };
  const router = loadArchiveRouterWithMocks(mockFor({ match: bare }));
  const response = makeResponse();
  await routeHandler(router, 'get', '/:id')({ params: { id: 'match-2' }, user: { id: 'caller' } }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.proofs, []);
});

test('an unparseable submission degrades to null instead of breaking the whole detail', async () => {
  const broken = { ...MATCH, home_submission: 'not json at all' };
  const router = loadArchiveRouterWithMocks(mockFor({ match: broken }));
  const response = makeResponse();
  await routeHandler(router, 'get', '/:id')({ params: { id: 'match-1' }, user: { id: 'caller' } }, response);

  assert.equal(response.statusCode, 200, 'one corrupt field must not hide the entire match');
  assert.equal(response.body.match.home_submission, null);
  assert.equal(response.body.match.away_submission.home_score, 1, 'the other side still reads');
});

test('wager settlement and ranking impact are reported explicitly', async () => {
  const router = loadArchiveRouterWithMocks(mockFor());
  const response = makeResponse();
  await routeHandler(router, 'get', '/:id')({ params: { id: 'match-1' }, user: { id: 'caller' } }, response);

  assert.equal(response.body.match.wager_stc, 500);
  assert.equal(response.body.match.wager_status, 'settled');
  assert.equal(response.body.match.stats_processed, 1);
});

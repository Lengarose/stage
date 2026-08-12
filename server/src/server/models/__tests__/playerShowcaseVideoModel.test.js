const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

function loadModelWithMocks(executesql) {
  const modelPath = path.resolve(__dirname, '../playerShowcaseVideoModel.js');
  const dbPath = path.resolve(__dirname, '../../db/database.js');
  delete require.cache[modelPath];
  delete require.cache[dbPath];
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { EXECUTESQL: executesql } };
  return require(modelPath);
}

test('url title and description are trimmed, and blank optional text becomes null', async () => {
  let params = null;
  const Model = loadModelWithMocks(async (sql, p = []) => {
    if (/INSERT INTO player_showcase_videos/.test(sql)) { params = p; return { affectedRows: 1 }; }
    throw new Error(`Unexpected SQL: ${sql}`);
  });

  await new Model({
    player_id: 'player-1',
    url: '  /uploads/hat-trick.mp4  ',
    title: '   Hat-trick   ',
    description: '   Hat-trick vs rivals   ',
    duration_seconds: '9.876',
  }).create();
  assert.equal(params[2], '/uploads/hat-trick.mp4');
  assert.equal(params[3], 'Hat-trick');
  assert.equal(params[4], 'Hat-trick vs rivals');
  assert.equal(params[5], 9.88);

  await new Model({ player_id: 'player-1', url: '/uploads/clip.mp4', title: '    ', description: '    ' }).create();
  assert.equal(params[3], null, 'a whitespace-only title is stored as null, not as spaces');
  assert.equal(params[4], null, 'a whitespace-only description is stored as null, not as spaces');
});

test('sort_order falls back to 0 rather than storing NaN', async () => {
  let params = null;
  const Model = loadModelWithMocks(async (sql, p = []) => {
    if (/INSERT INTO player_showcase_videos/.test(sql)) { params = p; return { affectedRows: 1 }; }
    throw new Error(`Unexpected SQL: ${sql}`);
  });

  await new Model({ player_id: 'player-1', url: '/uploads/clip.mp4', sort_order: 'not a number' }).create();
  assert.equal(params[6], 0);
});

test('updating a video never rewrites which player it belongs to', async () => {
  let sqlSeen = null;
  const Model = loadModelWithMocks(async (sql, p = []) => {
    if (/UPDATE player_showcase_videos/.test(sql)) { sqlSeen = sql; return { affectedRows: 1 }; }
    throw new Error(`Unexpected SQL: ${sql}`);
  });

  await new Model({ player_id: 'someone-else', url: 'https://x' }).update('video-1');
  assert.doesNotMatch(sqlSeen, /player_id\s*=/, 'ownership is fixed at publication');
});

test('a showcase reads back in the order the player arranged it', async () => {
  let seen = null;
  const Model = loadModelWithMocks(async (sql, p = []) => { seen = { sql, p }; return []; });

  await new Model().selectByPlayer('player-1');
  assert.match(seen.sql, /ORDER BY sort_order ASC/);
  assert.equal(seen.p[0], 'player-1');
});

test('fetching showcases for no players asks the database nothing', async () => {
  let called = false;
  const Model = loadModelWithMocks(async () => { called = true; return []; });

  const rows = await Model.selectByPlayers([]);
  assert.deepEqual(rows, []);
  assert.equal(called, false, 'an empty IN () list would be a SQL error, so skip the query');
});

test('several showcases are fetched in one query, not one per player', async () => {
  let calls = 0;
  let seen = null;
  const Model = loadModelWithMocks(async (sql, p = []) => { calls += 1; seen = { sql, p }; return []; });

  await Model.selectByPlayers(['a', 'b', 'c']);

  assert.equal(calls, 1, 'a board of reports must cost one request, not one per card');
  assert.match(seen.sql, /IN \(\?,\?,\?\)/);
  assert.match(seen.sql, /ORDER BY player_id ASC, sort_order ASC/);
  assert.deepEqual(seen.p, ['a', 'b', 'c']);
});

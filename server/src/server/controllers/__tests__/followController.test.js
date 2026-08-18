const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../../../../..');

function readRepoFile(...parts) {
  return fs.readFileSync(path.join(root, ...parts), 'utf8');
}

function loadFollowRouter(executesql) {
  const controllerPath = path.resolve(__dirname, '../followController.js');
  const modelPath = path.resolve(__dirname, '../../models/followModel.js');
  const dbPath = path.resolve(__dirname, '../../db/database.js');

  delete require.cache[controllerPath];
  delete require.cache[modelPath];
  delete require.cache[dbPath];

  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { EXECUTESQL: executesql },
  };

  return require(controllerPath);
}

function routeHandler(router, method, pathName) {
  const layer = router.stack.find((entry) => entry.route?.path === pathName && entry.route.methods[method]);
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

function makeStore({ playerId = 'player-me' } = {}) {
  const store = {
    follows: [],
    players: playerId ? [{ id: playerId, user_id: 'user-1', email: 'me@test.com' }] : [],
  };

  const executesql = async (sql, params = []) => {
    if (/SELECT id FROM players/.test(sql)) {
      const userId = params[0];
      const email = String(params[1] || '').toLowerCase();
      return store.players
        .filter((p) => p.user_id === userId || String(p.email || '').toLowerCase() === email)
        .map((p) => ({ id: p.id }));
    }
    if (/SELECT \* FROM follows WHERE follower_id = \? AND target_id = \? AND target_type = \?/.test(sql)) {
      return store.follows.filter((row) => (
        row.follower_id === params[0]
        && row.target_id === params[1]
        && row.target_type === params[2]
      ));
    }
    if (/SELECT \* FROM follows WHERE id = \?/.test(sql)) {
      return store.follows.filter((row) => row.id === params[0]);
    }
    if (/SELECT \* FROM follows WHERE 1=1/.test(sql)) {
      let rows = [...store.follows];
      let i = 0;
      if (sql.includes('AND follower_id = ?')) {
        const value = params[i++];
        rows = rows.filter((row) => row.follower_id === value);
      }
      if (sql.includes('AND LOWER(TRIM(follower_email))')) {
        const value = String(params[i++]).toLowerCase();
        rows = rows.filter((row) => String(row.follower_email || '').toLowerCase() === value);
      }
      if (sql.includes('AND follower_player_id = ?')) {
        const value = params[i++];
        rows = rows.filter((row) => row.follower_player_id === value);
      }
      if (sql.includes('AND target_id = ?')) {
        const value = params[i++];
        rows = rows.filter((row) => row.target_id === value);
      }
      if (sql.includes('AND target_type = ?')) {
        const value = params[i++];
        rows = rows.filter((row) => row.target_type === value);
      }
      return rows;
    }
    if (/INSERT INTO follows/.test(sql)) {
      store.follows.push({
        id: params[0],
        follower_id: params[1],
        follower_email: params[2],
        follower_player_id: params[3],
        target_id: params[4],
        target_type: params[5],
        target_name: params[6],
      });
      return { affectedRows: 1 };
    }
    if (/DELETE FROM follows WHERE id = \?/.test(sql)) {
      store.follows = store.follows.filter((row) => row.id !== params[0]);
      return { affectedRows: 1 };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  return { store, executesql };
}

test('follows table, route, and Stage client entity exist', () => {
  const routes = readRepoFile('server/src/server/routes/registerStageRoutes.js');
  const migrations = readRepoFile('server/src/server/migrations/startupMigrations.js');
  const schema = readRepoFile('server/schema.sql');
  const webClient = readRepoFile('src/api/stageClient.js');
  const deletion = readRepoFile('server/src/server/services/accountDeletion.js');

  assert.match(routes, /app\.use\('\/api\/stage\/follows', verifyToken/);
  assert.match(migrations, /CREATE TABLE IF NOT EXISTS follows \(/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS follows \(/);
  assert.match(webClient, /'Follow'/);
  assert.match(deletion, /DELETE FROM follows WHERE LOWER\(TRIM\(follower_email\)\) IN /);
  assert.match(deletion, /DELETE FROM follows WHERE follower_id = \?/);
});

test('POST /follows creates a player follow and GET filters it', async () => {
  const { executesql, store } = makeStore();
  const router = loadFollowRouter(executesql);
  const created = makeResponse();

  await routeHandler(router, 'post', '/')(
    {
      user: { id: 'user-1', email: 'me@test.com' },
      body: { target_id: 'player-2', target_type: 'player', target_name: 'Neo' },
    },
    created,
  );

  assert.equal(created.statusCode, 201);
  assert.equal(created.body.target_id, 'player-2');
  assert.equal(created.body.target_type, 'player');
  assert.equal(created.body.follower_id, 'user-1');
  assert.equal(created.body.follower_player_id, 'player-me');
  assert.equal(store.follows.length, 1);

  const listed = makeResponse();
  await routeHandler(router, 'get', '/')(
    { query: { follower_id: 'user-1', target_id: 'player-2', target_type: 'player' } },
    listed,
  );
  assert.equal(listed.statusCode, 200);
  assert.equal(listed.body.length, 1);
  assert.equal(listed.body[0].id, created.body.id);

  const again = makeResponse();
  await routeHandler(router, 'post', '/')(
    {
      user: { id: 'user-1', email: 'me@test.com' },
      body: { target_id: 'player-2', target_type: 'player' },
    },
    again,
  );
  assert.equal(again.statusCode, 200);
  assert.equal(again.body.id, created.body.id);
  assert.equal(store.follows.length, 1);
});

test('POST /follows rejects following yourself', async () => {
  const { executesql } = makeStore();
  const router = loadFollowRouter(executesql);
  const response = makeResponse();

  await routeHandler(router, 'post', '/')(
    {
      user: { id: 'user-1', email: 'me@test.com' },
      body: { target_id: 'player-me', target_type: 'player' },
    },
    response,
  );

  assert.equal(response.statusCode, 400);
  assert.match(response.body.error, /yourself/i);
});

test('DELETE /follows/:id unfollows only the owner', async () => {
  const { executesql, store } = makeStore();
  const router = loadFollowRouter(executesql);
  store.follows.push({
    id: 'follow-1',
    follower_id: 'user-1',
    follower_email: 'me@test.com',
    follower_player_id: 'player-me',
    target_id: 'club-1',
    target_type: 'club',
    target_name: 'Ajax',
  });

  const forbidden = makeResponse();
  await routeHandler(router, 'delete', '/:id')(
    { params: { id: 'follow-1' }, user: { id: 'intruder', email: 'other@test.com' } },
    forbidden,
  );
  assert.equal(forbidden.statusCode, 403);
  assert.equal(store.follows.length, 1);

  const ok = makeResponse();
  await routeHandler(router, 'delete', '/:id')(
    { params: { id: 'follow-1' }, user: { id: 'user-1', email: 'me@test.com' } },
    ok,
  );
  assert.equal(ok.statusCode, 200);
  assert.equal(store.follows.length, 0);
});

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

function loadMatchRouterWithDbMock(executesql) {
  const controllerPath = path.resolve(__dirname, '../matchController.js');
  const modelPath = path.resolve(__dirname, '../../models/matchModel.js');
  const dbPath = path.resolve(__dirname, '../../db/database.js');
  const socketPath = path.resolve(__dirname, '../../utils/socketBroadcast.js');

  delete require.cache[controllerPath];
  delete require.cache[modelPath];
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { EXECUTESQL: executesql, pool: {} },
  };
  require.cache[socketPath] = {
    id: socketPath,
    filename: socketPath,
    loaded: true,
    exports: { broadcastMatch() {}, broadcastMatchDeleted() {} },
  };

  return require(controllerPath);
}

function getMatchesHandler(router) {
  const layer = router.stack.find((entry) => entry.route?.path === '/');
  return layer.route.stack[0].handle;
}

function getRouteHandler(router, path, method = 'get') {
  const layer = router.stack.find((entry) => entry.route?.path === path);
  return layer.route.stack.find((entry) => entry.method === method).handle;
}

test('GET / includes away matches for a club the user owns even when their player belongs to another club', async () => {
  const ownedClubId = 'club-owned';
  const playerClubId = 'club-player';
  const match = {
    id: 'match-1',
    home_club_id: 'club-home',
    away_club_id: ownedClubId,
    status: 'scheduled',
    scheduled_date: '2026-05-25 18:00:00',
  };

  const executesql = async (sql, params = []) => {
    if (/FROM users WHERE id = \?/.test(sql)) {
      return [{ id: params[0], email: 'manager@example.test', role_id: 1 }];
    }
    if (/FROM players/.test(sql)) {
      return [{ id: 'player-1', club_id: playerClubId }];
    }
    if (/FROM clubs\s+WHERE user_id/.test(sql)) {
      return [{ id: ownedClubId }];
    }
    if (/SELECT \* FROM matches WHERE/.test(sql)) {
      const ownScopeValues = params.slice(0, -1);
      return ownScopeValues.includes(ownedClubId) ? [match] : [];
    }
    if (/SELECT id, name, owner_email FROM clubs WHERE id IN/.test(sql)) {
      return [
        { id: 'club-home', name: 'Home Club', owner_email: 'home@example.test' },
        { id: ownedClubId, name: 'Owned Away Club', owner_email: 'owned@example.test' },
      ];
    }
    if (/SELECT id, gamertag, email FROM players WHERE id IN/.test(sql)) return [];
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const router = loadMatchRouterWithDbMock(executesql);
  const handle = getMatchesHandler(router);
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
    { query: { away_club_id: ownedClubId }, user: { id: 'user-1' } },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.length, 1);
  assert.equal(response.body[0].id, match.id);
});

test('GET /profile exposes read-only profile matches without participant scope', async () => {
  const publicMatch = {
    id: 'profile-match-1',
    home_player_id: 'profile-player',
    away_player_id: 'other-player',
    status: 'completed',
    scheduled_date: '2026-05-25 18:00:00',
    proof_url: 'https://example.test/private-proof.png',
    admin_notes: 'Internal note',
  };

  const executesql = async (sql, params = []) => {
    if (/SELECT \* FROM matches\s+WHERE/.test(sql)) {
      return params.includes('profile-player') ? [publicMatch] : [];
    }
    if (/SELECT id, name, owner_email FROM clubs WHERE id IN/.test(sql)) return [];
    if (/SELECT id, gamertag, email FROM players WHERE id IN/.test(sql)) {
      return [
        { id: 'profile-player', gamertag: 'Profile Player', email: 'profile@example.test' },
        { id: 'other-player', gamertag: 'Other Player', email: 'other@example.test' },
      ];
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const router = loadMatchRouterWithDbMock(executesql);
  const handle = getRouteHandler(router, '/profile');
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
    { query: { player_id: 'profile-player', status: 'completed', limit: 30 } },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.length, 1);
  assert.equal(response.body[0].id, publicMatch.id);
  assert.equal(response.body[0].home_player_name, 'Profile Player');
  assert.equal(response.body[0].proof_url, undefined);
  assert.equal(response.body[0].admin_notes, undefined);
});

test('GET /:id still forbids non-profile match reads outside participant scope', async () => {
  const privateMatch = {
    id: 'profile-match-1',
    home_player_id: 'profile-player',
    away_player_id: 'other-player',
    status: 'completed',
  };

  const executesql = async (sql, params = []) => {
    if (/FROM users WHERE id = \?/.test(sql)) {
      return [{ id: params[0], email: 'viewer@example.test', role_id: 1 }];
    }
    if (/FROM players/.test(sql)) {
      return [{ id: 'viewer-player', club_id: null }];
    }
    if (/FROM clubs\s+WHERE user_id/.test(sql)) {
      return [];
    }
    if (/FROM matches WHERE id = \?/.test(sql)) {
      return [privateMatch];
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const router = loadMatchRouterWithDbMock(executesql);
  const handle = getRouteHandler(router, '/:id');
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
    { params: { id: privateMatch.id }, user: { id: 'viewer-user' } },
    response,
  );

  assert.equal(response.statusCode, 403);
});

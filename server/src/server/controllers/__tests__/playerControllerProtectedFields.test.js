const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');

/**
 * PATCH /players/:id writes the player's wallet (credits, stc), subscription and
 * verification flag. Those decide what a paying account gets, so they must not be
 * settable by whoever happens to send the request — otherwise an account can grant
 * itself currency and STAGE Plus without ever touching Stripe.
 */

function loadPlayerRouterWithMocks(executesql) {
  const controllerPath = path.resolve(__dirname, '../playerController.js');
  const modelPath = path.resolve(__dirname, '../../models/playerModel.js');
  const dbPath = path.resolve(__dirname, '../../db/database.js');
  const socketPath = path.resolve(__dirname, '../../utils/socketBroadcast.js');

  delete require.cache[controllerPath];
  delete require.cache[modelPath];
  delete require.cache[dbPath];
  delete require.cache[socketPath];

  class PlayerMock {
    constructor(body = {}) {
      this.body = body;
      this.id = body.id || 'player-1';
    }
    selectAll(query) { return executesql('TEST_SELECT_ALL_PLAYERS', [query]); }
    searchByGamertag(search, limit, offset) { return executesql('TEST_SEARCH_PLAYERS', [search, limit, offset]); }
    update(id) { return executesql('TEST_UPDATE_PLAYER', [id, this.body]); }
    selectOne(id) { return executesql('TEST_SELECT_PLAYER', [id]); }
  }

  require.cache[modelPath] = { id: modelPath, filename: modelPath, loaded: true, exports: PlayerMock };
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { EXECUTESQL: executesql } };
  require.cache[socketPath] = {
    id: socketPath,
    filename: socketPath,
    loaded: true,
    exports: { broadcastPlayer() {}, broadcastPlayerDeleted() {} },
  };

  const originalLoad = Module._load;
  Module._load = function mockExpress(request, parent, isMain) {
    if (request === 'express') {
      return {
        Router() {
          const router = { stack: [] };
          for (const method of ['get', 'post', 'patch', 'delete']) {
            router[method] = (routePath, handle) => {
              router.stack.push({
                route: {
                  path: routePath,
                  methods: { [method]: true },
                  stack: [{ handle }],
                },
              });
            };
          }
          return router;
        },
      };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    return require(controllerPath);
  } finally {
    Module._load = originalLoad;
  }
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

const EXISTING_PLAYER = {
  id: 'player-1',
  user_id: 'owner-user',
  email: 'owner@example.test',
  gamertag: 'Owner',
  club_id: 'club-1',
  credits: 50,
  stc: 1000,
  subscription: 'free',
  is_verified: 0,
  goals: 4,
  assists: 1,
};

/** @param {{ roleId?: number, callerId?: string, sameClub?: boolean }} opts */
function mockFor({ roleId = 1, callerId = 'caller-user', sameClub = false, onUpdate } = {}) {
  return async (sql, params = []) => {
    if (/information_schema/.test(sql)) return [{ ok: 1 }];
    if (/SELECT id, email, role_id FROM users WHERE id = \? LIMIT 1/.test(sql)) {
      const id = params[0];
      if (id === 'owner-user') {
        return [{ id: 'owner-user', email: 'owner@example.test', role_id: roleId }];
      }
      return [{ id: callerId, email: 'caller@example.test', role_id: roleId }];
    }
    if (sql === 'TEST_SELECT_PLAYER') return [{ ...EXISTING_PLAYER }];
    if (/SELECT id FROM players WHERE LOWER\(gamertag\)/.test(sql)) return [];
    if (/SELECT id FROM players\s+WHERE club_id = \?/.test(sql)) {
      return sameClub ? [{ id: 'teammate-player' }] : [];
    }
    if (sql === 'TEST_UPDATE_PLAYER') { onUpdate?.(params[1]); return { affectedRows: 1 }; }
    if (/UPDATE users SET player_id/.test(sql)) return { affectedRows: 1 };
    return [];
  };
}

test('a non-admin cannot top up a wallet or grant a subscription through a player edit', async () => {
  let written = null;
  const router = loadPlayerRouterWithMocks(mockFor({ roleId: 1, onUpdate: (b) => { written = b; } }));
  const response = makeResponse();

  await routeHandler(router, 'patch', '/:id')(
    {
      params: { id: 'player-1' },
      body: {
        gamertag: 'Owner',
        credits: 999999,
        stc: 999999999,
        subscription: 'stage_plus',
        subscription_expires_at: '2099-01-01T00:00:00Z',
        is_verified: 1,
      },
      user: { id: 'owner-user', email: 'owner@example.test' },
    },
    response
  );

  assert.equal(response.statusCode, 200, 'the edit itself still succeeds');
  assert.equal(written.credits, 50, 'credits keep their stored value');
  assert.equal(written.stc, 1000, 'stc keeps its stored value');
  assert.equal(written.subscription, 'free', 'subscription cannot be self-granted');
  assert.equal(written.subscription_expires_at, undefined);
  assert.equal(written.is_verified, 0, 'verification cannot be self-granted');
});

test('a non-admin cannot reassign a player to another account', async () => {
  let written = null;
  const router = loadPlayerRouterWithMocks(mockFor({ roleId: 1, onUpdate: (b) => { written = b; } }));
  const response = makeResponse();

  await routeHandler(router, 'patch', '/:id')(
    {
      params: { id: 'player-1' },
      body: { user_id: 'attacker-user', email: 'attacker@example.test' },
      user: { id: 'owner-user', email: 'owner@example.test' },
    },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(written.user_id, 'owner-user', 'ownership cannot be taken over');
  assert.equal(written.email, 'owner@example.test');
});

test('a stranger cannot PATCH another player', async () => {
  const router = loadPlayerRouterWithMocks(mockFor({ roleId: 1 }));
  const response = makeResponse();

  await routeHandler(router, 'patch', '/:id')(
    {
      params: { id: 'player-1' },
      body: { goals: 99, assists: 40, overall_rating: 99, position: 'ST' },
      user: { id: 'caller-user', email: 'caller@example.test' },
    },
    response
  );

  assert.equal(response.statusCode, 403);
});

test('the owner cannot rewrite career stats through a player edit', async () => {
  let written = null;
  const router = loadPlayerRouterWithMocks(mockFor({ roleId: 1, onUpdate: (b) => { written = b; } }));
  const response = makeResponse();

  await routeHandler(router, 'patch', '/:id')(
    {
      params: { id: 'player-1' },
      body: { position: 'ST', bio: 'hello', goals: 99, assists: 40, overall_rating: 99 },
      user: { id: 'owner-user', email: 'owner@example.test' },
    },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(written.position, 'ST');
  assert.equal(written.bio, 'hello');
  assert.equal(written.goals, 4, 'career goals stay on the stored value');
  assert.equal(written.assists, 1);
  assert.equal(written.overall_rating, undefined);
});

test('a teammate can still manage club roles and dressing-room seats', async () => {
  let written = null;
  const router = loadPlayerRouterWithMocks(mockFor({
    roleId: 1,
    sameClub: true,
    onUpdate: (b) => { written = b; },
  }));
  const response = makeResponse();

  await routeHandler(router, 'patch', '/:id')(
    {
      params: { id: 'player-1' },
      body: { position: 'ST', bio: 'hello', dressing_room_seat: 3, club_roles: ['captain'], goals: 99 },
      user: { id: 'caller-user', email: 'caller@example.test' },
    },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(written.dressing_room_seat, 3);
  assert.deepEqual(written.club_roles, ['captain']);
  assert.equal(written.position, undefined, 'teammates cannot rewrite profile fields');
  assert.equal(written.goals, 4, 'career stats stay on the stored value');
});

test('GET / respects directory limit instead of hardcoding the first 25 players', async () => {
  let query = null;
  const router = loadPlayerRouterWithMocks(async (sql, params = []) => {
    if (/information_schema/.test(sql)) return [{ ok: 1 }];
    if (sql === 'TEST_SELECT_ALL_PLAYERS') {
      query = params[0];
      return [{ id: 'player-500', gamertag: 'Lengarose', country: 'DR Congo' }];
    }
    return [];
  });
  const response = makeResponse();

  await routeHandler(router, 'get', '/')(
    { query: { limit: '500' }, user: { id: 'caller-user' } },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.deepEqual(query, { page: 1, limit: 500, offset: undefined });
  assert.equal(response.body[0].gamertag, 'Lengarose');
});

test('GET / supports server-side player directory search', async () => {
  let searchArgs = null;
  const router = loadPlayerRouterWithMocks(async (sql, params = []) => {
    if (/information_schema/.test(sql)) return [{ ok: 1 }];
    if (sql === 'TEST_SEARCH_PLAYERS') {
      searchArgs = params;
      return [{ id: 'player-lenga', gamertag: 'Lengarose', country: 'DR Congo' }];
    }
    return [];
  });
  const response = makeResponse();

  await routeHandler(router, 'get', '/')(
    { query: { search: 'Lenga', limit: '500' }, user: { id: 'caller-user' } },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.deepEqual(searchArgs, ['Lenga', 500, 0]);
  assert.equal(response.body[0].gamertag, 'Lengarose');
});

test('an admin can still adjust a wallet — that is what the admin panel is for', async () => {
  let written = null;
  const router = loadPlayerRouterWithMocks(mockFor({ roleId: 0, onUpdate: (b) => { written = b; } }));
  const response = makeResponse();

  await routeHandler(router, 'patch', '/:id')(
    { params: { id: 'player-1' }, body: { credits: 500, subscription: 'stage_plus' }, user: { id: 'caller-user' } },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(written.credits, 500);
  assert.equal(written.subscription, 'stage_plus');
});

function mockPlusPlayer(onWrite) {
  return async (sql, params = []) => {
    if (/information_schema/.test(sql)) return [{ ok: 1 }];
    if (sql === 'TEST_SELECT_PLAYER') {
      return [{
        id: 'player-1',
        user_id: 'owner-user',
        email: 'owner@example.test',
        subscription: 'stage_plus',
        game_day_tile_backgrounds: {},
        career_tile_backgrounds: {},
      }];
    }
    if (/game_day_tile_backgrounds/.test(sql) || /career_tile_backgrounds/.test(sql)) {
      onWrite?.(params);
      return { affectedRows: 1 };
    }
    return [];
  };
}

test('game-day tile background accepts page keys from tileKey, title_key, or query', async () => {
  const written = [];
  const router = loadPlayerRouterWithMocks(mockPlusPlayer((params) => written.push(params)));
  const handler = routeHandler(router, 'patch', '/:id/game-day-tile-background');
  const owner = { id: 'owner-user', email: 'owner@example.test' };

  for (const req of [
    { body: { type: 'custom', image_url: '/uploads/tile.jpg', tile_key: 'home' } },
    { body: { type: 'custom', image_url: '/uploads/tile.jpg', tileKey: 'tournaments' } },
    { body: { type: 'custom', image_url: '/uploads/tile.jpg', title_key: 'profile' } },
    { body: { type: 'custom', image_url: '/uploads/tile.jpg' }, query: { tile_key: 'apps' } },
    { body: { type: 'custom', image_url: '/uploads/tile.jpg', tile_key: 'Match Screens' } },
    { body: { type: 'custom', image_url: '/uploads/tile.jpg', tile_key: 'GOST' } },
    { body: { type: 'custom', image_url: '/uploads/tile.jpg', title_key: 'find_players' } },
    { body: { type: 'custom', image_url: '/uploads/tile.jpg' }, query: { title_key: 'find_clubs' } },
  ]) {
    const response = makeResponse();
    await handler({ params: { id: 'player-1' }, body: {}, query: {}, ...req, user: owner }, response);
    assert.equal(response.statusCode, 200, JSON.stringify(req));
  }

  assert.equal(written.length, 8);
  assert.match(String(written[0][0]), /"home"/);
  assert.match(String(written[4][0]), /"match_screens"/);
  assert.match(String(written[5][0]), /"competitions"/);
  assert.match(String(written[6][0]), /"find_players"/);
  assert.match(String(written[7][0]), /"find_clubs"/);
});

test('game-day tile background still rejects unknown keys', async () => {
  const router = loadPlayerRouterWithMocks(mockPlusPlayer(() => {}));
  const response = makeResponse();
  await routeHandler(router, 'patch', '/:id/game-day-tile-background')(
    {
      params: { id: 'player-1' },
      body: { type: 'default', tile_key: 'not_a_tile' },
      query: {},
      user: { id: 'owner-user', email: 'owner@example.test' },
    },
    response,
  );
  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error, 'Valid tile_key is required');
});

test('career tile background accepts camelCase tileKey', async () => {
  const written = [];
  const router = loadPlayerRouterWithMocks(mockPlusPlayer((params) => written.push(params)));
  const response = makeResponse();
  await routeHandler(router, 'patch', '/:id/career-tile-background')(
    {
      params: { id: 'player-1' },
      body: { type: 'custom', image_url: '/uploads/tile.jpg', tileKey: 'upcoming' },
      query: {},
      user: { id: 'owner-user', email: 'owner@example.test' },
    },
    response,
  );
  assert.equal(response.statusCode, 200);
  assert.match(String(written[0][0]), /"upcoming"/);
});

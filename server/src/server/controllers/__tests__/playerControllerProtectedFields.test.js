const assert = require('node:assert/strict');
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

const EXISTING_PLAYER = {
  id: 'player-1',
  user_id: 'owner-user',
  email: 'owner@example.test',
  gamertag: 'Owner',
  credits: 50,
  stc: 1000,
  subscription: 'free',
  is_verified: 0,
};

/** @param {{ roleId?: number }} opts */
function mockFor({ roleId = 1, onUpdate }) {
  return async (sql, params = []) => {
    if (/information_schema/.test(sql)) return [{ ok: 1 }];
    if (/SELECT id, email, role_id FROM users WHERE id = \? LIMIT 1/.test(sql)) {
      return [{ id: 'caller-user', email: 'caller@example.test', role_id: roleId }];
    }
    if (sql === 'TEST_SELECT_PLAYER') return [{ ...EXISTING_PLAYER }];
    if (/SELECT id FROM players WHERE LOWER\(gamertag\)/.test(sql)) return [];
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
      user: { id: 'caller-user' },
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
      user: { id: 'caller-user' },
    },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(written.user_id, 'owner-user', 'ownership cannot be taken over');
  assert.equal(written.email, 'owner@example.test');
});

test('ordinary profile fields still save normally', async () => {
  let written = null;
  const router = loadPlayerRouterWithMocks(mockFor({ roleId: 1, onUpdate: (b) => { written = b; } }));
  const response = makeResponse();

  await routeHandler(router, 'patch', '/:id')(
    {
      params: { id: 'player-1' },
      // The flows that legitimately edit other players — dressing room, game day,
      // club role management — all touch fields like these and must keep working.
      body: { position: 'ST', bio: 'hello', dressing_room_seat: 3, club_roles: ['captain'] },
      user: { id: 'caller-user' },
    },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(written.position, 'ST');
  assert.equal(written.bio, 'hello');
  assert.equal(written.dressing_room_seat, 3);
  assert.deepEqual(written.club_roles, ['captain']);
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

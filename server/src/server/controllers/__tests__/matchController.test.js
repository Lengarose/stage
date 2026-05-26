const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

function loadMatchRouterWithDbMock(executesql) {
  const controllerPath = path.resolve(__dirname, '../matchController.js');
  const dbPath = path.resolve(__dirname, '../../db/database.js');
  const socketPath = path.resolve(__dirname, '../../utils/socketBroadcast.js');

  delete require.cache[controllerPath];
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

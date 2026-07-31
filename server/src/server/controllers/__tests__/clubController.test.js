const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

function loadClubRouterWithDbMock(executesql) {
  const controllerPath = path.resolve(__dirname, '../clubController.js');
  const dbPath = path.resolve(__dirname, '../../db/database.js');
  const operationsPath = path.resolve(__dirname, '../../services/clubOperationsService.js');
  const membershipPath = path.resolve(__dirname, '../../services/clubMembershipService.js');
  const socketPath = path.resolve(__dirname, '../../utils/socketBroadcast.js');

  delete require.cache[controllerPath];
  delete require.cache[membershipPath];
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { EXECUTESQL: executesql },
  };
  require.cache[operationsPath] = {
    id: operationsPath,
    filename: operationsPath,
    loaded: true,
    exports: {
      ALL_PERMISSIONS: ['manage_staff', 'review_applicants'],
      ROLE_PERMISSIONS: {
        captain: ['review_applicants'],
      },
      requireClubPermission: async () => ({ user: { id: 'manager-user', email: 'manager@example.test' }, access: {} }),
      writeClubAudit: async () => {},
    },
  };
  require.cache[socketPath] = {
    id: socketPath,
    filename: socketPath,
    loaded: true,
    exports: {
      broadcastClub() {},
      broadcastClubDeleted() {},
    },
  };

  return require(controllerPath);
}

function routeHandler(router, pathPattern) {
  const layer = router.stack.find((entry) => entry.route?.path === pathPattern);
  return layer.route.stack[0].handle;
}

test('POST /:id/staff upserts active club membership for assigned role', async () => {
  const membershipWrites = [];
  const executesql = async (sql, params = []) => {
    if (/SELECT id, user_id FROM players WHERE id = \? AND club_id = \? LIMIT 1/.test(sql)) {
      return [{ id: 'player-1', user_id: 'user-1' }];
    }
    if (/INSERT INTO club_staff_roles/.test(sql)) return { affectedRows: 1 };
    if (/SELECT \* FROM club_staff_roles WHERE id = \?/.test(sql)) {
      return [{ id: 'role-1', club_id: 'club-1', player_id: 'player-1', user_id: 'user-1', role: 'captain', permissions: JSON.stringify(['review_applicants']) }];
    }
    if (/DELETE FROM club_memberships/.test(sql)) return { affectedRows: 0 };
    if (/UPDATE club_memberships/.test(sql)) {
      membershipWrites.push({ sql, params });
      return { affectedRows: 1 };
    }
    if (/SELECT \* FROM club_memberships/.test(sql)) return [];
    if (/INSERT INTO club_memberships/.test(sql)) {
      membershipWrites.push({ sql, params });
      return { affectedRows: 1 };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  const router = loadClubRouterWithDbMock(executesql);
  const handle = routeHandler(router, '/:id/staff');
  const response = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; },
  };

  await handle(
    {
      params: { id: 'club-1' },
      body: { player_id: 'player-1', role: 'captain' },
      user: { id: 'manager-user' },
    },
    response,
  );

  assert.equal(response.statusCode, 201);
  assert.equal(membershipWrites.some((call) => /INSERT INTO club_memberships/.test(call.sql)), true);
  const insert = membershipWrites.find((call) => /INSERT INTO club_memberships/.test(call.sql));
  assert.deepEqual(insert.params.slice(1), ['club-1', 'player-1', 'user-1', 'captain', 'staff_assignment']);
});

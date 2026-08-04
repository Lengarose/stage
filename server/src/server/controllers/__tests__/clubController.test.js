const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

function loadClubRouterWithDbMock(executesql, { requireClubPermissionMock } = {}) {
  const controllerPath = path.resolve(__dirname, '../clubController.js');
  const modelPath = path.resolve(__dirname, '../../models/clubModel.js');
  const staffRoleModelPath = path.resolve(__dirname, '../../models/clubStaffRoleModel.js');
  const lineupModelPath = path.resolve(__dirname, '../../models/clubFixtureLineupModel.js');
  const dbPath = path.resolve(__dirname, '../../db/database.js');
  const operationsPath = path.resolve(__dirname, '../../services/clubOperationsService.js');
  const membershipPath = path.resolve(__dirname, '../../services/clubMembershipService.js');
  const socketPath = path.resolve(__dirname, '../../utils/socketBroadcast.js');

  delete require.cache[controllerPath];
  delete require.cache[modelPath];
  delete require.cache[staffRoleModelPath];
  delete require.cache[lineupModelPath];
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
      requireClubPermission: requireClubPermissionMock || (async () => ({ user: { id: 'manager-user', email: 'manager@example.test' }, access: {} })),
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

function routeHandler(router, pathPattern, method = null) {
  const layer = router.stack.find((entry) =>
    entry.route?.path === pathPattern
    && (!method || entry.route.methods?.[method])
  );
  return layer.route.stack[0].handle;
}

function makeJsonResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; },
  };
}

test('PATCH /:id requires club profile permission before updating', async () => {
  let selectCalled = false;
  let updateCalled = false;
  const executesql = async (sql, params = []) => {
    if (/SELECT \* FROM clubs WHERE id = \?/.test(sql)) {
      selectCalled = true;
      return [{ id: params[0], name: 'Club One', user_id: 'president-user', president_user_id: 'president-user' }];
    }
    if (/SELECT id FROM clubs WHERE LOWER\(name\)/.test(sql)) return [];
    if (/SELECT id FROM users WHERE id = \? LIMIT 1/.test(sql)) return [{ id: params[0] }];
    if (/UPDATE clubs SET/.test(sql)) {
      updateCalled = true;
      return { affectedRows: 1 };
    }
    if (/UPDATE users SET owner_id/.test(sql)) return { affectedRows: 1 };
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  const router = loadClubRouterWithDbMock(executesql, {
    requireClubPermissionMock: async () => {
      const err = new Error('Forbidden');
      err.status = 403;
      throw err;
    },
  });
  const handle = routeHandler(router, '/:id', 'patch');
  const response = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; },
  };

  await handle(
    { params: { id: 'club-1' }, body: { name: 'Hijacked', president_user_id: 'attacker' }, user: { id: 'attacker' } },
    response,
  );

  assert.equal(response.statusCode, 403);
  assert.equal(selectCalled, false);
  assert.equal(updateCalled, false);
});

test('PATCH /:id ignores sensitive president identity fields from generic updates', async () => {
  const updates = [];
  const executesql = async (sql, params = []) => {
    if (/SELECT \* FROM clubs WHERE id = \?/.test(sql)) {
      return [{ id: params[0], name: 'Club One', user_id: 'president-user', president_user_id: 'president-user', owner_email: 'president@example.test' }];
    }
    if (/SELECT id FROM clubs WHERE LOWER\(name\)/.test(sql)) return [];
    if (/SELECT id FROM users WHERE id = \? LIMIT 1/.test(sql)) return [{ id: params[0] }];
    if (/UPDATE clubs SET/.test(sql)) {
      updates.push(params);
      return { affectedRows: 1 };
    }
    if (/UPDATE users SET owner_id/.test(sql)) return { affectedRows: 1 };
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  const router = loadClubRouterWithDbMock(executesql, {
    requireClubPermissionMock: async () => ({
      user: { id: 'president-user', email: 'president@example.test' },
      access: { admin: false, permissions: ['edit_club_profile'] },
    }),
  });
  const handle = routeHandler(router, '/:id', 'patch');
  const response = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; },
  };

  await handle(
    {
      params: { id: 'club-1' },
      body: { name: 'New Name', user_id: 'attacker', president_user_id: 'attacker', owner_email: 'attacker@example.test' },
      user: { id: 'president-user' },
    },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.user_id, 'president-user');
  assert.equal(response.body.president_user_id, 'president-user');
  assert.equal(response.body.owner_email, 'president@example.test');
});

test('PATCH /:id rejects operational and financial fields for profile editors', async () => {
  let updateCalled = false;
  const executesql = async (sql, params = []) => {
    if (/SELECT \* FROM clubs WHERE id = \?/.test(sql)) {
      return [{
        id: params[0],
        name: 'Club One',
        user_id: 'president-user',
        president_user_id: 'president-user',
        owner_email: 'president@example.test',
        stc: 100,
      }];
    }
    if (/SELECT id FROM clubs WHERE LOWER\(name\)/.test(sql)) return [];
    if (/SELECT id FROM users WHERE id = \? LIMIT 1/.test(sql)) return [{ id: params[0] }];
    if (/UPDATE clubs SET/.test(sql)) {
      updateCalled = true;
      return { affectedRows: 1 };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  const router = loadClubRouterWithDbMock(executesql, {
    requireClubPermissionMock: async () => ({
      user: { id: 'editor-user', email: 'editor@example.test' },
      access: { admin: false, permissions: ['edit_club_profile'] },
    }),
  });
  const handle = routeHandler(router, '/:id', 'patch');
  const response = makeJsonResponse();

  await handle(
    { params: { id: 'club-1' }, body: { description: 'Nice club', stc: 999999, status: 'champion' }, user: { id: 'editor-user' } },
    response,
  );

  assert.equal(response.statusCode, 403);
  assert.equal(updateCalled, false);
});

test('PATCH /:id allows formation updates with formation permission', async () => {
  const permissionChecks = [];
  const updates = [];
  const executesql = async (sql, params = []) => {
    if (/SELECT \* FROM clubs WHERE id = \?/.test(sql)) {
      return [{ id: params[0], name: 'Club One', user_id: 'president-user', president_user_id: 'president-user', formation: '433', lineup: null }];
    }
    if (/UPDATE clubs SET/.test(sql)) {
      updates.push(params);
      return { affectedRows: 1 };
    }
    if (/SELECT id FROM users WHERE id = \? LIMIT 1/.test(sql)) return [{ id: params[0] }];
    if (/UPDATE users SET owner_id/.test(sql)) return { affectedRows: 1 };
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  const router = loadClubRouterWithDbMock(executesql, {
    requireClubPermissionMock: async (_req, _clubId, permission) => {
      permissionChecks.push(permission);
      return {
        user: { id: 'captain-user', email: 'captain@example.test' },
        access: { admin: false, permissions: ['manage_formation'] },
      };
    },
  });
  const handle = routeHandler(router, '/:id', 'patch');
  const response = makeJsonResponse();

  await handle(
    { params: { id: 'club-1' }, body: { formation: '4231', lineup: [{ player_id: 'player-1' }] }, user: { id: 'captain-user' } },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.deepEqual(permissionChecks, [null]);
  assert.equal(updates[0][32], '4231');
  assert.equal(updates[0][33], JSON.stringify([{ player_id: 'player-1' }]));
});

test('DELETE /:id is admin-only even for club staff', async () => {
  let deleteCalled = false;
  const executesql = async (sql) => {
    if (/SELECT \* FROM clubs WHERE id = \?/.test(sql)) return [{ id: 'club-1', user_id: 'president-user', president_user_id: 'president-user' }];
    if (/DELETE FROM clubs/.test(sql)) {
      deleteCalled = true;
      return { affectedRows: 1 };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  const router = loadClubRouterWithDbMock(executesql, {
    requireClubPermissionMock: async () => ({ user: { id: 'captain-user', email: 'captain@example.test' }, access: { admin: false } }),
  });
  const handle = routeHandler(router, '/:id', 'delete');
  const response = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; },
  };

  await handle({ params: { id: 'club-1' }, user: { id: 'captain-user' } }, response);

  assert.equal(response.statusCode, 403);
  assert.equal(deleteCalled, false);
});

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

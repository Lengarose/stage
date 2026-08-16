const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

function loadClubOperationsServiceWithDbMock(executesql) {
  const servicePath = path.resolve(__dirname, '../clubOperationsService.js');
  const identityServicePath = path.resolve(__dirname, '../identityService.js');
  const dbPath = path.resolve(__dirname, '../../db/database.js');

  delete require.cache[servicePath];
  delete require.cache[identityServicePath];
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { EXECUTESQL: executesql },
  };

  return require(servicePath);
}

test('getClubAccess presents legacy users.owner_id club access as president permissions', async () => {
  const user = { id: 'user-1', email: 'changed@example.test', role_id: 1, role: 'user' };
  const club = { id: 'club-1', user_id: null, owner_email: 'old@example.test' };
  const executesql = async (sql, params = []) => {
    if (/SELECT \* FROM clubs WHERE id = \? LIMIT 1/.test(sql) && params[0] === 'club-1') return [club];
    if (/FROM users WHERE id = \? LIMIT 1/.test(sql)) {
      return [{ ...user, player_id: null, owner_id: 'club-1' }];
    }
    if (/FROM players\s+WHERE user_id = \?/.test(sql)) return [];
    if (/SELECT \* FROM club_staff_roles/.test(sql)) return [];
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const { getClubAccess } = loadClubOperationsServiceWithDbMock(executesql);
  const access = await getClubAccess(user, 'club-1');

  assert.equal(access.allowed, true);
  assert.deepEqual(access.roles, ['president']);
  assert.equal(access.permissions.includes('manage_staff'), true);
});

test('getClubAccess grants president permissions through canonical club president_user_id', async () => {
  const user = { id: 'president-user', email: 'president@example.test', role_id: 1, role: 'user' };
  const club = {
    id: 'club-1',
    user_id: null,
    president_user_id: 'president-user',
    owner_email: 'legacy@example.test',
  };
  const executesql = async (sql, params = []) => {
    if (/SELECT \* FROM clubs WHERE id = \? LIMIT 1/.test(sql) && params[0] === 'club-1') return [club];
    if (/FROM users WHERE id = \? LIMIT 1/.test(sql)) {
      return [{ ...user, player_id: null, owner_id: null }];
    }
    if (/FROM players\s+WHERE user_id = \?/.test(sql)) return [];
    if (/FROM clubs WHERE president_user_id = \?/.test(sql)) return [club];
    if (/SELECT \* FROM club_staff_roles/.test(sql)) return [];
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const { getClubAccess } = loadClubOperationsServiceWithDbMock(executesql);
  const access = await getClubAccess(user, 'club-1');

  assert.equal(access.allowed, true);
  assert.deepEqual(access.roles, ['president']);
  assert.equal(access.permissions.includes('manage_finances'), true);
  assert.equal(access.permissions.includes('offer_contracts'), true);
});

test('getClubAccess grants permissions from active club membership primary role', async () => {
  const user = { id: 'user-1', email: 'member@example.test', role_id: 1, role: 'user' };
  const club = { id: 'club-1', user_id: 'owner-user', owner_email: 'owner@example.test' };
  const player = {
    id: 'player-1',
    user_id: 'user-1',
    email: 'member@example.test',
    club_id: 'legacy-club',
    role: 'member',
    club_roles: null,
  };
  const membership = {
    id: 'membership-1',
    club_id: 'club-1',
    player_id: 'player-1',
    user_id: 'user-1',
    status: 'active',
    primary_role: 'captain',
  };
  const executesql = async (sql, params = []) => {
    if (/SELECT \* FROM clubs WHERE id = \? LIMIT 1/.test(sql) && params[0] === 'club-1') return [club];
    if (/FROM users WHERE id = \? LIMIT 1/.test(sql)) {
      return [{ ...user, player_id: 'player-1', owner_id: null }];
    }
    if (/SELECT \* FROM players WHERE id = \? LIMIT 1/.test(sql)) return [player];
    if (/FROM club_memberships/.test(sql)) return [membership];
    if (/SELECT \* FROM club_staff_roles/.test(sql)) return [];
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const { getClubAccess } = loadClubOperationsServiceWithDbMock(executesql);
  const access = await getClubAccess(user, 'club-1');

  assert.equal(access.allowed, true);
  assert.deepEqual(access.roles, ['captain']);
  assert.equal(access.permissions.includes('offer_contracts'), true);
});

test('getPlayerForUser accepts active membership when legacy player club id differs', async () => {
  const user = { id: 'user-1', email: 'member@example.test', role_id: 1, role: 'user' };
  const player = {
    id: 'player-1',
    user_id: 'user-1',
    email: 'member@example.test',
    club_id: 'legacy-club',
    role: 'member',
    club_roles: null,
  };
  const membership = {
    id: 'membership-1',
    club_id: 'club-1',
    player_id: 'player-1',
    user_id: 'user-1',
    status: 'active',
    primary_role: 'member',
  };
  const executesql = async (sql, params = []) => {
    if (/FROM users WHERE id = \? LIMIT 1/.test(sql)) {
      return [{ ...user, player_id: 'player-1', owner_id: null }];
    }
    if (/SELECT \* FROM players WHERE id = \? LIMIT 1/.test(sql)) return [player];
    if (/FROM club_memberships/.test(sql)) return [membership];
    if (/FROM clubs WHERE/.test(sql)) return [];
    if (/SELECT \* FROM club_staff_roles/.test(sql)) return [];
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const { getPlayerForUser } = loadClubOperationsServiceWithDbMock(executesql);
  const resolved = await getPlayerForUser(user, 'club-1');

  assert.equal(resolved.id, 'player-1');
  assert.equal(resolved.club_id, 'club-1');
});

test('normalizeAssignableStaffRole only accepts captain and vice-captain', () => {
  const { normalizeAssignableStaffRole } = loadClubOperationsServiceWithDbMock(async () => []);
  assert.equal(normalizeAssignableStaffRole('captain'), 'captain');
  assert.equal(normalizeAssignableStaffRole('vice-captain'), 'vice_captain');
  assert.equal(normalizeAssignableStaffRole('vice_captain'), 'vice_captain');
  assert.equal(normalizeAssignableStaffRole('president'), null);
  assert.equal(normalizeAssignableStaffRole('recruiter'), null);
});

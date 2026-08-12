const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

function loadIdentityServiceWithDbMock(executesql) {
  const servicePath = path.resolve(__dirname, '../identityService.js');
  const resolutionPath = path.resolve(__dirname, '../presidentResolutionService.js');
  const dbPath = path.resolve(__dirname, '../../db/database.js');

  delete require.cache[servicePath];
  delete require.cache[resolutionPath];
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { EXECUTESQL: executesql },
  };

  return require(servicePath);
}

function withPresidentEnsureSupport(executesql, { presidents = [] } = {}) {
  const store = { presidents: [...presidents] };
  return async (sql, params = []) => {
    if (/SELECT \* FROM presidents WHERE user_id = \?/.test(sql)) {
      return store.presidents.filter((p) => p.user_id === params[0]);
    }
    if (/SELECT \* FROM presidents WHERE id = \?/.test(sql)) {
      return store.presidents.filter((p) => p.id === params[0]);
    }
    if (/INSERT INTO presidents/.test(sql)) {
      const row = {
        id: params[0],
        user_id: params[1],
        club_id: params[2],
        email: params[3],
        display_name: params[4] ?? null,
      };
      store.presidents.push(row);
      return { affectedRows: 1 };
    }
    if (/UPDATE presidents SET club_id/.test(sql)) {
      const row = store.presidents.find((p) => p.id === params[1]);
      if (row) row.club_id = params[0];
      return { affectedRows: 1 };
    }
    if (/UPDATE clubs SET president_id/.test(sql)) {
      return { affectedRows: 1 };
    }
    return executesql(sql, params);
  };
}

test('resolveUserIdentity presents legacy owned club users as presidents', async () => {
  const calls = [];
  const user = {
    id: 'user-1',
    email: 'owner@example.test',
    player_id: 'player-1',
    owner_id: 'club-owned',
    role_id: 1,
    role: 'user',
  };
  const player = {
    id: 'player-1',
    user_id: 'user-1',
    email: 'owner@example.test',
    club_id: 'club-member',
    role: 'captain',
    club_roles: JSON.stringify(['captain']),
  };
  const memberClub = { id: 'club-member', user_id: 'other-user', owner_email: 'other@example.test' };
  const ownedClub = { id: 'club-owned', user_id: 'user-1', owner_email: 'owner@example.test' };
  const staffRole = { id: 'staff-1', club_id: 'club-member', player_id: 'player-1', user_id: 'user-1', role: 'recruiter' };

  const executesql = withPresidentEnsureSupport(async (sql, params) => {
    calls.push({ sql, params });
    if (/FROM users WHERE id = \?/.test(sql)) return [user];
    if (/FROM players WHERE id = \?/.test(sql)) return [player];
    if (/FROM clubs WHERE id = \? LIMIT 1/.test(sql) && params[0] === 'club-member') return [memberClub];
    if (/FROM clubs WHERE id = \? LIMIT 1/.test(sql) && params[0] === 'club-owned') return [ownedClub];
    if (/FROM clubs WHERE president_user_id = \?/.test(sql)) return [];
    if (/FROM club_memberships/.test(sql)) return [];
    if (/FROM club_staff_roles/.test(sql)) return [staffRole];
    throw new Error(`Unexpected SQL: ${sql}`);
  });

  const { resolveUserIdentity } = loadIdentityServiceWithDbMock(executesql);
  const identity = await resolveUserIdentity('user-1');

  assert.equal(identity.user.id, 'user-1');
  assert.equal(identity.player.id, 'player-1');
  assert.equal(identity.memberClub.id, 'club-member');
  assert.equal(identity.ownedClub.id, 'club-owned');
  assert.equal(identity.user.owned_club_id, 'club-owned');
  assert.equal(identity.club.id, 'club-member');
  assert.deepEqual(identity.roles, ['president', 'captain', 'recruiter']);
  assert.equal(calls.some((call) => /FROM clubs WHERE user_id = \?/.test(call.sql)), false);
});

test('resolveUserIdentity presents owner email fallback accounts as presidents', async () => {
  const user = {
    id: 'user-legacy',
    email: 'legacy@example.test',
    player_id: null,
    owner_id: null,
    role_id: 1,
    role: 'user',
  };
  const player = {
    id: 'player-legacy',
    user_id: null,
    email: 'legacy@example.test',
    club_id: null,
    role: 'member',
    club_roles: null,
  };
  const ownedClub = { id: 'club-legacy', user_id: null, owner_email: 'legacy@example.test' };

  const executesql = withPresidentEnsureSupport(async (sql) => {
    if (/FROM users WHERE id = \?/.test(sql)) return [user];
    if (/FROM players\s+WHERE user_id = \?/.test(sql)) return [player];
    if (/FROM clubs WHERE president_user_id = \?/.test(sql)) return [];
    if (/FROM clubs WHERE user_id = \?/.test(sql)) return [];
    if (/FROM clubs WHERE LOWER\(TRIM\(owner_email\)\)/.test(sql)) return [ownedClub];
    if (/FROM club_memberships/.test(sql)) return [];
    if (/FROM club_staff_roles/.test(sql)) return [];
    throw new Error(`Unexpected SQL: ${sql}`);
  });

  const { resolveUserIdentity } = loadIdentityServiceWithDbMock(executesql);
  const identity = await resolveUserIdentity('user-legacy');

  assert.equal(identity.player.id, 'player-legacy');
  assert.equal(identity.ownedClub.id, 'club-legacy');
  assert.equal(identity.club.id, 'club-legacy');
  assert.deepEqual(identity.roles, ['president']);
});

test('resolveUserIdentity resolves president-only management role without creating President profile', async () => {
  const user = {
    id: 'president-user',
    email: 'president@example.test',
    player_id: null,
    owner_id: null,
    role_id: 1,
    role: 'user',
  };
  const presidentClub = {
    id: 'club-president',
    user_id: null,
    president_user_id: 'president-user',
    owner_email: 'legacy-owner@example.test',
  };

  const executesql = withPresidentEnsureSupport(async (sql) => {
    if (/FROM users WHERE id = \?/.test(sql)) return [user];
    if (/FROM players\s+WHERE user_id = \?/.test(sql)) return [];
    if (/FROM clubs WHERE president_user_id = \?/.test(sql)) return [presidentClub];
    if (/FROM club_memberships/.test(sql)) return [];
    if (/FROM club_staff_roles/.test(sql)) return [];
    throw new Error(`Unexpected SQL: ${sql}`);
  });

  const { resolveUserIdentity } = loadIdentityServiceWithDbMock(executesql);
  const identity = await resolveUserIdentity('president-user');

  assert.equal(identity.player, null);
  assert.equal(identity.presidentClub.id, 'club-president');
  assert.equal(identity.presidentClubId, 'club-president');
  assert.equal(identity.ownedClub.id, 'club-president');
  assert.equal(identity.club.id, 'club-president');
  assert.equal(identity.presidentId, null);
  assert.deepEqual(identity.roles, ['president']);
});

test('resolveUserIdentity prefers active club membership over legacy player club_id', async () => {
  const user = {
    id: 'user-member',
    email: 'member@example.test',
    player_id: 'player-member',
    owner_id: null,
    role_id: 1,
    role: 'user',
  };
  const player = {
    id: 'player-member',
    user_id: 'user-member',
    email: 'member@example.test',
    club_id: 'legacy-club',
    role: 'member',
    club_roles: null,
  };
  const membership = {
    id: 'membership-1',
    club_id: 'membership-club',
    player_id: 'player-member',
    user_id: 'user-member',
    status: 'active',
    primary_role: 'vice_captain',
  };
  const membershipClub = { id: 'membership-club', user_id: 'owner-user', owner_email: 'owner@example.test' };

  const executesql = withPresidentEnsureSupport(async (sql, params = []) => {
    if (/FROM users WHERE id = \?/.test(sql)) return [user];
    if (/FROM players WHERE id = \?/.test(sql)) return [player];
    if (/FROM club_memberships/.test(sql)) return [membership];
    if (/FROM clubs WHERE president_user_id = \?/.test(sql)) return [];
    if (/FROM clubs WHERE id = \? LIMIT 1/.test(sql) && params[0] === 'membership-club') return [membershipClub];
    if (/FROM club_staff_roles/.test(sql)) return [];
    throw new Error(`Unexpected SQL: ${sql}`);
  });

  const { resolveUserIdentity } = loadIdentityServiceWithDbMock(executesql);
  const identity = await resolveUserIdentity('user-member');

  assert.equal(identity.membership.id, 'membership-1');
  assert.equal(identity.memberClub.id, 'membership-club');
  assert.equal(identity.club.id, 'membership-club');
  assert.deepEqual(identity.roles, ['vice_captain']);
});

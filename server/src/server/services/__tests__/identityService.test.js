const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

function loadIdentityServiceWithDbMock(executesql) {
  const servicePath = path.resolve(__dirname, '../identityService.js');
  const dbPath = path.resolve(__dirname, '../../db/database.js');

  delete require.cache[servicePath];
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { EXECUTESQL: executesql },
  };

  return require(servicePath);
}

test('resolveUserIdentity links owner user to player, member club, owned club, and roles', async () => {
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

  const executesql = async (sql, params) => {
    calls.push({ sql, params });
    if (/FROM users WHERE id = \?/.test(sql)) return [user];
    if (/FROM players WHERE id = \?/.test(sql)) return [player];
    if (/FROM clubs WHERE id = \? LIMIT 1/.test(sql) && params[0] === 'club-member') return [memberClub];
    if (/FROM clubs WHERE id = \? LIMIT 1/.test(sql) && params[0] === 'club-owned') return [ownedClub];
    if (/FROM club_staff_roles/.test(sql)) return [staffRole];
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const { resolveUserIdentity } = loadIdentityServiceWithDbMock(executesql);
  const identity = await resolveUserIdentity('user-1');

  assert.equal(identity.user.id, 'user-1');
  assert.equal(identity.player.id, 'player-1');
  assert.equal(identity.memberClub.id, 'club-member');
  assert.equal(identity.ownedClub.id, 'club-owned');
  assert.equal(identity.user.owned_club_id, 'club-owned');
  assert.equal(identity.club.id, 'club-member');
  assert.deepEqual(identity.roles, ['owner', 'captain', 'recruiter']);
  assert.equal(calls.some((call) => /FROM clubs WHERE user_id = \?/.test(call.sql)), false);
});

test('resolveUserIdentity falls back to email links for legacy accounts', async () => {
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

  const executesql = async (sql) => {
    if (/FROM users WHERE id = \?/.test(sql)) return [user];
    if (/FROM players\s+WHERE user_id = \?/.test(sql)) return [player];
    if (/FROM clubs WHERE LOWER\(TRIM\(owner_email\)\)/.test(sql)) return [ownedClub];
    if (/FROM club_staff_roles/.test(sql)) return [];
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const { resolveUserIdentity } = loadIdentityServiceWithDbMock(executesql);
  const identity = await resolveUserIdentity('user-legacy');

  assert.equal(identity.player.id, 'player-legacy');
  assert.equal(identity.ownedClub.id, 'club-legacy');
  assert.equal(identity.club.id, 'club-legacy');
  assert.deepEqual(identity.roles, ['owner']);
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

  const executesql = async (sql, params = []) => {
    if (/FROM users WHERE id = \?/.test(sql)) return [user];
    if (/FROM players WHERE id = \?/.test(sql)) return [player];
    if (/FROM club_memberships/.test(sql)) return [membership];
    if (/FROM clubs WHERE id = \? LIMIT 1/.test(sql) && params[0] === 'membership-club') return [membershipClub];
    if (/FROM club_staff_roles/.test(sql)) return [];
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const { resolveUserIdentity } = loadIdentityServiceWithDbMock(executesql);
  const identity = await resolveUserIdentity('user-member');

  assert.equal(identity.membership.id, 'membership-1');
  assert.equal(identity.memberClub.id, 'membership-club');
  assert.equal(identity.club.id, 'membership-club');
  assert.deepEqual(identity.roles, ['vice_captain']);
});

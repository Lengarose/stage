const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

function loadServiceWithDbMock(executesql) {
  const servicePath = path.resolve(__dirname, '../clubMembershipService.js');
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

test('upsertActiveMembership inactivates other memberships before inserting active link', async () => {
  const calls = [];
  const executesql = async (sql, params = []) => {
    calls.push({ sql, params });
    if (/DELETE FROM club_memberships/.test(sql)) return { affectedRows: 0 };
    if (/SELECT \* FROM club_memberships/.test(sql)) return [];
    if (/INSERT INTO club_memberships/.test(sql)) return { affectedRows: 1 };
    if (/UPDATE club_memberships/.test(sql)) return { affectedRows: 1 };
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const { upsertActiveMembership } = loadServiceWithDbMock(executesql);
  const id = await upsertActiveMembership({
    clubId: 'club-1',
    playerId: 'player-1',
    userId: 'user-1',
    primaryRole: 'captain',
    source: 'contract_acceptance',
  });

  assert.ok(id);
  assert.match(calls[0].sql, /DELETE FROM club_memberships/);
  assert.match(calls[1].sql, /status = 'active' AND club_id <> \?/);
  assert.deepEqual(calls[1].params, ['inactive', 'player-1', 'club-1']);
  assert.match(calls[3].sql, /INSERT INTO club_memberships/);
  assert.deepEqual(calls[3].params.slice(1), ['club-1', 'player-1', 'user-1', 'captain', 'contract_acceptance']);
});

test('upsertActiveMembership updates existing active link instead of duplicating it', async () => {
  const calls = [];
  const executesql = async (sql, params = []) => {
    calls.push({ sql, params });
    if (/DELETE FROM club_memberships/.test(sql)) return { affectedRows: 0 };
    if (/SELECT \* FROM club_memberships/.test(sql)) return [{ id: 'membership-1', source: 'legacy_player_club_id' }];
    if (/UPDATE club_memberships/.test(sql)) return { affectedRows: 1 };
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const { upsertActiveMembership } = loadServiceWithDbMock(executesql);
  const id = await upsertActiveMembership({
    clubId: 'club-1',
    playerId: 'player-1',
    primaryRole: 'president',
    source: 'club_creation',
  });

  assert.equal(id, 'membership-1');
  assert.equal(calls.filter((call) => /INSERT INTO club_memberships/.test(call.sql)).length, 0);
  assert.match(calls[3].sql, /primary_role = \?/);
  assert.deepEqual(calls[3].params, [null, 'president', 'club_creation', 'membership-1']);
});

test('endActiveMemberships propagates write failures instead of hiding stale active memberships', async () => {
  const executesql = async (sql) => {
    if (/DELETE FROM club_memberships/.test(sql)) return { affectedRows: 0 };
    if (/UPDATE club_memberships/.test(sql)) throw new Error('duplicate inactive row');
    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const { endActiveMemberships } = loadServiceWithDbMock(executesql);

  await assert.rejects(
    () => endActiveMemberships({ playerId: 'player-1', reason: 'inactive' }),
    /duplicate inactive row/
  );
});

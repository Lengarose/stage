const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

function loadLeaveServiceWithConnection(connection) {
  const servicePath = path.resolve(__dirname, '../leaveClubLifecycleService.js');
  const dbPath = path.resolve(__dirname, '../../db/database.js');
  const rulesPath = path.resolve(__dirname, '../contractRulesService.js');

  delete require.cache[servicePath];
  delete require.cache[dbPath];
  delete require.cache[rulesPath];

  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: {
      pool: {
        promise() {
          return { getConnection: async () => connection };
        },
      },
      EXECUTESQL: async () => [],
    },
  };
  require.cache[rulesPath] = {
    id: rulesPath,
    filename: rulesPath,
    loaded: true,
    exports: {
      markContractInboxStatus: async () => {},
    },
  };

  return require(servicePath);
}

function makeConnection(state) {
  const calls = [];
  const connection = {
    committed: false,
    rolledBack: false,
    async beginTransaction() {},
    async commit() { connection.committed = true; },
    async rollback() { connection.rolledBack = true; },
    release() {},
    async query(sql, params = []) {
      calls.push({ sql, params });
      if (/SELECT \* FROM clubs WHERE id = \?/.test(sql)) {
        return [[state.club].filter(Boolean), []];
      }
      if (/SELECT \* FROM players WHERE id = \?/.test(sql)) {
        return [[state.player].filter(Boolean), []];
      }
      if (/FROM player_contracts/.test(sql) && /status IN/.test(sql)) {
        return [state.liveContracts || [], []];
      }
      if (/SELECT id\s+FROM club_memberships/.test(sql)) {
        return [state.memberships || [], []];
      }
      if (/DELETE FROM presidents/.test(sql)) {
        state.presidentDeleted = true;
        return [{ affectedRows: 1 }, []];
      }
      if (/UPDATE player_contracts\s+SET status = 'terminated'/.test(sql)) {
        for (const id of params) {
          const contract = (state.liveContracts || []).find((row) => row.id === id);
          if (contract) contract.status = 'terminated';
        }
        return [{ affectedRows: params.length }, []];
      }
      if (/UPDATE player_contracts\s+SET status = 'cancelled'/.test(sql)) {
        for (const id of params) {
          const contract = (state.liveContracts || []).find((row) => row.id === id);
          if (contract) contract.status = 'cancelled';
        }
        return [{ affectedRows: params.length }, []];
      }
      if (/UPDATE club_memberships/.test(sql)) {
        state.membershipInactive = true;
        return [{ affectedRows: 1 }, []];
      }
      if (/DELETE FROM club_staff_roles/.test(sql)) {
        return [{ affectedRows: 0 }, []];
      }
      if (/UPDATE players/.test(sql)) {
        state.player.club_id = null;
        state.player.role = 'member';
        state.player.club_roles = JSON.stringify(['member']);
        state.player.status = 'free_agent';
        return [{ affectedRows: 1 }, []];
      }
      if (/UPDATE clubs/.test(sql)) {
        state.club.president_player_id = null;
        state.club.president_user_id = null;
        state.club.user_id = null;
        state.club.owner_email = null;
        return [{ affectedRows: 1 }, []];
      }
      if (/UPDATE users SET owner_id = NULL/.test(sql)) {
        state.userOwnerCleared = true;
        return [{ affectedRows: 1 }, []];
      }
      if (/SELECT id, user_id, email, club_id, role, club_roles, status FROM players/.test(sql)) {
        return [[state.player], []];
      }
      if (/SELECT \* FROM clubs WHERE id = \? LIMIT 1$/.test(sql) || /SELECT \* FROM clubs WHERE id = \? LIMIT 1$/.test(sql.trim())) {
        return [[state.club], []];
      }
      if (/FROM player_contracts\s+WHERE team_id = \?/.test(sql) && /ORDER BY/.test(sql)) {
        return [state.liveContracts || [], []];
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };
  return { connection, calls, state };
}

const founderState = () => ({
  club: {
    id: 'club-1',
    name: 'Founder FC',
    president_player_id: 'player-1',
    president_user_id: 'user-1',
    user_id: 'user-1',
    owner_email: 'founder@example.test',
  },
  player: {
    id: 'player-1',
    user_id: 'user-1',
    email: 'founder@example.test',
    club_id: 'club-1',
    role: 'president',
    club_roles: JSON.stringify(['president', 'member']),
    status: 'active',
  },
  liveContracts: [
    { id: 'c-player', team_id: 'club-1', user_id: 'player-1', contract_type: 'founder_player', status: 'active' },
    { id: 'c-owner', team_id: 'club-1', user_id: 'player-1', contract_type: 'ownership', status: 'active' },
  ],
});

test('leave club terminates founder and president contracts and releases the player as a free agent', async () => {
  const { connection, state } = makeConnection(founderState());
  const { leaveClubLifecycle } = loadLeaveServiceWithConnection(connection);

  const result = await leaveClubLifecycle({
    user: { id: 'user-1', email: 'founder@example.test' },
    playerId: 'player-1',
    clubId: 'club-1',
  });

  assert.equal(connection.committed, true);
  assert.equal(result.player.status, 'free_agent');
  assert.equal(result.player.club_id, null);
  assert.equal(result.detachedPresidency, true);
  assert.deepEqual(result.terminatedContractIds.sort(), ['c-owner', 'c-player']);
  assert.equal(state.club.president_player_id, null);
  assert.equal(state.club.user_id, null);
  assert.equal(state.userOwnerCleared, true);
  assert.equal(state.membershipInactive, true);
  assert.equal(state.presidentDeleted, true);
});

test('leave club does not clear a player signed to a different club', async () => {
  const state = founderState();
  state.player.club_id = 'club-other';
  state.club.president_player_id = null;
  state.club.president_user_id = null;
  state.club.user_id = null;
  state.club.owner_email = 'someone-else@example.test';
  const { connection } = makeConnection(state);
  const { leaveClubLifecycle } = loadLeaveServiceWithConnection(connection);

  const result = await leaveClubLifecycle({
    user: { id: 'user-1', email: 'founder@example.test' },
    playerId: 'player-1',
    clubId: 'club-1',
  });

  assert.equal(result.player.club_id, 'club-other');
  assert.equal(result.detachedPresidency, false);
  assert.deepEqual(result.terminatedContractIds.sort(), ['c-owner', 'c-player']);
});

test('leave club rejects a caller with no link to that club', async () => {
  const state = founderState();
  state.player.club_id = 'club-other';
  state.liveContracts = [];
  state.club.president_player_id = null;
  state.club.president_user_id = null;
  state.club.user_id = null;
  state.club.owner_email = 'someone-else@example.test';
  const { connection } = makeConnection(state);
  const { leaveClubLifecycle } = loadLeaveServiceWithConnection(connection);

  await assert.rejects(
    () => leaveClubLifecycle({
      user: { id: 'user-1', email: 'founder@example.test' },
      playerId: 'player-1',
      clubId: 'club-1',
    }),
    (err) => err.status === 400 && err.code === 'not_a_member'
  );
});

test('leave club rejects a player that does not belong to the authenticated user', async () => {
  const { connection } = makeConnection(founderState());
  const { leaveClubLifecycle } = loadLeaveServiceWithConnection(connection);

  await assert.rejects(
    () => leaveClubLifecycle({
      user: { id: 'other-user', email: 'other@example.test' },
      playerId: 'player-1',
      clubId: 'club-1',
    }),
    (err) => err.status === 403 && err.code === 'player_forbidden'
  );
});

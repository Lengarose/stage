const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

function loadFounderServiceWithConnection(connection) {
  const servicePath = path.resolve(__dirname, '../founderContractLifecycleService.js');
  const dbPath = path.resolve(__dirname, '../../db/database.js');
  const membershipPath = path.resolve(__dirname, '../clubMembershipService.js');

  delete require.cache[servicePath];
  delete require.cache[dbPath];
  delete require.cache[membershipPath];

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
    },
  };

  return require(servicePath);
}

function makeConnection({ failOnSql = null, existing = {} } = {}) {
  const calls = [];
  const state = {
    clubs: existing.club ? [existing.club] : [],
    contracts: existing.contracts || (existing.contract ? [existing.contract] : []),
    memberships: existing.membership ? [existing.membership] : [],
    player: existing.player || {
      id: 'player-1',
      user_id: 'user-1',
      email: 'founder@example.test',
      club_id: null,
      role: 'free_agent',
      club_roles: JSON.stringify(['free_agent']),
    },
  };
  const connection = {
    calls,
    state,
    began: false,
    committed: false,
    rolledBack: false,
    released: false,
    async beginTransaction() {
      this.began = true;
    },
    async commit() {
      this.committed = true;
    },
    async rollback() {
      this.rolledBack = true;
    },
    release() {
      this.released = true;
    },
    async query(sql, params = []) {
      calls.push({ sql, params });
      if (failOnSql && failOnSql.test(sql)) {
        throw new Error('Injected failure');
      }
      if (/SELECT id, user_id, email, club_id, role, club_roles FROM players WHERE id = \? LIMIT 1 FOR UPDATE/.test(sql)) {
        return [[state.player], []];
      }
      if (/SELECT \* FROM clubs\s+WHERE president_player_id = \?/.test(sql)) {
        return [state.clubs.filter((club) => club.president_player_id === params[0]), []];
      }
      if (/SELECT id FROM clubs WHERE LOWER\(name\) = LOWER\(\?\) LIMIT 1 FOR UPDATE/.test(sql)) {
        return [state.clubs.filter((club) => String(club.name).toLowerCase() === String(params[0]).toLowerCase()).map((club) => ({ id: club.id })), []];
      }
      if (/INSERT INTO clubs/.test(sql)) {
        state.clubs.push({
          id: params[0],
          user_id: params[1],
          president_user_id: params[2],
          president_player_id: params[3],
          owner_email: params[4],
          name: params[5],
          tag: params[6],
          platform: params[7],
          region: params[8],
          country_code: params[9],
          status: 'active',
          stc: params[15],
        });
        return [{ affectedRows: 1 }, []];
      }
      if (/INSERT INTO stc_transactions/.test(sql)) return [{ affectedRows: 1 }, []];
      if (/UPDATE users SET owner_id/.test(sql)) return [{ affectedRows: 1 }, []];
      if (/SELECT \*, user_id AS target_player_id FROM player_contracts WHERE id = \? LIMIT 1/.test(sql)) {
        return [[state.contracts.find((contract) => contract.id === params[0])].filter(Boolean), []];
      }
      if (/SELECT \*, user_id AS target_player_id\s+FROM player_contracts/.test(sql)) {
        const byClubAndPlayer = state.contracts.filter((contract) => (
          contract.team_id === params[0] && contract.user_id === params[1]
        ));
        if (/contract_type = 'founder'/.test(sql)) {
          return [byClubAndPlayer.filter((contract) => contract.contract_type === 'founder'), []];
        }
        if (/contract_type = \?/.test(sql)) {
          return [byClubAndPlayer.filter((contract) => contract.contract_type === params[2]), []];
        }
        if (/contract_type IN/.test(sql)) {
          const allowedTypes = params.slice(2).filter((param) => ['founder_player', 'founder', 'ownership'].includes(param));
          return [byClubAndPlayer.filter((contract) => allowedTypes.includes(contract.contract_type)), []];
        }
        return [byClubAndPlayer, []];
      }
      if (/INSERT INTO player_contracts/.test(sql)) {
        state.contracts.push({
          id: params[0],
          team_id: params[1],
          user_id: params[2],
          contract_type: params[3],
          status: 'active',
          offered_by: params[4],
          offered_by_user_id: params[5],
          offered_by_club_id: params[6],
          max_games: params[7],
          max_days: params[8],
          weekly_salary_stc: params[9],
          signing_bonus_stc: params[10],
          transfer_fee_stc: params[11],
          offer_note: params[12],
          captaincy_offered: 0,
          target_player_id: params[2],
        });
        return [{ affectedRows: 1 }, []];
      }
      if (/UPDATE player_contracts SET status = 'active'/.test(sql)) {
        const contract = state.contracts.find((row) => row.id === params[2]);
        if (contract) {
          contract.status = 'active';
          contract.start_date = params[0];
          contract.end_date = params[1];
        }
        return [{ affectedRows: 1 }, []];
      }
      if (/UPDATE clubs SET president_player_id = \?/.test(sql)) {
        const club = state.clubs.find((row) => row.id === params[1]);
        if (club) club.president_player_id = params[0];
        return [{ affectedRows: 1 }, []];
      }
      if (/UPDATE players SET club_id = \?/.test(sql)) {
        state.player.club_id = params[0];
        state.player.club_roles = params[1];
        state.player.role = params[2];
        state.player.status = 'active';
        return [{ affectedRows: 1 }, []];
      }
      if (/DELETE FROM club_memberships/.test(sql)) return [{ affectedRows: 0 }, []];
      if (/UPDATE club_memberships\s+SET status = \?/.test(sql)) return [{ affectedRows: 0 }, []];
      if (/UPDATE club_memberships\s+SET user_id = COALESCE/.test(sql)) {
        const membership = state.memberships.find((row) => row.id === params[3]);
        if (membership) {
          membership.user_id = params[0] || membership.user_id;
          membership.primary_role = params[1];
          membership.source = params[2];
        }
        return [{ affectedRows: 1 }, []];
      }
      if (/SELECT \* FROM club_memberships/.test(sql)) {
        return [state.memberships.filter((membership) => membership.club_id === params[0] && membership.player_id === params[1] && membership.status === 'active'), []];
      }
      if (/INSERT INTO club_memberships/.test(sql)) {
        state.memberships.push({
          id: params[0],
          club_id: params[1],
          player_id: params[2],
          user_id: params[3],
          status: 'active',
          primary_role: params[4],
          source: params[5],
        });
        return [{ affectedRows: 1 }, []];
      }
      if (/SELECT \* FROM clubs WHERE id = \? LIMIT 1/.test(sql)) {
        return [[state.clubs.find((club) => club.id === params[0])].filter(Boolean), []];
      }
      if (/SELECT \* FROM club_memberships WHERE id = \? LIMIT 1/.test(sql)) {
        return [[state.memberships.find((membership) => membership.id === params[0])].filter(Boolean), []];
      }
      if (/SELECT id, user_id, email, club_id, role, club_roles FROM players WHERE id = \? LIMIT 1/.test(sql)) {
        return [[state.player], []];
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };
  return connection;
}

test('founder lifecycle creates club, active player contract, active president contract, membership, and president player link', async () => {
  const connection = makeConnection();
  const { createFounderContractLifecycle } = loadFounderServiceWithConnection(connection);

  const result = await createFounderContractLifecycle({
    user: { id: 'user-1', email: 'founder@example.test' },
    playerId: 'player-1',
    club: { name: 'Founder FC', tag: 'FFC', platform: 'PlayStation', region: 'Europe', country_code: 'BE' },
    idempotencyKey: 'founder-key-1',
  });

  assert.equal(connection.committed, true);
  assert.equal(connection.rolledBack, false);
  assert.equal(result.club.president_player_id, 'player-1');
  assert.equal(result.player.club_id, result.club.id);
  assert.equal(result.player.status, 'active');
  assert.equal(result.contract.id, result.playerContract.id, 'legacy contract alias should point to player contract');
  assert.equal(result.playerContract.status, 'active');
  assert.equal(result.playerContract.contract_type, 'founder_player');
  assert.equal(result.playerContract.team_id, result.club.id);
  assert.equal(result.playerContract.user_id, 'player-1');
  assert.equal(result.presidentContract.status, 'active');
  assert.equal(result.presidentContract.contract_type, 'ownership');
  assert.equal(result.presidentContract.team_id, result.club.id);
  assert.equal(result.presidentContract.user_id, 'player-1');
  assert.deepEqual(result.contracts.map((contract) => contract.contract_type).sort(), ['founder_player', 'ownership']);
  assert.equal(result.membership.primary_role, 'president');
  assert.equal(connection.state.clubs.length, 1);
  assert.equal(connection.state.contracts.length, 2);
  assert.equal(connection.state.memberships.length, 1);
});

test('founder lifecycle rolls back when contract creation fails before attaching player', async () => {
  const connection = makeConnection({ failOnSql: /INSERT INTO player_contracts/ });
  const { createFounderContractLifecycle } = loadFounderServiceWithConnection(connection);

  await assert.rejects(
    () => createFounderContractLifecycle({
      user: { id: 'user-1', email: 'founder@example.test' },
      playerId: 'player-1',
      club: { name: 'Founder FC', tag: 'FFC' },
    }),
    /Injected failure/
  );

  assert.equal(connection.committed, false);
  assert.equal(connection.rolledBack, true);
  assert.equal(connection.state.player.club_id, null);
});

test('founder lifecycle does not report success when membership attachment fails', async () => {
  const connection = makeConnection({ failOnSql: /INSERT INTO club_memberships/ });
  const { createFounderContractLifecycle } = loadFounderServiceWithConnection(connection);

  await assert.rejects(
    () => createFounderContractLifecycle({
      user: { id: 'user-1', email: 'founder@example.test' },
      playerId: 'player-1',
      club: { name: 'Founder FC', tag: 'FFC' },
    }),
    /Injected failure/
  );

  assert.equal(connection.committed, false);
  assert.equal(connection.rolledBack, true);
});

test('founder lifecycle retry reuses existing founder club and both founder contracts', async () => {
  const existingClub = {
    id: 'club-existing',
    user_id: 'user-1',
    president_user_id: 'user-1',
    president_player_id: 'player-1',
    owner_email: 'founder@example.test',
    name: 'Founder FC',
  };
  const existingPlayerContract = {
    id: 'contract-player-existing',
    team_id: 'club-existing',
    user_id: 'player-1',
    target_player_id: 'player-1',
    contract_type: 'founder_player',
    status: 'active',
    offer_note: 'Founder player contract: founder-key-1',
  };
  const existingPresidentContract = {
    id: 'contract-president-existing',
    team_id: 'club-existing',
    user_id: 'player-1',
    target_player_id: 'player-1',
    contract_type: 'ownership',
    status: 'active',
    offer_note: 'Founder president contract: founder-key-1',
  };
  const existingMembership = {
    id: 'membership-existing',
    club_id: 'club-existing',
    player_id: 'player-1',
    user_id: 'user-1',
    status: 'active',
    primary_role: 'president',
    source: 'founder_contract',
  };
  const connection = makeConnection({
    existing: {
      club: existingClub,
      contracts: [existingPlayerContract, existingPresidentContract],
      membership: existingMembership,
      player: {
        id: 'player-1',
        user_id: 'user-1',
        email: 'founder@example.test',
        club_id: 'club-existing',
        role: 'president',
        club_roles: JSON.stringify(['president', 'member']),
      },
    },
  });
  const { createFounderContractLifecycle } = loadFounderServiceWithConnection(connection);

  const result = await createFounderContractLifecycle({
    user: { id: 'user-1', email: 'founder@example.test' },
    playerId: 'player-1',
    club: { name: 'Founder FC', tag: 'FFC' },
    idempotencyKey: 'founder-key-1',
  });

  assert.equal(result.club.id, 'club-existing');
  assert.equal(result.contract.id, 'contract-player-existing');
  assert.equal(result.playerContract.id, 'contract-player-existing');
  assert.equal(result.presidentContract.id, 'contract-president-existing');
  assert.deepEqual(result.contracts.map((contract) => contract.id).sort(), ['contract-player-existing', 'contract-president-existing']);
  assert.equal(result.membership.id, 'membership-existing');
  assert.equal(connection.state.clubs.length, 1);
  assert.equal(connection.state.contracts.length, 2);
});

test('founder lifecycle retry treats legacy founder contract as player-side founder contract and creates ownership contract', async () => {
  const existingClub = {
    id: 'club-existing',
    user_id: 'user-1',
    president_user_id: 'user-1',
    president_player_id: 'player-1',
    owner_email: 'founder@example.test',
    name: 'Founder FC',
  };
  const legacyFounderContract = {
    id: 'contract-legacy-founder',
    team_id: 'club-existing',
    user_id: 'player-1',
    target_player_id: 'player-1',
    contract_type: 'founder',
    status: 'active',
    offer_note: 'Founder contract: founder-key-1',
  };
  const connection = makeConnection({
    existing: {
      club: existingClub,
      contracts: [legacyFounderContract],
      player: {
        id: 'player-1',
        user_id: 'user-1',
        email: 'founder@example.test',
        club_id: 'club-existing',
        role: 'president',
        club_roles: JSON.stringify(['president', 'member']),
      },
    },
  });
  const { createFounderContractLifecycle } = loadFounderServiceWithConnection(connection);

  const result = await createFounderContractLifecycle({
    user: { id: 'user-1', email: 'founder@example.test' },
    playerId: 'player-1',
    club: { name: 'Founder FC', tag: 'FFC' },
    idempotencyKey: 'founder-key-1',
  });

  assert.equal(result.playerContract.id, 'contract-legacy-founder');
  assert.equal(result.playerContract.contract_type, 'founder');
  assert.equal(result.presidentContract.contract_type, 'ownership');
  assert.equal(connection.state.contracts.length, 2);
});

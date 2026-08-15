const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const LIVE_LOAN_STATUSES = ['PROPOSED', 'AWAITING_PLAYER', 'PENDING_WINDOW', 'ACTIVE'];

function defaultContract(overrides = {}) {
  return {
    id: 'contract-1',
    user_id: 'player-1',
    team_id: 'club-a',
    status: 'active',
    contract_type: 'squad',
    end_date: '2028-06-30',
    ...overrides,
  };
}

function defaultPlayer(overrides = {}) {
  return {
    id: 'player-1',
    club_id: 'club-a',
    email: 'player@example.test',
    gamertag: 'Player X',
    ...overrides,
  };
}

function createHarness({ player, contracts, loans = [] } = {}) {
  const state = {
    player: player || defaultPlayer(),
    contracts: contracts || [defaultContract()],
    loans: loans.map((loan) => ({ ...loan })),
  };
  const deliveries = [];

  async function query(sql, params = []) {
    const text = String(sql);
    if (/FROM players\s+WHERE id = \?/.test(text)) {
      return state.player?.id === params[0] ? [state.player] : [];
    }
    if (/FROM player_contracts/.test(text) && /user_id = \?/.test(text)) {
      return state.contracts.filter((contract) => (
        contract.user_id === params[0]
        && contract.status === 'active'
        && contract.contract_type !== 'ownership'
      ));
    }
    if (/FROM player_loans/.test(text) && /player_id = \?/.test(text) && /status IN/.test(text)) {
      return state.loans.filter((loan) => (
        loan.player_id === params[0] && LIVE_LOAN_STATUSES.includes(loan.status)
      ));
    }
    if (/INSERT INTO player_loans/.test(text)) {
      const loan = {
        id: params[0],
        player_id: params[1],
        contract_id: params[2],
        parent_club_id: params[3],
        loan_club_id: params[4],
        start_date: params[5],
        end_date: params[6],
        loan_fee_stc: params[7],
        parent_wage_percentage: params[8],
        loan_wage_percentage: params[9],
        status: params[10],
        proposed_by_club_id: params[11],
      };
      state.loans.push(loan);
      return { affectedRows: 1 };
    }
    if (/FROM player_loans\s+WHERE id = \?/.test(text)) {
      return state.loans.filter((loan) => loan.id === params[0]);
    }
    if (/UPDATE player_loans\s+SET status = \?/.test(text)) {
      const loan = state.loans.find((row) => row.id === params[1]);
      if (loan) loan.status = params[0];
      return { affectedRows: loan ? 1 : 0 };
    }
    throw new Error(`Unexpected SQL: ${text}`);
  }

  async function deliverParentProposal(loan) {
    deliveries.push(loan);
  }

  return { state, query, deliverParentProposal, deliveries };
}

function loadService() {
  const servicePath = path.resolve(__dirname, '../playerLoanService.js');
  const dbPath = path.resolve(__dirname, '../../db/database.js');
  delete require.cache[servicePath];
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { EXECUTESQL: async () => { throw new Error('use injected query'); } },
  };
  delete require.cache[servicePath];
  return require(servicePath);
}

function validProposal(overrides = {}) {
  return {
    playerId: 'player-1',
    loanClubId: 'club-b',
    proposedByClubId: 'club-b',
    startDate: '2027-01-01',
    endDate: '2027-06-30',
    loanFeeStc: 25000,
    parentWagePercentage: 30,
    loanWagePercentage: 70,
    ...overrides,
  };
}

async function assertLoanError(fn, code) {
  await assert.rejects(fn, (err) => {
    assert.equal(err.code, code);
    return true;
  });
}

test('Club B can propose a loan for a player with an active player-group contract at Club A', async () => {
  const harness = createHarness();
  const { proposeLoan } = loadService();

  const loan = await proposeLoan(validProposal(), {
    query: harness.query,
    deliverParentProposal: harness.deliverParentProposal,
  });

  assert.equal(loan.status, 'PROPOSED');
  assert.equal(loan.player_id, 'player-1');
  assert.equal(loan.contract_id, 'contract-1');
  assert.equal(loan.parent_club_id, 'club-a');
  assert.equal(loan.loan_club_id, 'club-b');
  assert.equal(loan.loan_fee_stc, 25000);
  assert.equal(loan.parent_wage_percentage, 30);
  assert.equal(loan.loan_wage_percentage, 70);
  assert.equal(harness.state.player.club_id, 'club-a');
  assert.equal(harness.deliveries.length, 1);
  assert.equal(harness.deliveries[0].id, loan.id);
});

test('a player without an active player-group contract cannot be loaned', async () => {
  const harness = createHarness({ contracts: [] });
  const { proposeLoan } = loadService();

  await assertLoanError(
    () => proposeLoan(validProposal(), {
      query: harness.query,
      deliverParentProposal: harness.deliverParentProposal,
    }),
    'LOAN_NOT_ALLOWED',
  );
  assert.equal(harness.state.loans.length, 0);
  assert.equal(harness.deliveries.length, 0);
});

test('a club cannot loan a player to itself', async () => {
  const harness = createHarness();
  const { proposeLoan } = loadService();

  await assertLoanError(
    () => proposeLoan(validProposal({ loanClubId: 'club-a', proposedByClubId: 'club-a' }), {
      query: harness.query,
      deliverParentProposal: harness.deliverParentProposal,
    }),
    'LOAN_SAME_CLUB',
  );
  assert.equal(harness.state.loans.length, 0);
});

test('a loan cannot end after the parent contract', async () => {
  const harness = createHarness();
  const { proposeLoan } = loadService();

  await assertLoanError(
    () => proposeLoan(validProposal({ endDate: '2029-01-01' }), {
      query: harness.query,
      deliverParentProposal: harness.deliverParentProposal,
    }),
    'LOAN_BEYOND_CONTRACT',
  );
  assert.equal(harness.state.loans.length, 0);
});

test('wage percentages must add up to 100', async () => {
  const harness = createHarness();
  const { proposeLoan } = loadService();

  await assertLoanError(
    () => proposeLoan(validProposal({ parentWagePercentage: 40, loanWagePercentage: 40 }), {
      query: harness.query,
      deliverParentProposal: harness.deliverParentProposal,
    }),
    'LOAN_WAGE_SPLIT_INVALID',
  );
  assert.equal(harness.state.loans.length, 0);
});

test('a second live loan for the same player is refused', async () => {
  const harness = createHarness({
    loans: [{
      id: 'loan-existing',
      player_id: 'player-1',
      status: 'PROPOSED',
      parent_club_id: 'club-a',
      loan_club_id: 'club-c',
    }],
  });
  const { proposeLoan } = loadService();

  await assertLoanError(
    () => proposeLoan(validProposal(), {
      query: harness.query,
      deliverParentProposal: harness.deliverParentProposal,
    }),
    'LOAN_ALREADY_LIVE',
  );
  assert.equal(harness.state.loans.length, 1);
  assert.equal(harness.deliveries.length, 0);
});

test('the parent club can reject a proposal without moving the player or spending STC', async () => {
  const harness = createHarness();
  const { proposeLoan, rejectLoanByParent } = loadService();
  const proposed = await proposeLoan(validProposal(), {
    query: harness.query,
    deliverParentProposal: harness.deliverParentProposal,
  });
  harness.state.clubs = { 'club-a': { stc: 80000 }, 'club-b': { stc: 50000 } };

  const rejected = await rejectLoanByParent({
    loanId: proposed.id,
    actorClubId: 'club-a',
  }, { query: harness.query });

  assert.equal(rejected.status, 'REJECTED');
  assert.equal(harness.state.player.club_id, 'club-a');
  assert.equal(harness.state.contracts[0].status, 'active');
  assert.equal(harness.state.clubs['club-a'].stc, 80000);
  assert.equal(harness.state.clubs['club-b'].stc, 50000);
});

test('only the parent club can reject a proposed loan', async () => {
  const harness = createHarness();
  const { proposeLoan, rejectLoanByParent } = loadService();
  const proposed = await proposeLoan(validProposal(), {
    query: harness.query,
    deliverParentProposal: harness.deliverParentProposal,
  });

  await assertLoanError(
    () => rejectLoanByParent({
      loanId: proposed.id,
      actorClubId: 'club-b',
    }, { query: harness.query }),
    'LOAN_NOT_PARENT',
  );
  assert.equal(harness.state.loans[0].status, 'PROPOSED');
});

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

function createHarness({ player, contracts, loans = [], clubs, memberships, presidents } = {}) {
  const state = {
    player: { stc: 0, ...(player || defaultPlayer()) },
    contracts: contracts || [defaultContract()],
    loans: loans.map((loan) => ({ ...loan })),
    clubs: clubs || {
      'club-a': { id: 'club-a', name: 'Club A', stc: 80000 },
      'club-b': { id: 'club-b', name: 'Club B', stc: 50000 },
    },
    memberships: memberships || [{
      player_id: 'player-1',
      club_id: 'club-a',
      status: 'active',
      primary_role: 'president',
    }],
    presidents: presidents || [{
      club_id: 'club-a',
      player_id: 'player-1',
      user_id: 'user-1',
    }],
    transactions: [],
    inbox: [],
  };
  const deliveries = [];
  const playerOffers = [];

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
    if (/FROM player_loans/.test(text) && /PENDING_WINDOW/.test(text) && !/WHERE id =/.test(text)) {
      return state.loans.filter((loan) => loan.status === 'PENDING_WINDOW');
    }
    if (/FROM player_loans/.test(text) && /status = 'ACTIVE'/.test(text) && /parent_club_id = \?/.test(text)) {
      return state.loans
        .filter((loan) => loan.status === 'ACTIVE' && (loan.parent_club_id === params[0] || loan.loan_club_id === params[1] || loan.loan_club_id === params[0]))
        .map((loan) => {
          const contract = state.contracts.find((row) => row.id === loan.contract_id) || {};
          return { ...loan, weekly_salary_stc: contract.weekly_salary_stc || 0 };
        });
    }
    if (/FROM player_loans/.test(text) && /player_id = \?/.test(text) && /status = 'ACTIVE'/.test(text)) {
      return state.loans.filter((loan) => loan.player_id === params[0] && loan.status === 'ACTIVE');
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
    if (/UPDATE player_loans/.test(text) && /SET/.test(text)) {
      const loan = state.loans.find((row) => row.id === params[params.length - 1]);
      if (!loan) return { affectedRows: 0 };
      const setPart = text.match(/SET\s+([\s\S]+?)\s+WHERE/i)?.[1] || '';
      const columns = [...setPart.matchAll(/(\w+)\s*=\s*\?/g)].map((match) => match[1]);
      columns.forEach((column, index) => {
        loan[column] = params[index];
      });
      return { affectedRows: 1 };
    }
    if (/FROM clubs\s+WHERE id = \?/.test(text)) {
      const club = state.clubs[params[0]];
      return club ? [club] : [];
    }
    if (/UPDATE clubs\s+SET stc = \?/.test(text)) {
      const club = state.clubs[params[params.length - 1]];
      if (club) club.stc = params[0];
      return { affectedRows: club ? 1 : 0 };
    }
    if (/INSERT INTO stc_transactions/.test(text)) {
      state.transactions.push({
        id: params[0],
        club_id: params[1],
        amount: params[2],
        balance_after: params[3],
        type: params[4],
        category: params[5],
        description: params[6],
        related_entity_type: params[7],
        related_entity_id: params[8],
        reference_id: params[9],
      });
      return { affectedRows: 1 };
    }
    if (/UPDATE inbox_messages/.test(text)) {
      state.inbox.push({ sql: text, params });
      return { affectedRows: 1 };
    }
    if (/FROM player_contracts/.test(text) && /id = \?/.test(text)) {
      return state.contracts.filter((contract) => contract.id === params[0]);
    }
    if (/UPDATE players\s+SET stc = \?/.test(text)) {
      if (state.player?.id === params[params.length - 1]) state.player.stc = params[0];
      return { affectedRows: 1 };
    }
    if (/INSERT INTO player_stc_transactions/.test(text)) {
      state.transactions.push({
        id: params[0],
        player_id: params[1],
        amount: params[2],
        category: params[5] || params[4],
      });
      return { affectedRows: 1 };
    }
    throw new Error(`Unexpected SQL: ${text}`);
  }

  async function deliverParentProposal(loan) {
    deliveries.push(loan);
  }

  async function deliverPlayerOffer(loan) {
    playerOffers.push(loan);
  }

  async function withTransaction(work) {
    const snapshot = {
      player: { ...state.player },
      contracts: state.contracts.map((row) => ({ ...row })),
      loans: state.loans.map((row) => ({ ...row })),
      clubs: Object.fromEntries(Object.entries(state.clubs).map(([id, club]) => [id, { ...club }])),
      memberships: state.memberships.map((row) => ({ ...row })),
      presidents: state.presidents.map((row) => ({ ...row })),
      transactions: state.transactions.map((row) => ({ ...row })),
    };
    try {
      return await work(query);
    } catch (err) {
      state.player = snapshot.player;
      state.contracts.splice(0, state.contracts.length, ...snapshot.contracts);
      state.loans.splice(0, state.loans.length, ...snapshot.loans);
      Object.keys(state.clubs).forEach((id) => { delete state.clubs[id]; });
      Object.assign(state.clubs, snapshot.clubs);
      state.memberships.splice(0, state.memberships.length, ...snapshot.memberships);
      state.presidents.splice(0, state.presidents.length, ...snapshot.presidents);
      state.transactions.splice(0, state.transactions.length, ...snapshot.transactions);
      throw err;
    }
  }

  return {
    state,
    query,
    withTransaction,
    deliverParentProposal,
    deliverPlayerOffer,
    deliveries,
    playerOffers,
  };
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

function loanDeps(harness, extras = {}) {
  return {
    query: harness.query,
    withTransaction: harness.withTransaction,
    deliverParentProposal: harness.deliverParentProposal,
    deliverPlayerOffer: harness.deliverPlayerOffer,
    isWindowOpen: async () => true,
    ...extras,
  };
}

async function proposeAcceptedByParent(harness, extras = {}) {
  const service = loadService();
  const proposed = await service.proposeLoan(validProposal(), loanDeps(harness, extras));
  const awaiting = await service.acceptLoanByParent({
    loanId: proposed.id,
    actorClubId: 'club-a',
  }, loanDeps(harness, extras));
  return { service, proposed, awaiting };
}

test('parent accept asks the player and does not move ownership', async () => {
  const harness = createHarness();
  const { awaiting } = await proposeAcceptedByParent(harness);

  assert.equal(awaiting.status, 'AWAITING_PLAYER');
  assert.ok(awaiting.parent_accepted_at);
  assert.equal(harness.playerOffers.length, 1);
  assert.equal(harness.playerOffers[0].id, awaiting.id);
  assert.equal(harness.playerOffers[0].parent_club_id, 'club-a');
  assert.equal(harness.playerOffers[0].loan_club_id, 'club-b');
  assert.equal(harness.playerOffers[0].start_date, '2027-01-01');
  assert.equal(harness.playerOffers[0].end_date, '2027-06-30');
  assert.equal(harness.playerOffers[0].loan_fee_stc, 25000);
  assert.equal(harness.playerOffers[0].parent_wage_percentage, 30);
  assert.equal(harness.playerOffers[0].loan_wage_percentage, 70);
  assert.equal(harness.state.player.club_id, 'club-a');
  assert.equal(harness.state.contracts[0].status, 'active');
  assert.equal(harness.state.clubs['club-a'].stc, 80000);
  assert.equal(harness.state.clubs['club-b'].stc, 50000);
});

test('only the parent club can accept a proposed loan', async () => {
  const harness = createHarness();
  const { proposeLoan, acceptLoanByParent } = loadService();
  const proposed = await proposeLoan(validProposal(), loanDeps(harness));

  await assertLoanError(
    () => acceptLoanByParent({
      loanId: proposed.id,
      actorClubId: 'club-b',
    }, loanDeps(harness)),
    'LOAN_NOT_PARENT',
  );
  assert.equal(harness.state.loans[0].status, 'PROPOSED');
  assert.equal(harness.playerOffers.length, 0);
});

test('the player can reject after both clubs agreed without moving registration', async () => {
  const harness = createHarness();
  const { service, awaiting } = await proposeAcceptedByParent(harness);

  const rejected = await service.rejectLoanByPlayer({
    loanId: awaiting.id,
    actorPlayerId: 'player-1',
  }, loanDeps(harness));

  assert.equal(rejected.status, 'REJECTED');
  assert.equal(harness.state.player.club_id, 'club-a');
  assert.equal(harness.state.contracts[0].status, 'active');
  assert.equal(harness.state.memberships[0].club_id, 'club-a');
  assert.equal(harness.state.presidents[0].club_id, 'club-a');
  assert.equal(harness.state.clubs['club-a'].stc, 80000);
  assert.equal(harness.state.clubs['club-b'].stc, 50000);
  assert.equal(harness.state.transactions.length, 0);
});

test('only the loaned player can accept or reject the player step', async () => {
  const harness = createHarness();
  const { service, awaiting } = await proposeAcceptedByParent(harness);

  await assertLoanError(
    () => service.rejectLoanByPlayer({
      loanId: awaiting.id,
      actorPlayerId: 'player-other',
    }, loanDeps(harness)),
    'LOAN_NOT_PLAYER',
  );
  await assertLoanError(
    () => service.acceptLoanByPlayer({
      loanId: awaiting.id,
      actorPlayerId: 'player-other',
    }, loanDeps(harness)),
    'LOAN_NOT_PLAYER',
  );
  assert.equal(harness.state.loans[0].status, 'AWAITING_PLAYER');
});

test('player accept with an open window activates the loan and settles the fee without a transfer', async () => {
  const harness = createHarness();
  const { service, awaiting } = await proposeAcceptedByParent(harness);

  const activated = await service.acceptLoanByPlayer({
    loanId: awaiting.id,
    actorPlayerId: 'player-1',
  }, loanDeps(harness));

  assert.equal(activated.status, 'ACTIVE');
  assert.ok(activated.player_accepted_at);
  assert.ok(activated.activated_at);
  assert.equal(harness.state.player.club_id, 'club-a');
  assert.equal(harness.state.contracts[0].status, 'active');
  assert.equal(harness.state.contracts[0].team_id, 'club-a');
  assert.equal(harness.state.memberships[0].club_id, 'club-a');
  assert.equal(harness.state.memberships[0].primary_role, 'president');
  assert.equal(harness.state.presidents[0].player_id, 'player-1');
  assert.equal(harness.state.clubs['club-b'].stc, 25000);
  assert.equal(harness.state.clubs['club-a'].stc, 105000);
  assert.equal(harness.state.transactions.length, 2);
  assert.equal(harness.state.transactions[0].club_id, 'club-b');
  assert.equal(harness.state.transactions[0].amount, -25000);
  assert.equal(harness.state.transactions[1].club_id, 'club-a');
  assert.equal(harness.state.transactions[1].amount, 25000);
});

test('player accept with a closed window queues the loan and does not take the fee yet', async () => {
  const harness = createHarness();
  const { service, awaiting } = await proposeAcceptedByParent(harness, {
    isWindowOpen: async () => false,
  });

  const queued = await service.acceptLoanByPlayer({
    loanId: awaiting.id,
    actorPlayerId: 'player-1',
  }, loanDeps(harness, { isWindowOpen: async () => false }));

  assert.equal(queued.status, 'PENDING_WINDOW');
  assert.ok(queued.player_accepted_at);
  assert.equal(queued.activated_at, undefined);
  assert.equal(harness.state.player.club_id, 'club-a');
  assert.equal(harness.state.contracts[0].status, 'active');
  assert.equal(harness.state.clubs['club-a'].stc, 80000);
  assert.equal(harness.state.clubs['club-b'].stc, 50000);
  assert.equal(harness.state.transactions.length, 0);
});

test('execute-pending activates a window-queued loan and then settles the fee', async () => {
  const harness = createHarness();
  const { service, awaiting } = await proposeAcceptedByParent(harness, {
    isWindowOpen: async () => false,
  });
  await service.acceptLoanByPlayer({
    loanId: awaiting.id,
    actorPlayerId: 'player-1',
  }, loanDeps(harness, { isWindowOpen: async () => false }));

  const result = await service.activatePendingWindowLoans(loanDeps(harness));

  assert.equal(result.activated, 1);
  assert.equal(harness.state.loans[0].status, 'ACTIVE');
  assert.ok(harness.state.loans[0].activated_at);
  assert.equal(harness.state.player.club_id, 'club-a');
  assert.equal(harness.state.contracts[0].status, 'active');
  assert.equal(harness.state.memberships[0].club_id, 'club-a');
  assert.equal(harness.state.clubs['club-b'].stc, 25000);
  assert.equal(harness.state.clubs['club-a'].stc, 105000);
});

test('activation fails closed when the loan club cannot pay the fee', async () => {
  const harness = createHarness({
    clubs: {
      'club-a': { id: 'club-a', name: 'Club A', stc: 80000 },
      'club-b': { id: 'club-b', name: 'Club B', stc: 1000 },
    },
  });
  const { service, awaiting } = await proposeAcceptedByParent(harness);

  await assertLoanError(
    () => service.acceptLoanByPlayer({
      loanId: awaiting.id,
      actorPlayerId: 'player-1',
    }, loanDeps(harness)),
    'LOAN_INSUFFICIENT_STC',
  );

  assert.equal(harness.state.loans[0].status, 'AWAITING_PLAYER');
  assert.equal(harness.state.player.club_id, 'club-a');
  assert.equal(harness.state.contracts[0].status, 'active');
  assert.equal(harness.state.clubs['club-a'].stc, 80000);
  assert.equal(harness.state.clubs['club-b'].stc, 1000);
  assert.equal(harness.state.transactions.length, 0);
});

test('either party club can cancel before activation without changing registration', async () => {
  const harness = createHarness();
  const { service, awaiting } = await proposeAcceptedByParent(harness);

  const cancelled = await service.cancelLoan({
    loanId: awaiting.id,
    actorClubId: 'club-b',
  }, loanDeps(harness));

  assert.equal(cancelled.status, 'CANCELLED');
  assert.equal(harness.state.player.club_id, 'club-a');
  assert.equal(harness.state.contracts[0].status, 'active');
  assert.equal(harness.state.memberships[0].club_id, 'club-a');
  assert.equal(harness.state.clubs['club-a'].stc, 80000);
  assert.equal(harness.state.clubs['club-b'].stc, 50000);
});

test('a third club cannot cancel a live proposal', async () => {
  const harness = createHarness();
  const { service, awaiting } = await proposeAcceptedByParent(harness);

  await assertLoanError(
    () => service.cancelLoan({
      loanId: awaiting.id,
      actorClubId: 'club-c',
    }, loanDeps(harness)),
    'LOAN_NOT_BORROWER',
  );
  assert.equal(harness.state.loans[0].status, 'AWAITING_PLAYER');
});

function activeLoanFixture(overrides = {}) {
  return {
    id: 'loan-active',
    player_id: 'player-1',
    contract_id: 'contract-1',
    parent_club_id: 'club-a',
    loan_club_id: 'club-b',
    start_date: '2027-01-01',
    end_date: '2027-06-30',
    loan_fee_stc: 25000,
    parent_wage_percentage: 30,
    loan_wage_percentage: 70,
    status: 'ACTIVE',
    ...overrides,
  };
}

test('an active loan makes the borrower the playing club and blocks the owner from selecting', async () => {
  const harness = createHarness({
    contracts: [defaultContract({ weekly_salary_stc: 10000 })],
    loans: [activeLoanFixture()],
  });
  const service = loadService();

  const registration = await service.getPlayingRegistration('player-1', loanDeps(harness));
  assert.equal(registration.owner_club_id, 'club-a');
  assert.equal(registration.playing_club_id, 'club-b');
  assert.equal(registration.selectable_for['club-b'], true);
  assert.equal(registration.selectable_for['club-a'], false);

  await assertLoanError(
    () => service.assertPlayerEligibleForClub({ playerId: 'player-1', clubId: 'club-a' }, loanDeps(harness)),
    'LOAN_PLAYER_NOT_ELIGIBLE',
  );
  await service.assertPlayerEligibleForClub({ playerId: 'player-1', clubId: 'club-b' }, loanDeps(harness));
  assert.equal(harness.state.presidents[0].club_id, 'club-a');
});

test('squad view badges the loanee at the borrower and lists them as on loan at the owner', async () => {
  const harness = createHarness({
    contracts: [defaultContract({ weekly_salary_stc: 10000 })],
    loans: [activeLoanFixture()],
  });
  const service = loadService();

  const borrower = await service.getSquadLoanView('club-b', loanDeps(harness));
  assert.deepEqual(borrower.incoming_player_ids, ['player-1']);
  assert.equal(borrower.annotations['player-1'].loan_badge, 'LOAN');
  assert.equal(borrower.annotations['player-1'].selectable, true);
  assert.equal(borrower.annotations['player-1'].loan_from_club_id, 'club-a');

  const owner = await service.getSquadLoanView('club-a', loanDeps(harness));
  assert.equal(owner.annotations['player-1'].loan_status, 'loaned_out');
  assert.equal(owner.annotations['player-1'].selectable, false);
  assert.equal(owner.annotations['player-1'].on_loan_club_id, 'club-b');
  assert.equal(owner.annotations['player-1'].loan_end_date, '2027-06-30');
});

test('lineup persistence refuses a player whose playing club is not the lineup club', async () => {
  const harness = createHarness({ loans: [activeLoanFixture()] });
  const service = loadService();

  await assertLoanError(
    () => service.assertLineupEligibleForClub('club-a', {
      starting_players: ['player-1'],
    }, loanDeps(harness)),
    'LOAN_PLAYER_NOT_ELIGIBLE',
  );
  await service.assertLineupEligibleForClub('club-b', {
    starting_players: ['player-1'],
    bench_players: [],
  }, loanDeps(harness));
});

test('a 30/70 wage split debits both clubs and credits the player for the full weekly salary', async () => {
  const harness = createHarness({
    contracts: [defaultContract({ weekly_salary_stc: 10000 })],
    loans: [activeLoanFixture()],
    clubs: {
      'club-a': { id: 'club-a', name: 'Club A', stc: 80000 },
      'club-b': { id: 'club-b', name: 'Club B', stc: 50000 },
    },
  });
  const service = loadService();
  const shares = service.getWageSplitAmounts({
    weeklySalary: 10000,
    loan: activeLoanFixture(),
    parentClubId: 'club-a',
  });
  assert.deepEqual(shares, [
    { clubId: 'club-a', amount: 3000, role: 'owner' },
    { clubId: 'club-b', amount: 7000, role: 'borrower' },
  ]);

  const paid = await service.paySplitWeeklySalary({
    contract: defaultContract({ weekly_salary_stc: 10000 }),
    weeklySalary: 10000,
  }, loanDeps(harness));

  assert.equal(paid.player_received, 10000);
  assert.equal(harness.state.clubs['club-a'].stc, 77000);
  assert.equal(harness.state.clubs['club-b'].stc, 43000);
  assert.equal(harness.state.player.stc, 10000);
  assert.equal(harness.state.loans[0].status, 'ACTIVE');
});

test('0/100 and 100/0 wage splits charge only the paying club', async () => {
  const service = loadService();
  assert.deepEqual(service.getWageSplitAmounts({
    weeklySalary: 8000,
    loan: activeLoanFixture({ parent_wage_percentage: 0, loan_wage_percentage: 100 }),
    parentClubId: 'club-a',
  }), [{ clubId: 'club-b', amount: 8000, role: 'borrower' }]);
  assert.deepEqual(service.getWageSplitAmounts({
    weeklySalary: 8000,
    loan: activeLoanFixture({ parent_wage_percentage: 100, loan_wage_percentage: 0 }),
    parentClubId: 'club-a',
  }), [{ clubId: 'club-a', amount: 8000, role: 'owner' }]);
});

test('a club wage shortfall does not charge the other club and the loan stays active', async () => {
  const harness = createHarness({
    contracts: [defaultContract({ weekly_salary_stc: 10000 })],
    loans: [activeLoanFixture()],
    clubs: {
      'club-a': { id: 'club-a', name: 'Club A', stc: 80000 },
      'club-b': { id: 'club-b', name: 'Club B', stc: 1000 },
    },
  });
  const service = loadService();
  const paid = await service.paySplitWeeklySalary({
    contract: defaultContract({ weekly_salary_stc: 10000 }),
    weeklySalary: 10000,
  }, loanDeps(harness));

  assert.equal(paid.player_received, 4000);
  assert.equal(harness.state.clubs['club-a'].stc, 77000);
  assert.equal(harness.state.clubs['club-b'].stc, 0);
  assert.equal(harness.state.loans[0].status, 'ACTIVE');
});

test('owner wage usage uses the parent share and the borrower uses the loan share', async () => {
  const harness = createHarness({
    contracts: [defaultContract({ weekly_salary_stc: 10000 })],
    loans: [activeLoanFixture()],
  });
  const service = loadService();

  const owner = await service.getClubLoanWageDelta('club-a', loanDeps(harness));
  const borrower = await service.getClubLoanWageDelta('club-b', loanDeps(harness));
  assert.equal(owner.active_weekly_delta, -7000);
  assert.equal(borrower.active_weekly_delta, 7000);
});

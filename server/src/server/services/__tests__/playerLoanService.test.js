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
  const recallNotices = [];
  const earlyEndRequests = [];
  const earlyEndNotices = [];
  const purchaseOffers = [];

  async function query(sql, params = []) {
    const text = String(sql);
    if (/FROM players\s+WHERE id = \?/.test(text)) {
      return state.player?.id === params[0] ? [state.player] : [];
    }
    if (/FROM players\s+WHERE id IN \(/.test(text)) {
      return params.includes(state.player?.id) ? [state.player] : [];
    }
    if (/FROM player_loans/.test(text) && /player_id IN \(/.test(text)) {
      return state.loans.filter((loan) => (
        loan.status === 'ACTIVE' && params.includes(loan.player_id)
      ));
    }
    if (/FROM player_contracts/.test(text) && /user_id = \?/.test(text) && /id <> \?/.test(text)) {
      const live = ['active', 'pending', 'pending_window', 'negotiating'];
      return state.contracts.filter((contract) => (
        contract.user_id === params[0]
        && contract.id !== params[1]
        && live.includes(contract.status)
        && contract.contract_type !== 'ownership'
      ));
    }
    if (/FROM player_contracts/.test(text) && /user_id = \?/.test(text)) {
      return state.contracts.filter((contract) => (
        contract.user_id === params[0]
        && contract.status === 'active'
        && contract.contract_type !== 'ownership'
      ));
    }
    if (/INSERT INTO player_contracts/.test(text)) {
      const colPart = text.match(/INSERT INTO player_contracts\s*\(([\s\S]*?)\)/i)?.[1] || '';
      const columns = colPart.split(',').map((column) => column.trim()).filter(Boolean);
      const valuePart = text.match(/VALUES\s*\(([\s\S]*?)\)/i)?.[1] || '';
      const tokens = valuePart.split(',').map((token) => token.trim());
      const contract = { contract_type: 'squad', status: 'active' };
      let paramIndex = 0;
      columns.forEach((column, index) => {
        const token = tokens[index];
        if (token === '?') {
          contract[column] = params[paramIndex];
          paramIndex += 1;
        } else if (token && !/^NOW\(\)$/i.test(token)) {
          contract[column] = token.replace(/^'|'$/g, '');
        }
      });
      state.contracts.push(contract);
      return { affectedRows: 1 };
    }
    if (/UPDATE player_contracts/.test(text) && /id IN \(/.test(text)) {
      const cancelling = /'cancelled'/.test(text);
      const teamId = cancelling ? null : params[0];
      const ids = cancelling ? params : params.slice(1);
      for (const contract of state.contracts) {
        if (!ids.includes(contract.id)) continue;
        contract.status = cancelling
          ? 'cancelled'
          : (contract.team_id === teamId ? 'completed' : 'terminated');
      }
      return { affectedRows: ids.length };
    }
    if (/FROM player_loans/.test(text) && /purchase_offer_status = 'PENDING_WINDOW'/.test(text)) {
      return state.loans.filter((loan) => (
        loan.status === 'ACTIVE' && loan.purchase_offer_status === 'PENDING_WINDOW'
      ));
    }
    if (/FROM player_loans/.test(text) && /PENDING_WINDOW/.test(text) && !/WHERE id =/.test(text)) {
      return state.loans.filter((loan) => loan.status === 'PENDING_WINDOW');
    }
    if (/FROM player_loans/.test(text) && /status = 'ACTIVE'/.test(text) && /end_date/.test(text) && !/parent_club_id/.test(text) && !/player_id = \?/.test(text)) {
      return state.loans.filter((loan) => loan.status === 'ACTIVE' && loan.end_date);
    }
    if (/FROM player_loans/.test(text) && /status = 'ACTIVE'/.test(text) && /id <> \?/.test(text)) {
      return state.loans.filter((loan) => (
        loan.player_id === params[0] && loan.status === 'ACTIVE' && loan.id !== params[1]
      ));
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
      const colPart = text.match(/INSERT INTO player_loans\s*\(([^)]+)\)/i)?.[1] || '';
      const columns = colPart.split(',').map((column) => column.trim()).filter(Boolean);
      const loan = {
        purchase_type: 'NONE',
        purchase_option_stc: 0,
        purchase_option_deadline: null,
      };
      columns.forEach((column, index) => {
        loan[column] = params[index];
      });
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
    if (/UPDATE players\s+SET club_id = \?/.test(text)) {
      if (state.player?.id === params[params.length - 1]) {
        state.player.club_id = params[0];
        state.player.club_roles = params[1];
        state.player.role = 'member';
      }
      return { affectedRows: 1 };
    }
    if (/UPDATE notifications/.test(text)) {
      return { affectedRows: 0 };
    }
    if (/DELETE FROM club_memberships/.test(text)) {
      const kept = state.memberships.filter((row) => !(
        row.player_id === params[0]
        && row.status !== 'active'
        && (params.length < 2 || row.club_id !== params[1])
      ));
      state.memberships.splice(0, state.memberships.length, ...kept);
      return { affectedRows: 1 };
    }
    if (/UPDATE club_memberships/.test(text) && /SET status = \?/.test(text)) {
      for (const row of state.memberships) {
        if (row.player_id !== params[1] || row.status !== 'active') continue;
        if (params.length > 2 && row.club_id === params[2]) continue;
        row.status = params[0];
      }
      return { affectedRows: 1 };
    }
    if (/FROM club_memberships/.test(text)) {
      return state.memberships.filter((row) => (
        row.club_id === params[0] && row.player_id === params[1] && row.status === 'active'
      ));
    }
    if (/UPDATE club_memberships/.test(text)) {
      const row = state.memberships.find((entry) => entry.id === params[params.length - 1]);
      if (row) {
        row.primary_role = params[1];
        row.source = params[2];
      }
      return { affectedRows: row ? 1 : 0 };
    }
    if (/INSERT INTO club_memberships/.test(text)) {
      state.memberships.push({
        id: params[0],
        club_id: params[1],
        player_id: params[2],
        user_id: params[3],
        status: 'active',
        primary_role: params[4],
        source: params[5],
      });
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

  async function deliverRecallNotice(loan) {
    recallNotices.push(loan);
  }

  async function deliverEarlyEndRequest(loan) {
    earlyEndRequests.push(loan);
  }

  async function deliverEarlyEndNotice(loan) {
    earlyEndNotices.push(loan);
  }

  async function deliverPurchaseOffer(loan) {
    purchaseOffers.push(loan);
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
    deliverRecallNotice,
    deliverEarlyEndRequest,
    deliverEarlyEndNotice,
    deliverPurchaseOffer,
    deliveries,
    playerOffers,
    recallNotices,
    earlyEndRequests,
    earlyEndNotices,
    purchaseOffers,
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
    deliverRecallNotice: harness.deliverRecallNotice,
    deliverEarlyEndRequest: harness.deliverEarlyEndRequest,
    deliverEarlyEndNotice: harness.deliverEarlyEndNotice,
    deliverPurchaseOffer: harness.deliverPurchaseOffer,
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
    purchase_type: 'NONE',
    purchase_option_stc: 0,
    purchase_option_deadline: null,
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

test('completing a due loan returns playing rights to the owner without rewriting club_id', async () => {
  const harness = createHarness({
    loans: [activeLoanFixture({ end_date: '2026-01-01' })],
  });
  const service = loadService();

  const result = await service.completeDueLoans(loanDeps(harness));
  assert.equal(result.completed, 1);
  assert.equal(harness.state.loans[0].status, 'COMPLETED');
  assert.ok(harness.state.loans[0].completed_at);
  assert.equal(harness.state.player.club_id, 'club-a');
  assert.equal(harness.state.contracts[0].status, 'active');

  const registration = await service.getPlayingRegistration('player-1', loanDeps(harness));
  assert.equal(registration.playing_club_id, 'club-a');
  await service.assertPlayerEligibleForClub({ playerId: 'player-1', clubId: 'club-a' }, loanDeps(harness));
  await assertLoanError(
    () => service.assertPlayerEligibleForClub({ playerId: 'player-1', clubId: 'club-b' }, loanDeps(harness)),
    'LOAN_PLAYER_NOT_ELIGIBLE',
  );
});

test('two activation attempts for the same player leave only one ACTIVE loan', async () => {
  const first = activeLoanFixture({
    id: 'loan-one',
    status: 'PENDING_WINDOW',
    loan_fee_stc: 0,
  });
  const second = activeLoanFixture({
    id: 'loan-two',
    status: 'PENDING_WINDOW',
    loan_fee_stc: 0,
    loan_club_id: 'club-c',
  });
  const harness = createHarness({
    loans: [first, second],
    clubs: {
      'club-a': { id: 'club-a', name: 'Club A', stc: 80000 },
      'club-b': { id: 'club-b', name: 'Club B', stc: 50000 },
      'club-c': { id: 'club-c', name: 'Club C', stc: 50000 },
    },
  });
  const service = loadService();

  const activated = await service.activateLoan({ loanId: 'loan-one' }, loanDeps(harness));
  assert.equal(activated.status, 'ACTIVE');
  await assertLoanError(
    () => service.activateLoan({ loanId: 'loan-two' }, loanDeps(harness)),
    'LOAN_ALREADY_LIVE',
  );
  assert.equal(harness.state.loans.filter((loan) => loan.status === 'ACTIVE').length, 1);
  assert.equal(harness.state.loans.find((loan) => loan.id === 'loan-two').status, 'PENDING_WINDOW');
  assert.equal(harness.state.player.club_id, 'club-a');
});

test('a live loan blocks a permanent player-group contract accept', async () => {
  const harness = createHarness({ loans: [activeLoanFixture()] });
  const service = loadService();

  await assertLoanError(
    () => service.assertNoLiveLoanForTransfer({
      playerId: 'player-1',
      contractType: 'squad',
    }, loanDeps(harness)),
    'LOAN_TRANSFER_CONFLICT',
  );
  await service.assertNoLiveLoanForTransfer({
    playerId: 'player-1',
    contractType: 'ownership',
  }, loanDeps(harness));
});

test('players with no live loan are not blocked from a permanent accept', async () => {
  const harness = createHarness({ loans: [] });
  const service = loadService();
  await service.assertNoLiveLoanForTransfer({
    playerId: 'player-1',
    contractType: 'squad',
  }, loanDeps(harness));
});

test('proposeLoan defaults recall_allowed true and recall_after_date null', async () => {
  const harness = createHarness();
  const { proposeLoan } = loadService();

  const loan = await proposeLoan(validProposal(), loanDeps(harness));

  assert.equal(Number(loan.recall_allowed), 1);
  assert.equal(loan.recall_after_date, null);
  assert.equal(Number(harness.state.loans[0].recall_allowed), 1);
  assert.equal(harness.state.loans[0].recall_after_date, null);
});

test('proposeLoan persists recall_allowed and recall_after_date when provided', async () => {
  const harness = createHarness();
  const { proposeLoan } = loadService();

  const loan = await proposeLoan(validProposal({
    recallAllowed: false,
    recallAfterDate: '2027-03-01',
  }), loanDeps(harness));

  assert.equal(Number(loan.recall_allowed), 0);
  assert.equal(loan.recall_after_date, '2027-03-01');
  assert.equal(Number(harness.state.loans[0].recall_allowed), 0);
  assert.equal(harness.state.loans[0].recall_after_date, '2027-03-01');
});

test('proposeLoan defaults omitted purchase terms to NONE, 0, and null', async () => {
  const harness = createHarness();
  const { proposeLoan } = loadService();

  const loan = await proposeLoan(validProposal(), loanDeps(harness));

  assert.equal(loan.purchase_type, 'NONE');
  assert.equal(loan.purchase_option_stc, 0);
  assert.equal(loan.purchase_option_deadline, null);
  assert.equal(harness.state.loans[0].purchase_type, 'NONE');
  assert.equal(Number(harness.state.loans[0].purchase_option_stc), 0);
  assert.equal(harness.state.loans[0].purchase_option_deadline, null);
});

test('proposeLoan persists OPTIONAL purchase type, price, and deadline', async () => {
  const harness = createHarness();
  const { proposeLoan } = loadService();

  const loan = await proposeLoan(validProposal({
    purchaseType: 'OPTIONAL',
    purchaseOptionStc: 100000,
    purchaseOptionDeadline: '2027-05-01',
  }), loanDeps(harness));

  assert.equal(loan.purchase_type, 'OPTIONAL');
  assert.equal(loan.purchase_option_stc, 100000);
  assert.equal(loan.purchase_option_deadline, '2027-05-01');
  assert.equal(harness.state.loans[0].purchase_type, 'OPTIONAL');
  assert.equal(Number(harness.state.loans[0].purchase_option_stc), 100000);
  assert.equal(harness.state.loans[0].purchase_option_deadline, '2027-05-01');
});

test('proposeLoan persists MANDATORY purchase type', async () => {
  const harness = createHarness();
  const { proposeLoan } = loadService();

  const loan = await proposeLoan(validProposal({
    purchase_type: 'MANDATORY',
    purchase_option_stc: 75000,
  }), loanDeps(harness));

  assert.equal(loan.purchase_type, 'MANDATORY');
  assert.equal(loan.purchase_option_stc, 75000);
  assert.equal(loan.purchase_option_deadline, null);
  assert.equal(harness.state.loans[0].purchase_type, 'MANDATORY');
  assert.equal(Number(harness.state.loans[0].purchase_option_stc), 75000);
  assert.equal(harness.state.loans[0].purchase_option_deadline, null);
});

test('a purchase deadline cannot be after the loan end date', async () => {
  const harness = createHarness();
  const { proposeLoan } = loadService();

  await assertLoanError(
    () => proposeLoan(validProposal({
      purchaseType: 'OPTIONAL',
      purchaseOptionStc: 100000,
      purchaseOptionDeadline: '2027-07-01',
    }), loanDeps(harness)),
    'LOAN_BEYOND_CONTRACT',
  );
  assert.equal(harness.state.loans.length, 0);
});

test('a purchase deadline cannot be after the parent contract', async () => {
  const harness = createHarness();
  const { proposeLoan } = loadService();

  await assertLoanError(
    () => proposeLoan(validProposal({
      endDate: '2028-06-30',
      purchaseType: 'OPTIONAL',
      purchaseOptionStc: 100000,
      purchaseOptionDeadline: '2028-07-01',
    }), loanDeps(harness)),
    'LOAN_BEYOND_CONTRACT',
  );
  assert.equal(harness.state.loans.length, 0);
});

test('an unknown purchase type is not allowed', async () => {
  const harness = createHarness();
  const { proposeLoan } = loadService();

  await assertLoanError(
    () => proposeLoan(validProposal({ purchaseType: 'BUY' }), loanDeps(harness)),
    'LOAN_NOT_ALLOWED',
  );
  assert.equal(harness.state.loans.length, 0);
});

test('parent recall of an ACTIVE loan returns playing rights home without rewriting club_id', async () => {
  const harness = createHarness({
    loans: [activeLoanFixture()],
    clubs: {
      'club-a': { id: 'club-a', name: 'Club A', stc: 105000 },
      'club-b': { id: 'club-b', name: 'Club B', stc: 25000 },
    },
  });
  const service = loadService();

  const recalled = await service.recallLoan({
    loanId: 'loan-active',
    actorClubId: 'club-a',
  }, loanDeps(harness));

  assert.equal(recalled.status, 'RECALLED');
  assert.ok(recalled.completed_at);
  assert.equal(harness.state.loans.length, 1);
  assert.equal(harness.state.loans[0].status, 'RECALLED');
  assert.equal(harness.state.player.club_id, 'club-a');
  assert.equal(harness.state.contracts[0].status, 'active');
  assert.equal(harness.state.contracts[0].team_id, 'club-a');
  assert.equal(harness.state.memberships[0].club_id, 'club-a');
  assert.equal(harness.state.clubs['club-a'].stc, 105000);
  assert.equal(harness.state.clubs['club-b'].stc, 25000);
  assert.equal(harness.recallNotices.length, 1);
  assert.equal(harness.recallNotices[0].id, 'loan-active');

  const registration = await service.getPlayingRegistration('player-1', loanDeps(harness));
  assert.equal(registration.playing_club_id, 'club-a');
  await service.assertPlayerEligibleForClub({ playerId: 'player-1', clubId: 'club-a' }, loanDeps(harness));
  await assertLoanError(
    () => service.assertPlayerEligibleForClub({ playerId: 'player-1', clubId: 'club-b' }, loanDeps(harness)),
    'LOAN_PLAYER_NOT_ELIGIBLE',
  );
});

test('only the parent club can recall an active loan', async () => {
  const harness = createHarness({ loans: [activeLoanFixture()] });
  const service = loadService();

  await assertLoanError(
    () => service.recallLoan({
      loanId: 'loan-active',
      actorClubId: 'club-b',
    }, loanDeps(harness)),
    'LOAN_NOT_PARENT',
  );
  assert.equal(harness.state.loans[0].status, 'ACTIVE');
  assert.equal(harness.recallNotices.length, 0);
});

test('a loan with recall_allowed false cannot be recalled', async () => {
  const harness = createHarness({
    loans: [activeLoanFixture({ recall_allowed: 0 })],
  });
  const service = loadService();

  await assertLoanError(
    () => service.recallLoan({
      loanId: 'loan-active',
      actorClubId: 'club-a',
    }, loanDeps(harness)),
    'LOAN_RECALL_NOT_ALLOWED',
  );
  assert.equal(harness.state.loans[0].status, 'ACTIVE');
});

test('a loan cannot be recalled before recall_after_date', async () => {
  const harness = createHarness({
    loans: [activeLoanFixture({ recall_after_date: '2027-03-01' })],
  });
  const service = loadService();

  await assertLoanError(
    () => service.recallLoan({
      loanId: 'loan-active',
      actorClubId: 'club-a',
    }, loanDeps(harness, { now: () => '2027-01-15 12:00:00' })),
    'LOAN_RECALL_TOO_EARLY',
  );
  assert.equal(harness.state.loans[0].status, 'ACTIVE');
});

test('a loan that is not ACTIVE cannot be recalled', async () => {
  const harness = createHarness({
    loans: [activeLoanFixture({ status: 'PROPOSED' })],
  });
  const service = loadService();

  await assertLoanError(
    () => service.recallLoan({
      loanId: 'loan-active',
      actorClubId: 'club-a',
    }, loanDeps(harness)),
    'LOAN_NOT_ALLOWED',
  );
  assert.equal(harness.state.loans[0].status, 'PROPOSED');
});

test('after recall a squad contract accept is no longer blocked', async () => {
  const harness = createHarness({ loans: [activeLoanFixture()] });
  const service = loadService();

  await service.recallLoan({
    loanId: 'loan-active',
    actorClubId: 'club-a',
  }, loanDeps(harness));

  await service.assertNoLiveLoanForTransfer({
    playerId: 'player-1',
    contractType: 'squad',
  }, loanDeps(harness));
});

test('parent can propose early end of an ACTIVE loan without changing status', async () => {
  const harness = createHarness({ loans: [activeLoanFixture()] });
  const service = loadService();

  const proposed = await service.proposeEarlyEnd({
    loanId: 'loan-active',
    actorClubId: 'club-a',
  }, loanDeps(harness));

  assert.equal(proposed.status, 'ACTIVE');
  assert.equal(proposed.early_end_proposed_by_club_id, 'club-a');
  assert.ok(proposed.early_end_proposed_at);
  assert.equal(harness.state.loans[0].status, 'ACTIVE');
  assert.equal(harness.state.loans[0].early_end_proposed_by_club_id, 'club-a');
  assert.equal(harness.earlyEndRequests.length, 1);
  assert.equal(harness.earlyEndRequests[0].early_end_proposed_by_club_id, 'club-a');
  assert.equal(harness.earlyEndNotices.length, 0);
  assert.equal(harness.state.player.club_id, 'club-a');
});

test('borrower can propose early end of an ACTIVE loan', async () => {
  const harness = createHarness({ loans: [activeLoanFixture()] });
  const service = loadService();

  const proposed = await service.proposeEarlyEnd({
    loanId: 'loan-active',
    actorClubId: 'club-b',
  }, loanDeps(harness));

  assert.equal(proposed.status, 'ACTIVE');
  assert.equal(proposed.early_end_proposed_by_club_id, 'club-b');
  assert.equal(harness.state.loans[0].early_end_proposed_by_club_id, 'club-b');
  assert.equal(harness.earlyEndRequests.length, 1);
});

test('proposing early end again from the same club is idempotent', async () => {
  const harness = createHarness({ loans: [activeLoanFixture()] });
  const service = loadService();

  await service.proposeEarlyEnd({
    loanId: 'loan-active',
    actorClubId: 'club-a',
  }, loanDeps(harness));
  const again = await service.proposeEarlyEnd({
    loanId: 'loan-active',
    actorClubId: 'club-a',
  }, loanDeps(harness));

  assert.equal(again.status, 'ACTIVE');
  assert.equal(again.early_end_proposed_by_club_id, 'club-a');
  assert.equal(harness.state.loans.filter((loan) => loan.id === 'loan-active').length, 1);
  assert.equal(harness.earlyEndRequests.length, 1);
});

test('a club cannot propose early end while the other club has a pending request', async () => {
  const harness = createHarness({ loans: [activeLoanFixture()] });
  const service = loadService();

  await service.proposeEarlyEnd({
    loanId: 'loan-active',
    actorClubId: 'club-a',
  }, loanDeps(harness));
  await assertLoanError(
    () => service.proposeEarlyEnd({
      loanId: 'loan-active',
      actorClubId: 'club-b',
    }, loanDeps(harness)),
    'LOAN_NOT_ALLOWED',
  );
  assert.equal(harness.state.loans[0].early_end_proposed_by_club_id, 'club-a');
  assert.equal(harness.state.loans[0].status, 'ACTIVE');
});

test('other club accept of early end returns playing rights home without rewriting club_id', async () => {
  const harness = createHarness({
    loans: [activeLoanFixture()],
    clubs: {
      'club-a': { id: 'club-a', name: 'Club A', stc: 105000 },
      'club-b': { id: 'club-b', name: 'Club B', stc: 25000 },
    },
  });
  const service = loadService();

  await service.proposeEarlyEnd({
    loanId: 'loan-active',
    actorClubId: 'club-a',
  }, loanDeps(harness));
  const ended = await service.acceptEarlyEnd({
    loanId: 'loan-active',
    actorClubId: 'club-b',
  }, loanDeps(harness));

  assert.equal(ended.status, 'TERMINATED_EARLY');
  assert.ok(ended.completed_at);
  assert.equal(harness.state.loans.length, 1);
  assert.equal(harness.state.loans[0].status, 'TERMINATED_EARLY');
  assert.equal(harness.state.player.club_id, 'club-a');
  assert.equal(harness.state.contracts[0].status, 'active');
  assert.equal(harness.state.contracts[0].team_id, 'club-a');
  assert.equal(harness.state.memberships[0].club_id, 'club-a');
  assert.equal(harness.state.clubs['club-a'].stc, 105000);
  assert.equal(harness.state.clubs['club-b'].stc, 25000);
  assert.equal(harness.earlyEndNotices.length, 1);
  assert.equal(harness.earlyEndNotices[0].status, 'TERMINATED_EARLY');

  const registration = await service.getPlayingRegistration('player-1', loanDeps(harness));
  assert.equal(registration.playing_club_id, 'club-a');
  await service.assertPlayerEligibleForClub({ playerId: 'player-1', clubId: 'club-a' }, loanDeps(harness));
  await assertLoanError(
    () => service.assertPlayerEligibleForClub({ playerId: 'player-1', clubId: 'club-b' }, loanDeps(harness)),
    'LOAN_PLAYER_NOT_ELIGIBLE',
  );
  await service.assertNoLiveLoanForTransfer({
    playerId: 'player-1',
    contractType: 'squad',
  }, loanDeps(harness));
});

test('other club reject of early end leaves the loan ACTIVE with borrower playing rights', async () => {
  const harness = createHarness({ loans: [activeLoanFixture()] });
  const service = loadService();

  await service.proposeEarlyEnd({
    loanId: 'loan-active',
    actorClubId: 'club-a',
  }, loanDeps(harness));
  const rejected = await service.rejectEarlyEnd({
    loanId: 'loan-active',
    actorClubId: 'club-b',
  }, loanDeps(harness));

  assert.equal(rejected.status, 'ACTIVE');
  assert.equal(harness.state.loans[0].status, 'ACTIVE');
  assert.equal(harness.state.loans[0].early_end_proposed_by_club_id, null);
  assert.equal(harness.state.loans[0].early_end_proposed_at, null);
  assert.equal(harness.earlyEndNotices.length, 0);

  const registration = await service.getPlayingRegistration('player-1', loanDeps(harness));
  assert.equal(registration.playing_club_id, 'club-b');
  await service.assertPlayerEligibleForClub({ playerId: 'player-1', clubId: 'club-b' }, loanDeps(harness));
  await assertLoanError(
    () => service.assertPlayerEligibleForClub({ playerId: 'player-1', clubId: 'club-a' }, loanDeps(harness)),
    'LOAN_PLAYER_NOT_ELIGIBLE',
  );
});

test('a non-party club cannot propose early end', async () => {
  const harness = createHarness({ loans: [activeLoanFixture()] });
  const service = loadService();

  await assertLoanError(
    () => service.proposeEarlyEnd({
      loanId: 'loan-active',
      actorClubId: 'club-c',
    }, loanDeps(harness)),
    'LOAN_NOT_PARENT',
  );
  assert.equal(harness.state.loans[0].status, 'ACTIVE');
  assert.equal(harness.earlyEndRequests.length, 0);
});

test('a loan that is not ACTIVE cannot be ended early', async () => {
  const harness = createHarness({
    loans: [activeLoanFixture({ status: 'PROPOSED' })],
  });
  const service = loadService();

  await assertLoanError(
    () => service.proposeEarlyEnd({
      loanId: 'loan-active',
      actorClubId: 'club-a',
    }, loanDeps(harness)),
    'LOAN_NOT_ALLOWED',
  );
  assert.equal(harness.state.loans[0].status, 'PROPOSED');
});

test('the proposing club cannot accept its own early-end request', async () => {
  const harness = createHarness({ loans: [activeLoanFixture()] });
  const service = loadService();

  await service.proposeEarlyEnd({
    loanId: 'loan-active',
    actorClubId: 'club-a',
  }, loanDeps(harness));
  await assertLoanError(
    () => service.acceptEarlyEnd({
      loanId: 'loan-active',
      actorClubId: 'club-a',
    }, loanDeps(harness)),
    'LOAN_NOT_ALLOWED',
  );
  assert.equal(harness.state.loans[0].status, 'ACTIVE');
  assert.equal(harness.earlyEndNotices.length, 0);
});

// ── 08 — Exercise an option to buy ─────────────────────────────────────────

function optionalLoanFixture(overrides = {}) {
  return activeLoanFixture({
    purchase_type: 'OPTIONAL',
    purchase_option_stc: 40000,
    purchase_option_deadline: null,
    purchase_offer_status: null,
    purchase_salary_stc: null,
    purchase_contract_days: null,
    ...overrides,
  });
}

function mandatoryLoanFixture(overrides = {}) {
  return optionalLoanFixture({ purchase_type: 'MANDATORY', ...overrides });
}

function purchaseHarness(overrides = {}) {
  return createHarness({
    contracts: [defaultContract({ weekly_salary_stc: 5000 })],
    ...overrides,
  });
}

function frozenNow(text) {
  return () => `${text} 12:00:00`;
}

function parentContractOf(harness) {
  return harness.state.contracts.find((row) => row.id === 'contract-1');
}

function newClubContractOf(harness) {
  return harness.state.contracts.find((row) => row.id !== 'contract-1');
}

test('the borrowing club can exercise an option on an ACTIVE loan and the loan stays ACTIVE', async () => {
  const harness = purchaseHarness({ loans: [optionalLoanFixture()] });
  const service = loadService();

  const loan = await service.exercisePurchaseOption({
    loanId: 'loan-active',
    actorClubId: 'club-b',
    weeklySalaryStc: 8000,
    durationDays: 365,
  }, loanDeps(harness, { now: frozenNow('2027-03-01') }));

  assert.equal(loan.status, 'ACTIVE');
  assert.equal(harness.state.loans[0].status, 'ACTIVE');
  assert.equal(harness.state.loans[0].purchase_offer_status, 'AWAITING_PLAYER');
  assert.equal(Number(harness.state.loans[0].purchase_salary_stc), 8000);
  assert.equal(Number(harness.state.loans[0].purchase_contract_days), 365);
  assert.equal(harness.purchaseOffers.length, 1);
  assert.equal(harness.purchaseOffers[0].id, 'loan-active');
  // No ownership or money movement until the player accepts.
  assert.equal(harness.state.player.club_id, 'club-a');
  assert.equal(harness.state.clubs['club-b'].stc, 50000);
});

test('the player rejecting the purchase leaves the loan ACTIVE with no fee and no ownership change', async () => {
  const harness = purchaseHarness({ loans: [optionalLoanFixture()] });
  const service = loadService();
  const deps = loanDeps(harness, { now: frozenNow('2027-03-01') });

  await service.exercisePurchaseOption({
    loanId: 'loan-active',
    actorClubId: 'club-b',
    weeklySalaryStc: 8000,
    durationDays: 365,
  }, deps);
  const loan = await service.rejectPurchaseByPlayer({
    loanId: 'loan-active',
    actorPlayerId: 'player-1',
  }, deps);

  assert.equal(loan.status, 'ACTIVE');
  assert.equal(harness.state.loans[0].status, 'ACTIVE');
  assert.equal(harness.state.loans[0].purchase_type, 'OPTIONAL');
  assert.equal(harness.state.loans[0].purchase_offer_status, null);
  assert.equal(harness.state.player.club_id, 'club-a');
  assert.equal(harness.state.clubs['club-b'].stc, 50000);
  assert.equal(harness.state.clubs['club-a'].stc, 80000);
  assert.equal(parentContractOf(harness).status, 'active');
});

test('the player accepting the purchase in an open window converts the loan to PURCHASED', async () => {
  const harness = purchaseHarness({ loans: [optionalLoanFixture()] });
  const service = loadService();
  const deps = loanDeps(harness, { now: frozenNow('2027-03-01') });

  await service.exercisePurchaseOption({
    loanId: 'loan-active',
    actorClubId: 'club-b',
    weeklySalaryStc: 8000,
    durationDays: 365,
  }, deps);
  const purchased = await service.acceptPurchaseByPlayer({
    loanId: 'loan-active',
    actorPlayerId: 'player-1',
  }, deps);

  assert.equal(purchased.status, 'PURCHASED');
  const loan = harness.state.loans[0];
  assert.equal(loan.status, 'PURCHASED');
  assert.ok(loan.completed_at);
  assert.ok(loan.purchased_at);
  assert.equal(loan.purchase_offer_status, null);

  // Fee settled Club B → Club A.
  assert.equal(harness.state.clubs['club-b'].stc, 10000);
  assert.equal(harness.state.clubs['club-a'].stc, 120000);
  assert.equal(harness.state.transactions.filter((row) => row.category === 'loan_purchase').length, 2);

  // Ownership moved once, through the transfer outcome.
  assert.equal(harness.state.player.club_id, 'club-b');
  assert.notEqual(parentContractOf(harness).status, 'active');
  const signed = newClubContractOf(harness);
  assert.equal(signed.team_id, 'club-b');
  assert.equal(signed.status, 'active');
  assert.equal(Number(signed.weekly_salary_stc), 8000);
  assert.equal(signed.end_date, '2028-02-29');
  assert.equal(loan.purchase_contract_id, signed.id);
  assert.equal(
    harness.state.memberships.find((row) => row.status === 'active').club_id,
    'club-b',
  );
});

test('a purchased player is a normal signed player at Club B with no LOAN badge', async () => {
  const harness = purchaseHarness({ loans: [optionalLoanFixture()] });
  const service = loadService();
  const deps = loanDeps(harness, { now: frozenNow('2027-03-01') });

  await service.exercisePurchaseOption({
    loanId: 'loan-active',
    actorClubId: 'club-b',
    weeklySalaryStc: 8000,
  }, deps);
  await service.acceptPurchaseByPlayer({ loanId: 'loan-active', actorPlayerId: 'player-1' }, deps);

  const registration = await service.getPlayingRegistration('player-1', deps);
  assert.equal(registration.owner_club_id, 'club-b');
  assert.equal(registration.playing_club_id, 'club-b');
  assert.equal(registration.loan, null);

  const squad = await service.getSquadLoanView('club-b', deps);
  assert.equal(squad.incoming_player_ids.length, 0);
  assert.equal(squad.annotations['player-1'], undefined);

  await service.assertPlayerEligibleForClub({ playerId: 'player-1', clubId: 'club-b' }, deps);
  await assertLoanError(
    () => service.assertPlayerEligibleForClub({ playerId: 'player-1', clubId: 'club-a' }, deps),
    'LOAN_PLAYER_NOT_ELIGIBLE',
  );
  // The loan is no longer live, so a permanent accept is no longer blocked.
  await service.assertNoLiveLoanForTransfer({ playerId: 'player-1', contractType: 'squad' }, deps);
});

test('accepting the purchase with a closed window queues the conversion until execute-pending', async () => {
  const harness = purchaseHarness({ loans: [optionalLoanFixture()] });
  const service = loadService();
  const closed = loanDeps(harness, { now: frozenNow('2027-03-01'), isWindowOpen: async () => false });

  await service.exercisePurchaseOption({
    loanId: 'loan-active',
    actorClubId: 'club-b',
    weeklySalaryStc: 8000,
    durationDays: 365,
  }, closed);
  const queued = await service.acceptPurchaseByPlayer({
    loanId: 'loan-active',
    actorPlayerId: 'player-1',
  }, closed);

  assert.equal(queued.status, 'ACTIVE');
  assert.equal(harness.state.loans[0].purchase_offer_status, 'PENDING_WINDOW');
  assert.ok(harness.state.loans[0].purchase_player_accepted_at);
  assert.equal(harness.state.player.club_id, 'club-a');
  assert.equal(harness.state.clubs['club-b'].stc, 50000);

  const open = loanDeps(harness, { now: frozenNow('2027-03-05') });
  const result = await service.activatePendingWindowLoans(open);
  assert.equal(result.purchased, 1);
  assert.equal(harness.state.loans[0].status, 'PURCHASED');
  assert.equal(harness.state.player.club_id, 'club-b');
  assert.equal(harness.state.clubs['club-b'].stc, 10000);
  assert.notEqual(parentContractOf(harness).status, 'active');
});

test('a purchase the borrower cannot afford rolls back and leaves the loan ACTIVE', async () => {
  const harness = purchaseHarness({
    loans: [optionalLoanFixture({ purchase_option_stc: 90000 })],
  });
  const service = loadService();
  const deps = loanDeps(harness, { now: frozenNow('2027-03-01') });

  await service.exercisePurchaseOption({
    loanId: 'loan-active',
    actorClubId: 'club-b',
    weeklySalaryStc: 8000,
  }, deps);
  await assertLoanError(
    () => service.acceptPurchaseByPlayer({ loanId: 'loan-active', actorPlayerId: 'player-1' }, deps),
    'LOAN_INSUFFICIENT_STC',
  );

  assert.equal(harness.state.loans[0].status, 'ACTIVE');
  assert.equal(harness.state.clubs['club-b'].stc, 50000);
  assert.equal(harness.state.clubs['club-a'].stc, 80000);
  assert.equal(harness.state.player.club_id, 'club-a');
  assert.equal(parentContractOf(harness).status, 'active');
  assert.equal(harness.state.contracts.length, 1);
});

test('only the borrowing club can exercise the option', async () => {
  const harness = purchaseHarness({ loans: [optionalLoanFixture()] });
  const service = loadService();

  await assertLoanError(
    () => service.exercisePurchaseOption({
      loanId: 'loan-active',
      actorClubId: 'club-a',
      weeklySalaryStc: 8000,
    }, loanDeps(harness)),
    'LOAN_NOT_BORROWER',
  );
  assert.equal(harness.state.loans[0].purchase_offer_status, null);
  assert.equal(harness.purchaseOffers.length, 0);
});

test('a loan with no option to buy cannot be exercised', async () => {
  const harness = purchaseHarness({ loans: [activeLoanFixture()] });
  const service = loadService();

  await assertLoanError(
    () => service.exercisePurchaseOption({
      loanId: 'loan-active',
      actorClubId: 'club-b',
      weeklySalaryStc: 8000,
    }, loanDeps(harness)),
    'LOAN_NO_PURCHASE_OPTION',
  );
});

test('an option cannot be exercised after the purchase deadline', async () => {
  const harness = purchaseHarness({
    loans: [optionalLoanFixture({ purchase_option_deadline: '2027-02-01' })],
  });
  const service = loadService();

  await assertLoanError(
    () => service.exercisePurchaseOption({
      loanId: 'loan-active',
      actorClubId: 'club-b',
      weeklySalaryStc: 8000,
    }, loanDeps(harness, { now: frozenNow('2027-02-02') })),
    'LOAN_PURCHASE_TOO_LATE',
  );
  assert.equal(harness.state.loans[0].status, 'ACTIVE');
});

test('an option cannot be exercised on a loan that is not ACTIVE', async () => {
  const harness = purchaseHarness({
    loans: [optionalLoanFixture({ status: 'COMPLETED' })],
  });
  const service = loadService();

  await assertLoanError(
    () => service.exercisePurchaseOption({
      loanId: 'loan-active',
      actorClubId: 'club-b',
      weeklySalaryStc: 8000,
    }, loanDeps(harness, { now: frozenNow('2027-03-01') })),
    'LOAN_NOT_ALLOWED',
  );
});

test('an unrelated permanent accept is still blocked while an exercised loan is live', async () => {
  const harness = purchaseHarness({ loans: [optionalLoanFixture()] });
  const service = loadService();
  const deps = loanDeps(harness, { now: frozenNow('2027-03-01') });

  await service.exercisePurchaseOption({
    loanId: 'loan-active',
    actorClubId: 'club-b',
    weeklySalaryStc: 8000,
  }, deps);

  await assertLoanError(
    () => service.assertNoLiveLoanForTransfer({
      playerId: 'player-1',
      contractType: 'squad',
    }, deps),
    'LOAN_TRANSFER_CONFLICT',
  );
});

test('only the loan player can respond to a purchase offer', async () => {
  const harness = purchaseHarness({ loans: [optionalLoanFixture()] });
  const service = loadService();
  const deps = loanDeps(harness, { now: frozenNow('2027-03-01') });

  await service.exercisePurchaseOption({
    loanId: 'loan-active',
    actorClubId: 'club-b',
    weeklySalaryStc: 8000,
  }, deps);
  await assertLoanError(
    () => service.acceptPurchaseByPlayer({ loanId: 'loan-active', actorPlayerId: 'player-2' }, deps),
    'LOAN_NOT_PLAYER',
  );
  assert.equal(harness.state.loans[0].status, 'ACTIVE');
});

// ── 09 — Honour an obligation to buy ───────────────────────────────────────

test('a MANDATORY loan converts at its deadline without a second player vote', async () => {
  const harness = purchaseHarness({
    loans: [mandatoryLoanFixture({ end_date: '2027-06-30' })],
  });
  const service = loadService();

  const result = await service.completeDueLoans(loanDeps(harness, { now: frozenNow('2027-06-30') }));

  assert.equal(result.purchased, 1);
  assert.equal(result.completed, 0);
  assert.equal(result.retried, 0);
  assert.equal(harness.state.loans[0].status, 'PURCHASED');
  assert.equal(harness.state.player.club_id, 'club-b');
  assert.equal(harness.state.clubs['club-b'].stc, 10000);
  assert.equal(harness.state.clubs['club-a'].stc, 120000);
  assert.equal(harness.purchaseOffers.length, 0);
});

test('a MANDATORY conversion copies the parent salary and remaining parent end date', async () => {
  const harness = purchaseHarness({
    loans: [mandatoryLoanFixture({ end_date: '2027-06-30' })],
  });
  const service = loadService();

  await service.completeDueLoans(loanDeps(harness, { now: frozenNow('2027-06-30') }));

  const signed = newClubContractOf(harness);
  assert.equal(signed.team_id, 'club-b');
  assert.equal(Number(signed.weekly_salary_stc), 5000);
  assert.equal(signed.end_date, '2028-06-30');
});

test('a MANDATORY loan stays ACTIVE and retries when the window is closed', async () => {
  const harness = purchaseHarness({
    loans: [mandatoryLoanFixture({ end_date: '2027-06-30' })],
  });
  const service = loadService();

  const result = await service.completeDueLoans(loanDeps(harness, {
    now: frozenNow('2027-06-30'),
    isWindowOpen: async () => false,
  }));

  assert.equal(result.purchased, 0);
  assert.equal(result.completed, 0);
  assert.equal(result.retried, 1);
  assert.equal(result.errors[0].code, 'LOAN_WINDOW_CLOSED');
  assert.equal(harness.state.loans[0].status, 'ACTIVE');
  assert.equal(harness.state.player.club_id, 'club-a');

  const retry = await service.completeDueLoans(loanDeps(harness, { now: frozenNow('2027-07-01') }));
  assert.equal(retry.purchased, 1);
  assert.equal(harness.state.loans[0].status, 'PURCHASED');
});

test('a MANDATORY loan the borrower cannot pay stays ACTIVE and retries', async () => {
  const harness = purchaseHarness({
    loans: [mandatoryLoanFixture({ end_date: '2027-06-30', purchase_option_stc: 90000 })],
  });
  const service = loadService();

  const result = await service.completeDueLoans(loanDeps(harness, { now: frozenNow('2027-06-30') }));

  assert.equal(result.purchased, 0);
  assert.equal(result.completed, 0);
  assert.equal(result.retried, 1);
  assert.equal(result.errors[0].code, 'LOAN_INSUFFICIENT_STC');
  assert.equal(harness.state.loans[0].status, 'ACTIVE');
  assert.equal(harness.state.clubs['club-b'].stc, 50000);
  assert.equal(harness.state.clubs['club-a'].stc, 80000);
  assert.equal(harness.state.player.club_id, 'club-a');
  assert.equal(parentContractOf(harness).status, 'active');
});

test('a MANDATORY loan converts on its own earlier purchase deadline', async () => {
  const harness = purchaseHarness({
    loans: [mandatoryLoanFixture({ end_date: '2027-06-30', purchase_option_deadline: '2027-03-01' })],
  });
  const service = loadService();

  const result = await service.completeDueLoans(loanDeps(harness, { now: frozenNow('2027-03-01') }));

  assert.equal(result.purchased, 1);
  assert.equal(harness.state.loans[0].status, 'PURCHASED');
  assert.equal(harness.state.player.club_id, 'club-b');
});

test('an OPTIONAL loan that is never exercised completes as a normal return', async () => {
  const harness = purchaseHarness({
    loans: [optionalLoanFixture({ end_date: '2027-06-30' })],
  });
  const service = loadService();

  const result = await service.completeDueLoans(loanDeps(harness, { now: frozenNow('2027-06-30') }));

  assert.equal(result.completed, 1);
  assert.equal(result.purchased, 0);
  assert.equal(harness.state.loans[0].status, 'COMPLETED');
  assert.equal(harness.state.player.club_id, 'club-a');
  assert.equal(parentContractOf(harness).status, 'active');
  assert.equal(harness.state.clubs['club-b'].stc, 50000);

  const registration = await service.getPlayingRegistration('player-1', loanDeps(harness));
  assert.equal(registration.playing_club_id, 'club-a');
});

test('recall and mutual early end still work on an OPTIONAL loan', async () => {
  const recallHarness = purchaseHarness({ loans: [optionalLoanFixture()] });
  const service = loadService();

  const recalled = await service.recallLoan({
    loanId: 'loan-active',
    actorClubId: 'club-a',
  }, loanDeps(recallHarness, { now: frozenNow('2027-03-01') }));
  assert.equal(recalled.status, 'RECALLED');
  assert.equal(recallHarness.state.player.club_id, 'club-a');

  const endHarness = purchaseHarness({ loans: [optionalLoanFixture()] });
  const endDeps = loanDeps(endHarness, { now: frozenNow('2027-03-01') });
  await service.proposeEarlyEnd({ loanId: 'loan-active', actorClubId: 'club-b' }, endDeps);
  const ended = await service.acceptEarlyEnd({ loanId: 'loan-active', actorClubId: 'club-a' }, endDeps);
  assert.equal(ended.status, 'TERMINATED_EARLY');
  assert.equal(endHarness.state.player.club_id, 'club-a');
});

// ── Regression: an obligation cannot be escaped by ending the loan (07) ─────

test('a MANDATORY loan cannot be recalled out of', async () => {
  const harness = purchaseHarness({ loans: [mandatoryLoanFixture()] });
  const service = loadService();

  await assertLoanError(
    () => service.recallLoan({
      loanId: 'loan-active',
      actorClubId: 'club-a',
    }, loanDeps(harness, { now: frozenNow('2027-03-01') })),
    'LOAN_PURCHASE_OBLIGED',
  );
  assert.equal(harness.state.loans[0].status, 'ACTIVE');
});

test('a MANDATORY loan cannot be ended early by either club', async () => {
  const harness = purchaseHarness({ loans: [mandatoryLoanFixture()] });
  const service = loadService();
  const deps = loanDeps(harness, { now: frozenNow('2027-03-01') });

  await assertLoanError(
    () => service.proposeEarlyEnd({ loanId: 'loan-active', actorClubId: 'club-b' }, deps),
    'LOAN_PURCHASE_OBLIGED',
  );
  await assertLoanError(
    () => service.proposeEarlyEnd({ loanId: 'loan-active', actorClubId: 'club-a' }, deps),
    'LOAN_PURCHASE_OBLIGED',
  );
  assert.equal(harness.state.loans[0].status, 'ACTIVE');
  assert.equal(harness.state.loans[0].early_end_proposed_by_club_id, undefined);
});

test('an OPTIONAL loan the player already accepted cannot be recalled out of', async () => {
  const harness = purchaseHarness({ loans: [optionalLoanFixture()] });
  const service = loadService();
  const closed = loanDeps(harness, { now: frozenNow('2027-03-01'), isWindowOpen: async () => false });

  await service.exercisePurchaseOption({
    loanId: 'loan-active',
    actorClubId: 'club-b',
    weeklySalaryStc: 8000,
  }, closed);
  await service.acceptPurchaseByPlayer({ loanId: 'loan-active', actorPlayerId: 'player-1' }, closed);
  assert.equal(harness.state.loans[0].purchase_offer_status, 'PENDING_WINDOW');

  await assertLoanError(
    () => service.recallLoan({ loanId: 'loan-active', actorClubId: 'club-a' }, closed),
    'LOAN_PURCHASE_OBLIGED',
  );
  assert.equal(harness.state.loans[0].status, 'ACTIVE');
});

test('recalling an OPTIONAL loan clears an offer the player never answered', async () => {
  const harness = purchaseHarness({ loans: [optionalLoanFixture()] });
  const service = loadService();
  const deps = loanDeps(harness, { now: frozenNow('2027-03-01') });

  await service.exercisePurchaseOption({
    loanId: 'loan-active',
    actorClubId: 'club-b',
    weeklySalaryStc: 8000,
  }, deps);
  const recalled = await service.recallLoan({ loanId: 'loan-active', actorClubId: 'club-a' }, deps);

  assert.equal(recalled.status, 'RECALLED');
  assert.equal(harness.state.loans[0].purchase_offer_status, null);
  assert.equal(harness.state.loans[0].purchase_salary_stc, null);
  assert.equal(harness.state.player.club_id, 'club-a');
});

// ── Regression: a queued purchase survives the loan end date (02, 08) ───────

test('a queued purchase is not dropped when the loan end date arrives with the window shut', async () => {
  const harness = purchaseHarness({
    loans: [optionalLoanFixture({ end_date: '2027-06-30' })],
  });
  const service = loadService();
  const closed = loanDeps(harness, { now: frozenNow('2027-03-01'), isWindowOpen: async () => false });

  await service.exercisePurchaseOption({
    loanId: 'loan-active',
    actorClubId: 'club-b',
    weeklySalaryStc: 8000,
  }, closed);
  await service.acceptPurchaseByPlayer({ loanId: 'loan-active', actorPlayerId: 'player-1' }, closed);

  // The loan's last day arrives and the window is still shut.
  const stillClosed = loanDeps(harness, { now: frozenNow('2027-06-30'), isWindowOpen: async () => false });
  const first = await service.completeDueLoans(stillClosed);
  assert.equal(first.completed, 0, 'must not complete as a free return');
  assert.equal(first.purchased, 0);
  assert.equal(first.retried, 1);
  assert.equal(harness.state.loans[0].status, 'ACTIVE');
  assert.equal(harness.state.player.club_id, 'club-a');

  // Window reopens: the agreed purchase still goes through.
  const open = loanDeps(harness, { now: frozenNow('2027-07-05') });
  const second = await service.completeDueLoans(open);
  assert.equal(second.purchased, 1);
  assert.equal(harness.state.loans[0].status, 'PURCHASED');
  assert.equal(harness.state.player.club_id, 'club-b');
  assert.equal(harness.state.clubs['club-b'].stc, 10000);
});

test('an offer the player never answered expires with the loan', async () => {
  const harness = purchaseHarness({
    loans: [optionalLoanFixture({ end_date: '2027-06-30' })],
  });
  const service = loadService();
  const deps = loanDeps(harness, { now: frozenNow('2027-03-01') });

  await service.exercisePurchaseOption({
    loanId: 'loan-active',
    actorClubId: 'club-b',
    weeklySalaryStc: 8000,
  }, deps);

  const result = await service.completeDueLoans(loanDeps(harness, { now: frozenNow('2027-06-30') }));
  assert.equal(result.completed, 1);
  assert.equal(result.offers_expired, 1);
  assert.equal(harness.state.loans[0].status, 'COMPLETED');
  assert.equal(harness.state.loans[0].purchase_offer_status, null);
  assert.equal(harness.state.player.club_id, 'club-a');
  assert.equal(harness.state.clubs['club-b'].stc, 50000);
});

// ── Regression: bulk registration + release guard (01, 03) ──────────────────

test('getPlayingClubIds resolves owner and borrower in one pass', async () => {
  const harness = purchaseHarness({ loans: [activeLoanFixture()] });
  const service = loadService();

  const map = await service.getPlayingClubIds(['player-1'], loanDeps(harness));
  const registration = map.get('player-1');
  assert.equal(registration.owner_club_id, 'club-a');
  assert.equal(registration.playing_club_id, 'club-b');
  assert.equal(registration.loan_id, 'loan-active');
});

test('getPlayingClubIds falls back to club_id when there is no live loan', async () => {
  const harness = purchaseHarness({ loans: [] });
  const service = loadService();

  const map = await service.getPlayingClubIds(['player-1'], loanDeps(harness));
  const registration = map.get('player-1');
  assert.equal(registration.playing_club_id, 'club-a');
  assert.equal(registration.loan_id, null);
});

test('hasLiveLoan is true for every live status and false once terminal', async () => {
  const service = loadService();
  for (const status of ['PROPOSED', 'AWAITING_PLAYER', 'PENDING_WINDOW', 'ACTIVE']) {
    const harness = purchaseHarness({ loans: [activeLoanFixture({ status })] });
    assert.equal(await service.hasLiveLoan('player-1', loanDeps(harness)), true, status);
  }
  for (const status of ['COMPLETED', 'PURCHASED', 'RECALLED', 'TERMINATED_EARLY', 'CANCELLED', 'REJECTED']) {
    const harness = purchaseHarness({ loans: [activeLoanFixture({ status })] });
    assert.equal(await service.hasLiveLoan('player-1', loanDeps(harness)), false, status);
  }
});

test('assertNoLiveLoanForClubMove blocks a club change mid-loan', async () => {
  const harness = purchaseHarness({ loans: [activeLoanFixture()] });
  const service = loadService();

  await assertLoanError(
    () => service.assertNoLiveLoanForClubMove({ playerId: 'player-1' }, loanDeps(harness)),
    'LOAN_TRANSFER_CONFLICT',
  );

  const free = purchaseHarness({ loans: [] });
  await service.assertNoLiveLoanForClubMove({ playerId: 'player-1' }, loanDeps(free));
});

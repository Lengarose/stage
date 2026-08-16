const { v4: uuidv4 } = require('uuid');
const { EXECUTESQL } = require('../db/database');

const LIVE_LOAN_STATUSES = ['PROPOSED', 'AWAITING_PLAYER', 'PENDING_WINDOW', 'ACTIVE'];
const PRE_ACTIVATION_STATUSES = ['PROPOSED', 'AWAITING_PLAYER', 'PENDING_WINDOW'];
const ACTIVATABLE_STATUSES = ['AWAITING_PLAYER', 'PENDING_WINDOW'];

function queryWith(query, sql, params = []) {
  return query ? query(sql, params) : EXECUTESQL(sql, params);
}

function loanError(code, message, status = 400) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  return err;
}

function asNumber(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function nowStamp(deps = {}) {
  if (typeof deps.now === 'function') return deps.now();
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

async function isTransferWindowOpen(deps = {}) {
  if (typeof deps.isWindowOpen === 'function') return deps.isWindowOpen();
  if (deps.isWindowOpen === true || deps.isWindowOpen === false) return deps.isWindowOpen;
  const { getCurrentTransferWindow } = require('./transferWindowService');
  return Boolean(await getCurrentTransferWindow());
}

async function runInTransaction(deps, fn) {
  if (typeof deps.withTransaction === 'function') {
    return deps.withTransaction(fn);
  }
  if (deps.query) {
    return fn(deps.query);
  }
  const { withTransaction } = require('../db/database');
  let result;
  await withTransaction(async (exec) => {
    result = await fn(exec);
  });
  return result;
}

async function loadLoan(query, loanId) {
  const rows = await queryWith(query, 'SELECT * FROM player_loans WHERE id = ? LIMIT 1', [loanId]);
  return rows[0] || null;
}

async function updateLoan(query, loanId, fields) {
  const columns = Object.keys(fields);
  const params = columns.map((column) => fields[column]);
  await queryWith(
    query,
    `UPDATE player_loans
        SET ${columns.map((column) => `${column} = ?`).join(', ')}
      WHERE id = ?`,
    [...params, loanId]
  );
  return { id: loanId, ...fields };
}

async function markLoanInbox(query, loanId, status, actionType = null) {
  const actionClause = actionType ? ' AND action_type = ?' : '';
  const params = actionType ? [status, loanId, actionType] : [status, loanId];
  await queryWith(
    query,
    `UPDATE inbox_messages
        SET status = ?,
            is_read = 1
      WHERE related_entity_id = ?
        AND message_type = 'loan_proposal'${actionClause}`,
    params
  ).catch(() => {});
}

async function deliverParentProposalSafe(loan, deps = {}) {
  try {
    if (typeof deps.deliverParentProposal === 'function') {
      await deps.deliverParentProposal(loan);
    } else if (deps.deliverParentProposal !== false) {
      const { deliverLoanProposal } = require('./messageDeliveryService');
      await deliverLoanProposal(loan);
    }
  } catch (err) {
    console.warn('[playerLoan] parent proposal delivery failed:', err?.message || err);
  }
}

async function deliverPlayerOfferSafe(loan, deps = {}) {
  try {
    if (typeof deps.deliverPlayerOffer === 'function') {
      await deps.deliverPlayerOffer(loan);
    } else if (deps.deliverPlayerOffer !== false) {
      const { deliverPlayerLoanOffer } = require('./messageDeliveryService');
      await deliverPlayerLoanOffer(loan);
    }
  } catch (err) {
    console.warn('[playerLoan] player offer delivery failed:', err?.message || err);
  }
}

async function settleLoanFee(query, loan) {
  const fee = asNumber(loan.loan_fee_stc);
  if (fee <= 0) return { settled: false, fee: 0 };

  const borrowers = await queryWith(query, 'SELECT id, stc, name FROM clubs WHERE id = ? LIMIT 1', [loan.loan_club_id]);
  const parents = await queryWith(query, 'SELECT id, stc, name FROM clubs WHERE id = ? LIMIT 1', [loan.parent_club_id]);
  const borrower = borrowers[0];
  const parent = parents[0];
  if (!borrower || !parent) throw loanError('LOAN_NOT_ALLOWED', 'Club not found', 404);
  if (asNumber(borrower.stc) < fee) {
    throw loanError('LOAN_INSUFFICIENT_STC', 'Loan club cannot pay the loan fee');
  }

  const players = await queryWith(query, 'SELECT gamertag FROM players WHERE id = ? LIMIT 1', [loan.player_id]).catch(() => []);
  const playerLabel = players[0]?.gamertag || 'player';
  const borrowerBalance = asNumber(borrower.stc) - fee;
  const parentBalance = asNumber(parent.stc) + fee;

  await queryWith(query, 'UPDATE clubs SET stc = ?, updated_date = NOW() WHERE id = ?', [borrowerBalance, borrower.id]);
  await queryWith(
    query,
    `INSERT INTO stc_transactions
      (id, club_id, amount, balance_after, type, category, description, related_entity_type, related_entity_id, reference_id, created_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      uuidv4(),
      borrower.id,
      -fee,
      borrowerBalance,
      'expense',
      'loan_fee',
      `Loan fee paid to ${parent.name || 'club'} for ${playerLabel}`,
      'player_loan',
      loan.id,
      loan.id,
    ]
  );

  await queryWith(query, 'UPDATE clubs SET stc = ?, updated_date = NOW() WHERE id = ?', [parentBalance, parent.id]);
  await queryWith(
    query,
    `INSERT INTO stc_transactions
      (id, club_id, amount, balance_after, type, category, description, related_entity_type, related_entity_id, reference_id, created_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      uuidv4(),
      parent.id,
      fee,
      parentBalance,
      'income',
      'loan_fee',
      `Loan fee received from ${borrower.name || 'club'} for ${playerLabel}`,
      'player_loan',
      loan.id,
      loan.id,
    ]
  );

  return { settled: true, fee };
}

async function activateLoan(input = {}, deps = {}) {
  const loanId = String(input.loanId || input.id || '').trim();
  if (!loanId) throw loanError('LOAN_NOT_ALLOWED', 'Loan is required');

  return runInTransaction(deps, async (query) => {
    const loan = await loadLoan(query, loanId);
    if (!loan) throw loanError('LOAN_NOT_ALLOWED', 'Loan not found', 404);
    if (!ACTIVATABLE_STATUSES.includes(loan.status)) {
      throw loanError('LOAN_NOT_ALLOWED', 'Only an agreed loan can be activated');
    }

    await settleLoanFee(query, loan);

    const activatedAt = nowStamp(deps);
    const playerAcceptedAt = loan.player_accepted_at || input.playerAcceptedAt || activatedAt;
    await updateLoan(query, loanId, {
      status: 'ACTIVE',
      player_accepted_at: playerAcceptedAt,
      activated_at: activatedAt,
    });
    await markLoanInbox(query, loanId, 'accepted');
    return {
      ...loan,
      status: 'ACTIVE',
      player_accepted_at: playerAcceptedAt,
      activated_at: activatedAt,
    };
  });
}

async function proposeLoan(input = {}, deps = {}) {
  const query = deps.query || EXECUTESQL;
  const playerId = String(input.playerId || '').trim();
  const loanClubId = String(input.loanClubId || input.proposedByClubId || '').trim();
  const proposedByClubId = String(input.proposedByClubId || loanClubId).trim();
  if (!playerId || !loanClubId) {
    throw loanError('LOAN_NOT_ALLOWED', 'Player and loan club are required');
  }

  const players = await queryWith(query, 'SELECT * FROM players WHERE id = ? LIMIT 1', [playerId]);
  const player = players[0];
  if (!player) throw loanError('LOAN_NOT_ALLOWED', 'Player not found', 404);

  const contracts = await queryWith(
    query,
    `SELECT *
       FROM player_contracts
      WHERE user_id = ?
        AND status = 'active'
        AND (contract_type IS NULL OR contract_type <> 'ownership')
      LIMIT 1`,
    [playerId]
  );
  const contract = contracts[0];
  if (!contract) throw loanError('LOAN_NOT_ALLOWED', 'Player has no active player-group contract');
  if (String(contract.team_id) === loanClubId) {
    throw loanError('LOAN_SAME_CLUB', 'Parent club and loan club must differ');
  }

  const parentEnd = contract.end_date ? new Date(contract.end_date) : null;
  const loanEnd = input.endDate ? new Date(input.endDate) : null;
  if (!loanEnd || Number.isNaN(loanEnd.getTime())) {
    throw loanError('LOAN_BEYOND_CONTRACT', 'Loan end date is required');
  }
  if (parentEnd && !Number.isNaN(parentEnd.getTime()) && loanEnd.getTime() > parentEnd.getTime()) {
    throw loanError('LOAN_BEYOND_CONTRACT', 'Loan cannot outlast the parent contract');
  }

  const parentWage = asNumber(input.parentWagePercentage);
  const loanWage = asNumber(input.loanWagePercentage);
  if (parentWage < 0 || loanWage < 0 || parentWage + loanWage !== 100) {
    throw loanError('LOAN_WAGE_SPLIT_INVALID', 'Parent and loan wage percentages must sum to 100');
  }

  const live = await queryWith(
    query,
    `SELECT id
       FROM player_loans
      WHERE player_id = ?
        AND status IN (${LIVE_LOAN_STATUSES.map(() => '?').join(',')})
      LIMIT 1`,
    [playerId, ...LIVE_LOAN_STATUSES]
  );
  if (live.length) throw loanError('LOAN_ALREADY_LIVE', 'Player already has a live loan');

  const loan = {
    id: uuidv4(),
    player_id: playerId,
    contract_id: contract.id,
    parent_club_id: contract.team_id,
    loan_club_id: loanClubId,
    start_date: input.startDate,
    end_date: input.endDate,
    loan_fee_stc: asNumber(input.loanFeeStc),
    parent_wage_percentage: asNumber(input.parentWagePercentage),
    loan_wage_percentage: asNumber(input.loanWagePercentage),
    status: 'PROPOSED',
    proposed_by_club_id: proposedByClubId,
  };

  await queryWith(
    query,
    `INSERT INTO player_loans
      (id, player_id, contract_id, parent_club_id, loan_club_id, start_date, end_date,
       loan_fee_stc, parent_wage_percentage, loan_wage_percentage, status, proposed_by_club_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      loan.id,
      loan.player_id,
      loan.contract_id,
      loan.parent_club_id,
      loan.loan_club_id,
      loan.start_date,
      loan.end_date,
      loan.loan_fee_stc,
      loan.parent_wage_percentage,
      loan.loan_wage_percentage,
      loan.status,
      loan.proposed_by_club_id,
    ]
  );

  await deliverParentProposalSafe(loan, deps);
  return loan;
}

async function rejectLoanByParent(input = {}, deps = {}) {
  const query = deps.query || EXECUTESQL;
  const loanId = String(input.loanId || '').trim();
  const actorClubId = String(input.actorClubId || '').trim();
  if (!loanId) throw loanError('LOAN_NOT_PARENT', 'Loan is required');

  const loan = await loadLoan(query, loanId);
  if (!loan) throw loanError('LOAN_NOT_PARENT', 'Loan not found', 404);
  if (String(loan.parent_club_id) !== actorClubId) {
    throw loanError('LOAN_NOT_PARENT', 'Only the parent club can reject this loan');
  }
  if (loan.status !== 'PROPOSED') {
    throw loanError('LOAN_NOT_PARENT', 'Only a proposed loan can be rejected by the parent club');
  }

  await updateLoan(query, loanId, { status: 'REJECTED' });
  await markLoanInbox(query, loanId, 'rejected', 'loan_parent_response');
  return { ...loan, status: 'REJECTED' };
}

async function acceptLoanByParent(input = {}, deps = {}) {
  const query = deps.query || EXECUTESQL;
  const loanId = String(input.loanId || '').trim();
  const actorClubId = String(input.actorClubId || '').trim();
  if (!loanId) throw loanError('LOAN_NOT_PARENT', 'Loan is required');

  const loan = await loadLoan(query, loanId);
  if (!loan) throw loanError('LOAN_NOT_PARENT', 'Loan not found', 404);
  if (String(loan.parent_club_id) !== actorClubId) {
    throw loanError('LOAN_NOT_PARENT', 'Only the parent club can accept this loan');
  }
  if (loan.status !== 'PROPOSED') {
    throw loanError('LOAN_NOT_PARENT', 'Only a proposed loan can be accepted by the parent club');
  }

  const parentAcceptedAt = nowStamp(deps);
  await updateLoan(query, loanId, {
    status: 'AWAITING_PLAYER',
    parent_accepted_at: parentAcceptedAt,
  });
  await markLoanInbox(query, loanId, 'accepted', 'loan_parent_response');

  const next = {
    ...loan,
    status: 'AWAITING_PLAYER',
    parent_accepted_at: parentAcceptedAt,
  };
  await deliverPlayerOfferSafe(next, deps);
  return next;
}

async function rejectLoanByPlayer(input = {}, deps = {}) {
  const query = deps.query || EXECUTESQL;
  const loanId = String(input.loanId || '').trim();
  const actorPlayerId = String(input.actorPlayerId || '').trim();
  if (!loanId) throw loanError('LOAN_NOT_PLAYER', 'Loan is required');

  const loan = await loadLoan(query, loanId);
  if (!loan) throw loanError('LOAN_NOT_PLAYER', 'Loan not found', 404);
  if (String(loan.player_id) !== actorPlayerId) {
    throw loanError('LOAN_NOT_PLAYER', 'Only the player can reject this loan');
  }
  if (loan.status !== 'AWAITING_PLAYER') {
    throw loanError('LOAN_NOT_PLAYER', 'Only a loan awaiting the player can be rejected');
  }

  await updateLoan(query, loanId, { status: 'REJECTED' });
  await markLoanInbox(query, loanId, 'rejected', 'loan_player_response');
  return { ...loan, status: 'REJECTED' };
}

async function acceptLoanByPlayer(input = {}, deps = {}) {
  const query = deps.query || EXECUTESQL;
  const loanId = String(input.loanId || '').trim();
  const actorPlayerId = String(input.actorPlayerId || '').trim();
  if (!loanId) throw loanError('LOAN_NOT_PLAYER', 'Loan is required');

  const loan = await loadLoan(query, loanId);
  if (!loan) throw loanError('LOAN_NOT_PLAYER', 'Loan not found', 404);
  if (String(loan.player_id) !== actorPlayerId) {
    throw loanError('LOAN_NOT_PLAYER', 'Only the player can accept this loan');
  }
  if (loan.status !== 'AWAITING_PLAYER') {
    throw loanError('LOAN_NOT_PLAYER', 'Only a loan awaiting the player can be accepted');
  }

  const playerAcceptedAt = nowStamp(deps);
  const windowOpen = await isTransferWindowOpen(deps);
  if (!windowOpen) {
    await updateLoan(query, loanId, {
      status: 'PENDING_WINDOW',
      player_accepted_at: playerAcceptedAt,
    });
    await markLoanInbox(query, loanId, 'accepted', 'loan_player_response');
    return {
      ...loan,
      status: 'PENDING_WINDOW',
      player_accepted_at: playerAcceptedAt,
    };
  }

  return activateLoan({
    loanId,
    playerAcceptedAt,
  }, deps);
}

async function cancelLoan(input = {}, deps = {}) {
  const query = deps.query || EXECUTESQL;
  const loanId = String(input.loanId || '').trim();
  const actorClubId = String(input.actorClubId || '').trim();
  if (!loanId) throw loanError('LOAN_NOT_BORROWER', 'Loan is required');

  const loan = await loadLoan(query, loanId);
  if (!loan) throw loanError('LOAN_NOT_BORROWER', 'Loan not found', 404);
  const isParent = String(loan.parent_club_id) === actorClubId;
  const isBorrower = String(loan.loan_club_id) === actorClubId;
  if (!isParent && !isBorrower) {
    throw loanError('LOAN_NOT_BORROWER', 'Only a party club can cancel this loan');
  }
  if (!PRE_ACTIVATION_STATUSES.includes(loan.status)) {
    throw loanError('LOAN_NOT_ALLOWED', 'An active loan cannot be cancelled');
  }

  await updateLoan(query, loanId, { status: 'CANCELLED' });
  await markLoanInbox(query, loanId, 'cancelled');
  return { ...loan, status: 'CANCELLED' };
}

async function activatePendingWindowLoans(deps = {}) {
  const query = deps.query || EXECUTESQL;
  const rows = await queryWith(
    query,
    `SELECT *
       FROM player_loans
      WHERE status = 'PENDING_WINDOW'
      ORDER BY created_date ASC`,
    []
  ).catch(() => []);

  const result = { activated: 0, errors: [] };
  for (const loan of rows) {
    try {
      await activateLoan({ loanId: loan.id, playerAcceptedAt: loan.player_accepted_at }, deps);
      result.activated += 1;
    } catch (err) {
      result.errors.push({
        loan_id: loan.id,
        error: err.message,
        code: err.code || null,
      });
    }
  }
  return result;
}

async function getActiveLoanForPlayer(playerId, deps = {}) {
  const query = deps.query || EXECUTESQL;
  const id = String(playerId || '').trim();
  if (!id) return null;
  const rows = await queryWith(
    query,
    "SELECT * FROM player_loans WHERE player_id = ? AND status = 'ACTIVE' LIMIT 1",
    [id]
  ).catch(() => []);
  return rows[0] || null;
}

async function getPlayingRegistration(playerOrId, deps = {}) {
  const query = deps.query || EXECUTESQL;
  const playerId = typeof playerOrId === 'object' ? String(playerOrId?.id || '') : String(playerOrId || '');
  const player = typeof playerOrId === 'object' && playerOrId
    ? playerOrId
    : (await queryWith(query, 'SELECT * FROM players WHERE id = ? LIMIT 1', [playerId]).catch(() => []))[0] || { id: playerId };
  const loan = await getActiveLoanForPlayer(playerId, deps);
  const ownerClubId = String(loan?.parent_club_id || player.club_id || '');
  const playingClubId = String(loan?.loan_club_id || ownerClubId);
  return {
    player_id: playerId,
    owner_club_id: ownerClubId,
    playing_club_id: playingClubId,
    loan,
    president_club_id: ownerClubId,
    selectable_for: {
      [ownerClubId]: !loan,
      [playingClubId]: true,
    },
  };
}

async function assertPlayerEligibleForClub(input = {}, deps = {}) {
  const playerId = String(input.playerId || '').trim();
  const clubId = String(input.clubId || '').trim();
  const registration = await getPlayingRegistration(playerId, deps);
  if (!clubId || registration.playing_club_id !== clubId) {
    throw loanError('LOAN_PLAYER_NOT_ELIGIBLE', 'Player is not eligible for this club lineup', 409);
  }
  return registration;
}

function collectLineupPlayerIds(payload = {}) {
  const bags = [payload.starting_players, payload.bench_players, payload.lineup, payload.player_ids];
  const ids = [];
  for (const bag of bags) {
    let list = bag;
    if (typeof list === 'string') {
      try { list = JSON.parse(list); } catch { list = []; }
    }
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      const id = typeof item === 'string' || typeof item === 'number'
        ? String(item)
        : String(item?.player_id || item?.id || '');
      if (id) ids.push(id);
    }
  }
  return [...new Set(ids)];
}

async function assertLineupEligibleForClub(clubId, payload = {}, deps = {}) {
  const ids = collectLineupPlayerIds(payload);
  for (const playerId of ids) {
    await assertPlayerEligibleForClub({ playerId, clubId }, deps);
  }
  return ids;
}

async function listActiveLoansForClub(clubId, deps = {}) {
  const query = deps.query || EXECUTESQL;
  const id = String(clubId || '').trim();
  if (!id) return [];
  return queryWith(
    query,
    `SELECT pl.*, pc.weekly_salary_stc
       FROM player_loans pl
       LEFT JOIN player_contracts pc ON pc.id = pl.contract_id
      WHERE pl.status = 'ACTIVE'
        AND (pl.parent_club_id = ? OR pl.loan_club_id = ?)`,
    [id, id]
  ).catch(() => []);
}

function annotationForLoan(loan, clubId) {
  const isBorrower = String(loan.loan_club_id) === String(clubId);
  if (isBorrower) {
    return {
      loan_id: loan.id,
      loan_badge: 'LOAN',
      loan_status: 'loaned_in',
      selectable: true,
      loan_from_club_id: loan.parent_club_id,
      loan_end_date: loan.end_date,
    };
  }
  return {
    loan_id: loan.id,
    loan_badge: null,
    loan_status: 'loaned_out',
    selectable: false,
    on_loan_club_id: loan.loan_club_id,
    loan_end_date: loan.end_date,
  };
}

async function getSquadLoanView(clubId, deps = {}) {
  const loans = await listActiveLoansForClub(clubId, deps);
  const annotations = {};
  const incoming_player_ids = [];
  for (const loan of loans) {
    annotations[loan.player_id] = annotationForLoan(loan, clubId);
    if (String(loan.loan_club_id) === String(clubId)) incoming_player_ids.push(loan.player_id);
  }
  return { incoming_player_ids, outgoing_player_ids: loans.filter((loan) => String(loan.parent_club_id) === String(clubId)).map((loan) => loan.player_id), annotations, loans };
}

function getWageSplitAmounts({ weeklySalary, loan, parentClubId } = {}) {
  const total = Math.max(0, asNumber(weeklySalary));
  if (!loan || loan.status !== 'ACTIVE') {
    return parentClubId ? [{ clubId: parentClubId, amount: total, role: 'owner' }] : [];
  }
  const parentPct = asNumber(loan.parent_wage_percentage);
  const parentAmount = Math.round(total * parentPct / 100);
  const loanAmount = total - parentAmount;
  const shares = [];
  if (parentAmount > 0) shares.push({ clubId: loan.parent_club_id, amount: parentAmount, role: 'owner' });
  if (loanAmount > 0) shares.push({ clubId: loan.loan_club_id, amount: loanAmount, role: 'borrower' });
  return shares;
}

async function creditPlayerWage(query, { playerId, amount, description, referenceId }) {
  if (amount <= 0) return;
  const players = await queryWith(query, 'SELECT id, email, stc FROM players WHERE id = ? LIMIT 1', [playerId]);
  const player = players[0];
  if (!player) return;
  const next = asNumber(player.stc) + amount;
  await queryWith(query, 'UPDATE players SET stc = ?, updated_date = NOW() WHERE id = ?', [next, playerId]);
  await queryWith(
    query,
    `INSERT INTO player_stc_transactions
      (id, player_id, player_email, amount, balance_after, type, category, source, description, reference_id, created_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      uuidv4(),
      playerId,
      player.email || null,
      amount,
      next,
      'income',
      'salary',
      'loan_wage',
      description,
      referenceId,
    ]
  ).catch(() => {});
}

async function paySplitWeeklySalary(input = {}, deps = {}) {
  const query = deps.query || EXECUTESQL;
  const contract = input.contract || {};
  const playerId = String(contract.user_id || input.playerId || '');
  const weeklySalary = asNumber(input.weeklySalary != null ? input.weeklySalary : contract.weekly_salary_stc);
  const loan = input.loan || await getActiveLoanForPlayer(playerId, deps);
  const shares = getWageSplitAmounts({
    weeklySalary,
    loan,
    parentClubId: contract.team_id,
  });

  let playerReceived = 0;
  const paid = [];
  for (const share of shares) {
    const clubs = await queryWith(query, 'SELECT id, name, stc FROM clubs WHERE id = ? LIMIT 1', [share.clubId]);
    const club = clubs[0];
    if (!club) {
      paid.push({ ...share, paid: 0, shortfall: share.amount });
      continue;
    }
    const amount = Math.min(share.amount, asNumber(club.stc));
    if (amount <= 0) {
      paid.push({ ...share, paid: 0, shortfall: share.amount });
      continue;
    }
    const nextBalance = asNumber(club.stc) - amount;
    await queryWith(query, 'UPDATE clubs SET stc = ?, updated_date = NOW() WHERE id = ?', [nextBalance, club.id]);
    await queryWith(
      query,
      `INSERT INTO stc_transactions
        (id, club_id, amount, balance_after, type, category, description, related_entity_type, related_entity_id, reference_id, created_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        uuidv4(),
        club.id,
        -amount,
        nextBalance,
        'expense',
        'salary',
        'Loan wage share for player',
        'player_loan',
        loan?.id || contract.id,
        contract.id,
      ]
    );
    playerReceived += amount;
    paid.push({ ...share, paid: amount, shortfall: share.amount - amount });
  }
  await creditPlayerWage(query, {
    playerId,
    amount: playerReceived,
    description: 'Weekly salary',
    referenceId: contract.id,
  });
  return {
    player_received: playerReceived,
    paid,
    loan_status: loan?.status || null,
  };
}

async function getClubLoanWageDelta(clubId, deps = {}) {
  const loans = await listActiveLoansForClub(clubId, deps);
  let active_weekly_delta = 0;
  for (const loan of loans) {
    const salary = asNumber(loan.weekly_salary_stc);
    const shares = getWageSplitAmounts({ weeklySalary: salary, loan, parentClubId: loan.parent_club_id });
    const ownerShare = shares.find((share) => share.role === 'owner')?.amount || 0;
    const borrowerShare = shares.find((share) => share.role === 'borrower')?.amount || 0;
    if (String(loan.parent_club_id) === String(clubId)) active_weekly_delta += ownerShare - salary;
    if (String(loan.loan_club_id) === String(clubId)) active_weekly_delta += borrowerShare;
  }
  return { active_weekly_delta };
}

module.exports = {
  LIVE_LOAN_STATUSES,
  proposeLoan,
  rejectLoanByParent,
  acceptLoanByParent,
  rejectLoanByPlayer,
  acceptLoanByPlayer,
  cancelLoan,
  activateLoan,
  activatePendingLoans: activatePendingWindowLoans,
  activatePendingWindowLoans,
  getActiveLoanForPlayer,
  getPlayingRegistration,
  assertPlayerEligibleForClub,
  assertLineupEligibleForClub,
  collectLineupPlayerIds,
  getSquadLoanView,
  getWageSplitAmounts,
  paySplitWeeklySalary,
  getClubLoanWageDelta,
};

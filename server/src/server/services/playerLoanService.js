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

function asFlag(value, defaultValue = true) {
  if (value === undefined || value === null || value === '') return defaultValue;
  if (value === false || value === 0 || value === '0') return false;
  return true;
}

function nowStamp(deps = {}) {
  if (typeof deps.now === 'function') return deps.now();
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

function dateOnly(value) {
  if (value == null || value === '') return null;
  const text = String(value);
  return text.length >= 10 ? text.slice(0, 10) : text;
}

function recallFieldsFromInput(input = {}) {
  const allowedRaw = input.recallAllowed !== undefined ? input.recallAllowed : input.recall_allowed;
  const afterRaw = input.recallAfterDate !== undefined ? input.recallAfterDate : input.recall_after_date;
  return {
    recall_allowed: asFlag(allowedRaw, true) ? 1 : 0,
    recall_after_date: dateOnly(afterRaw),
  };
}

const PURCHASE_TYPES = ['NONE', 'OPTIONAL', 'MANDATORY'];

function purchaseFieldsFromInput(input = {}) {
  const typeRaw = input.purchaseType !== undefined ? input.purchaseType : input.purchase_type;
  const stcRaw = input.purchaseOptionStc !== undefined ? input.purchaseOptionStc : input.purchase_option_stc;
  const deadlineRaw = input.purchaseOptionDeadline !== undefined ? input.purchaseOptionDeadline : input.purchase_option_deadline;
  const purchase_type = (typeRaw === undefined || typeRaw === null || typeRaw === '')
    ? 'NONE'
    : String(typeRaw).trim().toUpperCase();
  if (!PURCHASE_TYPES.includes(purchase_type)) {
    throw loanError('LOAN_NOT_ALLOWED', 'Purchase type is not allowed');
  }
  return {
    purchase_type,
    purchase_option_stc: asNumber(stcRaw),
    purchase_option_deadline: dateOnly(deadlineRaw),
  };
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

async function loadLoan(query, loanId, options = {}) {
  const lock = options.forUpdate ? ' FOR UPDATE' : '';
  const rows = await queryWith(query, `SELECT * FROM player_loans WHERE id = ? LIMIT 1${lock}`, [loanId]);
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

async function markLoanInbox(query, loanId, status, actionType = null, messageType = 'loan_proposal') {
  const actionClause = actionType ? ' AND action_type = ?' : '';
  const params = actionType
    ? [status, loanId, messageType, actionType]
    : [status, loanId, messageType];
  await queryWith(
    query,
    `UPDATE inbox_messages
        SET status = ?,
            is_read = 1
      WHERE related_entity_id = ?
        AND message_type = ?${actionClause}`,
    params
  ).catch(() => {});
}

async function deliverPurchaseOfferSafe(loan, deps = {}) {
  try {
    if (typeof deps.deliverPurchaseOffer === 'function') {
      await deps.deliverPurchaseOffer(loan);
    } else if (deps.deliverPurchaseOffer !== false) {
      const { deliverLoanPurchaseOffer } = require('./messageDeliveryService');
      await deliverLoanPurchaseOffer(loan);
    }
  } catch (err) {
    console.warn('[playerLoan] purchase offer delivery failed:', err?.message || err);
  }
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

async function deliverRecallNoticeSafe(loan, deps = {}) {
  try {
    if (typeof deps.deliverRecallNotice === 'function') {
      await deps.deliverRecallNotice(loan);
    } else if (deps.deliverRecallNotice !== false) {
      const { deliverLoanRecalled } = require('./messageDeliveryService');
      await deliverLoanRecalled(loan);
    }
  } catch (err) {
    console.warn('[playerLoan] recall notice delivery failed:', err?.message || err);
  }
}

async function deliverEarlyEndRequestSafe(loan, deps = {}) {
  try {
    if (typeof deps.deliverEarlyEndRequest === 'function') {
      await deps.deliverEarlyEndRequest(loan);
    } else if (deps.deliverEarlyEndRequest !== false) {
      const { deliverEarlyEndRequest } = require('./messageDeliveryService');
      await deliverEarlyEndRequest(loan);
    }
  } catch (err) {
    console.warn('[playerLoan] early-end request delivery failed:', err?.message || err);
  }
}

async function deliverEarlyEndNoticeSafe(loan, deps = {}) {
  try {
    if (typeof deps.deliverEarlyEndNotice === 'function') {
      await deps.deliverEarlyEndNotice(loan);
    } else if (deps.deliverEarlyEndNotice !== false) {
      const { deliverLoanTerminatedEarly } = require('./messageDeliveryService');
      await deliverLoanTerminatedEarly(loan);
    }
  } catch (err) {
    console.warn('[playerLoan] early-end notice delivery failed:', err?.message || err);
  }
}

function isLoanParty(loan, actorClubId) {
  return String(loan.parent_club_id) === actorClubId || String(loan.loan_club_id) === actorClubId;
}

// An agreed sale cannot be escaped by ending the loan early. That is true for
// an obligation to buy, and for an option the player has already accepted —
// in both cases the transfer is owed and only the conversion is outstanding.
function assertNotPurchaseObliged(loan) {
  const type = String(loan?.purchase_type || 'NONE').trim().toUpperCase();
  if (type === 'MANDATORY') {
    throw loanError('LOAN_PURCHASE_OBLIGED', 'This loan carries an obligation to buy and cannot be ended early');
  }
  if (loan?.purchase_offer_status === 'PENDING_WINDOW') {
    throw loanError('LOAN_PURCHASE_OBLIGED', 'The player has accepted a permanent transfer that is waiting on the window');
  }
}

// An option the player never answered dies with the loan.
const CLEARED_PURCHASE_OFFER = {
  purchase_offer_status: null,
  purchase_salary_stc: null,
  purchase_contract_days: null,
  purchase_player_accepted_at: null,
};

function clearPendingOfferFields(loan) {
  return loan?.purchase_offer_status ? { ...CLEARED_PURCHASE_OFFER } : {};
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
    const loan = await loadLoan(query, loanId, { forUpdate: true });
    if (!loan) throw loanError('LOAN_NOT_ALLOWED', 'Loan not found', 404);
    if (!ACTIVATABLE_STATUSES.includes(loan.status)) {
      throw loanError('LOAN_NOT_ALLOWED', 'Only an agreed loan can be activated');
    }

    const live = await queryWith(
      query,
      `SELECT id
         FROM player_loans
        WHERE player_id = ?
          AND status = 'ACTIVE'
          AND id <> ?
        LIMIT 1
        FOR UPDATE`,
      [loan.player_id, loanId]
    );
    if (live.length) throw loanError('LOAN_ALREADY_LIVE', 'Player already has a live loan');

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

  const recall = recallFieldsFromInput(input);
  const purchase = purchaseFieldsFromInput(input);
  if (purchase.purchase_option_deadline) {
    const deadline = new Date(purchase.purchase_option_deadline);
    if (Number.isNaN(deadline.getTime()) || deadline.getTime() > loanEnd.getTime()) {
      throw loanError('LOAN_BEYOND_CONTRACT', 'Purchase deadline cannot be after the loan end date');
    }
    if (parentEnd && !Number.isNaN(parentEnd.getTime()) && deadline.getTime() > parentEnd.getTime()) {
      throw loanError('LOAN_BEYOND_CONTRACT', 'Purchase deadline cannot outlast the parent contract');
    }
  }
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
    recall_allowed: recall.recall_allowed,
    recall_after_date: recall.recall_after_date,
    purchase_type: purchase.purchase_type,
    purchase_option_stc: purchase.purchase_option_stc,
    purchase_option_deadline: purchase.purchase_option_deadline,
  };

  await queryWith(
    query,
    `INSERT INTO player_loans
      (id, player_id, contract_id, parent_club_id, loan_club_id, start_date, end_date,
       loan_fee_stc, parent_wage_percentage, loan_wage_percentage, status, proposed_by_club_id,
       recall_allowed, recall_after_date, purchase_type, purchase_option_stc, purchase_option_deadline)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      loan.recall_allowed,
      loan.recall_after_date,
      loan.purchase_type,
      loan.purchase_option_stc,
      loan.purchase_option_deadline,
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

async function recallLoan(input = {}, deps = {}) {
  const loanId = String(input.loanId || input.id || '').trim();
  const actorClubId = String(input.actorClubId || '').trim();
  if (!loanId) throw loanError('LOAN_NOT_PARENT', 'Loan is required');

  return runInTransaction(deps, async (query) => {
    const loan = await loadLoan(query, loanId, { forUpdate: true });
    if (!loan) throw loanError('LOAN_NOT_ALLOWED', 'Loan not found', 404);
    if (String(loan.parent_club_id) !== actorClubId) {
      throw loanError('LOAN_NOT_PARENT', 'Only the parent club can recall this loan');
    }
    if (loan.status !== 'ACTIVE') {
      throw loanError('LOAN_NOT_ALLOWED', 'Only an active loan can be recalled');
    }
    if (!asFlag(loan.recall_allowed, true)) {
      throw loanError('LOAN_RECALL_NOT_ALLOWED', 'This loan cannot be recalled');
    }
    assertNotPurchaseObliged(loan);
    const afterDate = dateOnly(loan.recall_after_date);
    if (afterDate && dateOnly(nowStamp(deps)) < afterDate) {
      throw loanError('LOAN_RECALL_TOO_EARLY', 'This loan cannot be recalled yet');
    }

    const completedAt = nowStamp(deps);
    const cleared = clearPendingOfferFields(loan);
    await updateLoan(query, loanId, {
      status: 'RECALLED',
      completed_at: completedAt,
      ...cleared,
    });
    const next = {
      ...loan,
      status: 'RECALLED',
      completed_at: completedAt,
      ...cleared,
    };
    await deliverRecallNoticeSafe(next, deps);
    return next;
  });
}

async function proposeEarlyEnd(input = {}, deps = {}) {
  const loanId = String(input.loanId || input.id || '').trim();
  const actorClubId = String(input.actorClubId || '').trim();
  if (!loanId) throw loanError('LOAN_NOT_PARENT', 'Loan is required');

  return runInTransaction(deps, async (query) => {
    const loan = await loadLoan(query, loanId, { forUpdate: true });
    if (!loan) throw loanError('LOAN_NOT_ALLOWED', 'Loan not found', 404);
    if (!isLoanParty(loan, actorClubId)) {
      throw loanError('LOAN_NOT_PARENT', 'Only a party club can propose early end');
    }
    if (loan.status !== 'ACTIVE') {
      throw loanError('LOAN_NOT_ALLOWED', 'Only an active loan can be ended early');
    }
    assertNotPurchaseObliged(loan);
    const pendingBy = String(loan.early_end_proposed_by_club_id || '').trim();
    if (pendingBy && pendingBy !== actorClubId) {
      throw loanError('LOAN_NOT_ALLOWED', 'An early-end request is already pending');
    }
    if (pendingBy === actorClubId) {
      return loan;
    }

    const proposedAt = nowStamp(deps);
    await updateLoan(query, loanId, {
      early_end_proposed_by_club_id: actorClubId,
      early_end_proposed_at: proposedAt,
    });
    const next = {
      ...loan,
      early_end_proposed_by_club_id: actorClubId,
      early_end_proposed_at: proposedAt,
    };
    await deliverEarlyEndRequestSafe(next, deps);
    return next;
  });
}

async function acceptEarlyEnd(input = {}, deps = {}) {
  const loanId = String(input.loanId || input.id || '').trim();
  const actorClubId = String(input.actorClubId || '').trim();
  if (!loanId) throw loanError('LOAN_NOT_ALLOWED', 'Loan is required');

  return runInTransaction(deps, async (query) => {
    const loan = await loadLoan(query, loanId, { forUpdate: true });
    if (!loan) throw loanError('LOAN_NOT_ALLOWED', 'Loan not found', 404);
    if (loan.status !== 'ACTIVE') {
      throw loanError('LOAN_NOT_ALLOWED', 'Only an active loan can be ended early');
    }
    const pendingBy = String(loan.early_end_proposed_by_club_id || '').trim();
    if (!pendingBy) {
      throw loanError('LOAN_NOT_ALLOWED', 'No early-end request is pending');
    }
    if (!isLoanParty(loan, actorClubId) || pendingBy === actorClubId) {
      throw loanError('LOAN_NOT_ALLOWED', 'Only the other club can accept this early-end request');
    }
    assertNotPurchaseObliged(loan);

    const completedAt = nowStamp(deps);
    const cleared = clearPendingOfferFields(loan);
    await updateLoan(query, loanId, {
      status: 'TERMINATED_EARLY',
      completed_at: completedAt,
      ...cleared,
    });
    await markLoanInbox(query, loanId, 'accepted', null, 'loan_early_end');
    const next = {
      ...loan,
      status: 'TERMINATED_EARLY',
      completed_at: completedAt,
      ...cleared,
    };
    await deliverEarlyEndNoticeSafe(next, deps);
    return next;
  });
}

async function rejectEarlyEnd(input = {}, deps = {}) {
  const loanId = String(input.loanId || input.id || '').trim();
  const actorClubId = String(input.actorClubId || '').trim();
  if (!loanId) throw loanError('LOAN_NOT_ALLOWED', 'Loan is required');

  return runInTransaction(deps, async (query) => {
    const loan = await loadLoan(query, loanId, { forUpdate: true });
    if (!loan) throw loanError('LOAN_NOT_ALLOWED', 'Loan not found', 404);
    if (loan.status !== 'ACTIVE') {
      throw loanError('LOAN_NOT_ALLOWED', 'Only an active loan can be ended early');
    }
    const pendingBy = String(loan.early_end_proposed_by_club_id || '').trim();
    if (!pendingBy) {
      throw loanError('LOAN_NOT_ALLOWED', 'No early-end request is pending');
    }
    if (!isLoanParty(loan, actorClubId) || pendingBy === actorClubId) {
      throw loanError('LOAN_NOT_ALLOWED', 'Only the other club can reject this early-end request');
    }

    await updateLoan(query, loanId, {
      early_end_proposed_by_club_id: null,
      early_end_proposed_at: null,
    });
    await markLoanInbox(query, loanId, 'rejected', null, 'loan_early_end');
    return {
      ...loan,
      early_end_proposed_by_club_id: null,
      early_end_proposed_at: null,
    };
  });
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

// ── Purchase (option to buy / obligation to buy) ────────────────────────────
// Ticket 08 (exercise an option) and ticket 09 (honour an obligation).
// This module is the only place allowed to move ownership for a loanee: the
// loan is ended as PURCHASED in the same transaction, then the normal
// transfer-accept outcome runs (parent contract closed, club_id + membership
// move to the borrower). Callers never run a second copy of these rules.

const PURCHASE_OFFER_AWAITING = 'AWAITING_PLAYER';
const PURCHASE_OFFER_PENDING_WINDOW = 'PENDING_WINDOW';

function purchaseTypeOf(loan) {
  return String(loan?.purchase_type || 'NONE').trim().toUpperCase();
}

// Null deadline means "the loan end date", per the agreed terms.
function purchaseDeadline(loan) {
  return dateOnly(loan?.purchase_option_deadline) || dateOnly(loan?.end_date);
}

function addDays(fromDateText, days) {
  const base = new Date(`${dateOnly(fromDateText)}T00:00:00Z`);
  if (Number.isNaN(base.getTime())) return null;
  return new Date(base.getTime() + Math.max(0, days) * 86400000).toISOString().slice(0, 10);
}

async function settlePurchaseFee(query, loan, price) {
  if (price <= 0) return { settled: false, fee: 0 };

  const borrowers = await queryWith(query, 'SELECT id, stc, name FROM clubs WHERE id = ? LIMIT 1', [loan.loan_club_id]);
  const parents = await queryWith(query, 'SELECT id, stc, name FROM clubs WHERE id = ? LIMIT 1', [loan.parent_club_id]);
  const borrower = borrowers[0];
  const parent = parents[0];
  if (!borrower || !parent) throw loanError('LOAN_NOT_ALLOWED', 'Club not found', 404);
  if (asNumber(borrower.stc) < price) {
    throw loanError('LOAN_INSUFFICIENT_STC', 'Loan club cannot pay the purchase price');
  }

  const players = await queryWith(query, 'SELECT gamertag FROM players WHERE id = ? LIMIT 1', [loan.player_id]).catch(() => []);
  const playerLabel = players[0]?.gamertag || 'player';
  const borrowerBalance = asNumber(borrower.stc) - price;
  const parentBalance = asNumber(parent.stc) + price;

  await queryWith(query, 'UPDATE clubs SET stc = ?, updated_date = NOW() WHERE id = ?', [borrowerBalance, borrower.id]);
  await queryWith(
    query,
    `INSERT INTO stc_transactions
      (id, club_id, amount, balance_after, type, category, description, related_entity_type, related_entity_id, reference_id, created_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      uuidv4(),
      borrower.id,
      -price,
      borrowerBalance,
      'expense',
      'loan_purchase',
      `Purchase fee paid to ${parent.name || 'club'} for ${playerLabel}`,
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
      price,
      parentBalance,
      'income',
      'loan_purchase',
      `Purchase fee received from ${borrower.name || 'club'} for ${playerLabel}`,
      'player_loan',
      loan.id,
      loan.id,
    ]
  );

  return { settled: true, fee: price };
}

// One transaction: fee, PURCHASED, new Club B contract, parent contract closed,
// club_id + membership moved. Any throw rolls the whole thing back and the
// loan stays exactly as it was.
async function convertLoanToPurchase(input = {}, deps = {}) {
  const loanId = String(input.loanId || input.id || '').trim();
  if (!loanId) throw loanError('LOAN_NOT_ALLOWED', 'Loan is required');

  const windowOpen = await isTransferWindowOpen(deps);
  if (!windowOpen) {
    throw loanError('LOAN_WINDOW_CLOSED', 'The transfer window is closed', 409);
  }

  return runInTransaction(deps, async (query) => {
    const loan = await loadLoan(query, loanId, { forUpdate: true });
    if (!loan) throw loanError('LOAN_NOT_ALLOWED', 'Loan not found', 404);
    if (loan.status !== 'ACTIVE') {
      throw loanError('LOAN_NOT_ALLOWED', 'Only an active loan can be purchased');
    }
    const type = purchaseTypeOf(loan);
    if (!['OPTIONAL', 'MANDATORY'].includes(type)) {
      throw loanError('LOAN_NO_PURCHASE_OPTION', 'This loan carries no purchase terms');
    }

    const stamp = nowStamp(deps);
    const today = dateOnly(stamp);
    const price = asNumber(loan.purchase_option_stc);

    const parentContracts = await queryWith(
      query,
      'SELECT * FROM player_contracts WHERE id = ? LIMIT 1',
      [loan.contract_id]
    ).catch(() => []);
    const parentContract = parentContracts[0] || {};

    await settlePurchaseFee(query, loan, price);

    // The loan stops being live before ownership moves, so the transfer
    // outcome below is legal and no second live loan can reference the player.
    await updateLoan(query, loanId, {
      status: 'PURCHASED',
      completed_at: stamp,
      purchased_at: stamp,
      purchase_offer_status: null,
    });

    const hasExerciseSalary = loan.purchase_salary_stc !== null
      && loan.purchase_salary_stc !== undefined
      && loan.purchase_salary_stc !== '';
    const weeklySalary = hasExerciseSalary
      ? asNumber(loan.purchase_salary_stc)
      : asNumber(parentContract.weekly_salary_stc);
    const days = asNumber(loan.purchase_contract_days);
    const endDate = days > 0
      ? addDays(today, days)
      : (dateOnly(parentContract.end_date) || dateOnly(loan.end_date));

    const contractId = uuidv4();
    await queryWith(
      query,
      `INSERT INTO player_contracts
        (id, team_id, user_id, contract_type, status, max_days, weekly_salary_stc,
         signing_bonus_stc, transfer_fee_stc, start_date, end_date,
         offered_by_club_id, created_date, updated_date)
       VALUES (?, ?, ?, 'squad', 'active', ?, ?, 0, 0, ?, ?, ?, NOW(), NOW())`,
      [
        contractId,
        loan.loan_club_id,
        loan.player_id,
        days > 0 ? days : null,
        weeklySalary,
        today,
        endDate,
        loan.loan_club_id,
      ]
    );

    const { closeAcceptedContractConflicts } = require('./contractRulesService');
    await closeAcceptedContractConflicts({
      acceptedContract: {
        id: contractId,
        user_id: loan.player_id,
        team_id: loan.loan_club_id,
        contract_type: 'squad',
      },
      query,
    });

    const players = await queryWith(query, 'SELECT * FROM players WHERE id = ? LIMIT 1', [loan.player_id]).catch(() => []);
    const player = players[0] || {};
    await queryWith(
      query,
      "UPDATE players SET club_id = ?, club_roles = ?, role = 'member', status = 'active', updated_date = NOW() WHERE id = ?",
      [loan.loan_club_id, JSON.stringify(['member']), loan.player_id]
    );
    const { upsertActiveMembership } = require('./clubMembershipService');
    await upsertActiveMembership({
      clubId: loan.loan_club_id,
      playerId: loan.player_id,
      userId: player.user_id || null,
      primaryRole: 'member',
      source: 'loan_purchase',
      query,
    });

    await updateLoan(query, loanId, { purchase_contract_id: contractId });
    await markLoanInbox(query, loanId, 'accepted', 'loan_purchase_response');

    return {
      ...loan,
      status: 'PURCHASED',
      completed_at: stamp,
      purchased_at: stamp,
      purchase_offer_status: null,
      purchase_contract_id: contractId,
    };
  });
}

// Club B's president exercising an option. This is deliberately not
// "Send Contract Offer" — the Transfer Market path stays blocked for signed
// players and this endpoint is the only way in.
async function exercisePurchaseOption(input = {}, deps = {}) {
  const loanId = String(input.loanId || input.id || '').trim();
  const actorClubId = String(input.actorClubId || '').trim();
  if (!loanId) throw loanError('LOAN_NOT_BORROWER', 'Loan is required');

  return runInTransaction(deps, async (query) => {
    const loan = await loadLoan(query, loanId, { forUpdate: true });
    if (!loan) throw loanError('LOAN_NOT_ALLOWED', 'Loan not found', 404);
    if (String(loan.loan_club_id) !== actorClubId) {
      throw loanError('LOAN_NOT_BORROWER', 'Only the borrowing club can exercise this option');
    }
    if (loan.status !== 'ACTIVE') {
      throw loanError('LOAN_NOT_ALLOWED', 'Only an active loan carries a purchase option');
    }
    if (purchaseTypeOf(loan) !== 'OPTIONAL') {
      throw loanError('LOAN_NO_PURCHASE_OPTION', 'This loan carries no option to buy');
    }
    const deadline = purchaseDeadline(loan);
    if (deadline && dateOnly(nowStamp(deps)) > deadline) {
      throw loanError('LOAN_PURCHASE_TOO_LATE', 'The purchase deadline has passed');
    }
    if (loan.purchase_offer_status) {
      return loan;
    }

    const exercisedAt = nowStamp(deps);
    const salaryRaw = input.weeklySalaryStc !== undefined ? input.weeklySalaryStc : input.weekly_salary_stc;
    const daysRaw = input.durationDays !== undefined ? input.durationDays : input.max_days;
    const weeklySalary = asNumber(salaryRaw);
    const days = asNumber(daysRaw);
    if (weeklySalary < 0 || days < 0) {
      throw loanError('LOAN_NOT_ALLOWED', 'Permanent terms are not valid');
    }

    const fields = {
      purchase_offer_status: PURCHASE_OFFER_AWAITING,
      purchase_salary_stc: weeklySalary,
      purchase_contract_days: days > 0 ? days : null,
      purchase_exercised_at: exercisedAt,
      purchase_player_accepted_at: null,
    };
    await updateLoan(query, loanId, fields);

    const next = { ...loan, ...fields };
    await deliverPurchaseOfferSafe(next, deps);
    return next;
  });
}

async function rejectPurchaseByPlayer(input = {}, deps = {}) {
  const query = deps.query || EXECUTESQL;
  const loanId = String(input.loanId || input.id || '').trim();
  const actorPlayerId = String(input.actorPlayerId || '').trim();
  if (!loanId) throw loanError('LOAN_NOT_PLAYER', 'Loan is required');

  const loan = await loadLoan(query, loanId);
  if (!loan) throw loanError('LOAN_NOT_PLAYER', 'Loan not found', 404);
  if (String(loan.player_id) !== actorPlayerId) {
    throw loanError('LOAN_NOT_PLAYER', 'Only the player can respond to this purchase');
  }
  if (loan.status !== 'ACTIVE' || loan.purchase_offer_status !== PURCHASE_OFFER_AWAITING) {
    throw loanError('LOAN_NOT_PLAYER', 'No purchase offer is awaiting this player');
  }

  // Rejecting the permanent deal leaves the loan running to its normal end.
  const fields = {
    purchase_offer_status: null,
    purchase_salary_stc: null,
    purchase_contract_days: null,
    purchase_player_accepted_at: null,
  };
  await updateLoan(query, loanId, fields);
  await markLoanInbox(query, loanId, 'rejected', 'loan_purchase_response');
  return { ...loan, ...fields };
}

async function acceptPurchaseByPlayer(input = {}, deps = {}) {
  const query = deps.query || EXECUTESQL;
  const loanId = String(input.loanId || input.id || '').trim();
  const actorPlayerId = String(input.actorPlayerId || '').trim();
  if (!loanId) throw loanError('LOAN_NOT_PLAYER', 'Loan is required');

  const loan = await loadLoan(query, loanId);
  if (!loan) throw loanError('LOAN_NOT_PLAYER', 'Loan not found', 404);
  if (String(loan.player_id) !== actorPlayerId) {
    throw loanError('LOAN_NOT_PLAYER', 'Only the player can respond to this purchase');
  }
  if (loan.status !== 'ACTIVE' || loan.purchase_offer_status !== PURCHASE_OFFER_AWAITING) {
    throw loanError('LOAN_NOT_PLAYER', 'No purchase offer is awaiting this player');
  }

  const acceptedAt = nowStamp(deps);
  const windowOpen = await isTransferWindowOpen(deps);
  if (!windowOpen) {
    // Queue on the same row. Status stays ACTIVE until execute-pending converts.
    const fields = {
      purchase_offer_status: PURCHASE_OFFER_PENDING_WINDOW,
      purchase_player_accepted_at: acceptedAt,
    };
    await updateLoan(query, loanId, fields);
    await markLoanInbox(query, loanId, 'accepted', 'loan_purchase_response');
    return { ...loan, ...fields };
  }

  await updateLoan(query, loanId, { purchase_player_accepted_at: acceptedAt });
  return convertLoanToPurchase({ loanId }, deps);
}

// Ticket 09: the deadline job. A MANDATORY loan is never allowed to fall
// through to the free COMPLETED return — if it cannot convert it stays ACTIVE
// and the next run tries again.
async function completeDueLoans(deps = {}) {
  const query = deps.query || EXECUTESQL;
  const rows = await queryWith(
    query,
    `SELECT *
       FROM player_loans
      WHERE status = 'ACTIVE'
        AND (
          (end_date IS NOT NULL AND end_date <= CURDATE())
          OR (purchase_type = 'MANDATORY'
              AND purchase_option_deadline IS NOT NULL
              AND purchase_option_deadline <= CURDATE())
        )`,
    []
  );

  const completedAt = nowStamp(deps);
  const today = dateOnly(completedAt);
  const result = { completed: 0, purchased: 0, retried: 0, offers_expired: 0, errors: [] };

  for (const loan of rows) {
    const type = purchaseTypeOf(loan);
    const deadline = purchaseDeadline(loan);

    // A purchase the player already accepted is a commitment, whatever the
    // purchase type. It must never fall through to the free COMPLETED return
    // just because the window was still shut on the loan's last day.
    if (loan.purchase_offer_status === PURCHASE_OFFER_PENDING_WINDOW) {
      try {
        await convertLoanToPurchase({ loanId: loan.id }, deps);
        result.purchased += 1;
      } catch (err) {
        result.retried += 1;
        result.errors.push({
          loan_id: loan.id,
          error: err.message,
          code: err.code || null,
        });
      }
      continue;
    }

    if (type === 'MANDATORY') {
      if (!deadline || today < deadline) continue;
      try {
        await convertLoanToPurchase({ loanId: loan.id }, deps);
        result.purchased += 1;
      } catch (err) {
        result.retried += 1;
        result.errors.push({
          loan_id: loan.id,
          error: err.message,
          code: err.code || null,
        });
      }
      continue;
    }

    const endDate = dateOnly(loan.end_date);
    if (!endDate || today < endDate) continue;

    // An offer the player never answered dies with the loan rather than
    // sitting open against a row that is no longer live.
    const completionFields = {
      status: 'COMPLETED',
      completed_at: completedAt,
    };
    if (loan.purchase_offer_status === PURCHASE_OFFER_AWAITING) {
      completionFields.purchase_offer_status = null;
      completionFields.purchase_salary_stc = null;
      completionFields.purchase_contract_days = null;
      result.offers_expired += 1;
    }
    await updateLoan(query, loan.id, completionFields);
    result.completed += 1;
  }
  return result;
}

async function assertNoLiveLoanForTransfer({ playerId, contractType } = {}, deps = {}) {
  if (contractType === 'ownership') return;
  const query = deps.query || EXECUTESQL;
  const id = String(playerId || '').trim();
  if (!id) return;

  const live = await queryWith(
    query,
    `SELECT id
       FROM player_loans
      WHERE player_id = ?
        AND status IN (${LIVE_LOAN_STATUSES.map(() => '?').join(',')})
      LIMIT 1`,
    [id, ...LIVE_LOAN_STATUSES]
  );
  if (live.length) {
    throw loanError('LOAN_TRANSFER_CONFLICT', 'A live loan blocks this permanent contract accept', 409);
  }
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

  const result = { activated: 0, purchased: 0, errors: [] };
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

  // Purchases the player already accepted while the window was closed run on
  // the same calendar as contract offers and loan activations.
  const pendingPurchases = await queryWith(
    query,
    `SELECT *
       FROM player_loans
      WHERE status = 'ACTIVE'
        AND purchase_offer_status = 'PENDING_WINDOW'
      ORDER BY created_date ASC`,
    []
  ).catch(() => []);

  for (const loan of pendingPurchases) {
    try {
      await convertLoanToPurchase({ loanId: loan.id }, deps);
      result.purchased += 1;
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

// Bulk form of getPlayingRegistration. Match result submissions carry ~22
// players; asking per player would be 44 round trips.
async function getPlayingClubIds(playerIds = [], deps = {}) {
  const query = deps.query || EXECUTESQL;
  const ids = [...new Set((playerIds || []).map((id) => String(id || '')).filter(Boolean))];
  const result = new Map();
  if (!ids.length) return result;

  const placeholders = ids.map(() => '?').join(',');
  const players = await queryWith(
    query,
    `SELECT id, club_id FROM players WHERE id IN (${placeholders})`,
    ids
  ).catch(() => []);
  for (const player of players) {
    result.set(String(player.id), {
      owner_club_id: player.club_id ? String(player.club_id) : null,
      playing_club_id: player.club_id ? String(player.club_id) : null,
      loan_id: null,
    });
  }

  const loans = await queryWith(
    query,
    `SELECT id, player_id, parent_club_id, loan_club_id
       FROM player_loans
      WHERE status = 'ACTIVE'
        AND player_id IN (${placeholders})`,
    ids
  ).catch(() => []);
  for (const loan of loans) {
    const ownerClubId = String(loan.parent_club_id);
    result.set(String(loan.player_id), {
      owner_club_id: ownerClubId,
      playing_club_id: String(loan.loan_club_id),
      loan_id: loan.id,
    });
  }
  return result;
}

// A live loan is a reason to keep a player attached to their parent club even
// when the contract that created the loan has expired. Callers that release a
// player on contract expiry must ask this first.
async function hasLiveLoan(playerId, deps = {}) {
  const query = deps.query || EXECUTESQL;
  const id = String(playerId || '').trim();
  if (!id) return false;
  const rows = await queryWith(
    query,
    `SELECT id
       FROM player_loans
      WHERE player_id = ?
        AND status IN (${LIVE_LOAN_STATUSES.map(() => '?').join(',')})
      LIMIT 1`,
    [id, ...LIVE_LOAN_STATUSES]
  ).catch(() => []);
  return rows.length > 0;
}

async function assertNoLiveLoanForClubMove({ playerId } = {}, deps = {}) {
  if (await hasLiveLoan(playerId, deps)) {
    throw loanError('LOAN_TRANSFER_CONFLICT', 'A live loan blocks this club change', 409);
  }
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
      early_end_proposed_by_club_id: loan.early_end_proposed_by_club_id || null,
    };
  }
  return {
    loan_id: loan.id,
    loan_badge: null,
    loan_status: 'loaned_out',
    selectable: false,
    on_loan_club_id: loan.loan_club_id,
    loan_end_date: loan.end_date,
    recall_allowed: loan.recall_allowed,
    recall_after_date: loan.recall_after_date,
    early_end_proposed_by_club_id: loan.early_end_proposed_by_club_id || null,
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
  PURCHASE_TYPES,
  exercisePurchaseOption,
  acceptPurchaseByPlayer,
  rejectPurchaseByPlayer,
  convertLoanToPurchase,
  purchaseDeadline,
  proposeLoan,
  rejectLoanByParent,
  acceptLoanByParent,
  rejectLoanByPlayer,
  acceptLoanByPlayer,
  cancelLoan,
  recallLoan,
  proposeEarlyEnd,
  acceptEarlyEnd,
  rejectEarlyEnd,
  activateLoan,
  activatePendingLoans: activatePendingWindowLoans,
  activatePendingWindowLoans,
  completeDueLoans,
  assertNoLiveLoanForTransfer,
  assertLoanDoesNotBlockContractAccept: assertNoLiveLoanForTransfer,
  getActiveLoanForPlayer,
  getPlayingRegistration,
  getPlayingClubIds,
  hasLiveLoan,
  assertNoLiveLoanForClubMove,
  assertPlayerEligibleForClub,
  assertLineupEligibleForClub,
  collectLineupPlayerIds,
  getSquadLoanView,
  getWageSplitAmounts,
  paySplitWeeklySalary,
  getClubLoanWageDelta,
};

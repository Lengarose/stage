const { v4: uuidv4 } = require('uuid');
const { EXECUTESQL } = require('../db/database');

const LIVE_LOAN_STATUSES = ['PROPOSED', 'AWAITING_PLAYER', 'PENDING_WINDOW', 'ACTIVE'];

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

  return loan;
}

async function rejectLoanByParent(input = {}, deps = {}) {
  const query = deps.query || EXECUTESQL;
  const loanId = String(input.loanId || '').trim();
  const actorClubId = String(input.actorClubId || '').trim();
  if (!loanId) throw loanError('LOAN_NOT_PARENT', 'Loan is required');

  const rows = await queryWith(query, 'SELECT * FROM player_loans WHERE id = ? LIMIT 1', [loanId]);
  const loan = rows[0];
  if (!loan) throw loanError('LOAN_NOT_PARENT', 'Loan not found', 404);
  if (String(loan.parent_club_id) !== actorClubId) {
    throw loanError('LOAN_NOT_PARENT', 'Only the parent club can reject this loan');
  }
  if (loan.status !== 'PROPOSED') {
    throw loanError('LOAN_NOT_PARENT', 'Only a proposed loan can be rejected by the parent club');
  }

    await queryWith(
      query,
      'UPDATE player_loans SET status = ? WHERE id = ?',
      ['REJECTED', loanId]
    );
  await queryWith(
    query,
    `UPDATE inbox_messages
        SET status = 'rejected',
            is_read = 1
      WHERE related_entity_id = ?
        AND message_type = 'loan_proposal'`,
    [loanId]
  ).catch(() => {});
  return { ...loan, status: 'REJECTED' };
}

module.exports = {
  LIVE_LOAN_STATUSES,
  proposeLoan,
  rejectLoanByParent,
};

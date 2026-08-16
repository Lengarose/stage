const { EXECUTESQL } = require('../db/database');
const { getClubLoanWageDelta } = require('./playerLoanService');

const STARTER_CLUB_FINANCE = Object.freeze({
  balance_stc: 2_500_000,
  wage_budget_stc: 250_000,
  transfer_budget_stc: 1_000_000,
  stadium_level: 0,
  stadium_capacity: 5_000,
});

const STADIUM_FINANCE_TIERS = Object.freeze([
  {
    level: 0,
    name: 'Local Ground',
    capacity: 5_000,
    ticket_price_stc: 15,
    max_wage_budget_stc: 250_000,
    max_transfer_budget_stc: 1_000_000,
    monthly_maintenance_stc: 50_000,
  },
  {
    level: 1,
    name: 'Pro Stadium',
    capacity: 20_000,
    ticket_price_stc: 50,
    max_wage_budget_stc: 800_000,
    max_transfer_budget_stc: 5_000_000,
    monthly_maintenance_stc: 200_000,
  },
  {
    level: 2,
    name: 'Elite Ground',
    capacity: 45_000,
    ticket_price_stc: 130,
    max_wage_budget_stc: 1_800_000,
    max_transfer_budget_stc: 12_000_000,
    monthly_maintenance_stc: 600_000,
  },
  {
    level: 3,
    name: 'Iconic Arena',
    capacity: 80_000,
    ticket_price_stc: 180,
    max_wage_budget_stc: 4_000_000,
    max_transfer_budget_stc: 30_000_000,
    monthly_maintenance_stc: 1_500_000,
  },
]);

function getStadiumFinanceTier(level = 0) {
  const normalized = Math.min(Math.max(Number(level || 0), 0), STADIUM_FINANCE_TIERS.length - 1);
  return STADIUM_FINANCE_TIERS[normalized] || STADIUM_FINANCE_TIERS[0];
}

function numberOrZero(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function financeError(message, code = 'FINANCE_VALIDATION_FAILED', status = 400) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  return err;
}

async function getClubFinanceUsage(clubId, query = EXECUTESQL, options = {}) {
  const rows = await query('SELECT * FROM clubs WHERE id = ? LIMIT 1', [clubId]);
  const club = rows[0];
  if (!club) throw financeError('Club not found', 'CLUB_NOT_FOUND', 404);

  const excluded = options.excludeContractId ? String(options.excludeContractId) : null;
  const contractRows = await query(
    `SELECT
       COALESCE(SUM(CASE WHEN status = 'active' THEN weekly_salary_stc ELSE 0 END), 0) AS active_wages,
       COALESCE(SUM(CASE WHEN status IN ('pending','pending_window','negotiating') THEN weekly_salary_stc ELSE 0 END), 0) AS pending_wages,
       COALESCE(SUM(CASE WHEN status IN ('pending','pending_window','negotiating') THEN transfer_fee_stc ELSE 0 END), 0) AS pending_transfer_fees
     FROM player_contracts
     WHERE team_id = ?
       AND contract_type <> 'ownership'
       AND (? IS NULL OR id <> ?)`,
    [clubId, excluded, excluded]
  );
  const usage = contractRows[0] || {};
  const loanDelta = await getClubLoanWageDelta(clubId, { query }).catch(() => ({ active_weekly_delta: 0 }));
  const tier = getStadiumFinanceTier(club.stadium_level);
  const activeWeeklyWages = numberOrZero(usage.active_wages) + numberOrZero(loanDelta.active_weekly_delta);
  const pendingWeeklyWages = numberOrZero(usage.pending_wages);
  const transferLockedStc = numberOrZero(usage.pending_transfer_fees);
  const wageCap = numberOrZero(club.wage_budget_stc);
  const transferCap = numberOrZero(club.transfer_budget_stc);
  const balance = numberOrZero(club.stc);

  return {
    club,
    tier,
    balance_stc: balance,
    wage_budget_stc: wageCap,
    transfer_budget_stc: transferCap,
    active_weekly_wages_stc: activeWeeklyWages,
    pending_weekly_wages_stc: pendingWeeklyWages,
    committed_weekly_wages_stc: activeWeeklyWages + pendingWeeklyWages,
    wage_room_stc: wageCap - activeWeeklyWages - pendingWeeklyWages,
    transfer_locked_stc: transferLockedStc,
    transfer_budget_remaining_stc: transferCap - transferLockedStc,
    available_balance_stc: balance - transferLockedStc,
    monthly_operating_cost_estimate_stc: activeWeeklyWages * 4 + numberOrZero(tier.monthly_maintenance_stc),
  };
}

async function assertClubContractFinance({
  clubId,
  weeklySalary = 0,
  signingBonus = 0,
  transferFee = 0,
  excludeContractId = null,
  query = EXECUTESQL,
}) {
  const usage = await getClubFinanceUsage(clubId, query, { excludeContractId });
  const offeredWeekly = Math.max(0, numberOrZero(weeklySalary));
  const offeredBonus = Math.max(0, numberOrZero(signingBonus));
  const offeredTransfer = Math.max(0, numberOrZero(transferFee));

  if (usage.committed_weekly_wages_stc + offeredWeekly > usage.wage_budget_stc) {
    throw financeError(
      'Wage cap exceeded. Upgrade stadium or reduce wages.',
      'WAGE_CAP_EXCEEDED'
    );
  }

  if (offeredTransfer > 0 && usage.transfer_locked_stc + offeredTransfer > usage.transfer_budget_stc) {
    throw financeError('Transfer budget exceeded.', 'TRANSFER_BUDGET_EXCEEDED');
  }

  if (offeredTransfer + offeredBonus > usage.available_balance_stc) {
    throw financeError('Not enough club balance.', 'INSUFFICIENT_CLUB_BALANCE');
  }

  return usage;
}

async function assertClubFinanceWithinTier({
  stadiumLevel = 0,
  wageBudget,
  transferBudget,
  allowOverride = false,
}) {
  if (allowOverride) return getStadiumFinanceTier(stadiumLevel);
  const tier = getStadiumFinanceTier(stadiumLevel);
  if (wageBudget != null && numberOrZero(wageBudget) > numberOrZero(tier.max_wage_budget_stc)) {
    throw financeError('Wage cap exceeds stadium tier limit. Add an admin override reason to continue.', 'WAGE_TIER_LIMIT_EXCEEDED');
  }
  if (transferBudget != null && numberOrZero(transferBudget) > numberOrZero(tier.max_transfer_budget_stc)) {
    throw financeError('Transfer budget exceeds stadium tier limit. Add an admin override reason to continue.', 'TRANSFER_TIER_LIMIT_EXCEEDED');
  }
  return tier;
}

module.exports = {
  STARTER_CLUB_FINANCE,
  STADIUM_FINANCE_TIERS,
  getStadiumFinanceTier,
  getClubFinanceUsage,
  assertClubContractFinance,
  assertClubFinanceWithinTier,
};

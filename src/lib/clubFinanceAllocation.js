/**
 * clubFinanceAllocation — Central allocation logic for club earnings
 * 
 * Rule: When a club earns X STC:
 * - 100% → club.stc (main balance)
 * - 10% → club.transfer_budget_stc (additional)
 * - 5% → club.wage_budget_stc (additional)
 */

export function allocateClubEarnings(amountEarned) {
  return {
    balance: amountEarned,                        // 100%
    transfer_budget: Math.floor(amountEarned * 0.10),  // 10%
    wage_budget: Math.floor(amountEarned * 0.05),      // 5%
  };
}

/**
 * Apply allocation to club entity
 * Usage: const updates = applyClubEarnings(club, earnedAmount, description);
 */
export function applyClubEarnings(club, amount, description = "Club earning") {
  const alloc = allocateClubEarnings(amount);
  
  return {
    updates: {
      stc: (club.stc || 0) + alloc.balance,
      transfer_budget_stc: (club.transfer_budget_stc || 0) + alloc.transfer_budget,
      wage_budget_stc: (club.wage_budget_stc || 0) + alloc.wage_budget,
    },
    allocation: alloc,
  };
}
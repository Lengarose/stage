# Implementation Reference — Club Finance System Changes

## Quick Reference: What Changed Where

### 1. Ticket Revenue Allocation
**File**: `functions/updateMatchStats`
**Changes**:
- Line 62-78: Added ticket allocation calculation
  ```javascript
  const ticketAllocation = {
    balance: ticketRevenue,
    transfer_budget: Math.floor(ticketRevenue * 0.10),
    wage_budget: Math.floor(ticketRevenue * 0.05),
  };
  homeUpdates.transfer_budget_stc = (homeClub.transfer_budget_stc || 0) + ticketAllocation.transfer_budget;
  homeUpdates.wage_budget_stc = (homeClub.wage_budget_stc || 0) + ticketAllocation.wage_budget;
  ```
- Line 159-167: Updated transaction description to show breakdown

**Effect**: Every home match now increments club balance, transfer budget, and wage budget

---

### 2. Tournament Prize Distribution
**File**: `functions/distributeTournamentPrizes`
**Changes for 1st Place**:
- Line 64-79: Added allocation calculation
  ```javascript
  const prizeAllocation = {
    balance: firstPlacePrize,
    transfer_budget: Math.floor(firstPlacePrize * 0.10),
    wage_budget: Math.floor(firstPlacePrize * 0.05),
  };
  await base44.asServiceRole.entities.Club.update(club.id, {
    stc: (club.stc || 0) + prizeAllocation.balance,
    transfer_budget_stc: (club.transfer_budget_stc || 0) + prizeAllocation.transfer_budget,
    wage_budget_stc: (club.wage_budget_stc || 0) + prizeAllocation.wage_budget,
  });
  ```

**Changes for 2nd Place**:
- Line 105-120: Same allocation pattern for runner-up

**Effect**: Tournament winners grow all three budgets proportionally to prize amount

---

### 3. Club Wager Payouts
**File**: `functions/wagerMatchActions`
**Changes**:
- Line 304-331: New club-specific payout logic
  ```javascript
  if (!winnerId && winner_club_id) {
    // Club match wager
    const wagerAllocation = {
      balance: pot,
      transfer_budget: Math.floor(pot * 0.10),
      wage_budget: Math.floor(pot * 0.05),
    };
    await base44.asServiceRole.entities.Club.update(winnerClub.id, {
      stc: (winnerClub.stc || 0) + wagerAllocation.balance,
      transfer_budget_stc: (winnerClub.transfer_budget_stc || 0) + wagerAllocation.transfer_budget,
      wage_budget_stc: (winnerClub.wage_budget_stc || 0) + wagerAllocation.wage_budget,
    });
  }
  ```

**Effect**: Club-to-club wagers now properly allocate full pot across all three budgets

---

## New Files Created

### 1. lib/clubFinanceAllocation.js
**Purpose**: Reusable allocation utility
**Exports**:
- `allocateClubEarnings(amount)` — Returns { balance, transfer_budget, wage_budget }
- `applyClubEarnings(club, amount, description)` — Returns updates object

**Status**: Created as reference/utility, currently used inline in functions
**Future Use**: Can refactor functions to import and use this utility

### 2. functions/verifyClubFinances
**Purpose**: Admin verification endpoint
**Input**: `{ club_id?: string }` (optional, checks all if omitted)
**Output**:
```json
{
  "success": true,
  "clubs_checked": 5,
  "results": [
    {
      "club": "Club Name",
      "balance": 5000000,
      "transfer_budget_stc": 500000,
      "wage_budget_stc": 250000,
      "earning_sources": {
        "ticket_revenue": 10,
        "tournament_win": 2,
        "tournament_final": 1,
        "wager_win": 0
      },
      "issues": "OK"
    }
  ]
}
```

**Access**: Admin only
**Use Case**: Audit clubs after transactions

---

## Documentation Files

### 1. CLUB_FINANCE_ALLOCATION_SYSTEM.md
**Purpose**: Complete system overview
**Contents**:
- Allocation rule (100-10-5)
- All 3 income sources covered
- Database fields required
- Verification instructions
- Files modified
- Testing checklist

### 2. SYSTEM_VERIFICATION_SUMMARY.md
**Purpose**: Verification checklist (this one)
**Contents**:
- 9-point verification of each system component
- Root cause analysis
- File/module changes documented
- System design goals achieved

### 3. IMPLEMENTATION_REFERENCE.md
**Purpose**: Quick code reference (this file)
**Contents**:
- Exact line numbers and code snippets
- What changed where
- New files and their purpose

---

## Data Model Requirements

### Club Entity Fields (existing + required)
```javascript
{
  id: string,
  name: string,
  stc: number,                    // Primary balance (100% of earnings)
  transfer_budget_stc: number,    // Transfer market budget (10% of earnings)
  wage_budget_stc: number,        // Wage budget (5% of earnings)
  // ... other fields
}
```

### STCTransaction Entity Fields (for auditing)
```javascript
{
  id: string,
  club_id?: string,               // For club earnings
  player_id?: string,             // For player earnings
  player_email?: string,
  amount: number,
  type: string,                   // 'ticket_revenue', 'tournament_win', 'wager_win', etc.
  description: string,            // Must include allocation breakdown
  reference_id: string,           // Match/tournament/etc ID
  created_date: timestamp,
}
```

---

## Earning Events Summary

| Event | File | Allocation | Notes |
|-------|------|-----------|-------|
| Ticket Revenue | `updateMatchStats` | 100-10-5 | Home club only, every match |
| Tournament 1st | `distributeTournamentPrizes` | 100-10-5 | 80% of pool |
| Tournament 2nd | `distributeTournamentPrizes` | 100-10-5 | 20% of pool |
| Club Wager Win | `wagerMatchActions` | 100-10-5 | Full pot to winning club |
| Player Salary | `payWeeklySalaries` | N/A | Goes to player wallet only |
| Player Wager Win | `wagerMatchActions` | N/A | Goes to player wallet only |
| Player Tournament | `distributeTournamentPrizes` | N/A | Goes to player wallet only |

---

## Verification Checklist

- [ ] All 3 income sources use allocation
- [ ] No club earning event misses allocation
- [ ] Transfer budget growing with income
- [ ] Wage budget growing with income
- [ ] Transactions show allocation breakdown
- [ ] No negative budget values possible
- [ ] Player wallet stays separate
- [ ] verifyClubFinances runs without errors

---

## Rollback / Emergency Restore

If needed to revert:
1. Restore `updateMatchStats` to only update `stc`
2. Restore `distributeTournamentPrizes` to only update `stc`
3. Restore `wagerMatchActions` to old payout logic
4. Delete `verifyClubFinances` function
5. Delete allocation docs

However, existing transactions will remain with allocation breakdowns in descriptions (for audit trail).
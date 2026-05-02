# Club Finance Allocation System Fix

## Overview
Implemented a complete club finance allocation system that distributes all club earnings across three budget categories.

## Allocation Rule
When a club earns any amount of STC, it is distributed as follows:
- **100%** → `club.stc` (main balance / operational fund)
- **10%** → `club.transfer_budget_stc` (transfer market fund, additional)
- **5%** → `club.wage_budget_stc` (wage budget fund, additional)

Example: Club earns 100,000 STC
- Balance: +100,000
- Transfer Budget: +10,000
- Wage Budget: +5,000

## Income Sources Updated

### 1. **Ticket Revenue** (from `updateMatchStats`)
- **Trigger**: When a match completes with home club playing
- **Amount**: Stadium capacity × ticket price per ticket
- **Allocation**: ✅ 100% balance + 10% transfer + 5% wage
- **Transaction Type**: `ticket_revenue`
- **File**: `functions/updateMatchStats`
- **Lines**: 62-78 (allocation), 159-167 (transaction)

### 2. **Tournament Winnings** (from `distributeTournamentPrizes`)
- **Trigger**: When tournament completes, winner is determined
- **1st Place**: 80% of total prize pool (entry_fee × registered_teams)
- **2nd Place**: 20% of total prize pool
- **Allocation**: ✅ 100% balance + 10% transfer + 5% wage (for both places)
- **Transaction Types**: `tournament_win`, `tournament_final`
- **File**: `functions/distributeTournamentPrizes`
- **Lines**: 64-79 (1st), 105-120 (2nd)

### 3. **Club Wager Winnings** (from `wagerMatchActions`)
- **Trigger**: When a wagered club match completes
- **Amount**: Full pot (2× the bet amount)
- **Allocation**: ✅ 100% balance + 10% transfer + 5% wage
- **Transaction Type**: `wager_win`
- **File**: `functions/wagerMatchActions`
- **Lines**: 304-331 (allocation logic)

## Database Fields Required
Each club entity must have:
- `stc` — main balance (primary fund)
- `transfer_budget_stc` — transfer market budget
- `wage_budget_stc` — weekly wage budget

All three fields are updated on every earning event.

## Transaction Logging
All earning transactions now include a detailed breakdown in the description:
```
"Ticket sales: 800,000 → Balance +800,000, Transfer +80,000, Wage +40,000"
```

This allows easy auditing and verification of allocations.

## Verification
Use the `verifyClubFinances` function to audit all clubs:
```
POST /functions/verifyClubFinances
Body: { "club_id": "optional_club_id" }
```

Returns:
- Club balance, transfer budget, wage budget
- Count of earning transactions by type
- Any allocation issues or inconsistencies

## Files Modified

1. **functions/updateMatchStats**
   - Updated ticket revenue allocation (lines 62-78, 159-167)

2. **functions/distributeTournamentPrizes**
   - Updated 1st place allocation (lines 64-79)
   - Updated 2nd place allocation (lines 105-120)

3. **functions/wagerMatchActions**
   - Updated club wager payout (lines 304-331)

## Files Created

1. **lib/clubFinanceAllocation.js**
   - Reusable utility for allocation calculations
   - `allocateClubEarnings(amount)` — returns allocation breakdown
   - `applyClubEarnings(club, amount)` — applies updates and returns new values

2. **functions/verifyClubFinances**
   - Admin-only verification endpoint
   - Audits all earning sources per club
   - Checks for missing allocations in descriptions

## Other Income Sources
The following are NOT affected (no club earnings allocation needed):
- **Player salary**: Goes to player wallet only, not club
- **Player wager wins**: Goes to player wallet only
- **Player tournament prizes**: Goes to player wallet only
- **Club credits**: Separate system, not STC

## Testing Checklist
- [ ] Club plays home match → ticket revenue allocated to balance + transfer + wage
- [ ] Club wins tournament 1st → prize allocated to balance + transfer + wage
- [ ] Club wins tournament 2nd → prize allocated to balance + transfer + wage
- [ ] Club wins wager → pot allocated to balance + transfer + wage
- [ ] Transaction descriptions include allocation breakdown
- [ ] No negative budget values ever occur
- [ ] Existing player salary system remains unchanged
- [ ] Existing player wallet earnings remain player-only

## Root Cause
Previously, club earnings only went to `club.stc` (main balance). Transfer and wage budgets were never incremented on earning events, causing them to stagnate. This meant clubs couldn't grow their spending capacity by earning money.

Now all three budgets grow together proportionally, incentivizing clubs to earn money for both operational spending and strategic investments.
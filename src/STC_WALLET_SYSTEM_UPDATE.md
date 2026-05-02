# STC Player Wallet System - Update Summary

## Overview
Updated the player STC wallet to reflect **player-only earning sources**. Club-based match rewards have been removed from player view. Players earn STC through their own direct activities.

---

## Player STC Earning Sources (ONLY)

### 1. **Weekly Salary** 💰
- **Source**: Active player contracts with clubs
- **Frequency**: Paid weekly (calculated & distributed monthly)
- **Amount**: Per contract `weekly_salary_stc` field
- **Automation**: `payMonthlySalaries` (runs monthly, calculates weeks owed)
- **Transaction Type**: `salary`

### 2. **PvP Wager Wins** 🎲
- **Source**: 1v1 matches with STC wagers
- **Frequency**: Per match completion
- **Amount**: Full pot (both players' wagers combined)
- **Example**: If both players wager 10,000 STC, winner gets 20,000 STC
- **Automation**: `wagerMatchActions` (action: `payout_wager`)
- **Transaction Type**: `wager_win`

### 3. **PvP Solo Tournament 1st Place** 🥇
- **Source**: Player-only tournaments (not club tournaments)
- **Frequency**: Upon tournament completion
- **Prize**: **80% of total prize pool**
- **Calculation**: Pool = Entry Fee STC × Number of Participants
- **Automation**: `distributeTournamentPrizes`
- **Transaction Type**: `tournament_win`

### 4. **PvP Solo Tournament 2nd Place (Runner-up)** 🥈
- **Source**: Player-only tournaments (not club tournaments)
- **Frequency**: Upon tournament completion
- **Prize**: **20% of total prize pool**
- **Automation**: `distributeTournamentPrizes`
- **Transaction Type**: `tournament_final`

### 5. **Lifestyle Investment Income** 🏠
- **Source**: Passive income from owned real estate & lifestyle assets
- **Frequency**: Daily/per interval (based on asset config)
- **Amount**: Per-asset income × cycles elapsed
- **Automation**: `collectPassiveIncome` (user-triggered or scheduled)
- **Transaction Type**: `passive_income`
- **Assets Generating Income**: Real estate properties with `passive_income_stc` > 0

---

## REMOVED From Player Wallet View

❌ **Club match wins** - Not player earning (club earns)
❌ **Club match draws** - Not player earning (club earns)
❌ **Club match losses** - Never an income source
❌ **Win streak bonuses** - Not part of player wallet system
❌ **Club participation rewards** - Not player earning
❌ **Club tournament rewards** - Clubs/owners earn, not players

---

## UI Updates

### STCWallet Component (`components/lifestyle/STCWallet`)

#### "How to Earn STC" Section
- **New Header**: "Player STC Earnings"
- **New Subtitle**: "Earn STC directly to your wallet through:"
- **Simplified Earnings List**: Only 5 earning methods shown
- **Removed Types from Display**: All club-based earnings removed
- **Transaction Labels Updated**:
  - `salary` → "Weekly Salary"
  - `wager_win` → "Wager Win"
  - `wager_loss` → "Wager Loss"
  - `wager_lock` → "Wager Locked"
  - `wager_refund` → "Wager Refunded"
  - `tournament_win` → "Tournament Win (1st Place)"
  - `tournament_final` → "Tournament Runner-up (2nd Place)"
  - `passive_income` → "Passive Income (Investment)"

#### Earnings Grid
- Clear icons/colors for each earning type
- Simple descriptions tied directly to player actions
- No "club-only" warnings needed

---

## Related Systems (Verified)

### Club Finance Tab
- Shows "Weekly Wage Bill" ✅
- Correctly displays active contracts with `weekly_salary_stc` ✅
- Tracks income/expenses ✅

### Club Stadium Revenue
- Stadium generates matchday revenue per result ✅
- Does NOT transfer to player wallet ✅

### Tournament Prize System
- 80/20 split implemented for solo player tournaments ✅
- Solo tournaments pay players directly ✅
- Club tournaments pay club STC (not player) ✅

### Wager System
- PvP wager payout to winning player ✅
- Full pot awarded (both wagers combined) ✅
- Works for solo 1v1 matches ✅

---

## Data Fields Reference

### Player Entity
- `stc` - Player STC balance
- `credits` - Player credits (separate currency)
- `subscription` - Tier (rookie, pro, elite)

### PlayerContract Entity
- `weekly_salary_stc` - Weekly salary amount
- `salary_per_game_stc` - Legacy (not used for player wallet)
- `last_salary_paid_at` - Tracks payment dates
- `status` - Contract state (active, pending, expired, etc.)

### LifestylePurchase Entity
- `passive_income_stc` - Daily/interval income amount (from item)
- `passive_income_interval_days` - Collection interval
- `last_passive_collected_at` - Last income payout date

### STCTransaction Entity
- `type` - Transaction type (salary, wager_win, tournament_win, etc.)
- `amount` - STC amount (positive = earning, negative = spending)
- `player_email` - For player transactions
- `description` - Human-readable label

---

## Automation Schedule

| Name | Frequency | Function | Purpose |
|------|-----------|----------|---------|
| Monthly Salary Payout | Monthly (28th) | `payMonthlySalaries` | Calculate & pay weekly salaries owed |
| Weekly Lifestyle Maintenance | Weekly | `processLifestyleMaintenance` | Deduct maintenance costs |
| Collect Passive Income | User-triggered | `collectPassiveIncome` | Award lifestyle investment income |
| Wager Payout | Per match end | `wagerMatchActions` | Distribute wager winnings |
| Tournament Prize Distribution | Per tournament | `distributeTournamentPrizes` | Award 80/20 prize split |

---

## Transaction History Display

Player sees only their personal transactions:
- Weekly salary deposits
- Wager wins/losses/locks/refunds
- Tournament prize payouts
- Lifestyle investment income
- Purchase deductions (lifestyle items)
- Date, amount, and description for each

---

## Testing Checklist

- [x] Player wallet shows only player-earning methods
- [x] Weekly salary correctly described and calculated
- [x] Wager wins award full pot
- [x] Tournament 80/20 split implemented
- [x] Lifestyle income properly configured
- [x] Club match earnings removed from player view
- [x] Win streak bonuses removed
- [x] All transaction types correctly labeled
- [x] Club finance dashboard unaffected
- [x] Stadium revenue unaffected

---

## Notes

- Club-owned assets and club match earnings are displayed separately in Club Finance Tab
- Players can track their earnings in real-time via STCWallet component
- All systems remain backwards compatible with existing contracts
- No changes to club STC earning mechanics (unchanged)
# Player Salary & Club Finance System Overhaul

## Overview
Implemented two major system changes:
1. **Player Salary**: Converted from monthly batching to **true weekly payouts** via automation
2. **Club Finance**: Removed match-result revenue; replaced with **ticket revenue model** based on stadium capacity & ticket prices

---

## 1. PLAYER SALARY SYSTEM

### Previous System
- Monthly batch payout function (`payMonthlySalaries`)
- Calculated weeks owed and paid all at once
- Ran on cron schedule (28th of each month)

### New System ✅
- **Weekly automatic payouts** (`payWeeklySalaries`)
- Runs every **Monday at 00:00 UTC** (cron: `0 0 * * 1`)
- Each contracted player receives `weekly_salary_stc` per week
- Automation: `Weekly Salary Payout` (ID: 69e8dd059855396d7f77dfb2)

### Implementation Details

**Function**: `functions/payWeeklySalaries`
- Fetches all active contracts with `weekly_salary_stc > 0`
- Calculates weeks elapsed since last payment
- Pays accumulated salary if ≥ 1 week has passed
- Creates STC transaction record
- Sends player notification
- Updates `last_salary_paid_at` on contract

**Payroll Logic**:
```
Weeks Owed = Floor((now - last_salary_paid_at) / 7 days)
Salary Payment = Weeks Owed × weekly_salary_stc
Club Deduction = Salary Payment (from club.stc)
Player Credit = Salary Payment (to player.stc)
```

**Reliability**:
- Idempotency guard: `last_salary_paid_at` prevents double-paying
- Graceful handling: If club has insufficient STC, pays what's available
- Transaction history: Every payout recorded with reference to contract

**Frontend Display**:
- Contract forms display `weekly_salary_stc` clearly
- Wallet shows "Weekly Salary" in earnings breakdown
- Transaction history shows weekly amounts

---

## 2. CLUB FINANCE SYSTEM

### Previous System ❌ REMOVED
Match-result revenue for home clubs:
- Home Win: 500K–4M STC
- Home Draw: 300K–2.5M STC
- Home Loss: 150K–1.2M STC
- Away Win: 150K–1M STC
- Away Draw: 80K–600K STC
- Away Loss: 40K–300K STC

**Issue**: Rewarded results, not actual operations. Clubs earned from ANY match.

### New System ✅ TICKET REVENUE

**Model**: Revenue from ticket sales on **home matches only**
```
Revenue = Stadium Capacity × Ticket Price per Fan per Match
```

**Stadium Levels**:

| Level | Name | Capacity | Ticket Price | Revenue/Match | Upgrade Cost |
|-------|------|----------|--------------|---------------|--------------|
| 0 | Pro Stadium | 20,000 | 40 STC | 800,000 STC | — (default) |
| 1 | Elite Ground | 45,000 | 55 STC | 2,475,000 STC | 25M STC |
| 2 | Iconic Arena | 80,000 | 75 STC | 6,000,000 STC | 80M STC |

**Earning Pattern**:
- Home matches = Full ticket revenue earned
- Away matches = No revenue (opposing club's stadium)
- Result-independent = Same revenue regardless of W/D/L

**Automation**: Triggered in `updateMatchStats` when a club match completes

### Implementation

**File Updates**:

1. **`lib/stadiumLevels.js`** — New system
   - Removed `matchday_revenue_*` fields
   - Added `ticket_price_stc` field
   - New function: `calcTicketRevenue(level)` = `capacity × ticket_price`

2. **`functions/updateMatchStats`** — Ticket revenue award
   - Home club gets ticket revenue on match completion
   - Recorded as `STCTransaction` type `ticket_revenue`
   - Away club gets nothing
   - Line: `stc: (homeClub.stc || 0) + ticketRevenue`

3. **`components/club/StadiumUpgrade`** — UI display
   - Removed match-result revenue breakdown
   - Shows formula: `Capacity × Ticket Price = Revenue/Match`
   - Displays revenue per home match clearly
   - Upgrade path shows capacity and revenue projections

### Other Club Income Sources (Unchanged)

Clubs can still earn from:
- ✅ **Wager/Betting** (if club-vs-club STC wagering exists)
- ✅ **Tournament Winnings** (1st & 2nd place prize distribution)
- ✅ **Season/Pass Revenue** (if implemented)

---

## 3. TRANSACTION TYPES

### New STC Transaction Type
- **Type**: `ticket_revenue`
- **Amount**: Positive (income)
- **When**: Match completion for home club
- **Reference**: Match ID

### Existing Transaction Types
- `salary` — Weekly player salary (unchanged)
- `wager_win` / `wager_loss` — Betting results
- `tournament_win` / `tournament_final` — Prize distribution
- `passive_income` — Lifestyle investments
- `lifestyle_purchase` — Asset purchases

---

## 4. AUTOMATION CHANGES

### Removed
- ❌ `Monthly Salary Payout` (cron: `0 23 28 * *`)

### Added
- ✅ `Weekly Salary Payout` (cron: `0 0 * * 1`)
  - Runs every Monday at 00:00 UTC
  - Function: `payWeeklySalaries`

### Active Automations Still Running
- ✅ Weekly Lifestyle Maintenance
- ✅ Pay Monthly Rent
- ✅ Tournament Start Reminders
- ✅ Match Day Reminders
- ✅ Sync Free Agent Status
- ✅ Auto-Expire Contracts (Daily)

---

## 5. WALLET & PLAYER VIEW

### STCWallet Component Updates
- "Weekly Salary" earnings source description updated
- Matches new weekly automation
- Transaction history shows weekly amounts and dates

### Example Transaction
```
Weekly Salary
+85,000 STC
From: Manchester United FC
Date: April 21, 2026
Type: Regular Payment (1 week)
```

---

## 6. MATCH STATS PROCESSING

### What Happens When Match Completes

**Old System**:
```
Home Club: +500K (if win), +300K (if draw), +150K (if loss)
Away Club: +150K (if win), +80K (if draw), +40K (if loss)
```

**New System**:
```
Home Club: +(20,000 × 40) = +800,000 STC (always)
Away Club: +0 (no revenue for away matches)
```

---

## 7. VERIFICATION CHECKLIST

- [x] Stadium levels restructured with ticket pricing
- [x] `calcTicketRevenue()` function implemented
- [x] Match stats awards ticket revenue to home club only
- [x] Stadium Upgrade UI displays new model clearly
- [x] Weekly salary automation created (Monday 00:00 UTC)
- [x] Old monthly salary automation deleted
- [x] Transaction types include `ticket_revenue`
- [x] Player wallet shows weekly salary correctly
- [x] No changes to wager system (still works)
- [x] No changes to tournament prize distribution

---

## 8. MIGRATION NOTES

- **Existing Contracts**: Continue working; `payWeeklySalaries` calculates weeks owed on first run
- **Existing Stadium Levels**: Auto-clamped to 0-2 range; capacity/prices assigned by new levels
- **Old Revenue**: Not retroactively applied; starts fresh with match completions after deployment
- **Player Wallets**: Show accurate weekly salary going forward

---

## 9. EXAMPLE SCENARIOS

### Scenario 1: Weekly Salary Payment
```
Player: Alex (weekly_salary_stc: 50,000)
Contract: Active since April 1
Automation Runs: Monday, April 21

Calculation:
  Last Paid: April 14 (first Monday)
  Weeks Since: 1 week
  Amount: 1 × 50,000 = 50,000 STC

Result:
  Club Balance: -50,000 STC
  Player Balance: +50,000 STC
  Transaction: "Weekly salary (1 week) from club name"
```

### Scenario 2: Home Match Ticket Revenue
```
Club: Real Madrid (Stadium Level 2 — Iconic Arena)
Match: Home vs Bayern Munich
Stadium: 80,000 capacity × 75 STC/ticket = 6,000,000 per home match

Result: Real Madrid earns 6,000,000 STC (win, draw, or loss)
Bayern Munich earns: 0 STC (away match, no ticket revenue)
```

### Scenario 3: Stadium Upgrade
```
Club: Liverpool (Level 1 — Elite Ground)
Current Revenue: 45,000 × 55 = 2,475,000 per match
Upgrade Cost: 80,000,000 STC

After Upgrade → Level 2 — Iconic Arena:
New Revenue: 80,000 × 75 = 6,000,000 per match
Increase: +3,525,000 per home match!
```

---

## 10. TESTING RECOMMENDATIONS

1. **Salary Payout**: Create contract with `weekly_salary_stc: 10,000`, wait for Monday automation or manually trigger
2. **Ticket Revenue**: Complete a home match; verify home club receives `capacity × ticket_price`
3. **Away Match**: Complete away match; verify home club gets 0 STC from revenue
4. **Stadium Upgrade**: Upgrade stadium; verify new capacity/prices apply to next home match
5. **Wallet Display**: Verify STCWallet shows "Weekly Salary" and new transaction format

---

## 11. SUMMARY

| Aspect | Before | After |
|--------|--------|-------|
| Salary Payout | Monthly batch | **Weekly automated** |
| Salary Schedule | 28th of month | **Every Monday 00:00 UTC** |
| Club Match Revenue | Win/Draw/Loss dependent (150K–4M) | **Ticket-based (800K–6M)** |
| Revenue Trigger | Match result | **Home match completion only** |
| Away Match Revenue | 40K–1M STC | **0 STC (no ticket sales)** |
| Stadium Upgrade Benefit | Higher match rewards | **Higher capacity + ticket price** |

✅ **System is now more realistic and economically transparent**
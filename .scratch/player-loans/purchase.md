# Loan option and obligation to buy

**Status:** 07–09 done  
**Slice:** optional and mandatory purchase of a loanee, converting the loan into a permanent player-group contract with Club B. Later slices: performance clauses, counter-offers, Mercato copy, recall fee / player veto.

## Problem Statement

A loan can start, be played, end on date, be recalled, or end by mutual agreement. Club B still cannot buy the player. Transfer Market blocks a permanent offer to a signed player, and a live loan rejects a permanent accept (`LOAN_TRANSFER_CONFLICT`) so Club A’s parent contract is not killed under an open loan.

Presidents need the football behaviour from the original brief: a loan may carry an option to buy or an obligation to buy. Exercising it must use the existing permanent-transfer outcome (Club B becomes owner) without treating a normal offer as the way in, and without leaving two live player-group contracts.

## Solution

Purchase terms live on the same `player_loans` row (`purchase_type`, price, deadline). They are agreed when the loan is agreed. They are not a second live loan and not `player_contracts.is_loan`.

**Option to buy (`OPTIONAL`).** While the loan is `ACTIVE` and before the deadline, Club B’s president exercises. That is not Send Contract Offer. The player accepts the permanent deal with Club B. One loan-module conversion then: settles the purchase STC (Club B → Club A), marks the loan `PURCHASED` (terminal, not live), and runs the existing transfer-accept outcome so the parent contract with A ends and `club_id` / membership become Club B.

**Obligation to buy (`MANDATORY`).** Club B cannot decline. At the deadline (default: loan `end_date`), the same conversion runs. The player already accepted the loan that included the obligation, so there is no second player vote.

**None (`NONE`).** Default. End-date completion, recall, and mutual end stay as they are.

A live loan still blocks an unrelated permanent accept. The conversion is the exception: the module ends the loan in the same transaction, then the transfer path is legal because the loan is no longer live.

## User Stories

1. As Club B’s president, I want to attach an option to buy (price and optional deadline) when I request a loan, so that I can buy later without a separate negotiation.
2. As Club B’s president, I want to attach an obligation to buy when I request a loan, so that Club A knows the player will become ours.
3. As Club B’s president, I want purchase type to default to none, so that a normal loan stays a loan.
4. As Club A’s president, I want the inbox proposal to show purchase type and price, so that I am not accepting a hidden buy clause.
5. As a player, I want the loan offer to show option or obligation and the price, so that I know a permanent move may follow.
6. As Club B’s president, I want Transfer Market to keep blocking Send Contract Offer to a signed player, so that purchase is not confused with a normal raid.
7. As Club B’s president, I want Exercise option on an active optional loan, so that I can choose to buy.
8. As Club B’s president, I want to set the permanent salary and duration when I exercise, so that the new contract is a real player-group deal.
9. As a player, I want to accept or reject that permanent deal, so that I am not moved onto Club B’s contract without agreeing terms.
10. As a player, I want rejecting the purchase to leave the loan `ACTIVE`, so that I keep playing for Club B until the loan ends the normal way.
11. As Club B’s president, I want the purchase fee taken only on successful conversion, so that a rejected or failed buy does not spend STC.
12. As Club B’s president, I want conversion to fail with unchanged balances and an `ACTIVE` loan if I cannot pay the purchase price (`LOAN_INSUFFICIENT_STC`).
13. As Club A’s president, I want the purchase fee credited on conversion, so that selling via the option is paid like other fees.
14. As both clubs, I want conversion to wait if the transfer window is closed, then run with execute-pending, so that purchases follow the same calendar as contracts and loan activations.
15. As Club A’s president, I want my parent player-group contract terminated on successful purchase, so that I no longer own the player.
16. As Club B’s president, I want `players.club_id` and membership to become Club B on successful purchase, so that this is a real transfer, not a loan with a renamed status.
17. As Club B’s president, I want the player selectable for me after purchase without a LOAN badge, so that they are a normal signed player.
18. As Club A’s president, I want to lose selection and on-loan listing after purchase, so that the player has left.
19. As a buying president of a third club, I still cannot accept a permanent contract while the loan is live, so that a random offer cannot kill Club A’s contract under the loan.
20. As Club B’s president, I cannot exercise when `purchase_type` is none or the deadline has passed.
21. As Club A’s president, I cannot exercise Club B’s option.
22. As Club B’s president, I cannot refuse a `MANDATORY` purchase; at deadline the conversion runs without my extra click.
23. As a player on a mandatory loan, I do not get a second accept at deadline, because I already accepted the loan that included the obligation.
24. As Club A’s president, I want an optional loan that is not exercised by deadline to complete as a normal return (`COMPLETED`), so that the player comes home.
25. As an operator, I want a failed mandatory conversion (window or STC) to keep the loan live and retry, not silently complete as a free return.
26. As a player, I want a purchased loan row kept as `PURCHASED` history, not deleted.
27. As Club B’s president, I want recall and mutual early end to remain available on optional loans until conversion, so that purchase is not the only way out.
28. As a player with no purchase terms, I want loans to behave exactly as in tickets 01–06.
29. As an operator, I want unused contract `is_loan` flags left unused; purchase is not a second loan contract row.
30. As a later Mercato slice, I want a stable loan id and `PURCHASED` status so official copy can attach later.

## Implementation Decisions

- **Seam.** `playerLoanService` owns purchase terms, exercise, obligation trigger, fee settlement, and the conversion. It is the only caller allowed to run the existing transfer-accept outcome for a loanee. Squad, inbox, HTTP, Transfer Market, and `contractManagement` accept do not invent a second path. Unrelated accepts still call `assertNoLiveLoanForTransfer`.
- **Terms on the loan row.** `purchase_type` = `NONE` | `OPTIONAL` | `MANDATORY` (default `NONE`). `purchase_option_stc` (default 0). `purchase_option_deadline` (null means loan `end_date`). `proposeLoan` persists them. Deadline must be on or before parent contract end and on or before loan `end_date`.
- **Not Send Contract Offer.** `assertCanCreateContractOffer` / Transfer Market stay blocked for signed players. Exercise is `POST` on the loan.
- **Optional flow.** Club B exercises → player inbox (permanent terms: salary, duration) → player accept. Reject: loan stays `ACTIVE`, terms stay `OPTIONAL`. Accept + open window: `convertLoanToPurchase`. Accept + closed window: queue on the same row (pending purchase metadata; status stays `ACTIVE` until conversion), execute-pending converts.
- **Conversion (one transaction).** Debit Club B / credit Club A for `purchase_option_stc` on the existing STC ledger; on shortfall roll back (`LOAN_INSUFFICIENT_STC`). Set loan `PURCHASED` + `completed_at` (no longer live). Create/activate a player-group contract with Club B. Run the existing accept side-effects: terminate/complete other live player-group contracts (Club A’s parent), set `players.club_id` to Club B, upsert membership. This is the first loan path that **is** allowed to move ownership.
- **Obligation flow.** `completeDueLoans` (and the same family of jobs): if `ACTIVE` and `MANDATORY` and today ≥ deadline, do not mark `COMPLETED`; run conversion (no player inbox). If window closed or STC short: leave `ACTIVE`, retry next job. If `OPTIONAL` or `NONE` and today ≥ `end_date`, keep today’s `COMPLETED` return.
- **Status.** `PURCHASED` is terminal. Not in `LIVE_LOAN_STATUSES`. Playing club after purchase is Club B via `club_id` / the new contract, not via a loan.
- **Actors.** Only the borrower club exercises an option (`LOAN_NOT_BORROWER` otherwise). `LOAN_NO_PURCHASE_OPTION` when type is not `OPTIONAL`. `LOAN_PURCHASE_TOO_LATE` after deadline. Not `ACTIVE` → `LOAN_NOT_ALLOWED`.
- **Money.** Loan fee already paid on activation is not refunded. Purchase fee is separate. Wage split ends because the loan is no longer `ACTIVE`; Club B then pays 100% of the new contract like any signed player.
- **New contract terms.** Option exercise: Club B supplies weekly salary and duration (player-group, non-ownership). Obligation: copy parent `weekly_salary_stc` and remaining parent contract end (or parent `max_days` remainder) so conversion does not invent a free-agent deal.
- **Window.** Same rule as contract offers and loan activation.
- **Schema.** Columns on `player_loans` plus pending-purchase metadata on that row if the window is closed after player accept. Do not add playing-club columns on `players`. Do not use `player_contracts.is_loan`.

## Testing Decisions

- Tests assert external behaviour through the loan module: terms persist; exercise + player accept + open window → `PURCHASED`, Club B owns `club_id`, parent contract not `active`, purchase ledger rows, B selectable without loan badge; insufficient STC → still `ACTIVE`, balances unchanged; unrelated accept while live still `LOAN_TRANSFER_CONFLICT`; optional expiry without exercise → `COMPLETED` and player returns to A; mandatory at deadline converts (or stays live on window/STC failure).
- Prior art: `playerLoanService` injected query/transaction harness; `functionsController` accept conflict test; loan fee settlement tests.
- Callers (accept, expire/complete-due, execute-pending, Transfer Market offer) get focused tests that they consult the module — not a second copy of purchase rules.
- No-loan and 01–06 fixtures stay green. Do not assert SQL shape.

## Out of Scope

- Performance clauses, appearance quotas as the obligation trigger (calendar deadline only)
- Counter-offers and changing purchase price after propose
- Mercato / club news / player news copy
- Recall fee and player veto of recall
- Using Send Contract Offer as the exercise path
- Modelling purchase as `player_contracts.is_loan`
- Ownership-contract purchase (player-group only)

## Further Notes

- Playable loans forbade moving `club_id` because a loan is not a transfer. A purchase **is** a transfer. The forbidden pattern remains “set `club_id` to the loan club and set it back later.” Conversion moves ownership once, through the existing accept outcome, after the loan is `PURCHASED`.
- Node still does not reliably increment `games_played`; obligation is not “after 20 appearances” in this slice.
- Backward compatibility: `purchase_type = NONE` (including existing rows) ⇒ tickets 01–06 behaviour.

## Post-ship hardening (16 Aug 2026)

An architecture review of the whole loan system found nine correctness gaps.
All are fixed; two changed agreed behaviour and are recorded here so they are
not undone.

**An obligation binds both clubs.** `recallLoan`, `proposeEarlyEnd` and
`acceptEarlyEnd` now throw `LOAN_PURCHASE_OBLIGED` when `purchase_type` is
`MANDATORY`, or when the player has already accepted a purchase that is queued
on `purchase_offer_status = 'PENDING_WINDOW'`. Ticket 09's "recall and mutual
early end still work" applies to `OPTIONAL` and `NONE` loans. Rationale: an
obligation Club A can unilaterally cancel is not an obligation, and a purchase
the player already accepted is owed regardless of purchase type.

**A queued purchase outlives the loan end date; an unanswered offer does not.**
`completeDueLoans` converts (or retries) any loan carrying a `PENDING_WINDOW`
purchase before considering completion — previously an `OPTIONAL` loan reaching
`end_date` with the window shut was marked `COMPLETED` and the agreed purchase
was silently lost. An offer still sitting at `AWAITING_PLAYER` when the loan
ends is cleared and counted in `offers_expired`. The player's accept is
deliberately *not* deadline-checked: the offer was validly made, and it now
expires with the loan instead.

**Loans settle before contracts expire.** `expire_overdue` and
`checkExpiredContracts` run `completeDueLoans()` first, because
`releasePlayerFromClubIfUnassigned` now refuses to free a player who has a live
loan. Without the reorder, a loan ending on the same day as its parent contract
would leave the player attached for a run.

New module exports used by callers outside the loan module:
`hasLiveLoan`, `assertNoLiveLoanForClubMove`, `getPlayingClubIds` (bulk).

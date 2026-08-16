# Loan recall and early end

**Status:** 05–06 done  
**Slice:** parent recall of an active loan, then mutually agreed early termination. Playing rights return to the owner without rewriting `club_id`. Later slices: option/obligation to buy, clauses, counter-offers, Mercato copy.

## Problem Statement

A playable loan can start and can end when `end_date` is reached. It cannot end early. Club A has no Recall Player action. Club B cannot send the player back by agreement. `CANCELLED` is only for pre-activation, so using it for an active loan would mix two meanings.

Presidents need the football behaviour from the original loan brief: if the agreement permits it, the parent club can recall; both clubs can agree to end early; the row is kept.

## Solution

Keep the dedicated `player_loans` row and the existing playing-club resolver. Early end is another way to leave `ACTIVE`, not a `club_id` restore and not a second contract.

**Recall** is a parent-club action on an `ACTIVE` loan. Status becomes `RECALLED`. Playing club falls back to the owner because there is no `ACTIVE` loan. Parent contract, membership, and `players.club_id` stay on Club A. The loan fee already paid is not refunded. This is not a transfer, so the transfer window is ignored.

**Mutual early end** is a two-club agreement on an `ACTIVE` loan. Status becomes `TERMINATED_EARLY`. Same playing-rights and ownership outcome as recall.

`completeDueLoans` still marks natural expiry `COMPLETED`. `CANCELLED` stays pre-activation only.

## Locked Decisions

- **Seam.** All recall/early-end rules live on `playerLoanService`. Squad, inbox, HTTP, and lineup only call it.
- **Statuses.** `RECALLED` and `TERMINATED_EARLY` are terminal. They are not live. `LIVE_LOAN_STATUSES` stays `PROPOSED`, `AWAITING_PLAYER`, `PENDING_WINDOW`, `ACTIVE`. After either early end, Club A may select, Club B may not, and a permanent player-group accept is allowed.
- **Recall actor.** Only the parent club (Club A) can recall. Borrower recall is `LOAN_NOT_PARENT`. The player is notified and does not accept or reject.
- **Recall permission.** `recall_allowed` (default `true` so existing active loans remain recallable) and optional `recall_after_date` (null = immediately). False → `LOAN_RECALL_NOT_ALLOWED`. Today before `recall_after_date` → `LOAN_RECALL_TOO_EARLY`. Not `ACTIVE` → `LOAN_NOT_ALLOWED`.
- **Window and money.** Recall and mutual end take effect immediately. No `PENDING_WINDOW`. No fee refund. Wages stop splitting because the loan is no longer `ACTIVE`.
- **History.** Do not delete the row. Set `completed_at` (and keep status `RECALLED` / `TERMINATED_EARLY`). No `club_id` write.
- **Propose fields.** `proposeLoan` may persist `recall_allowed` and `recall_after_date`. Defaults: allowed true, after-date null. Request Loan UI can expose them; if omitted, defaults apply.
- **Mutual end.** Either club proposes; the other club accepts. Player is notified, no player vote. A pending mutual request is not a second live loan; it is metadata on the same `ACTIVE` row (or a single inbox action against that row). Reject leaves the loan `ACTIVE`.
- **Inbox.** Reuse contract-offer delivery. Recall: notify borrower president and player. Mutual: notify the other club, then both clubs and the player on accept.
- **UI.** Club A On loan group: Recall when `recall_allowed` and the after-date has passed. Club B (and A) get Request return / Accept return for ticket 06.

## Testing Decisions

- Module tests: recall `ACTIVE` → `RECALLED`, `club_id` still A, playing club A, B not eligible; borrower cannot recall; `recall_allowed=false` and too-early dates fail with stable codes; mutual accept → `TERMINATED_EARLY` with the same playing-rights assertions; natural `COMPLETED` path unchanged.
- Callers: HTTP recall route and Club A squad Recall consult the module. No-loan and end-date completion tests stay green.
- Do not assert SQL shape.

## Out of Scope

- Recall fee / compensation
- Player veto of recall
- Transfer-window gating of return
- Option/obligation to buy
- Clauses, counter-offers, Mercato copy
- Using `CANCELLED` for an active loan
- Rewriting `players.club_id`

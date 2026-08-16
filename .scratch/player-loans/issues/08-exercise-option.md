# 08 — Exercise an option to buy

**What to build:** While a loan is `ACTIVE` and `OPTIONAL`, Club B’s president can Exercise option (not Send Contract Offer), set the permanent salary and duration, and send the player an inbox offer. Player reject leaves the loan `ACTIVE`. Player accept converts in one step: purchase fee Club B → Club A, loan becomes `PURCHASED`, Club A’s parent contract ends, `club_id` and membership become Club B, player is a normal signed player at B.

Closed window queues the conversion on the same row until execute-pending. Insufficient STC rolls back (`LOAN_INSUFFICIENT_STC`): loan stays `ACTIVE`, balances unchanged. Unrelated permanent accepts while the loan is still live still get `LOAN_TRANSFER_CONFLICT`.

**Blocked by:** 07 — Attach purchase terms to a loan request

**Status:** done

- [x] Borrower exercises `OPTIONAL` + `ACTIVE` → player inbox with permanent terms; loan stays `ACTIVE` until conversion
- [x] Player reject → `ACTIVE`, no fee, no ownership change
- [x] Player accept + open window → `PURCHASED`; fee settled; `club_id` is Club B; parent contract with A is not `active`; no LOAN badge
- [x] Closed window → conversion waits for execute-pending; then the same `PURCHASED` outcome
- [x] Insufficient STC → `LOAN_INSUFFICIENT_STC`, still `ACTIVE`, balances unchanged
- [x] Non-borrower / not optional / after deadline / not active → stable codes (`LOAN_NOT_BORROWER`, `LOAN_NO_PURCHASE_OPTION`, `LOAN_PURCHASE_TOO_LATE`, `LOAN_NOT_ALLOWED`)
- [x] Unrelated permanent accept while live still `LOAN_TRANSFER_CONFLICT`
- [x] Conversion lives on `playerLoanService`; Send Contract Offer stays blocked for signed players

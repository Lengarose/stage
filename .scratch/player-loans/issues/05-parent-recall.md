# 05 — Parent recall of an active loan

**What to build:** Club A’s president can recall a player on an `ACTIVE` loan when the agreement allows it. The row is kept as `RECALLED`. Playing rights return to Club A with no `club_id` rewrite. Club B and the player are notified. The player does not accept or reject. The transfer window is ignored. The loan fee is not refunded.

`recall_allowed` defaults true; optional `recall_after_date` (null = immediately). `proposeLoan` persists those fields when provided.

**Blocked by:** 04 — Return home and conflict guards

**Status:** done

- [x] Parent recall of `ACTIVE` → `RECALLED`; row kept; `club_id` and parent contract unchanged
- [x] After recall, Club A can select and Club B cannot
- [x] Borrower / non-parent → `LOAN_NOT_PARENT`
- [x] `recall_allowed` false → `LOAN_RECALL_NOT_ALLOWED`; before `recall_after_date` → `LOAN_RECALL_TOO_EARLY`; not `ACTIVE` → `LOAN_NOT_ALLOWED`
- [x] Borrower president and player are notified; no player accept step
- [x] HTTP `POST /api/stage/player-loans/:id/recall` and Club A On loan Recall call `playerLoanService` only
- [x] Natural end-date `COMPLETED` and pre-activation `CANCELLED` still behave as in 01–04

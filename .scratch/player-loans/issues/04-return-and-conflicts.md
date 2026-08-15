# 04 — Return home and conflict guards

**What to build:** When the loan end date is reached, a job in the same family as contract expiry marks the loan `COMPLETED` and keeps the row. Playing rights return to Club A with no `club_id` rewrite. Club B can no longer select the player; Club A can.

A second live loan cannot be activated for the same player (including concurrent attempts). An incompatible permanent contract accept while a loan is live is rejected so the parent contract is not terminated under an open loan.

**Blocked by:** 03 — Play for the borrower and split wages

**Status:** ready-for-agent

- [ ] End date reached → `COMPLETED`; row kept; playing club is the owner again
- [ ] After completion, Club A can select the player and Club B cannot
- [ ] Two activation attempts for the same player leave only one `ACTIVE` loan
- [ ] Permanent contract accept while a loan is `PROPOSED` / `AWAITING_PLAYER` / `PENDING_WINDOW` / `ACTIVE` → `LOAN_TRANSFER_CONFLICT`
- [ ] No-loan players still transfer, expire, and get paid exactly as before

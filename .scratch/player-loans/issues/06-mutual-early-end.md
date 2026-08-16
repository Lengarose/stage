# 06 — Mutually agreed early termination

**What to build:** While a loan is `ACTIVE`, either club can propose an early return. The other club accepts or rejects. Accept marks the same row `TERMINATED_EARLY` (not `CANCELLED`, not `RECALLED`). Playing rights return to Club A with no `club_id` rewrite. The player is notified and does not vote. Reject leaves the loan `ACTIVE`.

This is not a second live loan. It is an action on the existing row.

**Blocked by:** 05 — Parent recall of an active loan

**Status:** done

- [x] Either club can propose early end of an `ACTIVE` loan; the other club receives an inbox request
- [x] Accept → `TERMINATED_EARLY`; row kept; `club_id` unchanged; Club A can select; Club B cannot
- [x] Reject → loan stays `ACTIVE`; playing rights stay with Club B
- [x] Player is notified on accept; no player accept/reject step
- [x] Wrong club / not `ACTIVE` → stable loan error codes
- [x] HTTP and squad Request return / Accept return call `playerLoanService` only
- [x] Recall (`RECALLED`) and end-date (`COMPLETED`) paths still work

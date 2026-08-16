# 09 — Honour an obligation to buy

**What to build:** A `MANDATORY` loan cannot be declined by Club B. When the deadline is reached (default: loan end date), the same conversion as ticket 08 runs without a second player vote. Club B pays the purchase price, the loan becomes `PURCHASED`, and Club B becomes the owner.

If the window is closed or STC is short, the loan stays `ACTIVE` and the job retries — it must not silently `COMPLETED` as a free return. An `OPTIONAL` or `NONE` loan that hits `end_date` without a purchase still completes as today’s return home.

**Blocked by:** 08 — Exercise an option to buy

**Status:** done

- [x] `MANDATORY` at deadline + open window + sufficient STC → `PURCHASED` and Club B owns the player, no extra player inbox
- [x] Closed window or `LOAN_INSUFFICIENT_STC` → loan remains `ACTIVE` and retries; not `COMPLETED`
- [x] `OPTIONAL`/`NONE` at `end_date` without exercise → `COMPLETED`; playing rights return to Club A
- [x] New Club B contract copies parent weekly salary and remaining parent end (no invented free-agent terms)
- [x] Recall and mutual early end still work on non-converted loans
- [x] `completeDueLoans` / expire-overdue family and execute-pending consult the loan module only

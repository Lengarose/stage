# 07 — Attach purchase terms to a loan request

**What to build:** Club B’s president can set purchase type (none / option / obligation), STC price, and optional deadline on Request Loan. Those terms are stored on the loan row, shown on the parent and player inbox cards, and default to none so existing loans stay loans. Nobody can exercise or convert yet.

Deadline, if set, must be on or before the loan end date and the parent contract end date.

**Blocked by:** None — can start immediately (01–06 already shipped).

**Status:** done

- [x] Propose persists `purchase_type` `NONE` | `OPTIONAL` | `MANDATORY`, `purchase_option_stc`, and `purchase_option_deadline` (null = loan end date)
- [x] Omitted terms default to none / 0 / null; existing 01–06 propose tests stay green
- [x] Parent and player inbox copy shows type and price when not none
- [x] Invalid deadline → a stable loan error; row is not created
- [x] Transfer Market still blocks Send Contract Offer to signed players
- [x] HTTP/UI call `playerLoanService`; unused contract `is_loan` flags stay unused

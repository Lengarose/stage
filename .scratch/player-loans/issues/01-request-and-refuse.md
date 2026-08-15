# 01 — Request and refuse a loan

**What to build:** Club B’s president can open a player who already has an active player-group contract with Club A and submit a Request Loan (dates, STC fee, wage split totalling 100%). Club A’s president receives an inbox proposal and can reject it. The player is not asked yet. A rejected or invalid request leaves contracts, club_id, membership, and balances unchanged.

Permanent **Send Contract Offer** stays blocked for signed players. Request Loan is the path for them.

**Blocked by:** None — can start immediately.

**Status:** done

- [x] A president of Club B can propose a loan for a player with an active player-group contract at a different club
- [x] Club A receives an inbox proposal and can reject it → status `REJECTED`, no registration or STC change
- [x] No active player-group contract → `LOAN_NOT_ALLOWED`
- [x] Same club, end after parent contract, wage split ≠ 100, or a second live loan → the matching stable error code
- [x] The player-loan module is the only place those rules live; HTTP/UI call it
- [x] Existing unused contract loan flags are not used
- [x] Players with no loan still sign and appear in squads exactly as today

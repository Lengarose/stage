# 02 — Three-party accept without moving ownership

**What to build:** After a proposal exists, Club A can accept. Only then does the player get a loan offer. If the player accepts and the transfer window is open, the loan becomes `ACTIVE`. If the window is closed, it becomes `PENDING_WINDOW` and the existing execute-pending job activates it when the window opens.

Activation debits Club B and credits Club A for the loan fee on the existing STC ledger. If Club B cannot pay, nothing becomes `ACTIVE` and balances are unchanged.

`players.club_id` stays Club A. The parent player-group contract stays `active`. Membership and president identity stay on Club A. This must not run the transfer accept path that terminates other player-group contracts or replaces membership.

**Blocked by:** 01 — Request and refuse a loan

**Status:** ready-for-agent

- [ ] Parent accept → `AWAITING_PLAYER` and a player inbox offer naming both clubs, dates, fee, and wage split
- [ ] Player reject → `REJECTED`; player accept + open window → `ACTIVE`
- [ ] Player accept + closed window → `PENDING_WINDOW`; execute-pending then activates
- [ ] On `ACTIVE`: parent contract still `active`, `club_id` still the owner club, membership/president unchanged
- [ ] Loan fee settles Club B → Club A with ledger rows; insufficient STC rolls back completely (`LOAN_INSUFFICIENT_STC`)
- [ ] Wrong actor cannot accept/reject (`LOAN_NOT_PARENT` / `LOAN_NOT_BORROWER` / `LOAN_NOT_PLAYER`)
- [ ] Pre-activation cancel → `CANCELLED` with no registration change

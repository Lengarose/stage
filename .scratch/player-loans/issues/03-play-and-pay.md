# 03 — Play for the borrower and split wages

**What to build:** While a loan is `ACTIVE`, the player competes for Club B and is paid according to the agreed wage split. Club B’s squad shows them with a LOAN badge and may select them. Club A’s squad lists them as on loan at B and cannot select them. Profile shows playing club plus “on loan from” the owner. The contracts tab shows a loan chip on the still-active parent contract.

Weekly salary still comes from the parent contract amount. Club A pays its percentage, Club B pays its percentage, the player receives the sum. Finance usage on each club reflects that share. Lineup save/publish refuses a player whose playing club is not the lineup club. Appearances in matches Club B fields belong to Club B.

A player-president loaned to B remains president of A.

**Blocked by:** 02 — Three-party accept without moving ownership

**Status:** done

- [x] Playing club is the borrower; owner club cannot select (`LOAN_PLAYER_NOT_ELIGIBLE`); borrower can
- [x] Squad: Club B shows LOAN badge; Club A shows On loan at B until the end date
- [x] Profile current club is the playing club, with on-loan-from the owner; parent contract still listed with Club A
- [x] Lineup persistence rejects a player whose playing club is not that club (server-side)
- [x] Wage 30/70 (and 0/100, 100/0) debits the two clubs and credits the player for 100% of weekly salary
- [x] Owner wage bill uses the parent share; borrower wage bill uses the loan share
- [x] One club’s wage shortfall does not silently charge the other club; the loan stays `ACTIVE`
- [x] Player-president on loan at B still presides over A
- [x] Callers (squad list, salary job, lineup) use the player-loan module; they do not copy loan conditionals

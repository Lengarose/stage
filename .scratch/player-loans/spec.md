# Playable Player Loans

**Status:** done  
**Slice:** playable loans (request / three-party accept / wage split / STC fee / squad eligibility / return). Later slices: counter-offers, performance clauses, option/obligation to buy, recall, Mercato copy.

## Problem Statement

A president can already sign a player with a permanent player-group contract. There is no way to let that player compete for a second club for a limited period without treating the move as a transfer.

Today, “the player belongs to this club” is one fact: the parent contract’s club, `players.club_id`, and the active club membership all move together. Accepting a contract overwrites the current club, replaces membership, and terminates every other live player-group contract. Unused loan columns and Mercato loan labels exist, but they do not execute a loan.

Presidents need a real football loan: Club A keeps the permanent contract; Club B gets temporary match registration; the player must agree; wages and an STC fee can be split; when the loan ends the player plays for Club A again. Existing players with no loan must keep today’s behaviour.

## Solution

Add a dedicated loan agreement, separate from the parent player-group contract. The parent contract stays `active` with Club A. A loan module is the only place that decides owner club vs playing club, eligibility, activation, completion, wage split, and the immediate loan fee.

Club B’s president requests a loan for a contracted player. Club A’s president accepts or rejects. The player then accepts or rejects. All three must accept before the loan can become `ACTIVE` (or `PENDING_WINDOW` if the transfer window is closed). Activation does not change `players.club_id`, does not replace club membership, and does not terminate the parent contract.

While the loan is active, Club B may select the player for matches and Club A may not. The player’s profile shows the playing club plus “on loan from” the owner. Weekly wages follow the agreed split. Club B pays the upfront loan fee on activation, recorded on the existing club STC ledger. When the end date is reached, the loan completes and playing rights return to Club A.

## User Stories

1. As Club B’s president, I want to request a loan for a player who already has an active player-group contract with Club A, so that I can add them to my match squad without buying them.
2. As Club B’s president, I want Transfer Market to keep blocking a permanent contract offer to a signed player, so that a loan is not confused with a transfer.
3. As Club B’s president, I want a Request Loan action on a signed player, so that the loan path is obvious when a contract offer is not allowed.
4. As Club B’s president, I want to set start date, end date, loan fee in STC, and a wage split that totals 100%, so that the proposal is a complete offer.
5. As Club A’s president, I want an inbox proposal when Club B requests one of my contracted players, so that I can accept or reject without hunting for it.
6. As Club A’s president, I want to reject a loan proposal, so that my player stays exclusively available to my club.
7. As a player, I want an inbox loan offer only after both clubs have agreed, so that I am not asked to decide a deal the parent club has not accepted.
8. As a player, I want to accept the loan, so that I can play for Club B for the agreed period.
9. As a player, I want to reject the loan, so that I stay with my parent club.
10. As any party, I want a rejected or cancelled proposal to leave club registration, membership, contracts, and balances unchanged, so that a refused loan is a no-op.
11. As Club B’s president, I want the loan to become active only when the transfer window is open, so that loans follow the same mercato calendar as contract offers.
12. As Club B’s president, I want an agreed loan to wait as pending-window when the window is closed, so that we do not have to re-negotiate when the window opens.
13. As a competition operator, I want pending-window loans to activate with the existing execute-pending window job, so that loans and queued contracts open together.
14. As Club A’s president, I want the parent player-group contract to stay active for the whole loan, so that I still own the player when the loan ends.
15. As Club A’s president, I want `players.club_id` to stay Club A during the loan, so that ownership is not rewritten as if this were a transfer.
16. As Club A’s president, I want club membership and president identity to stay on Club A during the loan, so that loaning a player-president does not strip Club A of its president.
17. As a player-president on loan at Club B, I want to keep presiding over Club A while I play matches for Club B, so that sporting registration is not confused with club ownership.
18. As Club B’s president, I want the player in my playing squad with a LOAN badge, so that I can tell loanees from permanent players.
19. As Club A’s president, I want the player in an On loan group showing Club B and the end date, so that my squad still accounts for them without offering them for selection.
20. As Club A’s president, I want the match lineup to refuse that player while they are on loan, so that I cannot field a player who is registered elsewhere.
21. As Club B’s president, I want to select the loanee in my lineup, so that they can play for me.
22. As Club B’s president, I want lineup save/publish to refuse a player whose playing club is not my club, so that eligibility is enforced on the server, not only in the squad list.
23. As a player on loan, I want my profile to show Club B as current club and “On loan from Club A until {date}”, so that visitors see both relationships.
24. As a player, I want my parent contract still listed with Club A, so that the loan is visibly temporary.
25. As Club A’s president, I want the contracts tab to show an attached loan chip on the parent contract, so that an active loan is not mistaken for a completed transfer.
26. As Club B’s president, I want the loan fee taken from my club STC and credited to Club A only when the loan activates, so that a proposal does not spend money.
27. As Club B’s president, I want activation to fail with no loan and no balance change if I cannot pay the immediate fee, so that money and registration cannot diverge.
28. As Club A’s president, I want my wage bill during the loan to be only my agreed percentage of the parent weekly salary, so that I am not paying 100% for a player I cannot select.
29. As Club B’s president, I want my wage bill to include my agreed percentage of that salary, so that I pay for the player I am fielding.
30. As a player, I want to receive the full weekly salary as the sum of both clubs’ shares, so that the split is a club matter, not a pay cut.
31. As a club president, I want each STC movement to appear on the existing club/player ledgers, so that audits match other fees and wages.
32. As a competition operator, I want match appearances during the loan attributed to Club B, so that stats follow the club that fielded the player.
33. As Club A’s president, I want the loan to complete on the end date and the player to become selectable for me again, so that I do not have to process a return transfer.
34. As Club B’s president, I want to lose selection rights when the loan completes, so that an expired loanee cannot stay in my XI.
35. As a player, I want completed loans kept as history, so that past spells remain on my profile later (history display can be thin in this slice; the rows must not be deleted).
36. As Club A’s president, I cannot loan a player who has no active player-group contract, so that free agents use the existing signing path instead.
37. As Club B’s president, I cannot set a loan end date after the parent contract ends, so that I never hold a player Club A no longer employs.
38. As a president, I cannot loan a player to their own parent club, so that a loan always has two distinct clubs.
39. As a president, I cannot have two live loans (proposed, awaiting player, pending-window, or active) for the same player, so that registration cannot fork.
40. As two clubs, I want concurrent activation attempts for the same player to leave only one active loan, so that a race cannot double-register them.
41. As a buying president, I cannot complete an incompatible permanent contract accept while a loan is live, so that the parent contract is not terminated under an open loan.
42. As a player with no loan, I want contracts, squad, wages, and transfers to work exactly as they do today, so that the loan system is additive.
43. As Club B’s president, I want wage percentages that do not sum to 100 rejected, so that silent under/overpay cannot be saved.
44. As the wrong actor, I cannot accept or reject a loan step that is not mine (parent / borrower / player), so that a third club cannot steal the deal.
45. As Club A’s president, I want a clear error when I try to select a loanee, so that the refusal is explained rather than a missing name.
46. As an operator, I want existing unused contract loan flags left unused, so that a loan is not modelled as a second player-group contract.
47. As Club B’s president, I want finance usage to count the loan fee and my wage share before activation, so that I cannot propose a deal my budget cannot carry.
48. As a player, I want inbox copy that names both clubs, the fee, the wage split, and the dates, so that I know what I am accepting.
49. As Club A’s president, I want to cancel a proposal that is not yet active, so that a stale request does not linger.
50. As a later Mercato slice, I want this slice to leave a stable loan id and status, so that official copy can attach without changing ownership rules.

## Implementation Decisions

- **Seam.** One deep player-loan module owns eligibility, lifecycle, owner vs playing club, wage split amounts, and immediate fee settlement. Squad listing, salary jobs, contract accept, lineup save/publish, identity “my club”, and inbox callers invoke that module. They do not reimplement “if loan then …”.
- **Not a second contract.** A loan is not a live player-group contract with the borrower. Accepting a player-group contract already terminates other live player-group contracts; a loan must not go through that path.
- **Ownership pointer.** `players.club_id` remains the owner club for the playable slice. Playing club is resolved from the active loan, else the owner club.
- **Membership.** Loan activation does not run the transfer membership upsert that ends other active memberships. Parent membership and president identity stay on the owner club. The borrower gets match registration via the loan module, not a replacement membership.
- **Statuses.** `PROPOSED` → `AWAITING_PLAYER` → `ACTIVE` or `PENDING_WINDOW` → `COMPLETED`, plus `REJECTED` and `CANCELLED`.
- **Three-party order.** Borrower proposes. Parent accepts or rejects. Only after parent accept does the player see the offer. Player accept activates or queues for the window.
- **Transfer window.** Same rule as contract offers: activate only while the window is open; otherwise `PENDING_WINDOW` until execute-pending.
- **Duration.** Calendar `start_date` and `end_date`. `end_date` must be on or before the parent contract end date. No game-count loans in this slice.
- **Fee.** `loan_fee_stc` is upfront. Reserve/lock at propose if the existing finance lock pattern applies; settle Club B debit and Club A credit on activation. Insufficient funds abort activation inside a transaction: no `ACTIVE` row, no balance change.
- **Wages.** Parent contract `weekly_salary_stc` remains the salary source. Parent percentage plus loan percentage must equal 100. Weekly pay debits each club for its share and credits the player for the sum. A club shortfall fails that club’s share the way today’s salary shortfall does; the loan stays `ACTIVE`; the other club is not silently charged the gap.
- **Finance usage.** Owner club wage usage includes the parent share of that salary. Borrower wage usage includes the loan share. Borrower cash/transfer checks include the immediate loan fee. Ownership contracts remain excluded from wage bills.
- **Conflicts.** At most one live loan per player (`PROPOSED`, `AWAITING_PLAYER`, `PENDING_WINDOW`, `ACTIVE`). Permanent contract accept while a loan is live is rejected. Parent club and loan club must differ.
- **Eligibility.** Playing club may select the player. Owner club may list them as on loan and must not select them. Lineup persistence must check playing club, not only the squad query.
- **Stats.** Match player stats already store a club on the row. Appearances during an active loan belong to the borrower because that club fielded the player.
- **Completion.** A scheduled/legacy job, in the same family as contract expiry, marks `COMPLETED` when now ≥ end date. Rows are kept. Playing club falls back to the owner. No `club_id` restore write is required because it never moved.
- **Schema.** Dedicated loan table (player, parent contract, parent club, loan club, dates, fee, wage percentages, status, three-party timestamps, activated/completed timestamps). Database-level uniqueness for one live loan per player where practical. Do not add playing-club columns on `players` in this slice. Leave existing unused contract `is_loan` / `loan_return_date` unused.
- **HTTP.** Thin routes around the loan module (create, parent accept/reject, player accept/reject, cancel, list by player/club). Error codes are stable strings (`LOAN_NOT_ALLOWED`, `LOAN_SAME_CLUB`, `LOAN_BEYOND_CONTRACT`, `LOAN_ALREADY_LIVE`, `LOAN_INSUFFICIENT_STC`, `LOAN_WAGE_SPLIT_INVALID`, `LOAN_TRANSFER_CONFLICT`, `LOAN_NOT_PARENT`, `LOAN_NOT_BORROWER`, `LOAN_NOT_PLAYER`, `LOAN_PLAYER_NOT_ELIGIBLE`). `PENDING_WINDOW` is a successful queue, not a hard fail.
- **Inbox.** Reuse the contract-offer delivery pattern (inbox + notification) with loan-specific copy and actions. No counter-offer in this slice.
- **UI.** Request Loan on signed players; loan proposal dialog; inbox cards for parent and player; squad On loan group and LOAN badge; profile current club + on-loan-from line; contracts tab loan chip. No Mercato official story in this slice.

## Testing Decisions

- Tests assert external behaviour through the player-loan module: given clubs, a parent contract, and a proposal, assert status, owner club, playing club, ledger effects, and eligibility. They do not assert SQL shape or internal helpers.
- Prior art: lifecycle services tested with an injected query/transaction adapter (`node:test`); squad listing tests that mock the database and assert who is returned; frontend source tests for offer visibility and squad merge.
- Callers that must stay honest (squad list, salary job, contract accept, lineup) get focused tests that they consult the loan module’s playing-club/eligibility results — not a second copy of loan rules.
- No-loan fixtures must keep existing contract, membership, and transfer tests green.
- Required scenarios: no contract → `LOAN_NOT_ALLOWED`; propose → `PROPOSED`; parent then player accept with open window → `ACTIVE`, `club_id` unchanged, parent contract still `active`; 30/70 wage split; complete → playing club is owner, borrower cannot select; owner cannot select while active, borrower can; concurrent activate → one winner; insufficient STC → no active loan, balances unchanged; reject by parent or player → `REJECTED`, no registration change; closed window → `PENDING_WINDOW` then execute-pending activates; permanent accept while live → `LOAN_TRANSFER_CONFLICT`; player-president loaned out remains president of the owner club.

## Out of Scope

- Counter-offers and multi-round negotiation history
- Performance clauses, appearance/goal/assist bonuses, milestone fee installments
- Option to buy and obligation to buy
- Recall and mutually agreed early termination UI (status `CANCELLED` is only for pre-activation)
- Mercato headlines, club news, and player news copy (loan id/status must remain attachable later)
- Changing `players.club_id` into a playing-club cache
- Modelling the loan as `player_contracts.is_loan`
- Game-count or season-id duration (calendar dates only)
- National-team registration

## Further Notes

- Founder dual contracts (player-group + ownership) already allow two contracts for one person at one club. A loan is the first case of two clubs at once; ownership stays on the parent club.
- Node match completion does not reliably increment contract `games_played`; this slice therefore uses calendar end dates, not appearance quotas.
- Mercato already has loan deal types and a Loans filter. This slice must not infer a loan from `contract_type = trial` or by writing a second contract. Later Mercato work should publish from the loan row.
- Backward compatibility rule: no live loan ⇒ existing Stage Leagues behaviour.

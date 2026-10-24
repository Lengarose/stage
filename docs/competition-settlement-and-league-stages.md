# Competition Settlement and League Stages

Implementation and verification report, 2026-10-24.

## 1. Verified Payout Failure

`advanceCommunityTournamentIfReady` previously distributed prizes only inside
the branch where progression newly completed a tournament and returned a winner.
An already-completed tournament did not enter that branch. Payout exceptions were
logged and discarded. A trophy could therefore exist without a successful payment
or a durable financial retry. The regression test reproduced zero payout attempts
for an already-completed tournament before the fix, and now passes.

Regional and GOST completion did not have equivalent automatic prize settlement.
The archival reward flow also had a client-side balance/ledger fallback that was
not atomic. That fallback has been removed.

## 2. Automatic Settlement

The server captures configured obligations before progression, then settles final
placements independently of whether a trophy was previously awarded. Completion
paths for tournaments, regional leagues, and GOST editions call the same service.
The retry worker processes only previously captured pending/failed settlements.
It does not scan and pay every historical completed competition on startup.

Club prizes credit `clubs.stc` and `stc_transactions`. Player prizes credit
`players.stc` and `player_stc_transactions`. Descriptions and durable fields
identify the competition, edition, recipient, position, amount, and payment key.
Balances and ledger entries commit in one transaction. Calculations use integer
cents and SQL decimal arithmetic. Prize settlement does not debit entry fees again.

Existing configuration stores explicit amounts, not prize percentages. No new
percentage scheme or fallback 70/20/10 distribution was introduced. Unknown
configuration or unsupported placements block payment rather than inventing one.
Zero-valued configured prizes create no financial transactions.

League positions use the existing final-standings ordering, including exclusions
and recorded points. Knockout placements use confirmed final/placement outcomes.
Equal elimination bands are paid only where the saved configuration explicitly
defines equal awards for that band.

## 3. Duplicate Prevention

- Competition/edition rows are locked during settlement.
- Each position has a unique competition/type/edition obligation.
- Each new ledger payment has a unique settlement key.
- Existing proven payments reduce only that obligation's missing amount.
- Changed recipients/amounts conflict with prior obligations instead of silently
  paying a replacement winner or reversing money.
- Trophy ownership is never payment evidence.

Internal settlement state uses the existing `league_entities` store with
`entity_type='competition_settlement'`; it is not a second wallet or ledger.
States include pending, failed, blocked, paid, and zero_prize. Failure reasons are
retained. New payout rows link an existing competition instance where available;
otherwise their explicit source/edition identifies the obligation.

## 4. Historical Review and Repair

Use the authenticated admin endpoint:

```text
POST /api/stage/competition-views/:kind/:id/reconcile
```

Kinds: `tournament`, `regional_league`, `competition_season`.
Use a regional league season's root ID, or a GOST `CompetitionSeason.id`, not the
parent competition ID.

Read-only preview body:

```json
{}
```

Apply only after inspecting every expected recipient, proven payment, missing
amount, and blocking reason:

```json
{"apply":true,"reason":"Reviewed the original edition prize obligations and ledger evidence"}
```

Identity comes from authentication, never a supplied admin ID. Applying writes an
audit record. Repeating the action does not duplicate payments. Legacy references
must establish the edition; an ambiguous parent-competition reference is flagged,
not accepted as proof and not ignored as unpaid. Transaction descriptions alone
never prove payment. Historical achievement amounts can establish obligations,
but achievements do not prove payment. Current defaults are not substituted for
missing historical configuration. No production reconciliation was executed.

## 5. Space League Wagers

Inspection found non-atomic stake reservation, separately committed refunds, and
settlement that swallowed credit failures before marking the wager settled.
The player RPC also duplicated that unsafe settlement implementation.

Reservation, settlement, draw refunds, cancellation refunds, and admin resolution
now use a separate wager transaction service. It locks the match and recipient
accounts, verifies both reservations, changes balances and existing ledgers, then
changes wager status in the same transaction. Reservation failure rolls back both
stakes. Existing draw refunds and the two-stake pot are preserved. Financial
errors are not swallowed by the match cancellation/acceptance callers.

An active legacy wager with evidence of prior payment is blocked for review, not
paid again. Admin resolution is audited. This remains separate from placement
prizes. Tests cover clubs, players, concurrent retries, draws, failed ledger
inserts, insufficient second-account funding, cancellation, and disputed results.

## 6. Regional and GOST Stages UI

The Fixtures navigation label is now Stages. Both detail pages use an adapter for
the existing shared tournament Stages component. Headers, management controls,
standings tabs, registration, and season selection remain intact.

The shared view provides league matchdays within League Phase, knockout stage
aliases, two-leg sections, home/away rows, right-hand Fixtures/Results previews,
and accessible dialogs with independent stage/matchday navigation. Single-phase
dialogs use matchday controls without a redundant stage-navigation bar. The main
selection survives closing a dialog. Lists scroll vertically under the pointer;
statistics are paginated without truncating participants. Panels have square
corners and previews stack on small screens. No generated UI primitives changed.

## 7. Whole-Round Progression

Regional/GOST progression locks the edition and its fixtures and uses one
transaction for all next-round writes. Completion checks use authoritative linked
matches and expected fixture counts, not just the statuses of existing rows.
Regional double-round-robin counts and configured GOST matchdays must be complete.
Knockout stages require all expected legs and resolved aggregate ties.

The old aggregate shortcut that treated the second-leg winner as the aggregate
winner was removed. New permitted draws are shuffled within the existing seeded
groups, while explicit fixed-pairing configuration preserves fixed pairings.
Deterministic fixture IDs and edition locking prevent duplicate draws. League-only
formats finish via standings without acquiring knockout stages. Player tournament
bracket advancement remains on its existing tournament service.

## 8. Recovery and Corrections

The same admin endpoint can preview progression with:

```json
{"action":"progression"}
```

Applying requires `apply:true` and a reason. It uses the server progression
service and existing fixture identities, and audits mutations. It can create a
missing successor for an otherwise complete round without a page visit.

Correction guards reject changes affecting established final placements/prizes
or downstream scheduling/reports/results. Idle successor draws are also
conservatively blocked: this implementation does not automatically dismantle and
rebuild an existing draw during a league correction. They require explicit admin
review and removal of genuinely idle dependencies first. Historical results and
individual statistics are not silently erased. GET match retrieval no longer
settles deadlines or mutates results.

## 9. Statistics and Participation

Both league types reuse the tournament aggregation implementation, scoped to the
selected league season or GOST edition. APIs expose category keys, complete counts,
and optional group/category pagination. Club goals come from confirmed official
scores; aggregate totals are not counted as extra matches.

Rankings cover club scoring/conceding, individual goals/assists/ratings/awards/
appearances, and goalkeeper clean sheets/conceding averages/ratings. Rankings use
sporting ties and deterministic display order. Zero-appearance clubs do not lead
defensive rankings. Individual rows retain the club represented in the report.

Actual participation comes from verified match statistics or reliable confirmed
report evidence, not membership, registration, or an unused substitutes bench.
Missing ratings do not become zero. Goalkeepers require verified full-match GK
participation; no intervals or minute-level goal attribution are invented.
Administrative scores do not create footballer facts. No historical lineups were
fabricated or backfilled. Polling/focus refresh picks up confirmed changes.

## 10. Migrations and Deployment

`schema.sql` and idempotent startup migrations add settlement references to both
existing ledgers, edition/position/configuration fields to `competition_payouts`,
and matching uniqueness indexes. The payout instance link permits null when no
backfilled instance exists. Player STC storage is normalised to DECIMAL(12,2).
Money columns are added after their tables have been created.

Deploy the changed backend files and restart the Gandi app to run migrations.
Inspect migration logs, verify constraints, then deploy the rebuilt frontend.
No dependencies were added. Schema migrations do not execute business payouts
or draws. Review historical competitions through the protected preview endpoint.

## 11. Verification

- `npm run lint`: passed.
- `npm run typecheck`: passed.
- Backend syntax checks, including `server/src/server.js`: passed.
- `npm run build`: passed; existing chunk-size/Browserslist warnings remain.
- Backend suite: 614 tests, 611 passed, 3 existing failures.
- Frontend suite: 336 tests, 332 passed, 4 existing failures.
- The three backend failures were reproduced with pre-change HEAD modules using
  an isolated preload, without changing the working tree. They concern captain
  profile editing, legacy fixture conversion, and a registration upload label.
- Frontend failures concern unchanged header menus, FUT avatar painting, signed-
  club GameDay loading, and profile-photo editing assertions.
- New financial/whole-round tests and shared Stages tests pass. Local HTTP tests
  exercise both league views, full/paginated statistics, unauthorised rejection,
  read-only reconciliation, audited apply, and duplicate repair requests.
- Controlled local data verifies actual zero-goal participation, exclusion of an
  unused goalkeeper, missing ratings, and historical club attribution.
- Headless Chrome verified desktop/mobile overflow, central/dialog wheel scrolling,
  preview dialogs, local matchday selection, stage boundaries, and Schedule
  visibility. Screenshots are in `/private/tmp/stage-league-*.png` and
  `/private/tmp/stage-ghost-mobile.png`.
- `graphify update .`: unavailable (`graphify` is not installed). No graph report
  or wiki index was available to read in the existing graph output directory.

## 12. Limits and Operational Review

No local MySQL service/CLI was available. Financial and HTTP runtime tests use
isolated transaction/SQL adapters, not a real MySQL server. InnoDB behaviour,
migration execution, production authentication, and real financial-history views
still require a configured staging database before deployment. Browser checks
used mocked local data and did not contact production APIs. Local Vite is running
at `http://127.0.0.1:5194`, with its API proxy explicitly pointed at local port 8080.

Historical editions missing an original reward snapshot, reliable legacy payment
references, configured expected matchdays, or resolved aggregate decisions remain
blocked for review. Missing participation cannot be repaired from roster membership.
Existing-draw correction rebuilding and ambiguous financial reversals are not
automated. No production balances, fixtures, trophies, or historical reports were
modified by this session.

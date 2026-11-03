# Regional promotion calendar — 3 November 2026

The user explicitly confirmed: semifinals on Tuesday of playing week 11 at
20:00, finals on Thursday of that week at 20:00, Europe/Brussels, 60-minute
blocks. An unresolved source league ranking or calendar clash blocks publication;
no winner, substitute date or override is inferred.

## Where it appears

Admin → Regional Leagues → Regional cycles and sporting allocation → select a
saved **next-season transition** → **Promotion calendar / Promotiekalender**.

1. Finish the source league results and resolve required sporting decisions.
2. Prepare/reconcile the transition draw using the existing cycle controls.
3. Preview the semifinals. Dates derive from the source season's published
   league calendar, not a manually supplied date or the target season's calendar.
4. Review the blockers, supply a reason and publish the stage together.
5. After both semifinals of every D2 group have confirmed results, reconcile the
   cycle to materialize the real finals. Preview and publish the finals.

This schedules an entire stage in one action. It does not yet turn result
reconciliation or stage publication into an unattended scheduler. The existing
per-match Admin action remains available for reviewed exceptions.

## Implementation boundaries

- Protected business endpoint:
  `POST /api/stage/regional-leagues/cycles/:cycleId/calendar`.
  Body: `stage: semifinal | final`; publication also requires `apply:true`,
  `expected_revision` and `reason`. Participants and dates cannot be supplied.
- Current official European transition snapshots only, with supported structure,
  source-ranking and participation policy versions. Legacy cycles do not acquire
  new scheduling conditions silently. Placement, GOST and D3 remain separate.
- Reads fresh sporting evidence through the existing cycle evaluator. Stored
  fixture references, opponents, source mappings, canonical Match identity and
  knockout rules must agree. Reconcile missing finals first; no placeholder
  opponents, partial stage publication or automatic winner is created.
- Requires exactly one published source league calendar covering every source
  edition. Tuesday/Thursday week 11 is derived from its first-playing-week Monday.
- Reuses current block, overlap, per-day/per-week and playing-evening limits.
  Cross-competition club bookings count conservatively. Individual-player future
  multi-event availability remains outside this stage planner.
- Review revision covers the policy, cycle, draw, matches, preparations, source
  calendar and bookings. Re-read on publication prevents stale review.
- GameDay and engine times, fixture audits, notifications and the internal
  `regional_pathway_calendar` publication record share one transaction and the
  official calendar write mutex. Failed writes roll back the whole stage.
- Published stage retries return the saved historical publication without
  duplicate audits/notices. Later controlled rescheduling does not rewrite that
  historical snapshot; consult current fixtures/GameDay for the current time.
- No overwrite of existing schedules, preparations, reports or played games.
  Missing/expired week-11 slots require review; no automatic calendar fallback.
- Source ties, expansion decisions, 180→240 growth, cups and mini-league decision
  calendars are not assigned invented dates. Their sporting formats stay intact.
- The shared schedule model now imports `unpack` for real legacy-fixture booking
  reads. A regression test executes that model method, rather than mocking it.
- No physical table or new generic CRUD route; internal snapshots use the existing
  flexible store. Admin identity comes from the server-side user lookup.

## Verification and deployment status

196 selected regression tests pass, including the cycle, calendar and GameDay suites.
Service/real local HTTP tests use controlled model and auth fixtures;
no production database/JWT is used. They cover derived times, late/unresolved
stages, final winners, identity, source revisions, collisions, permission,
confirmation gating, rollback, retries and real model JSON unpacking.
Lint, typecheck, server syntax and frontend build are checked separately.
Production MySQL/concurrency, host throughput and browser interaction still need
staging verification. No deployment, payment, reset or production data operation
was performed. The prior two documented functionsController baseline failures
remain excluded from the selected regression suite.
Graphify report/wiki are absent and the CLI is not installed.

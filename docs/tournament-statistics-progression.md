# Tournament Statistics and Progression

## Scope and Authority

The existing tournament detail page and Stats tab share the same implementation
for admin-created and user-created events. The selectable stored formats are
`knockout`, `group_stage` (groups followed by knockout), `league` (double
round-robin), and `swiss_ucl` (eight league matchdays followed by knockout).
Legacy `double_elimination` creation is disabled; existing records retain their
previous knockout-like progression, without introducing a new losers bracket.
Standalone `swiss` is a legacy display alias, not a selectable server format.

`matches` supplies official scores. A completed result must have a confirmed
result state, or the legacy `stats_processed=1` completion marker. Disputed,
pending, voided, cancelled, and bye records do not contribute played results.
Existing administrative/forfeit scores contribute participant totals, never
invented footballer performances. Duplicate match IDs count once.

`match_player_stats` supplies historical player/club attribution. New confirmed
reports persist the official result and its statistics in one transaction.
An explicitly selected participant receives `participation_verified=1`, even
with zero goals/assists and no rating. Unused substitutes are not selected.
The report allows an actual match position, an explicit Player of the Match
award, and a full-match goalkeeper declaration. More than one full-match
goalkeeper per club is rejected. No award is inferred from a rating.

Historical appearances are included only with a verified flag, an explicit
report participation list and statistics row, or recorded scorer/assist evidence.
Empty legacy rows, membership and registration alone are insufficient. No
historical lineups are fabricated or bulk backfilled. Transferring clubs does
not change the club ID captured with a match appearance. Missing ratings stay
missing and do not enter an average; there is no minimum appearance threshold.

Goalkeeper rankings currently use verified full-match GK declarations only.
Goals conceded use the official opponent score and clean sheets require zero
conceded. There is no reliable interval/goal-timing record, so substituted
goalkeepers are excluded from these full-match rankings, not assigned invented
minutes or conceded goals. Historical goalkeeper data may therefore be absent.

## Progression and Dependencies

`tournamentProgressionService` serializes work with the tournament row lock and
locks its match rows. Persisted unique progression keys and deterministic match
IDs prevent retry/concurrent draw duplication. No page visit performs a draw.
Official result processing calls the central competition engine immediately
after the result/statistics transaction, before ancillary career/economy work.

Club knockout rounds wait for all required ties, including all required legs
and aggregate decisions. Then the eligible winners receive a fresh persisted
draw. Group cross-seeding and UCL seed restrictions retain their fixed pairings.
Player brackets fill decided slots individually, including UCL knockout ties;
unknown opponents are unschedulable and cannot open GameDay. Required group or
league qualification still waits for the phase. League-only events finish from
standings. Byes qualify without being played appearances or inventing losers.
Tied two-leg aggregates use the existing extra-decider mechanism automatically.

Eligible knockout and group-to-knockout events generate a single-match
Third-Place Playoff from the two resolved semifinal losers. It is excluded from
UCL, league-only and legacy double-elimination events. The Stages dropdown puts
it immediately before Final, including preview modal navigation. Final kickoff,
reporting and completion require a resolved playoff. The final must be scheduled
after the playoff; conflicting schedule proposals/acceptances are rejected.
No arbitrary kickoff dates are generated.

Admin score corrections invalidate idle downstream qualifiers and retain prior
player-stat rows marked superseded. Corrections are administrative scores until
a new genuine report is confirmed; superseded footballer performances do not
remain official. Downstream scheduling, reports, results, media, wagers or other
detected activity cause a conflict instead of destructive reconciliation.
Already awarded tournaments require explicit administrative resolution rather
than silently rewriting prize/trophy history.

## Deployment and Recovery

Upload the changed backend files, then restart the app so the idempotent startup
migrations run. Fresh-install definitions in `server/schema.sql` match them:

- Matches: `progression_key`, `qualification_sources`, `report_finalized`,
  `administrative_result`; unique `(tournament_id, progression_key)`.
- Match statistics: `participation_verified`, `goalkeeper_full_match`,
  `is_superseded`, `appearance_key`; unique `appearance_key`.

Existing nullable keys are not fabricated and historical evidence is retained.
Build/deploy the frontend separately. Direct generic player-stat mutations now
return 403; use the authenticated match reporting workflow.

An administrator can preview a stuck tournament with:

```http
POST /api/stage/tournaments/:id/reconcile-progression
Authorization: Bearer <admin token>
Content-Type: application/json

{"dry_run": true}
```

After reviewing its plan, send `{"dry_run":false,"reason":"Reviewed recovery"}`
to apply the same idempotent rules with an admin audit entry. Default is dry-run.
Existing valid draws are preserved. Idle incorrect third-place fixtures and
premature idle club rounds may be removed; active or historical conflicts are
reported without deleting them. Resolve those dependencies through existing
admin workflows, then preview again. This endpoint does not erase completed
records or provide a bypass for paid/awarded tournament conflicts.

The same reconciler is available to a server job every 60 seconds when an
operator explicitly sets `TOURNAMENT_RECONCILIATION_ENABLED=true`. It is off by
default, preventing an unreviewed historical production sweep on deployment.
Normal confirmed results still trigger progression without this flag.

## Verification Limits

The local HTTP integration test runs the real Express routes and aggregation/
reconciliation services with an isolated SQL adapter. Unit tests exercise round,
ranking, correction and concurrency behavior. These are not live MySQL locking
or migration tests. Production data has not been changed. Deployment must verify
startup columns/indexes, real simultaneous confirmations and authenticated
end-to-end reports against a configured staging database before rollout.

Verification performed in this implementation:

- `npm run lint`, `npm run typecheck`, `node --check server/src/server.js`,
  production build and `git diff --check`: passed.
- Backend suite: 572/575 passed. Remaining pre-existing failures are legacy
  captain profile edit access, `createMatchFromLeagueFixture` snapshot setup,
  and an obsolete `ultimate_team` versus `registration_upload` expectation.
- Frontend suite: 315/319 passed. Remaining pre-existing failures concern header
  identity navigation, FUT avatar-frame markup, GameDay club loading, and profile
  photo preview markup. These failures were reproduced from the original revision.
- New statistics/progression/HTTP/security/report tests pass, including concurrent
  reconciliation, actual zero-goal keeper participation, unused substitute
  exclusion, missing ratings, historical clubs, third-place dependencies, and
  correction preservation. The concurrency adapter serializes transactions; real
  database isolation still requires staging verification.
- Headless Chrome checks passed at 1440px and 390px widths: all 16 participants
  accessible by scrolling, category switching, no-play defensive ordering,
  goalkeeper missing ratings, no document overflow, and third-place preview
  navigation. Vite HMR's websocket was blocked by Chrome's local-network policy;
  no component runtime errors occurred. Live socket delivery was not verified.
- `graphify update .` could not run because `graphify` is not installed. The
  required graph report/wiki are absent from the existing `graphify-out` folder.

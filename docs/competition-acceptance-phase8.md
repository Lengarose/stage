# Competition implementation and acceptance handoff — 6 November 2026

This records local work against the approved remaining-programme request. The
normal season route is now exercised against real isolated MySQL and JWT/HTTP.
The complete programme and its full exception matrix are **not** finished.

## Implemented in this follow-up

- New registration periods capture `regional_reserves_v1`. Existing applications
  receive preference-aware in-app reserve invitations after the shared confirmation
  deadline. One deadline, 48 hours later, applies to everyone; no individual
  extension or late new application. Club presidents accept/decline through the
  existing participation page. Acceptance rechecks personal Plus and three eligible
  players, is audited and idempotent, and can complete a previously unconfirmed
  application. Declining reserve willingness does not withdraw confirmed entry.
- Canonical field preparation waits for that deadline. Unsupported whole-field
  counts remain review; no arbitrary subset is admitted. Invitations and final
  field preparation use the existing persisted season worker and transaction lock.
- Transition cycles retain original source results/rights as evidence, then remove
  nonconfirmed next-edition rights at final allocation. D1 vacancies use confirmed,
  reserve-willing D2 clubs: losing promotion finalists first, then nonpromoted
  positions, with a stored seeded draw for equivalent candidates across groups.
  Confirmed replacements enter D2. Sporting decisions must finish before this
  allocation; no willingness alone grants D1. Missing qualified reserves or
  unapproved shrinkage remains review. Old editions retain their conditions.
- The existing Admin decision-calendar panel now also handles initial placement
  groups (up to five rounds) and third-place deciding fixtures. Admin supplies the
  dates; publication retains preview/revision/fixture/permission/conflict guards.
  No new default placement weekdays were invented.
- Newly accepted Cup terms capture `regional_cup_tied_v1`. Publication, readiness,
  reserve changes and kickoff check prior official result declarations in the exact
  Cup edition. Actual declared play for another club blocks selection; bench-only
  nomination does not create Cup-tied status. This is recorded declaration evidence,
  not EA verification. This does not complete transfer-window/sanction enforcement.

## Real-MySQL defects found and repaired

These fixes were necessary for the approved competition flow, rather than a
separate hardening project:

1. Fresh schema used unquoted MySQL 8 keyword `rank` in competition standings.
   Column and index are now quoted, matching the existing startup DDL.
2. Shirt-sale player references used `ON DELETE SET NULL` against a nonnullable
   player column. Fresh schema and existing-host migration now permit NULL,
   preserving historical sales rather than deleting them.
3. Full placement audit payloads exceeded TEXT. Admin audit before/after payloads
   now use MEDIUMTEXT in schema and startup migration; evidence is not truncated.
4. JSON deadline comparisons were receiving DATETIME-coerced parameters from the
   shared DB layer. Season/cycle/Cup/reminder selectors now bind JSON strings and
   unquote them in SQL, preserving exact ISO comparison and same-day recovery.
5. JSON form for five games needs 21 characters, exceeding VARCHAR(20). Club form
   now has room for that existing five-game format.
6. Notification business references include `match UUID:event`, exceeding 36
   characters. `notifications.related_id` now permits 255; event idempotency stays.
7. The old parent/series/season unique index prohibited valid parallel groups.
   It is removed idempotently; the existing unique regional edition identity
   still includes division, group, season, series, platform and region. Fresh
   schema and startup agree. This does not consolidate any production records.

Existing startup migrations also emit already-handled duplicate-index/absent-old-
index/table diagnostics. They were not represented as a completely clean migration
log or broadened into unrelated migration cleanup.

## Repeatable acceptance scripts

Files:
- `server/scripts/acceptance/bootstrap.cjs`: fresh schema on a dedicated socket;
  randomly named `stage_acceptance_<12 hex>` database and ephemeral test secrets.
- `server/scripts/acceptance/season.cjs`: real Express routes, JWT verification,
  stored roles, real model/service SQL and controlled application time.
- `server/scripts/acceptance/restart-probe.cjs`: fresh Node-process worker recovery
  against the exact isolated database, with persisted duplicate-count assertions.
- `server/scripts/acceptance/structures.cjs`: real persistence of the approved
  group layouts for 20/40/60/80/100/120/180/240. This is not activation or a full
  played season at every size; 180→240 expansion activation remains gated.

MySQL 8.4 was installed locally with approval. A separate temporary data directory
and Unix socket were used, with networking and MySQL X disabled. No Homebrew login
service or production database connection was used.

To rerun against the existing temporary instance:

```sh
STAGE_ACCEPTANCE_SOCKET=/private/tmp/stage-season-acceptance.sock node server/scripts/acceptance/season.cjs
STAGE_ACCEPTANCE_SOCKET=/private/tmp/stage-season-acceptance.sock node server/scripts/acceptance/structures.cjs
```

If the instance is stopped, start that dedicated data directory:

```sh
/opt/homebrew/opt/mysql@8.4/bin/mysqld --no-defaults --datadir=/private/tmp/stage-season-acceptance-mysql-v2 --socket=/private/tmp/stage-season-acceptance.sock --pid-file=/private/tmp/stage-season-acceptance.pid --skip-networking --mysqlx=0 --log-error=/private/tmp/stage-season-acceptance-mysql.log
```

On another machine initialize a **new empty** temporary data directory first
using that installation's `mysqld --no-defaults --initialize-insecure --datadir=…`.
Do not initialize over an existing data directory. Scripts reject other socket
paths and generate fresh acceptance databases; they do not drop existing schemas.
Preserved temporary databases are test artifacts, not application configuration.

The fixture clock advances registration, match and idle deadline events explicitly.
It does not change the host clock or disable application policy. Workers are
invoked at idle deadlines as well as match blocks, representing their normal
background execution when no browser or match request is running.

### Normal route exercised

- 40 initial clubs with four distinct Plus player identities each, stored club
  officers, plus one timely next-edition replacement candidate (164 players total).
- 39 ordinary confirmations plus one reserve acceptance and one shared deadline.
- 80 placement group matches plus four third-place decisions through real HTTP:
  lineup publication, ready checks, kickoff, submission and confirmation.
- Automatic D1/D2 allocation and 760 league fixtures across 38 rounds per group.
- 760 confirmed league results; 39 actual knockout Cup fixtures, with byes
  distinguished from matches; three normal promotion matches.
- A real D1 vacancy: one original club does not confirm the next edition; a timely
  new applicant fills D2, while a reserve-willing losing D2 promotion finalist fills
  D1 only after the playoffs. The final field keeps exactly 40 clubs and preserves
  the outgoing club’s historical position and rewards.
- Recurring registration and confirmation, reserve willingness, definitive source
  results, promotion, next-edition allocation/calendar/Cup startup.
- 7m/3m STC Cup payouts, one club award and separately keyed player awards,
  preserved ledger/award counts after settlement retry.
- A first actual scheduled match in the following league edition is played.
- Extra checks: outsider denied, failed-notification transaction rolls back a
  schedule proposal, opponent-only approval, one charge after repeated approval,
  away-first 2–2 report, genuine stale-score rejection, unchanged 2–2 confirmation
  and repeated confirmation without repeated club record updates.
- Fresh-process recovery checks persisted fixture/payment/award counts.

Images and match declarations are explicitly synthetic fixtures. No real EA game,
OCR verification, email/push delivery or payment-provider transaction is claimed.
The harness report keeps `complete: false` for the outstanding full exception
programme even when `normal_season_route_complete: true` passes. A zero exit for
this baseline is not proof that every masterdocument requirement is implemented.

## Still missing

- Complete player transfer/free-entry/loan/sanction enforcement and individual
  cross-event conflicts. Cup-tied selection checks alone do not close that scope.
- Full approved no-show/forfeit/withdrawal consequences, reversible derived
  statistics and downstream sporting/financial exception handling.
- Remaining approved tournament organizer schedule/consent/conflict integration.
- Remaining page/rule/tutorial coverage and actual desktop/mobile browser QA.
- Complete real-DB acceptance matrix: withdrawal thresholds, transfer boundaries,
  outages, expired Plus across all transitions, concurrent reserve competition,
  interrupted allocation/settlement and isolated reset scenarios not yet covered
  by this normal-run script. Existing controlled tests remain separate evidence.
- Unresolved policy: unsupported counts/waiting-list admission/shrinkage, NA times,
  180→240 extra calendar, cross-region priority/pause, premium/payment and some
  financial/outage exceptions. Do not invent these or ask again about confirmed
  reserve, Cup, European calendar and player packages.
- Production dependency preview/repair, deployment and live verification.

GOST/D3 remain closed. No production repair, reset, payout, upload, push or restart
was performed. Graphify remains unavailable.

## Where Admin and clubs find the new parts

| Role | Location | Behaviour |
| --- | --- | --- |
| Club president | Regional participation, linked from region/club; existing `/register-league?club=…&region=…` route | Reserve invitation, shared deadline, eligible player selection, accept/decline and response status. |
| Admin | Regional Leagues → action overview / registration | Reserve responses and deadline; unsupported field or recovery exceptions. |
| Admin | Saved regional cycle → additional sporting decision calendar | Choose placement groups, third-place decisions or supplementary tied-standings rounds; explicit dates and reviewed publication. |
| Club lineup manager | Official Cup GameDay → selection/readiness | Cup-tied eligibility enforced server-side; conflicting declared history requires review. |
| Admin | Existing Rewards and Trophies | Existing permanent assignments, captured promises, payments, player/club awards and exception review. |

## Deployment preparation

Application changes include the new reserve policy/allocation and Cup-tied service,
modified registration/field/cycle/calendar/worker models/services/controller, two
existing React panels and synchronized schema/startup migrations. Acceptance
scripts and handoff documentation are development tools, not production workers.
No new application dependency was added; Homebrew MySQL is local test infrastructure.

Use `git ls-files --modified --others --exclude-standard` in this checkout
(including new files) for the exact reviewed changed-file manifest before preparing the Gandi FTP package. Build frontend using the normal
Vite command. Upload changed backend files and synchronized migration/schema files;
Gandi application restart is separately required to execute startup migrations.
Actual upload, restart and the exact-ID live identity repair require their own
explicit authorization. The named duplicate IDs and preservation targets remain
in `docs/competition-delivery-status.md`.

## Recorded verification

The latest saved normal-route report includes the D1 vacancy and fresh-process
recovery assertions. The full exception matrix remains incomplete. 409 selected
server regressions and 32 frontend tests pass; a final targeted cycle/Cup-tied run
checks the vacancy bookkeeping correction. Lint, typecheck, backend syntax and
build passed. Two previously documented functionsController baseline fixtures were
also run explicitly and still fail (500 vs200; registration_upload vsultimate_team).
This is not a full-suite pass. See the saved JSON reports for actual run dates and
coverage, and the prepared deployment manifest for exact application files.


## 7 November player and browser follow-up

See [implementation and remaining scope](official-player-transfers-phase3.md).
The latest normal-season report was refreshed from the successful repeated
MySQL/JWT run. New player acceptance results are saved separately in
`acceptance-results/player-exceptions-2026-11-07.json`; the earlier 6 November
player report is a historical narrower run. Both retain `complete: false`.

The new script covers actual HTTP contract offers and responses outside the
manual global window, prohibited/allowed transfers, original participant roles,
retry fees, blocked generic updates, Plus expiry at publication/readiness/kickoff,
real persisted individual overlap, free-player actual-versus-bench evidence,
removed loan verbs for four roles, archived original loan state and financial
preservation. These are synthetic declarations, not real EA participation.

Actual Chrome desktop/mobile evidence is in
`acceptance-results/browser-2026-11-07/report.json` and its five PNGs. This proves
the recorded routes, URL/tab click, wrapping, overflow and nonunderlined tabs;
it is not a full browser pass of every Admin and tournament feature. Chrome
found an undefined Layout setter that prevented club identity setup; the dead
setter was removed. The current route has zero uncaught runtime errors.

Browser reproduction uses the existing normal isolated acceptance schema:

```sh
STAGE_ACCEPTANCE_SOCKET=/private/tmp/stage-season-acceptance.sock node server/scripts/acceptance/browser-fixture.cjs
VITE_API_PROXY_TARGET=http://127.0.0.1:18088 npm run dev -- --host 127.0.0.1 --port 4174 --strictPort
# Start a separate headless Chrome test profile with CDP on 127.0.0.1:19222.
node server/scripts/acceptance/browser.cjs
```

The fixture creates a temporary signed test session and completes the synthetic
viewer's country. Its private token file stays under /private/tmp and is not
committed. External Chrome requests are blocked. Temporary API/Vite/Chrome
processes are stopped after verification; the reusable isolated MySQL remains.
No production fallback or production deployment is part of these commands.

### Final verification for this player follow-up

- Combined relevant server run: **164 tests, 163 passed, one known legacy captain
  club-profile test failed** (`clubController.test.js`, PATCH profile edit).
  The two previously recorded functionsController failures now pass.
- Full frontend run: **481 tests, 476 passed, five existing source-shape assertion
  failures**: Admin forfeit queue variable placement, header identity menu source,
  FUT photo-frame source, GameDay source shape and profile image-editor source.
  The new Layout identity repair test passes; it no longer expects a reference
  to a nonexistent state setter. No whole-suite pass is claimed.
- Relevant transfer/Inbox/tutorial subset: 25 passed. The Layout subset: 3 passed.
  These overlap the full frontend run; do not sum them.
- Lint, typecheck, backend entry syntax, frontend production build and diff
  whitespace checks pass. Build retains existing chunk-size warnings.
- The latest player exception script exits successfully and covers all old loan
  HTTP verbs for four real JWT roles. The actual Chrome route passes five views
  without uncaught runtime errors. Its overall `complete` remains false.
- `graphify update .` was attempted; the executable and graph reports are absent.
- No production operation. Original phases 1–8 remain partial for the reasons
  recorded in the delivery-status table, rather than renumbering the work.

The final player run also covers active foreign-region actual participation:
offer/acceptance refuses automatic reassignment and requires the existing Admin
review. Bench-only evidence does not trigger that participation restriction.
The final combined server rerun remains 163/164 (the same legacy captain case).


## 8 November follow-up

Current evidence and precise limits: [competition exceptions](competition-exceptions-phase6-8.md).
The full server suite passed **1,023/1,023**, including enabled local MySQL semantic
result-snapshot coverage with no skipped tests. Actual MySQL/JWT exception,
regional-transfer and organizer-schedule routes pass independently. Their results
do not claim a combined season exercising every exceptional branch. Browser
screenshots now include the actual forms, rather than only the page header.
Latest frontend/build/check totals are recorded in the current delivery status.
Production operations remain unexecuted.

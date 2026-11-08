# Competition deployment manifest — 8 November 2026

Prepared locally, **not deployed or pushed**. This supplements the complete
[7 November manifest](competition-deployment-manifest-2026-11-07.md), including its
loan-retirement and earlier programme files. Uploading only the files below is
insufficient if the previous programme has not been deployed.

## Current backend delta

All required new modules must be uploaded with their callers before restarting.
Tests, local acceptance scripts, reports and documentation are not server uploads.

- `server/schema.sql`
- `server/src/server/controllers/fixtureAdminActionController.js`
- `server/src/server/controllers/leagueEntityController.js`
- `server/src/server/controllers/matchController.js`
- `server/src/server/controllers/rankingController.js`
- `server/src/server/controllers/rewardConfigController.js`
- `server/src/server/controllers/tournamentController.js`
- `server/src/server/functions/legacyFunctions.js`
- `server/src/server/lib/competitionPrizes.js`
- `server/src/server/lib/officialCalendarLoad.js`
- `server/src/server/lib/regionalRegistrationPolicy.js`
- `server/src/server/lib/regionalWithdrawal.js`
- `server/src/server/migrations/startupMigrations.js`
- `server/src/server/models/regionalOperationsModel.js`
- `server/src/server/models/tournamentModel.js`
- `server/src/server/services/competitionAdjustmentService.js`
- `server/src/server/services/competitionEngineService.js`
- `server/src/server/services/fixtureForfeitService.js`
- `server/src/server/services/officialAbsenceService.js`
- `server/src/server/services/officialMatchEligibilityService.js`
- `server/src/server/services/officialPlayerConflictService.js`
- `server/src/server/services/officialPlayerSanctionService.js`
- `server/src/server/services/officialScheduleService.js`
- `server/src/server/services/playerCareerService.js`
- `server/src/server/services/regionalCycleService.js`
- `server/src/server/services/regionalEditionService.js`
- `server/src/server/services/regionalOperationsService.js`
- `server/src/server/services/regionalRegistrationService.js`
- `server/src/server/services/regionalTransferService.js`
- `server/src/server/services/regionalWithdrawalService.js`
- `server/src/server/services/tournamentProgressionService.js`
- `server/src/server/services/tournamentScheduleChangeService.js`
- `server/src/server/services/tournamentScheduleService.js`

## Frontend and database

Upload the complete newly generated `build/` directory after an authorized
release. No new npm dependency was added. The new nullable
`tournaments.schedule_policy_version VARCHAR(50)` appears in both fresh schema
and startup migration; existing editions retain NULL until an explicit supported
publication. Competition exception/consent/change/sanction records use the existing
`league_entities` store, not new custom tables. Startup runs on application restart.

Preserve production `env.local.js`, uploads and secrets. Use Gandi FTP/SFTP, then
restart through the Gandi console; no pm2 or git/SSH deployment is assumed. The
Render socket process is separate and has no source change in this follow-up.
Existing idempotent migration duplicate-index diagnostics are still emitted;
no unrelated migration cleanup or claim of a completely silent boot is made.

## Identity repair remains separate and unexecuted

User-supplied unwanted rows: Premier `46dbb09f-8319-4607-ab97-ec941745bfd8`
and North America `e582c55b-1e72-45f5-ab63-137c3420404a`.
Preserve Premier `c2d6e60f-89e0-4813-81a1-967551d8d69f` and North America
`e91c6c27-4fd2-45d9-b6ed-6a3591d7b210`.
No live dependency inspection or deletion ran. Use the prepared exact-ID read-only
inventory and an independently authorized concrete repair; never delete genuine
editions, honours, proof or finance to hide duplicates.

## Validation and limits

Lint, typecheck, backend syntax and frontend build pass. Full server **1,023/1,023**
(including enabled local MySQL snapshot test), frontend **482/482**. Real isolated
exception/organizer/regional-transfer tests and Chrome desktop/mobile routes pass.
See [precise evidence](competition-exceptions-phase6-8.md). A normal complete
40-club season also passes; a full season combining every exception does not yet
have evidence. Post-withdrawal final allocation was subsequently connected in the completion
delta below. Existing open masterplan policy remains deferred. Graphify is unavailable. This manifest does not certify
production, authorize deployment or claim all eight phases are complete.


## Completion delta on 8 November — same release, not deployed

The approved withdrawal completion, corrected captured prizes and supported
reserve rollover are now connected. This supplements the earlier upload list.
No new dependency, schema table, migration, test case or control screen was added.
Existing source modules changed:

- `server/src/server/lib/competitionPrizes.js`
- `server/src/server/lib/componentPrizePlan.js`
- `server/src/server/lib/leagueRoundReadiness.js`
- `server/src/server/lib/regionalReserveAllocation.js`
- `server/src/server/lib/regionalStructure.js`
- `server/src/server/lib/regionalWithdrawal.js`
- `server/src/server/services/competitionEngineService.js`
- `server/src/server/services/regionalConfirmedCycleService.js`
- `server/src/server/services/regionalCycleService.js`
- `server/src/server/services/regionalRegistrationService.js`
- `server/src/server/services/regionalWithdrawalService.js`

Rebuild the complete frontend for any later authorized upload; its registration,
withdrawal preview and Rewards copy were updated. Earlier 1,023/482 test totals
and season evidence predate this delta. Per the user's instruction, tests were
not rerun and no new tests/checks were added. Existing lint/typecheck/backend
syntax requirements were used. No production repair, reset or deployment ran.

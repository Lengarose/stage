# Competition follow-up deployment manifest — prepared, not deployed

6 November 2026. Includes new untracked source files as well as modified files.
Review the current diff before deployment; no deployment is authorized here.

## Backend application files

- `server/schema.sql`
- `server/src/server/controllers/leagueEntityController.js`
- `server/src/server/lib/regionalFieldAssessment.js`
- `server/src/server/lib/regionalRegistrationPolicy.js`
- `server/src/server/lib/regionalReserveAllocation.js`
- `server/src/server/lib/regionalReservePolicy.js`
- `server/src/server/lib/regionalStructure.js`
- `server/src/server/migrations/startupMigrations.js`
- `server/src/server/models/regionalCupRecoveryModel.js`
- `server/src/server/models/regionalCycleRecoveryModel.js`
- `server/src/server/models/regionalRegistrationModel.js`
- `server/src/server/models/regionalSeasonProgressModel.js`
- `server/src/server/services/officialCupTiedService.js`
- `server/src/server/services/officialMatchEligibilityService.js`
- `server/src/server/services/regionalConfirmedCycleService.js`
- `server/src/server/services/regionalCycleService.js`
- `server/src/server/services/regionalDecisionCalendarService.js`
- `server/src/server/services/regionalOperationsService.js`
- `server/src/server/services/regionalRegistrationService.js`
- `server/src/server/services/regionalSeasonOrchestrationService.js`

## Frontend source changes

- `src/components/admin/RegionalDecisionCalendarPanel.jsx`
- `src/components/competition/RegionalRegistrationPanel.jsx`

Build with `npm run build` and upload the generated `build/` frontend artifacts
using the existing Gandi procedure. React source files alone are not a deployable
frontend. Backend file uploads require an explicit Gandi application restart.
Startup migrations change existing schema; review the synchronized `schema.sql`
and migration diff before that restart. No new application dependency.

Acceptance scripts under `server/scripts/acceptance/`, tests and documentation
are local development/test assets and are not required on the production host.
No change to secrets, socket-server hosting or live data is part of this manifest.

Production duplicate repair is separate. Exact IDs and preservation targets remain
in `docs/competition-delivery-status.md`; live identities/dependencies have not
been queried or repaired in this execution.


Latest combined upload list, including the transfer/loan removal files:
[7 November manifest](competition-deployment-manifest-2026-11-07.md).

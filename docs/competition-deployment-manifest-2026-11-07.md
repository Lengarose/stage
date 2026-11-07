# Competition deployment manifest — 7 November 2026

Prepared locally; **not deployed**. Includes the earlier 6 November work and the
permanent-transfer/loan-removal follow-up. No push or production operation is
authorized by the build prompt. Review the final diff before an authorized upload.

## Mandatory backend upload set

Upload every listed changed/new file before restarting. In particular, upload
`migrations/retirePlayerLoans.js` with `startupMigrations.js`; omitting the required
new module breaks startup. Test scripts and docs are not application uploads.

- `server/schema.sql`
- `server/src/server/controllers/clubController.js`
- `server/src/server/controllers/leagueEntityController.js`
- `server/src/server/controllers/playerContractController.js`
- `server/src/server/controllers/playerController.js`
- `server/src/server/controllers/playerLoanController.js`
- `server/src/server/functions/legacyFunctions.js`
- `server/src/server/lib/regionalFieldAssessment.js`
- `server/src/server/lib/regionalRegistrationPolicy.js`
- `server/src/server/lib/regionalReserveAllocation.js`
- `server/src/server/lib/regionalReservePolicy.js`
- `server/src/server/lib/regionalStructure.js`
- `server/src/server/migrations/retirePlayerLoans.js`
- `server/src/server/migrations/startupMigrations.js`
- `server/src/server/mobile/teamRoutes.js`
- `server/src/server/models/regionalCupRecoveryModel.js`
- `server/src/server/models/regionalCycleRecoveryModel.js`
- `server/src/server/models/regionalRegistrationModel.js`
- `server/src/server/models/regionalSeasonProgressModel.js`
- `server/src/server/services/contractRulesService.js`
- `server/src/server/services/founderContractLifecycleService.js`
- `server/src/server/services/officialCupTiedService.js`
- `server/src/server/services/officialMatchEligibilityService.js`
- `server/src/server/services/officialPlayerConflictService.js`
- `server/src/server/services/officialPlayerTransferService.js`
- `server/src/server/services/playerLoanService.js`
- `server/src/server/services/regionalConfirmedCycleService.js`
- `server/src/server/services/regionalCycleService.js`
- `server/src/server/services/regionalDecisionCalendarService.js`
- `server/src/server/services/regionalOperationsService.js`
- `server/src/server/services/regionalRegistrationService.js`
- `server/src/server/services/regionalSeasonOrchestrationService.js`

## Frontend

Upload the complete fresh `build/` from the final successful production build,
including its PWA service worker and asset references. Do not upload a mixture
of prior and new hashed bundles. Source changes included in that build:

- `src/api/stageClient.js`
- `src/components/Layout.jsx`
- `src/components/admin/RegionalDecisionCalendarPanel.jsx`
- `src/components/admin/sections/TransfersTab.jsx`
- `src/components/club/ClubOperations.jsx`
- `src/components/competition/RegionalRegistrationPanel.jsx`
- `src/components/contracts/ContractCard.jsx`
- `src/components/contracts/ContractsTab.jsx`
- `src/components/contracts/OfferContractDialog.jsx`
- `src/components/inbox/InboxContractOffer.jsx`
- `src/components/inbox/InboxMessageDetail.jsx`
- `src/components/inbox/InboxTrialRequest.jsx`
- `src/components/news/MercatoDesk.jsx`
- `src/components/transfer/TransferDetailPanel.jsx`
- `src/components/transfer/TransferScoutBoard.jsx`
- `src/components/transfer/TransferWindowBanner.jsx`
- `src/lib/contractOfferVisibility.js`
- `src/lib/inboxActionTypes.js`
- `src/lib/mercato.js`
- `src/lib/notificationTypes.js`
- `src/lib/pageWalkthroughCopy.js`
- `src/lib/transferMarketEntries.js`
- `src/lib/tutorialSteps.js`
- `src/lib/useTransferWindowStatus.js`
- `src/pages/ClubDetail.jsx`
- `src/pages/CreateContract.jsx`
- `src/pages/PlayerProfile.jsx`
- `src/pages/TransferMarket.jsx`

Deleted frontend source (not independent server files to upload):

- `src/components/inbox/InboxLoanEarlyEnd.jsx`
- `src/components/inbox/InboxLoanProposal.jsx`
- `src/components/inbox/InboxLoanPurchaseOffer.jsx`
- `src/components/inbox/InboxLoanRecalled.jsx`
- `src/components/inbox/InboxLoanTerminatedEarly.jsx`
- `src/components/transfer/RequestLoanDialog.jsx`
- `src/lib/playerLoanDisplay.js`

## Database and dependencies

- Keep `schema.sql` and startup migrations aligned. Earlier widened columns and
  indexes in this work are still required for the real-MySQL season route.
- No new runtime dependency. Native Chrome/CDP and browser acceptance scripts are
  local verification tooling, not production services or dependencies.
- On an authorized next application boot, `retirePlayerLoans` archives and retires
  live loans in a transaction. It keeps completed/purchased rows, paid ledgers,
  original contracts and physical permanent club identity. No automatic refund or
  old purchase-obligation payout is added. Existing loan financial exceptions
  require their preserved source evidence; do not erase it.
- Registration terms are immutable. Only genuinely new periods gain the new
  player transfer marker and roster capture. Do not backfill old accepted hashes.
- User-facing/default server text remains English. Localization is preserved.

## Gandi procedure — preparation only

1. Preserve `server/src/constants/env.local.js` and production uploads/secrets.
2. Upload the mandatory backend set via FTP/SFTP and the complete frontend build.
3. Restart the Node app from the Gandi console; FTP does not restart it. Startup
   migrations then run. There is no pm2 or git/SSH deployment assumption.
4. Inspect nodejs and watchd logs and perform separately authorized live checks.
   The Render socket process is independent; no socket-server source changed.

## Separate identity repair — no live execution

The read-only prepared inventory remains
`docs/repair-previews/regional-identity-readonly.sql`. IDs are user supplied, not
live-verified here. Unwanted: Premier `46dbb09f-8319-4607-ab97-ec941745bfd8`;
North America `e582c55b-1e72-45f5-ab63-137c3420404a`.
Preserve Premier `c2d6e60f-89e0-4813-81a1-967551d8d69f` and North America
`e91c6c27-4fd2-45d9-b6ed-6a3591d7b210`. Inspect actual dependencies before any
separately authorized repair. Never delete legitimate editions, awards or finance.

## Acceptance limits

Read `competition-acceptance-phase8.md` and `official-player-transfers-phase3.md`.
The normal isolated season, additional player/loan retirement HTTP scenarios and
the recorded Chrome routes pass. This is not completion of the full exception
matrix. Original phases 1–8 remain partial as recorded in the delivery status.

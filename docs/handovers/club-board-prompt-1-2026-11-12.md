# Club Board implementation handover — 12 November 2026

This is a working implementation record, not a declaration that the complete programme or Prompt 2 UI is finished. No deployment, push, production reset, historical payout or production reconciliation was performed.

## Registration alignment added in this session

- The former founder-wage form is an explanation of the Club Board. It no longer collects salary, signing bonus or self-assigned objectives.
- Club creation ignores legacy signup compensation inputs, establishes ownership/playing membership and prepares two pending Board proposals.
- The final onboarding step describes ownership separately and lists the prepared management/player offers. Continuing registration does not accept either paid offer.
- Manager replaces President in this onboarding copy. Internal intent and entity names remain compatible.
- The player step explains Level 1 / 0 XP. The short tutorial has six slides, at most three points each, covering the new rules without availability or loan instructions.
- Existing club-creation modal also explains Board offers. English and existing French signup strings were updated; localization infrastructure remains intact.

## Implemented foundations

- Server-controlled, versioned management/player proposals; recipient/club permissions; counter/accept/decline/withdraw; stale-version rejection; acceptance retry protection.
- Management 12-week terms, initial 5,000 STC opening, initial 4,000–6,000 range, 10% wage ceiling; separate player salary bands and four-week signing-bonus cap.
- Proposed terms remain separate from accepted terms. Future renewals are scheduled separately. Paid expiry/decline does not remove ownership.
- Weekly accrued payroll with final partial-week proration, linked club/player ledger entries, saved arrears and recovery. Governed rows are excluded from old payroll paths.
- Historical nonzero player terms are retained as separate documents when transitioning to a new agreement; no automatic historical bonus correction.
- Confirmed official-source Board evidence, pre-season objectives, provisional application notices, midpoint/renewal reviews and outcome notices. The approved new/promoted/returning objectives and explicit league grade thresholds are implemented. Tournament results are excluded.
- Card Levels 1–100 with the approved curve; future captured official participation earns 100 XP once. Invalidation and missing source matches revoke awards. Self-reported OVR no longer affects salary bands or the existing value formula.
- Structured club tournament minimum/GK/ANY rules, accepted-rule revisions, roster counting before entry charges and kickoff revalidation.
- Availability writes are retired with HTTP 410. GameDay roster filters and active Club Profile availability controls no longer gate participation.
- Canonical selection API reuses existing official publication/readiness/freeze services. Actual participants include non-scorers; explicit human/AI/own-goal attribution is validated against reported contributions.
- New trophy awards capture a congratulations version. Recovery checks the current earned award, delivers mail to the Manager/actual awarded player and retains a durable delivery receipt. Deleting the mail does not recreate it.
- Admin tournament entry notices are friendly and explicitly exclude Board objectives/salary/XP consequences.

## Approved answers captured

- XP categories: confirmed Regional League, Regional Cup and GOST only; no user/Admin tournament XP.
- Player duration: current or next published season end; 12 weeks without a relevant season; Trial 14 days, no game-count expiry.
- Payroll: completed seven-day periods from effective start; final partial-week proration; no advance pay; arrears when unfunded.
- League objectives: new club completes season; promoted club avoids relegation; returning club matches/improves previous final place. Three places above target = exceeds; confirmed title/promotion = exceptional; completion alone = meets.

## APIs for the next UI phase

All paths below are under authenticated `/api/stage`.

| Method/path | Use |
|---|---|
| GET `/club-board/clubs/:clubId` | Finance commitments, current/scheduled agreements, proposals, objectives and reviews |
| POST `/club-board/clubs/:clubId/prepare` | Existing Manager explicitly prepares the management offer without changing historical player terms |
| POST `/club-board/proposals` | Player offer/amendment/renewal; includes `club_id`, `player_id`, `purpose`, `squad_role`, `duration_type`, optional `calendar_id`, salary/bonus |
| GET `/club-board/proposals/:id` | Current version, history, status and supported actions |
| POST `/club-board/proposals/:id/respond` | `action`, `expected_version`, unique `request_id`; counter includes proposed amounts |
| POST `/club-board/agreements/:id/terminate` | Authorized end of a paid player agreement, keeping ownership separate |
| GET `/card-progressions/:playerId` | Level, total XP, next-level progress and provenance label |
| GET `/club-fixture-lineups/match-squad/:clubId/:fixtureId` | Rules, eligible/ineligible members, saved selection, previous suggestion and freeze state |
| POST/PATCH `/club-fixture-lineups` / `/:id` | Save/publish; existing publish/preparation routes remain authoritative |
| GET `/tournaments/:id` | Includes `club_rules_revision`; submit this as `club_rules_revision` during registration |

Inbox actions use `related_entity_type=club_contract_proposal` and metadata `proposal_id`, `proposal_version`, `club_id`, `contract_kind`. Load authoritative current terms before responding. Old messages can have superseded versions.

## Required remaining integration / honest limits

1. Prompt 2 must connect Inbox action modals, Board/Contracts screens, transfer-offer forms, season-duration selectors and Card display to these APIs. Old forms do not yet provide every new required duration/rules-version field. Do not deploy this as a finished user flow in isolation.
2. Finish app-wide visible Manager terminology outside onboarding, the Inbox redesign/read/delete fixes, and the complete GameDay Match Squad presentation/result editor. Canonical backend selection exists; the whole new screen does not yet exist.
3. Position-aware salary **recommendations inside a band** are not yet implemented. Band enforcement is authoritative; do not claim the recommendation uses verified performance or invent a new weighting formula.
4. The exact **renewal counter-offer range** beyond the published opening offer is not approved in the pasted specification. The service retains its opening offer rather than silently allowing a counter up to the full 10% ceiling. Initial 4,000–6,000 negotiation and approved renewal opening percentages are implemented.
5. GOST remains closed. XP recognizes captured `competition_season` selections, but the current official selection context is wired to regional leagues/Cups/pathways. Connect and exercise the GOST selection adapter when its activation rules permit play; do not claim a live GOST match has been tested.
6. Existing subscriptions, transfer/Cup-tied and official sanctions remain enforced through the existing official services. The new ordinary tournament roster helper currently checks linked club membership/account status; any additional applicable tournament-specific eligibility sources must be connected to the UI/rules consistently before release.
7. Historical 22,000 / 100,000 founder compensation is not paid or erased. The old immediate counter path now creates a proposal; historical promises need a ledger-based reconciliation preview before any real correction.
8. No visual browser walkthrough of the revised registration or complete season acceptance was performed in this change. The production build and targeted onboarding path tests are evidence of build/path integrity, not a substitute for the later UI walkthrough.

## Schema and deployment

Schema additions are present in both `server/schema.sql` and `server/src/server/migrations/startupMigrations.js`:

- `player_contracts.compensation_policy_version VARCHAR(50) NULL`
- `tournaments.club_rules JSON NULL`
- `club_fixture_lineups.goalkeeper_player_id VARCHAR(36) NULL`
- `club_fixture_lineups.uses_any TINYINT(1) NOT NULL DEFAULT 0`

Board/proposal/payroll/XP/objective/notice/delivery records use the existing `league_entities` domain store, only through business services. No new dependencies were installed. Deploy frontend/backend together only after the remaining UI integration; restart the Gandi app to run startup migrations and workers. Nothing was deployed here.

## Verification

- Required lint, typecheck and changed-server syntax checks passed; Vite/PWA production build passed (existing Browserslist/chunk-size notices).
- 56 targeted policy/founder/contract-controller/result/official-selection/trophy regression tests passed, including a real HTTP listener for selection routes. This includes the existing 2–2 confirmation tests.
- Four compact tutorial/profile-gate tests and four targeted onboarding-path tests passed.
- Real isolated MySQL + JWT HTTP acceptance report: `docs/acceptance-results/club-board-2026-11-12.json`. Its `complete` field applies to its listed scenarios only. The script exercises actual Board/Card/Match Squad routes, bonuses/payroll/arrears, stale requests, rollback, invalidation, renewal and durable trophy delivery.
- The broader pre-existing onboarding source-assertion file also has two navigation assertions that disagree with the untouched Layout implementation. They were not changed as a side effect.
- `graphify update .` could not run: `graphify` is not installed in this environment.

## Changed-file inventory

- `docs/acceptance-results/club-board-2026-11-12.json`
- `docs/handovers/club-board-prompt-1-2026-11-12.md`
- `server/schema.sql`
- `server/scripts/acceptance/club-board.cjs`
- `server/src/server.js`
- `server/src/server/controllers/__tests__/playerContractController.test.js`
- `server/src/server/controllers/cardProgressionController.js`
- `server/src/server/controllers/clubBoardController.js`
- `server/src/server/controllers/clubFixtureAvailabilityController.js`
- `server/src/server/controllers/clubFixtureLineupController.js`
- `server/src/server/controllers/dressingRoomController.js`
- `server/src/server/controllers/playerContractController.js`
- `server/src/server/controllers/tournamentController.js`
- `server/src/server/functions/legacyFunctions.js`
- `server/src/server/lib/clubBoardPolicy.js`
- `server/src/server/lib/clubTournamentParticipation.js`
- `server/src/server/migrations/startupMigrations.js`
- `server/src/server/models/clubBoardModel.js`
- `server/src/server/models/clubFixtureLineupModel.js`
- `server/src/server/models/tournamentModel.js`
- `server/src/server/routes/registerStageRoutes.js`
- `server/src/server/services/__tests__/clubBoardPolicy.test.js`
- `server/src/server/services/__tests__/founderContractLifecycleService.test.js`
- `server/src/server/services/__tests__/officialMatchEligibility.test.js`
- `server/src/server/services/boardTournamentNotices.js`
- `server/src/server/services/cardProgressionService.js`
- `server/src/server/services/clubAgreementService.js`
- `server/src/server/services/clubBoardReviewService.js`
- `server/src/server/services/clubBoardWorker.js`
- `server/src/server/services/clubContractBridge.js`
- `server/src/server/services/clubFinanceService.js`
- `server/src/server/services/founderContractLifecycleService.js`
- `server/src/server/services/lifecycleOwnedContracts.js`
- `server/src/server/services/matchResultNegotiationService.js`
- `server/src/server/services/officialMatchEligibilityService.js`
- `server/src/server/services/tournamentSquadService.js`
- `server/src/server/services/trophyAwardService.js`
- `server/src/server/services/trophyCongratulationsService.js`
- `src/components/ClubOnboardingModal.jsx`
- `src/components/gameday/GameDayDressingRoom.jsx`
- `src/components/gameday/GameDayMatchResult.jsx`
- `src/components/onboarding/ClubSetup.jsx`
- `src/components/onboarding/FounderPlayerTermsSetup.jsx`
- `src/components/onboarding/PlayerSetup.jsx`
- `src/components/onboarding/PresidentContractSetup.jsx`
- `src/components/onboarding/PresidentSetup.jsx`
- `src/lib/__tests__/playerOnlyOnboardingIntent.test.mjs`
- `src/lib/__tests__/tutorialSteps.test.mjs`
- `src/lib/playerValue.js`
- `src/lib/tutorialSteps.js`
- `src/pages/ClubDetail.jsx`
- `src/pages/Onboarding.jsx`
- `src/pages/PlayerProfile.jsx`
- `src/translations/coreTranslations.js`

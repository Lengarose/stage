# GOST Overview and Catalogue Assignment

## Implementation

The public-facing, authenticated `/competitions` route now uses three open trophy-led columns, restrained tier accents (sky/yellow/green), thin separators, rectangular sections and plain text links. Global navigation, theme and website background are unchanged. No stadium image, smoke, upload system or slanted section frame was added. Mobile columns stack with horizontal separators; the page scrolls naturally. Name tracks align at tablet/desktop widths even when Challenger wraps.

Current Season / Archive uses URL-driven conditional rendering. Archive columns list actual completed/archived editions and link with `?season=<id>`. CompetitionDetail honours that ID, including an older edition outside its initial 20-row list, after checking its competition identity. Results/winner access remains in the existing detail page.

## Canonical Trophy Relationship

Reused `reward_configuration.data_json.trophy_item_id`, already consumed by edition reward capture and award verification. No new table, schema migration or frontend entity was introduced.

`gostOverviewService.resolveAssignment` resolves stable catalogue IDs only. It compares the reward setting, legacy Competition `trophy_item_id`, and exact `trophy_items.linked_source_type='competition' / linked_source_id` reverse links. Agreeing links resolve one design. Conflicting IDs return a conflict, not the first catalogue match. Names, catalogue ordering and image similarity are not identity rules. Unlinked catalogue designs can be reused; designs explicitly owned by another event are rejected.

Admin → GOST now has a Competition trophy selector for each competition, catalogue name/preview and a reasoned Save action. The existing Trophies catalogue remains the only artwork-management workflow for this feature. Conflicting reverse links require review in the catalogue/Rewards before saving; they are not silently unlinked. A compatible legacy source field is normalised into the existing reward setting during an explicit save.

The action checks authenticated server-side admin roles, validates design eligibility, locks the competition and catalogue in a transaction, checks a review revision, and writes an audit with authenticated admin identity and before/after assignment. It does not issue awards, alter prize amounts, pay STC, generate fixtures or update captured editions.

## History and Data

- Existing captured settlement configurations and durable earned-award metadata are not changed by assignment.
- New edition captures also store the catalogue design ID, name and image URL as `trophy_snapshot`. Later award creation uses that captured name/artwork. Existing reviewed edition amendments still use the existing Rewards review workflow.
- Archives prefer earned-award snapshots, then captured design snapshots, then the edition's exact captured/explicit trophy ID. They never borrow the current competition trophy to fill missing historical evidence.
- Legacy captures containing only a design ID cannot reconstruct an older catalogue image revision that was never captured. Such history is not fabricated.
- Images use `object-fit: contain`, a stable portrait presentation area, no crop, filters, recolouring, background-removal CSS or photo frame. Missing/conflicting/broken images have restrained, useful guidance.
- States come from stored editions. Registered IDs and confirmed qualification entries are counted separately and deduplicated; maximum capacity is labelled separately. No default matchday-one claim is shown.
- Prize details read captured component configurations, or the current reviewed source configuration for an uncaptured active edition. Participation, winner bonus and runner-up bonus are separate. Total budget appears only with a captured roster basis. Legacy bundled/invalid configurations show unavailable rather than guessed amounts.
- Pathway uses existing club identity resolution and club-scoped standings/qualification records. Standings-based destinations are provisional until a confirmed qualification entry exists. Unplayed standings do not imply a qualifying position. Ambiguous placements show review guidance.
- Regional ranges reuse `qualificationConfig.js`. Journey is presented only for supported explicit format configuration: `league_36_8md` with the existing 9–24 playoff, or a league-only textual alternative. Unknown formats stay unavailable. The playoff is a distinct branch step; no progression rules changed.

## Routes and Deployment

All routes retain the application's existing authentication requirement:

- `GET /api/stage/gost/overview`: public-safe overview, read-only.
- `GET /api/stage/gost/:id/trophy`: admin catalogue selection/review, read-only.
- `POST /api/stage/gost/:id/trophy`: admin audited assignment.

Upload new `gostOverviewController.js`, `gostOverviewService.js`, changed `registerStageRoutes.js`, `competitionPrizeService.js` and `trophyEntitlementService.js` under `server/src/server/` via FTP/SFTP. Explicitly restart Node in the Gandi console. FTP upload does not restart the backend. Upload the complete rebuilt `build/` output for the frontend. No dependency install or socket-server change is required. Preserve host secrets and uploads. No live deployment or data mutation was performed.

Frontend changes: `Competitions.jsx`, `CompetitionDetail.jsx`, `gostOverview.js`, `CompetitionTrophySelector.jsx` and its insertion into `LeaguesTab.jsx`. The local-only preview harness is `scripts/gost-overview-qa.html`; its labelled QA editions/prizes are not production data.

## Verification

- Lint, typecheck, backend syntax and production build pass. Build retains existing chunk-size/Browserslist warnings.
- Focused assignment/pathway/reward/history tests: 25/25 pass.
- New endpoints exercised over actual isolated local HTTP: pass, including 401/403/404, reason validation, public-safe metadata, save/reload and spoofed-admin rejection. Database operations use injected fixtures, not a configured MySQL instance.
- Full backend suite: 711/715 pass. Four pre-existing failures: captain profile legacy edit, legacy fixture snapshot creation, tournament registration proof expectation, startup migration export source assertion.
- Full frontend suite: 416/420 pass. Four pre-existing failures: header identity source assertion, FUT image-frame source assertion, GameDay identity-loader source assertion, profile-photo preview source assertion.
- Browser QA at desktop, 1024px, 390px and 320px: current/archive navigation, exact edition links, prize breakdown/modal fit, no-club state, broken-image fallback, natural scrolling and no horizontal page overflow. Screenshots are controlled QA data, not live editions.
- `graphify update .` unavailable: command not installed; no GRAPH_REPORT/wiki exists in this checkout.

## Remaining Operational Verification

No configured local MySQL credentials/database are available. Physical MySQL locking, real persisted catalogue assignments and live authenticated flows were not verified. Nothing claims this is deployed.

The actual Supreme two-handled cup, Elite angular trophy and Challenger narrow trophy PNGs are not available as catalogue-linked files in this checkout. Their live IDs, image contents and actual pixel transparency could not be inspected. `src/assets/elite.png` was inspected and is an unrelated opaque shield illustration, so it was deliberately not used as a substitute. Select the correct existing catalogue records in Admin → GOST after deployment. Verify their complete artwork and actual transparent pixels; if opaque, prepare transparent PNG originals in the existing catalogue workflow without removing files referenced by historical awards. No original source images or historical assets were deleted or modified.

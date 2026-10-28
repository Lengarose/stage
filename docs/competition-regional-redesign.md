# Tournament And Regional Competition Redesign

Implementation and verification: 28 October 2026. Local source and isolated fixtures only; nothing deployed or repaired in production.

## Delivered

- Tournament detail headers retain the record's uploaded banner and persisted position, with dark blending, a non-interactive smoke asset, trophy fallback, actual format/platform/count/date/status and existing participation/organiser controls.
- Existing Edit Tournament now adjusts the original image without a new upload. Desktop/mobile crop previews use that same URL. Its position-only mode hides the unsupported zoom setting and preserves zero-percent alignment when reopening. A transactional presentation action checks the authenticated organiser/admin; admin changes are audited. The legacy presentation PATCH uses the same permission check.
- Prize breakdown separates configured allocations from the recorded settlement state. Completion/archive is not evidence of payment. Champion links use recorded outcome/earned award evidence, not the first provisional table row. Post-registration spectators do not see personal wallet comparisons.
- League, group and UCL tables have straight frames, profile links and locally scrollable columns. Sorting, tie breakers, progression, scheduling, results and statistics calculations remain in the existing domain implementation.
- Player/club directories use the full distinct registered collection, search, alphabetical order, conditional platform filters, correct profile destinations and own-participant highlighting. Missing profiles retain registration counts without linking to a known missing profile. Unspecified PlayStation remains PlayStation rather than becoming PS5.
- Regional hub groups by the existing canonical region/platform identity, separates current/archive, counts distinct divisions and combines search/region/division filters. Repeated response IDs render once. Separate conflicting IDs remain visible and flagged, not concealed by display name.
- Regional detail pages provide edition-keyed Overview, Clubs, Stages, Table, Stats, Rewards and History. URLs identify the selected edition; History opens its Overview. Keyed/cancelled requests prevent a previous edition response replacing the new selection.
- Regional counts/directories use the captured edition roster or explicit registered club IDs, never standings. Missing roster evidence returns an explicit review/error state, not a fabricated zero.
- Rewards uses captured settlement configuration, legacy edition reward snapshots, or current versioned configuration. Approved D1/D2 defaults are only a current-edition fallback; historical gaps stay unavailable. Reading pages never runs payments. Promotion counts require recorded edition settings; missing counts are explicitly unavailable.
- Regional artwork uses existing catalogue identities via the reused Admin trophy selector in the regional-league area. Historical captured artwork/earned award metadata is not replaced when current assignment changes. No illustrative cups or new trophy uploader was introduced.
- Shared page tabs are wrapping foreground text with a gentle selected/hover/focus glow and semantic selection. No tab backgrounds, per-tab underlines or horizontal tab strips. Light theme uses theme foreground for contrast.
- Ordinary tournament/regional pages no longer use Layout's bounded sticky-banner route classification. Stage/statistics tables use natural vertical page flow on these pages; modal bodies retain their bounded scrolling.

## Reproduced Fixture Shortcut

The original fixture shortcut was reproduced with the real Stages component: requesting fixture 4 displayed Matchday 1. `stageInitialSelection` now resolves the actual fixture's stage and round. The parent forwards the selected ID, and the real Overview button was verified opening Matchday 4. Unavailable fixture IDs produce a clear error/Retry rather than implying the first round is the requested fixture.

## North American Division 1: Live Review Pending

The prior implementation is documented in `regional-edition-identity-review.md`. It already provides normalized edition identity, guarded/idempotent creation and seeding, a read-only diagnostic, dependency preview and narrowly controlled audited removal of a proven unused duplicate. This task reuses it; it does not introduce a second repair mechanism.

Neither `server/.env` nor `server/src/constants/env.local.js` is configured here. No authenticated live diagnostic export or actual North American record IDs were available. Consequently:

- A genuine live duplicate has NOT been established or disproved.
- No live canonical ID was selected. Age, list order and names are not sufficient evidence.
- No dependency preview or repair was applied locally or live.
- Deployment, migration/index presence and backend restart on Gandi are unverified.
- The QA duplicate ID is test-only and is not a production finding.

An authorised operator can use the EXISTING operations below. `API_BASE` is the intended environment, `TOKEN` an authenticated admin token; do not paste credentials into chat.

```sh
curl -sS -H "Authorization: Bearer $TOKEN" \
  "$API_BASE/api/stage/regional-leagues/edition-review"
```

Inspect every North America / Division 1 / Season 1 candidate's ID, normalized platform/identity, slug, dates, status and season/division links. Distinguish repeated IDs, legitimate platforms/seasons and genuinely conflicting roots. Then obtain the existing dependency preview with actual reviewed IDs:

```sh
curl -sS -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "$API_BASE/api/stage/regional-leagues/edition-review" \
  --data '{"source_id":"ACTUAL_REVIEWED_SOURCE_ID","canonical_id":"ACTUAL_REVIEWED_CANONICAL_ID","apply":false}'
```

Review registrations, memberships, standings, fixtures/matches/reports/schedules, qualifications, reward configuration/snapshots, financial settlements/ledgers, trophy awards, archive and audit links. Both-active or incomplete-evidence conflicts block the existing Apply. Its safe case only removes a proven unused source; it does NOT merge active histories. Obtain approval of the exact preview before any Apply. Apply requires a reason and unchanged `expected_revision`, locks evidence transactionally and writes an idempotent audit. No apply command was run or authorised here.

After an approved operational repair, repeat diagnostics and check D1/D2, historical/platform access, participant/fixture/standing references, Admin Rewards source, and unchanged financial/trophy history. The live issue must remain labelled pending until this is done.

## Verification

Passed locally:

- `npm run lint`.
- `npm run typecheck`.
- `node --check server/src/server.js`.
- `npm run build` (existing large-chunk and outdated Browserslist warnings).
- Focused regional/routing/presentation HTTP suite: 7 tests passed. HTTP tests bind an ephemeral loopback port, use injected SQL fixtures and exercise read-only regional overview/roster, admin trophy GET/POST, public tournament presentation, organiser presentation POST, legacy presentation PATCH, denied permissions, invalid crops and immutable archive responses. Existing GOST assignment HTTP regression also passed. These are NOT real MySQL/JWT/deployed endpoint checks.
- Browser QA at desktop 1440px and mobile 390px/320px: no page-wide overflow, wrapping tabs, exact fixture shortcut, full directory counts/search/sort/combined filters and empty filters, regional combined filters/current/archive, explicit duplicate warning, error/Retry, History-to-Overview, player/club and league/knockout/group/UCL variants.
- Existing banner crop changed from 50% to 51%, saved without uploading, rendered at 51% and retained when reopening Edit. HTTP test verifies original URL is unchanged. Edit modal body scrolled from 0 to 157px using native scrolling; ordinary regional content scrolled the page to 484px.

Full suites are NOT clean:

- Frontend: 428 tests, 424 passed, 4 failed. Existing assertions in header identity navigation, FUT image markup, GameDay club loading and profile image editor markup fail. Their unrelated markup/identity expectations were not rewritten; the editor received only the necessary position-only/zero-position correction.
- Server: 736 tests, 731 passed, 4 failed, 1 skipped. Existing failures cover legacy captain profile editing, league fixture match snapshots, Ultimate Team registration expectations and startup migration export syntax.
- These unrelated assertions were not rewritten or suppressed. Logs: `/tmp/stage-competition-redesign-client-final.log`, `/tmp/stage-competition-redesign-server-final.log`.
- `graphify update .` could not run: `graphify` is not installed. The graph report/wiki are absent in this checkout.

Remaining environment verification: real MySQL queries/transaction behaviour, full application JWT routing, actual catalogue/upload assets, actual saved reward differences, live scheduling/registration/administration and live duplicate review. No production simulation, draw, payment, award, deletion or deployment was performed. The isolated QA pages are not production Vite entry points and their sample records are not shipped into application pages.

## Screenshots

All images are local fixture QA, visibly labelled as such. Missing assigned trophies deliberately show a neutral fallback; no mockup trophy is substituted.

| Page | Desktop | Mobile |
| --- | --- | --- |
| Tournament | [Desktop](qa/competition-redesign/tournament-desktop.png) | [Mobile](qa/competition-redesign/tournament-mobile.png) |
| Regional hub | [Desktop](qa/competition-redesign/regional-desktop.png) | [Mobile](qa/competition-redesign/regional-mobile.png) |
| Regional detail | [Desktop](qa/competition-redesign/league-desktop.png) | [Mobile](qa/competition-redesign/league-mobile.png) |

Local preview: `http://127.0.0.1:5194/scripts/competition-redesign-qa.html?view=tournament` (isolated data). `view=regional` and `view=league` show the other pages. The actual app still requires a configured backend.

## Database And Gandi Deployment

No new table, column, index or entity is introduced by this redesign. It reuses `tournaments.banner_position`, existing catalogue/settings rows, reward configuration, settlement and award snapshots. No dependency added. The earlier regional identity/startup migrations and constraints remain deployment prerequisites; their live presence was not checked.

Upload these backend files with their relative `server/` paths intact:

- `src/server/controllers/regionalPublicController.js` (new).
- `src/server/controllers/tournamentPresentationController.js` (new).
- `src/server/controllers/tournamentController.js` (changed).
- `src/server/services/regionalPublicService.js` (new).
- `src/server/services/tournamentPresentationService.js` (new).
- `src/server/services/gostOverviewService.js` (changed, shared assignment resolver).
- `src/server/routes/registerStageRoutes.js` (changed).

Deploy the full compatible backend release if the host lacks existing reward/identity/trophy service prerequisites. Preserve host secrets in `env.local.js`; do not replace them with local examples. Restart the Node app in the Gandi console after upload: FTP does not restart it. Startup migrations run at boot; check `nodejs.log` for actual success.

Upload the ENTIRE generated `build/` contents, including index, hashed assets, smoke PNG and PWA/service-worker files. Do not upload only a page chunk. This task has not uploaded them. Smoke is bundled by Vite; no separate production asset path configuration is needed. No socket-server change is required.

After deployment, verify authenticated new routes, permissions, uploaded artwork, selected-edition URLs, desktop/mobile scrolling, and catalogue assignment with approved test records. Run the read-only identity diagnostic before deciding whether any production duplicate repair is needed.

# GOST Competition Detail Redesign

## Implemented Locally

- `/competitions/:slug` continues to use one shared page for Supreme, Elite and Challenger. Global navigation, background/theme, formats and qualification rules are unchanged.
- Compact trophy-led header, real-text title, source-specific accents, native keyboard-accessible season selector and wrapping text-only navigation. No public Join, Generate Fixtures or Simulate buttons.
- State-aware Overview uses confirmed participants and canonical competition-view matches, excludes byes from match progress and only presents confirmed kickoff dates as scheduled. Completed/archived views retain distinct status, recorded podium, final score and explicit penalty outcome.
- Clubs uses one authoritative, deduplicated directory for both list and Overview counts: captured edition roster when available, otherwise registered club IDs plus confirmed qualification entries. Standings alone never create a directory participant. Pending qualifiers are excluded.
- Search, regional filter and ascending/descending alphabetical sort cover the entire directory. Own-club highlighting does not reorder the results. Unknown art, countries and qualifying positions remain unavailable rather than being invented.
- Qualification position and source come from that edition's confirmed qualification entry, not the club's current league position. Conflicting qualification evidence is flagged instead of picking a position.
- Existing GOST resolver supplies current assigned trophy artwork and historical edition snapshots. Rewards uses edition-captured configuration where present; no current configuration fills historical gaps. Participation and finalist bonuses are separate, with explicit combined totals and a separately labelled configured budget.
- History lists every completed/archived edition, recorded champion, runner-up, completion timestamp and captured trophy name where available. Selecting History opens that edition's Overview; the header retains its current tab. URL changes use React Router history and preserve Back/Forward behaviour.
- Requests fail explicitly with Retry, rather than silently producing empty lists. Edition content is keyed by source and edition; effect cleanup and request ordering prevent old responses from overwriting the current selection.
- Existing `LeagueCompetitionStages`, `TournamentLeaderboard` and standings rendering remain in place. Stage scheduling, match details, GAMEDAY and result actions still use their existing workflows. Shared journey presentation now makes the direct/playoff convergence more explicit.

## Read-Only Backend Changes

- Existing `GET /api/stage/gost/overview` now includes all edition presentations, without the former frontend 20-season cap, and recorded historical podium/completion context.
- New authenticated `GET /api/stage/gost/:id/editions/:seasonId/clubs` validates the source/edition relationship and returns public-safe participant fields and season identity/status.
- No migrations, new persisted entities, new dependencies or financial writes. Existing reward capture, payouts, trophy awards and automatic progression are untouched.

Admin GOST already has generation and simulation controls in `LeaguesTab.jsx`, using the same existing generator/business function. Inspection confirmed minimum-club/existing-fixture safeguards, reward-capture authorization, admin simulation authorization, audit paths and simulation confirmation. No live generation or simulation was run; operational execution against Gandi remains unverified.

## Verification

- Focused GOST service, HTTP and frontend-helper tests: **12 passed**. The actual new Express route was exercised over local HTTP with an injected fixture database, including authentication, wrong-edition 404, deduplication and public-field restrictions.
- Full backend suite: **734 tests, 729 passed, 4 failed, 1 skipped**. Same previously documented failures: captain legacy club edit; legacy league-fixture match snapshot; obsolete UT-photo registration assertion; startup-migration export source assertion. The opt-in real-MySQL test remains skipped.
- Full frontend suite: **424 tests, 420 passed, 4 failed**. Same previously documented source assertions: header identity menus, FUT image markup, GameDay club-loader source shape, profile photo preview source shape.
- `npm run lint`, `npm run typecheck`, `node --check server/src/server.js`, service syntax check and `npm run build` passed. Build retains existing chunk-size and stale Browserslist warnings.
- `git diff --check` passed. `graphify update .` could not run: command not installed. No GRAPH_REPORT.md or wiki is available in `graphify-out/`.
- Controlled browser QA: three source routes/accents; draft, partially populated and full editions; active and archived content; combined directory controls and profile hrefs; Rewards totals and unavailable state; missing/broken artwork; explicit load failure and successful Retry; Stages/Table/Stats rendering; History-to-Overview; header tab retention; router Back/Forward; delayed season response ignored after switching away; 26 editions accessible; light theme at 320px and dark theme at 390px without horizontal page overflow; desktop at 1440px.
- Screenshots (controlled QA records, not production): `/private/tmp/gost-detail-overview-desktop.png`, `/private/tmp/gost-detail-clubs-desktop.png`, `/private/tmp/gost-detail-overview-mobile.png`, `/private/tmp/gost-detail-clubs-mobile.png`.
- Reproducible UI harness: `http://127.0.0.1:5194/scripts/gost-detail-qa.html?state=partial`. Optional parameters: `slug=elite|challenger`, `state=draft|partial|full|league_phase|knockout|completed|archived`, `tab=clubs`, `slow=1`, `failure=1`, `noRewards=1`, `brokenImage=1`, `light=1`.

## Deployment And Limits

Nothing was deployed or repaired in production. No live matches, rewards, trophies, settlements or financial records were modified. No configured disposable MySQL environment or production catalogue access was available. Real Gandi SQL, actual catalogue artwork/transparency and operational admin generation/simulation were not verified. Screenshots intentionally show neutral artwork fallbacks, not substituted trophy designs. Historical positions/podium/rewards without reliable stored evidence remain explicitly unavailable.

For Gandi: upload `server/src/server/services/gostOverviewService.js` and `server/src/server/controllers/gostOverviewController.js`, then explicitly restart the Node app from the Gandi console. FTP uploads do not restart it. Upload the complete new `build/` frontend output. The matching backend is required for the redesigned page; no database migration is needed. Existing `/gost` route mount remains unchanged.

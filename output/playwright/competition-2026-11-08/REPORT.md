# Competition acceptance report — 8 November 2026

Tested completed implementation commit `280d480aa5c3215321077775c3f60b31ac8b0ee0` locally. No production connection, deployment, push, source fixes, staging or commits were performed by the testing agent.

**Result: core automated and real database acceptance passes. One confirmed public champion-display defect remains. This is not an assertion that every application workflow or every combination of competition exceptions has been tested.**

## Regression and build results

| Check | Result | Evidence |
|---|---|---|
| ESLint | Pass | `lint.log` |
| Typecheck | Pass | `typecheck.log` |
| Backend entry syntax | Pass | `syntax.log` |
| Full frontend suite | 482 passed, zero failures | `frontend-tests.log` |
| Full server suite | 1,022 passed, zero failures, one MySQL test skipped | `server-tests.log` |
| Skipped MySQL semantic-result case, rerun explicitly | 1 passed, zero skipped | `mysql-semantic-result.log` |
| Production build of frozen commit | Pass | `build-frozen.log` |

The MySQL case verifies JSON/TEXT/null-safe guarded confirmation and unchanged 2–2 proposal semantics on temporary tables. It was enabled separately with the dedicated local socket and synthetic acceptance schema. Combined server coverage is 1,023 passing cases, across the suite run and the separate enabled-MySQL run.

## Actual isolated MySQL/JWT acceptance

All six existing acceptance scripts ran successfully against fresh random `stage_acceptance_*` schemas on `/private/tmp/stage-season-acceptance.sock`. HTTP scenarios used real Express endpoints, signed JWTs and stored roles. External mail/push/socket integrations were disabled. Existing historical acceptance files were preserved by redirecting report writes into this directory.

- `season.log`: normal season passes 84 placement, 760 league, 39 Cup and three promotion fixtures; starts the following edition, verifies reserve rollover, 7m/3m Cup prizes, trophies, payout retry protection and recovery in a fresh Node process. Its `complete:false` and generic historical blocker describe the script's intentionally limited programme scope; `normal_season_route_complete:true` is the actual route result.
- `structures.log`: all eight approved 20/40/60/80/100/120/180/240-club group structures persist. This does not prove all growth transitions or the unapproved 180→240 calendar.
- `match-exceptions-2026-11-08.json`: both 18/19 first-half withdrawal branches, including already-played returns, preserve raw stats while correcting standings/career totals. Explicit forfeits, authorization/proof rejection, no-show review without automatic score/exclusion, sanctions following player identity, compensation/refund ledgers and concurrent retry protection pass.
- `player-exceptions-2026-11-07.json`: permanent transfers and free-player exceptions, placement/window restrictions, individual overlaps, publication/readiness/kickoff Plus enforcement, role restrictions and loan retirement/removal pass.
- `regional-transfers-2026-11-08.json`: earned-tier regional changes and review/permission scenarios pass.
- `organizer-schedule-2026-11-08.json`: organizer scheduling, published rules/consent, bounded windows, conflict checks, schedule-change response and permission scenarios pass.

### Additional recent-completion probes

`withdrawal-completion-http.json` records two complete 20-club seasons seeded with synthetic match results and processed through the actual JWT Admin withdrawal POST. In both cases:

- A full 380-fixture schedule closes automatically after the withdrawal decision; 18 definitive first-half games exclude all 38 affected matches, while 19 retain the first half and replace all returns.
- The next eligible club becomes stored champion and exactly 19 eligible clubs receive prizes. The original captured final-place amount of 21,700,000 STC remains unawarded, without changing the captured funding promise.
- An already confirmed next-season registration is marked withdrawn in stored status and participation state.
- Replaying the withdrawal returns its existing receipt and preserves payout IDs, recipients, amounts and ledger references. Settlement refresh timestamps can change; those are excluded from economic idempotency comparison.

`withdrawal-completion-probe.json` adds direct production-function checks: a cancelled fixture without an explicit withdrawal decision still blocks readiness; an established prior recipient payout blocks silent remapping; both 20-club D1-only and 40-club D1/D2 reserve allocation preserve every confirmed place exactly once and exclude withdrawn rights. These last allocation probes are in-memory checks, not a complete withdrawal-plus-reserve HTTP season.

## Real Playwright browser coverage

Used the installed Playwright skill and its CLI wrapper (invoked with `bash` because the installed wrapper lacks executable permission). Chrome ran headed with real Vite and the isolated MySQL/JWT API. No mocked API responses were used. Synthetic browser authentication was loaded through local storage-state files outside the repository; no tokens are included in this report.

Desktop viewport: 1440×1000. Mobile viewport: 390×844; this verifies responsive layout in desktop Chrome, not physical mobile hardware or touch/Safari behavior.

Verified:

- Regional hub opens the chosen season; Clubs click updates `tab=clubs` and renders the 20 participants.
- Seven competition tabs wrap at 390px without horizontal page overflow; text has no underline or bottom tab border.
- Stages shows the League Phase selector, matchday selector, separate upcoming/result sections and the real 1–0 recorded result. Selecting matchday 2 works.
- Clicking Season 1 history opens that exact season with `tab=overview`; completed fixture count is 380/380.
- Player tournament displays fixed match times, competition/device timezone, 20:00–20:40 Brussels interval, unpublished-draw empty state, fixture/result emptiness and appropriate player labels.
- Clicking the schedule/rules consent button performs real acceptance and displays “Schedule and conditions accepted.” Tournament content fits at 390px.
- Admin competition decisions and financial exception forms render on desktop/mobile; both pages remain 390px wide at a 390px viewport. Backend mutation behavior is verified by authenticated acceptance scripts, not by submitting financial/withdrawal forms through the browser.

Screenshots: `regional-hub-desktop.png`, `league-clubs-mobile.png`, `stages-mobile.png`, `tournament-desktop.png`, `tournament-mobile.png`, `admin-decisions-desktop.png`, `admin-decisions-mobile.png`, `admin-financial-desktop.png`, `admin-financial-mobile.png`, `champion-missing-frozen.png`.

## Confirmed finding

**Public completed league pages omit an existing champion name.** Reproduce using the synthetic completed Season 1 at `/leagues/uk-ireland-div-1?season=03d72ef5-f813-4d92-8f72-d818b28d0d4c&tab=overview`. The overview and History row say “Champion: Not recorded”, although the stored regional league has `winner_club_id=cc763c99-edae-4562-8ee9-84fd3ad3f351` and paid placement records; the participant profile exists. The UI in `src/pages/LeagueDetail.jsx` reads only `winner_club_name`, while settlement stores the winner ID without populating that name. Evidence: `browser-findings-details.json`, `champion-missing-frozen.png`, and saved browser snapshots. This is confirmed on frozen commit 280d480; no fix was made by this testing agent.

## Other observations and boundaries

- The initial browser session observed a `playerWallet` HTTP 500 in background salary processing. The separate diagnostic call without an action returned “Unknown playerWallet action: undefined”; that diagnostic is intentionally invalid and does **not** establish the cause of the browser's original request. Treat the original background 500 as untriaged, outside the recent withdrawal fixes.
- Synthetic trophy URLs intentionally have no uploaded image and return 404; the UI shows its artwork fallback. Realtime remains unavailable in this isolated fixture. These are fixture limitations, not passing live-integration evidence.
- Admin background identity-claim reads return 403 for the synthetic Admin role. The tested competition controls load; no claim is made that every Admin dashboard feed is functional.
- While browser QA was running, another actor edited `src/components/admin/sections/LeaguesTab.jsx` and briefly introduced missing-import Vite errors. Those shared-checkout HMR failures are excluded from completed-commit findings. Remaining Admin screenshots and the champion confirmation use a frozen `git archive 280d480` served on port 4175. Its only temporary config adjustment permits reading font dependencies through the shared node_modules symlink. Initial user-flow screenshots use unchanged relevant files on port 4174 before/around the unrelated Admin edit.
- Existing acceptance scripts and the backend loaded by the fixture came from completed commit 280d480. The first observed concurrent change was the Admin frontend; by the final working-tree snapshot, further Cup backend/public UI and Admin files were also changing. Those later edits have not been covered by this completed-commit acceptance run.
- No real EA match, external screenshot authenticity/OCR, payment provider, email/push delivery, production migration, production identity repair or deployment was tested. No all-exceptions-combined full season, every tournament format, every user route, touch keyboard/focus audit, or full mobile-device matrix was completed.
- The Graphify report/wiki are absent. No source files were changed by the tester, so no graph update was needed.

The final working checkout may include other agents' later changes. These results apply to the recorded completed implementation and the frozen browser target, not to unreviewed concurrent edits.

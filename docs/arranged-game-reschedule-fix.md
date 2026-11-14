# Arranged-game correspondence and acceptance — 14 November 2026

## Cause

The date-change reply omitted sender name/logo fields when calling the central Inbox delivery service. Its body used an email address and raw database timestamp. In addition, an invitation initially links to an opponent club/player rather than a Match. Reschedule acceptance treated that opponent ID as a Match ID, updated zero match rows and returned success. No real fixture was created for GameDay or Schedule.

## Corrected flow

- Club and player invitations retain the original two participants and contact emails through repeated counter-proposals. The replying participant supplies the appropriate club logo/name or player photo/gamertag in both directions.
- Subject, salutation, readable kickoff/timezone, response instructions and sign-off form a normal Inbox email. Inbox list and detail header display sender identity; the list also falls back to the stored club name.
- Acceptance locks the original invitation and current proposal in one transaction. It creates the real ranked Match if none exists, or updates an existing scheduled Match. Participant IDs, name/email snapshots, timezone, scheduled/confirmed time and confirmed scheduling state are stored together. Failed or stale acceptance cannot report success or insert a second fixture.
- The same Match data powers GameDay, Schedule → Fixtures and Schedule → Calendar. A committed match update is broadcast after acceptance; confirmation mail links to GameDay.
- Existing malformed reschedule correspondence is enriched on Inbox reads, without changing recipient or response permissions.
- `reconcileArrangedGames` is an authenticated business action invoked when GameDay or Schedule loads. It identifies the narrow legacy failure pattern (accepted reschedule, no linked Match, opponent/invitation ID used as the supposed Match ID), then restores the missing fixture transactionally. It preserves the accepted kickoff. Repeated calls do not create another fixture. Ambiguous records require review rather than guessing. Admin-triggered repairs are audited.
- Official league/competition scheduling restrictions remain enforced; this does not introduce an alternative route around them.

## Verification

- A regression against `respondInboxMessage` failed on the omitted sender identity before the fix.
- The isolated HTTP reproduction failed with zero real matches after accepting two counter-proposals before the acceptance fix.
- `server/scripts/acceptance/arranged-game.cjs` uses a new disposable local MySQL schema and real JWT/HTTP routes. Both club and player scenarios cover two counter-proposals, sender name/image, readable body, one confirmed match, both participants' real Match-list queries, repeat acceptance rejection, later rescheduling of the existing Match, legacy Inbox enrichment and one-time recovery of an older accepted broken invitation.
- Focused existing `respondInboxMessage` and central delivery tests, lint, typecheck, backend syntax and frontend build.
- Local browser checks and screenshots under `output/playwright/arranged-game-2026-11-14/` verify the visible Inbox, Fixtures, Calendar and GameDay using disposable accounts. Test artwork is illustrative.
- Local SMTP is disabled: Inbox and notification records are tested; external email delivery is not claimed.
- No production data was changed and no deployment was performed. Deploy the changed backend files, restart the Gandi app and upload the rebuilt frontend. Recovery runs for affected participants when they open GameDay or Schedule after deployment.
- Graphify update was attempted; the CLI is unavailable in this environment.

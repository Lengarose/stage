# Regional Admin walkthrough — 9–10 November 2026

## Delivered

- Admin → Regional Leagues → **Admin handbook · EN / FR / NL**.
- Browser versions: `/guides/regional-leagues/guide-nl.html`, `guide-fr.html`, `guide-en.html`.
- Matching downloadable PDFs beside the HTML files, 26 pages each.
- Twenty-one numbered illustrated steps, the same screenshots in every language, and a field dictionary. English UI labels are retained.
- Authoring source: `scripts/guides/build-regional-handbooks.py` (ReportLab/Pillow; macOS Arial fonts).
- Raw demonstration evidence: `output/playwright/admin-walkthrough-2026-11-09/results.json` and `evidence.json`.

## Demonstration actually performed

An isolated MySQL schema was created on a separate temporary MySQL socket. The local API used port 18089 and Vite port 4175. Production configuration, production data and production deployment were not used.

The local helper created 60 synthetic clubs, four players per club, a separate Admin profile, catalogue demonstration trophies and synthetic STC balances. Permanent D1/D2 definitions, Cup setup/trophy selection, the registration window, one club application/confirmation, placement draw/calendar, group allocation, three league draws/calendar and Cup activation were operated through the visible application. Remaining registrations and all matches used the normal protected application actions from a local test helper. The helper accelerated server time; browser wall-clock timers are not time-acceleration evidence.

The run completed:

| Step | Recorded result |
| --- | --- |
| First confirmed field | 60 clubs, each confirming three eligible personal Plus players |
| Initial placement | 10 groups of 6; 150 confirmed matches |
| First season structure | D1A / D2A / D2B, 20 clubs each |
| League | 380 fixtures per group, all 1,140 confirmed |
| Regional Cup | 4 initial byes, 59 confirmed played matches, completed |
| Promotion | 4 semifinals + 2 finals, completed |
| Promoted into D1 | Demo Club 12, 16, 17 and 22 |
| Relegated from D1 | Demo Club 20, 23, 34 and 37 |
| Cup reward ledger | 2 entries, 10,000,000 STC total; public page shows paid / trophy awarded |
| League reward ledger | 60 configured position-prize entries; synthetic test STC only |
| Rollover | Allocated season 2, three populated groups, league calendar and Cup activated; season 3 registration window prepared |
| Identity | Same permanent D1/D2 IDs and catalogue trophies across seasons; D2B shares D2 identity |
| First next-season match | Confirmed through the normal lineup, ready, kickoff, submit and confirm actions |

There are 1,355 confirmed first-cycle matches (150 + 1,140 + 59 + 6), plus one confirmed season-2 match. Confirmed reports generated 8,136 player appearance rows, 2,712 declared goals and 2,712 declared assists across the demonstration.

## Limits and issues found

This is an illustrated local training run, not a certification of every competition policy, geographic schedule, exception or production workload. SMTP was intentionally unconfigured; stored notifications do not prove delivery or reading. There were no EA games and no real financial transactions. GOST/D3 were not activated. The production duplicate-league IDs were not touched.

The initial simulator omitted `club_id` from individual stat rows. The helper was corrected before the final six league rounds. There are 6,996 earlier rows without club attribution. Career appearance rows exist, but the per-competition individual screenshots cover only subsequent correctly attributed reports. **Full-season individual-statistics completeness is not signed off.** No historical result or stat row was rewritten to conceal this limitation. All three handbooks disclose it.

A Cup page read during simultaneous progression encountered a MySQL deadlock; its visible Retry control successfully loaded the completed Cup afterward. Normal sporting progression reached the recorded completed/allocated state. This run does not establish a concurrent-load guarantee.

Two product defects encountered during setup were fixed:

1. New Regional editions now initialize explicit empty club arrays and a zero count; otherwise automatic field preparation rejected an empty draft as missing roster evidence. The two demo roots created before this fix were initialized through the protected audited Admin edit action. The existing edition regression test now asserts these defaults.
2. Creating/updating a player profile preserves existing user Admin role IDs 0/2 instead of overwriting them with player role 1. The demonstration's Admin remained usable after profile access. No new privilege is granted.

The Admin workspace can refresh/remount after an operation. The handbook tells operators to inspect the saved catalogue/cycle before repeating creation. It does not recommend bypassing errors or confirmations.

## Verification

- `npm run lint` passed.
- `npm run typecheck` passed.
- `node --check server/src/server.js` passed.
- `node --check server/scripts/acceptance/admin-walkthrough.cjs` passed.
- Existing player protection and Regional edition HTTP tests: 26 passed. The HTTP suite required local-listen permission outside the filesystem sandbox; the sandbox-only attempt failed with `listen EPERM`, then passed with that permission.
- The Regional edition suite passed again after adding the empty-roster regression assertions.
- PDFs rendered with Poppler; representative cover, illustrated and field-dictionary pages visually inspected. HTML versions opened in the app browser.
- `graphify update .` could not run because the `graphify` command is not installed. No graph report exists in this checkout.

## Local reproduction

`server/scripts/acceptance/admin-walkthrough.cjs` is a separate local training harness. It is never mounted by `server.js`. It requires an explicit temporary acceptance socket and an acceptance schema name; its control endpoint is loopback-only and protected by an ephemeral key. Credentials/signing keys remain in a mode-0600 temporary file, not the handbook or repository. The `--resume` flag resumes this isolated demonstration only. Its initialization log does not imply that a resumed database is empty.

The three static handbooks and their images/PDFs must be included in the normal frontend build/upload to appear on production. The two backend fixes require the usual changed-file upload and Gandi application restart. No deployment or push was performed for this walkthrough.

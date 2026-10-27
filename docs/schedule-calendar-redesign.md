# Schedule Calendar Redesign

## Scope And Layout

Schedule content now has an underlined Fixtures/Calendar switch, rectangular
scope dropdown, month/year picker, previous/next month and Today controls.
The Monday-first grid keeps all required weeks. Two previews and a remaining
count fit each desktop cell; mobile uses dots/counts and a full day list below.
The day panel is beside the grid on wide screens. Long lists scroll natively,
with normal scroll chaining at boundaries. Global navigation, theme settings,
page background and scheduling/reporting permissions were not changed.

The existing Fixtures list, unscheduled/proposed fixtures, contracts and match
detail presentation remain separate. Calendar no longer fetches those broad
lists or presents contracts/tournament start notices as scheduled games.

## Read API And Identity

`GET /api/stage/schedule/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD&scope=general`
is authenticated via the existing route registry. End is exclusive; ranges
cannot exceed 49 days. Optional `tournament_id` preserves embedded tournament
scope. No new persisted entity, migration or dependency is required.

The existing server identity service resolves the authenticated player, active
playing membership, owned club and president club. Candidate SQL queries scope
both home and away sides before returning records. General includes those
trusted identities; GOST/Regional restrict to the playing club (the existing
club-only identity fallback supports presidents without a player). No
client-provided user or club ID authorises visibility.

All candidate sources use padded date bounds and 250-row SQL pagination:
matches, competition_fixtures with competition_instances, and legacy
league_entities fixtures. Linked authoritative rows are fetched even if moved
outside the selected month, so stale mappings cannot resurrect cancelled or
rescheduled events. Parent sources supply competition identity, not names.
Only public display fields are returned; emails and report payloads are not.

## Eligibility, Classification And Deduplication

- Explicit confirmed scheduling state plus a reliable kickoff is required.
  An accepted Arrange Game invitation also supplies historical confirmation
  evidence for legacy matches with a default open scheduling field.
- Official completed results retain their reliable schedule, with scores;
  pending results do not appear as completed scores. Dates alone, proposals,
  windows, creation dates, unknown participants, byes, previews and voids do
  not establish a calendar event.
- Durable match/source/engine fixture links deduplicate events. Mapped matches
  win over repeated source records. Names or dates are never deduplication keys.
  Separate source fixtures/legs remain separate. Rescheduling retains identity.
- Supreme/light blue, Elite/yellow, Challenger/green, Regional/red,
  Friendly/silver and Tournament/purple have distinct translucent backgrounds
  and stronger leading accents. Tournament is last in the legend.
- GOST identity wins over tournament-shaped structure. Ordinary player/club,
  admin/user tournaments are purple. Scope filtering happens on the server;
  panel counts and previews consume the same response.
- Existing Arrange Game creates `type: ranked` matches. Those remain in General
  as ranked matches, not falsely labelled friendlies. Only explicit
  `friendly`/`friendly_match` types enter Friendly. Changing the Arrange Game
  product/rating rules was deliberately not part of this visual redesign.
- Linked matches use the existing `/game-day?match=...` destination. A legacy
  fixture without a match link opens its existing competition/league page;
  unlinked tournament engine fixtures open their tournament. A source lacking
  a usable destination says its details are not linked, without creating data.

## Time And Refresh

MySQL schedules are wall-clock values with a separate row timezone. The API
uses the existing `wallClockToOffsetIso` conversion exactly once. Viewer
timezone comes from users.timezone, falling back to Europe/Brussels. JSON legacy
schedule digits follow the existing wall-clock storage convention. Day grouping,
times, Today and exact range inclusion use the same display timezone. Padded
source ranges include UTC/local month crossings. Missing historical row zones
necessarily use the established Brussels fallback; they cannot be reconstructed
from current membership or timezone preferences.

No reliable duration/end-time contract was found across these sources. Warnings
therefore identify identical kickoff instants only, not invented duration
overlaps. Every conflicting game remains accessible, without rescheduling or
blocking any action.

The calendar refreshes on actual MATCH socket events, focus/visibility return
and a visible-page 60-second fallback for legacy league mutations. Cleanup
removes listeners/timers and ignores outstanding requests after unmount. Request
keys and version guards prevent old month/filter/account responses replacing
the active selection. Same-selection background refresh preserves usable data;
errors show retry instead of a false empty state. No no-op entity subscriptions
are used.

## Verification

- 18 focused tests pass: service aggregation/identity/eligibility, all categories
  and scopes, admin/user player/club tournaments, linked-source deduplication,
  separate legs, corrections/reschedules/voids, DST/month boundaries, five/six
  weeks, stable sorting, conflicts and the HTTP controller.
- The actual Express route was hit over loopback with injected authenticated
  identity/database fixtures: 401 unauthenticated, 400 invalid range, 200 scoped
  events, and filtered empty results. SQL calls were checked to be read-only.
- Real Schedule components were browser-tested with controlled fixtures at
  320, 390, 768, 1280 and 1600px: no horizontal overflow, mobile stacked panel,
  desktop side panel, all six category backgrounds, GOST filtering, busy-date
  count, full list scrolling, keyboard arrow selection independent of Today,
  Escape/focus return, September label wrapping, loading/error/empty states and
  a delayed old General request losing to a newer Tournament request.
- Dark and white themes were inspected. The day panel uses a labelled section
  instead of aside to avoid the existing global navigation-only aside colour
  rules in the white theme. No global CSS was modified.
- Lint, typecheck, backend syntax and production build pass. Build retains the
  existing Browserslist-age and chunk-size warnings.
- Full frontend run: 401/405 pass. Existing failures in unchanged areas:
  header identity menus, FUT photo frame img, GameDay club/president loading,
  profile photo editing preview expectations.
- Full backend run before the last extra dedup regression test: 678/682 pass.
  Failures in unchanged areas: legacy captain profile patch access,
  createMatchFromLeagueFixture snapshots, photo-free tournament registration,
  startup migration module export expectation. No unrelated fixes were made.
- `graphify update .` could not run: CLI absent; graph report/wiki are absent.

The QA harness is `scripts/schedule-calendar-qa.html`, not application data and
not part of the production bundle. It mocks the API. No live games were created.
Physical touch/trackpad hardware and production notification delivery were not
tested. `server/.env` and `server/src/constants/env.local.js` are unavailable,
so real MySQL queries and authenticated live accounts remain unverified.

## Files And Deployment

- src/pages/Schedule.jsx
- src/components/schedule/ScheduleCalendar.jsx
- src/lib/scheduleCalendar.js
- src/lib/__tests__/scheduleCalendar.test.mjs
- server/src/server/routes/registerStageRoutes.js
- server/src/server/controllers/scheduleCalendarController.js
- server/src/server/services/scheduleCalendarService.js
- server/src/server/controllers/__tests__/scheduleCalendarController.test.js
- server/src/server/services/__tests__/scheduleCalendarService.test.js
- scripts/schedule-calendar-qa.html

Upload the three changed/new backend runtime files to their existing server
paths, then restart Node from the Gandi console. FTP does not restart the app.
Upload the rebuilt build/ frontend output. No new migration or npm dependency
is required. No production deployment or data mutation was performed.

After configuring a local DB/auth environment, verify real data using:

```sh
curl -s -H "Authorization: Bearer $TOKEN" \
  'http://localhost:8080/api/stage/schedule/calendar?from=2026-10-01&to=2026-11-01&scope=general'
```

Repeat for GOST/Regional/Tournament/Friendly with an ordinary member, president,
clubless player and both home/away participants before production sign-off.

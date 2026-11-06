# Shared Admin GameDay action feeds — local handoff, 6 November 2026

## Result

Admin now owns a single set of four independently loaded feed states: result
reviews, forfeit claims, expired official fixtures and stuck GameDay matches.
The GameDay cards/lists, Admin shell and dashboard use the same values. A failed
or unfinished category has an unknown count; the combined action count remains
unknown until all four are ready. Retry is available. Successful categories stay
available when another category fails. Only verified empty categories display
empty/healthy copy. Category totals can count one match more than once; they are
not a count of unique matches or a general platform health measurement.

The previous GameDay-local summary load has been moved to this shared owner.
Reviews still use the authenticated bounded summary (full total plus ten-row
preview), while Disputes keeps its independent paginated list and exact-match
resolution checks. No original proposal, evidence, penalty, audit or decision
policy was changed.

## Read behavior

- `src/lib/adminGameDayFeeds.js` uses raw authenticated HTTP, because the generic
  entity factory converts some missing-route responses into successful empty
  arrays. Missing, denied, malformed and failed reads remain errors here.
- Forfeits use the existing pending filter, then remove unclaimed/final records.
  Stuck reads require all four existing status queries to succeed; final status/
  result rows are excluded. The existing deadline/48-hour age heuristic remains
  an operational review aid, not an automatic void or a complete stuck detector.
- Scheduling reads 200-row pages from both regional and competition fixture
  endpoints. Invalid/repeated IDs, an inconsistent filter response or a failed
  later page invalidates that category rather than reporting a partial total.
  Identical IDs from different fixture types stay distinct. Each source has a
  20,000-row safety ceiling; hitting it reports unavailable rather than truncating.
- These are live reads, not one database transaction or frozen snapshot. Offset
  pagination can shift while fixtures change; duplicate detection catches some
  changes but cannot detect every concurrent deletion. Refresh reconciles data.
  Legacy filtered Match reads still return all matching rows without bounded
  pagination; database/performance hardening for large backlogs remains open.
- Each refresh clears prior counts and has a generation guard. Superseded or
  unmounted requests cannot publish results into the current Admin feed state.
  Existing forfeit resolution now refreshes these shared feeds after success.
- GET `/matches` now recognizes both stored Admin roles 0 and 2, matching the
  existing exact-match/review reads. Ordinary users retain participant scope;
  a role claim in the request does not override the stored role. Write routes
  and audit requirements are unchanged. No new route/schema/entity was added.

## Navigation and placement

Find these controls at Admin dashboard, the Admin header and Admin → GameDay.
`/admin/disputes` and `/admin/forfeits` open their named view. GameDay tab selection
is stored as `?view=...`, with a validated fallback. `?match=...` takes precedence
for exact review; changing tabs clears that focused match.

## Validation and limits

Nine Match-controller tests pass, including real local Express HTTP with controlled
persistence/auth. They cover both stored Admin roles, participant-scoped ordinary
reads, review pagination, summary counts and failed/denied reads.

58 selected frontend/helper/render tests pass. They include 202-fixture paging,
late-page failure, duplicate detection, category isolation, unknown-versus-zero
counts, final-match filtering, render checks for header/dashboard/GameDay, and
associated-view navigation. Render tests stub child display/data boundaries;
they do not verify actual browser effects, focus, clicking or mobile behavior.

Lint, typecheck, backend syntax, production build and diff checks pass locally.
Actual MySQL/JWT/browser/live verification is still open. Other Admin inventories
(players, clubs, registrations, analytics, etc.) are outside this feed package and
still need their own failure/pagination audits. No deploy, push, production repair,
notification delivery or production data mutation occurred. Graphify report/wiki
and executable remain unavailable.

The overall competition programme is not complete. See competition-delivery-status.md.

## Follow-up

admin-forfeit-pagination-phase6.md replaces this package's unbounded forfeit read
with a bounded summary and independent cursor list, plus exact/locked snapshot
checks for new Admin decisions. The stuck Match reads and scheduling caveats
above remain applicable.

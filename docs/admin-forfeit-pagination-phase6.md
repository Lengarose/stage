# Bounded Admin forfeit reviews — local handoff, 6 November 2026

## Behavior and placement

Admin → GameDay → Forfeits (`/admin/forfeits`) now owns an independent cursor
list with at most fifty pending claims per page. Previous/Next and first-page
refresh distinguish loading, errors, empty first pages and exhausted later pages.
A failed summary does not prevent the independent list from loading. Stale list
responses are ignored when the cursor or refresh signal changes. Decisions are
serialized within this view while a selected claim is being processed.

The shared Admin feed now reads a full forfeit count and at most ten preview
records from `/api/stage/matches/forfeit-reviews/summary`. The header/dashboard/
GameDay counts still share that same state. The preview is explicitly identified
as a preview, and the complete list uses GET `/api/stage/matches/forfeit-reviews`.
The general unbounded pending-forfeit Match read is no longer used by this flow.
The separate stuck-match feed still uses its prior unbounded candidate reads;
fixture offset-paging limitations in admin-action-feeds-phase6.md remain open.

## Backend/read contract

Both read-only views live on the existing authenticated Match router before its
ID route. They require a stored Admin role of 0 or 2. Page cursor/limit are
validated, and errors do not disclose storage details or return an empty queue.
The model shares the pending-claim predicate between both queries: a claimant is
present, forfeit_status is pending, and terminal match/result states are excluded.

Pages read at most limit+1 rows, with a maximum of 51 to derive has_more; summaries
use one MySQL 8 window-count query with a ten-row preview and strip its internal
count column. Returned records are bounded; computing the count may still scan
the relevant dataset. No new persisted entity/schema/index is introduced.
Pages are live, not frozen. A first-page refresh reconciles newly pending lower
IDs and changes since the prior read. Summary and list requests need not show
exactly the same set if claims change between them.

## Decision safety

The list passes the reviewed record to the existing Admin action handler, rather
than searching for it in the dashboard preview. This permits decisions beyond
the first ten records. Before submission the exact Match ID is reread. Changed
claimant/proof, participant IDs, score or match/result/claim state rejects the
attempt with a request to refresh; operational updated_date/stream changes do
not create false conflicts. Null/empty absent text and numeric score formatting
are normalized by matching browser/server snapshot functions.

New browser decisions also send expected_forfeit_snapshot v1 to the existing
adminMatchActions resolve_forfeit action. It is compared against the canonical
row after the existing FOR UPDATE lock and before any result write or audit.
Changed/no-longer-pending claims return 409 FORFEIT_REVIEW_CHANGED. Current claims
use the existing approval/rejection, audit and progression behavior. Legacy
callers without this optional snapshot retain prior behavior. This is a request
precondition, not a new disciplinary or result policy.

Successful decisions refresh the shared summary and the current list page.
Unreadable or failed checks never submit a guessed action. Evidence links use
the existing safe attachment-link helper. No notification delivery was added.

## Verification

- Ten Match-controller tests pass, including local Express HTTP for both new
  routes, both stored Admin roles, denied users, 53-claim page boundaries/full
  summary, invalid pagination, empty queues and sanitized failures.
- Two selected adminMatchActions tests pass. They exercise legacy and guarded
  approval/progression, changed-proof refusal for approval and rejection under
  the lock with no writes, and current rejection plus its existing audit.
- 65 selected frontend/helper/render tests pass: bounded summaries/pages, invalid
  responses, terminal claims, exact-ID rereads, no decision after failed/changed
  reads, browser/server snapshot agreement, and initial list loading rendering.
- Lint/typecheck, backend syntax, build and diff checks pass locally. Render tests
  stub display/data boundaries and do not exercise browser effects or clicks.
- Actual MySQL/JWT, browser/mobile/focus, real lock contention, query performance
  and live deployment remain unverified. Graphify report/wiki/executable are absent.
  No deploy, push or production data changes were performed.

The complete competition programme remains unfinished; see competition-delivery-status.md.

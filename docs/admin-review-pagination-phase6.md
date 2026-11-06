# Bounded Admin result-review list

Local implementation, 5 November 2026. This follows the regional action overview,
focused match review and evidence preview. It changes review discovery, not result
rules or automatic decision-making.

## Admin flow

Admin → GameDay/Result Disputes now owns its review-list read independently of
the parent dashboard's catch-to-empty data loader. It displays loading, failure
with Refresh, verified empty-first-page, and empty-later-page states separately.
No failed request is presented as “no disputes”. Next/Previous browse at most fifty
reviews per page; Refresh starts at the first page. Stale page responses are
discarded and a page is usable only for its current cursor.

Each row opens the exact focused match via the existing `?match=` flow instead of
opening a decision directly from the list snapshot. Focused reads/rechecks, evidence,
penalty checks and browser/server result-snapshot guards remain. Opening either
view changes no score, deadline, reward or evidence.

Pagination is a live stored-state view, not a frozen snapshot. Cases may disappear
when resolved; newly pending cases before the current cursor appear after Refresh
from the first page. ID ordering is deterministic, not a new urgency ranking.
Parent `disputes` updates remain a refresh signal. Other dashboard summary widgets
still use their established feeds and were not audited or replaced by this step.

## Read boundary

New GET `/api/stage/matches/reviews` is mounted on the existing authenticated Match
router before `/:id`. It requires a stored role 0 or 2 and validates limit 1–50
plus the optional cursor. The SQL uses bound values, stable ID ordering and a
limit-plus-one read (at most 51) to return items/has_more/next_cursor without an
unbounded count or client-only pagination. The general entity-list route remains
unchanged; its old limit parameter was not consistently enforced by that controller.
SQL lives in Match.selectResultReviewPage; the controller validates HTTP input
and permissions. The final seven Match HTTP tests also pass after this MVC split.

The view includes stored disputed/Admin-review states and excludes terminal
statuses/results. It infers no overdue state or winner. Full match evidence is
available only to authorized Admins through this route, consistent with exact
Admin match reads. Non-Admin access is denied before match inventory reads.
Read errors return a generic 500 without storage details or a fabricated items list.

loadDisputeReviewPage rejects malformed, duplicate, resolved or nonprogressing
pages. It retains the existing canonical-match discriminator for the shared review
UI. No new entity/table, frontend entity factory entry or write/audit path is needed
for this dedicated read-only view. Existing result-decision endpoints are unchanged.

## Verification and limits

366 selected sequential server regressions and 40 frontend tests pass. The two
historical unrelated server baseline cases remain excluded. Actual local HTTP
tests cover both stored Admin roles, a 53-case inventory, the 50/3 page boundary,
end-of-list, invalid inputs, denied roles and sanitized storage failure. Helper
tests cover exact scoped requests and malformed/failed pages without empty fallback.
These tests use controlled persistence/auth, not real MySQL/JWT.

Lint, typecheck, backend syntax, build and diff checks pass. Actual browser/mobile
paging, focus and live data verification remain open. Graphify update was attempted;
the executable is unavailable. Nothing was deployed, no production data was changed,
and overall competition delivery remains unfinished.

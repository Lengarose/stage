# Regional result reviews in the Admin action overview

Local implementation, 4 November 2026. This extends the existing read-only
regional operations overview, not the result workflow or its captured policy.

## Admin flow

Admin → Regional Leagues → Regional action overview now includes stored disputed
or Admin-review results for active ordinary leagues, sporting cycles and enabled
Regional Cups. Each canonical match appears once even when fixture aliases repeat.
The item names its source and offers **Open match evidence** (the exact GameDay
match) and **Open dispute controls**. The focused-review follow-up below now
opens that exact match independently of the general disputes page's pagination.

The overview neither resolves a dispute nor approves scores, awards forfeits,
changes standings or pays rewards. It includes already recorded states only:
`status=disputed` or `result_state=ADMIN_REVIEW/DISPUTED`. It does not infer a
timeout from dates, apply a new policy to old editions or replace the existing
24-hour deadline worker. Resolved items disappear on overview refresh.

## Data boundary

The existing Admin-only operations action uses the same stored-role check and
read-only transaction. Its existing fixture inventory retains Cup/pathway rows
and additionally selects ordinary regional result-review matches via stored
fixture/engine source identities. No untyped client-supplied match scope is used.
Database read failures propagate instead of becoming an empty success.

Sources must have an active supported status. Invalidated, retired, closed,
disabled or missing sources are omitted, including a known retired parent or
older parent reset series. A canonical disputed match mapped to multiple active
sources produces identity-review items without choosing a match-action destination.
This remains an operational snapshot, not a full historical mapping audit.

Only the canonical match ID is added to the sanitized review item. Proposal
payloads, scores, screenshots, private contacts and internal exceptions are not
included in that item. Opening evidence and resolving results still use existing
route authorization and server-side workflow checks. No new endpoint, persisted
entity, schema, notification channel or mutation is introduced.

## Verification and limits

341 selected sequential server regressions pass. A final 15-test operations run
also passes after additional retirement/reset-source checks. Coverage includes
league/pathway/Cup items, alias deduplication, no inferred timeout, multiple-source
mapping, privacy, SELECT-only queries, failed inventory propagation and actual
local HTTP Admin-only sanitized output with controlled persistence/auth.
The two historically documented unrelated baseline cases remain excluded.

Lint, typecheck, backend syntax, frontend build and diff checks pass. Graphify
update was attempted but the executable is unavailable. Real MySQL/JWT, browser/
mobile navigation and production verification remain open. No deployment,
production repair or production result decision was performed. Overall competition
delivery remains unfinished.

## Exact-match dispute handoff — 4 November 2026 follow-up

The overview's controls link now opens `/admin/disputes?match=<canonical-id>`.
DisputesTab loads that match directly through the existing Match entity client,
even when it is absent from the first fifty general-list results. Focused mode
hides the unrelated list and economy panels, identifies the requested match and
offers Refresh, Show general dispute list and the exact GameDay evidence link.
The ordinary page without this parameter retains its existing list behaviour.

Missing/denied/malformed reads show a retryable error, never another available
dispute. An already decided or no-longer-pending match shows a status message
without a resolution payload/button. Existing UI result decisions are still made
through Admin's canonical `matchKickoff/admin_resolve` flow and its score dialog.
Opening a focused view performs no mutation. Resolve rereads the selected match
before opening the dialog; existing server workflow checks still govern submission.
Effect cleanup/version checks discard loads or resolution-dialog opens from a
previous focus after navigation/unmount.

The existing GET `/api/stage/matches/:id` now uses the controller's existing
`isAdminRole` helper for both stored Admin roles 0 and 2. Previously only role 0
could read unrelated matches here, despite role 2 being an Admin elsewhere.
The role still comes from the users table; request role claims do not grant
access. Non-Admin participant-scope restrictions remain. No mutation permission,
list-query permission, new endpoint or schema changed.

347 selected sequential server regressions and three focused frontend-helper
tests pass. The real local HTTP match-read test covers stored roles 0/2, missing
matches and denied roles 1/null/9 with a forged request role. Helper tests cover
direct lookup without list pagination, resolved states and failed/wrong-ID reads.
Lint/typecheck/backend syntax/build/diff checks pass. These tests use controlled
persistence/auth; actual JWT/MySQL and browser/mobile behaviour remain unverified.
Graphify is unavailable. Nothing was deployed and no production dispute was decided.

## Separate proposal and dispute evidence — 4 November 2026 follow-up

Both the Admin dispute list/focused page and the existing resolution dialog now
use the shared `DisputeEvidence` view. It displays each side's original submission
and separate dispute sheet with their own claimed home/away score, screenshot,
explanation, recorded submission time and proposed penalty decision. Stored match
and forfeit attachments remain accessible even when submission screenshots exist.
These are current stored fields, not a reconstructed historical audit trail.

Missing and malformed sheets are distinguished. Missing/invalid score fields
are never displayed as zero. Malformed timestamps are not guessed. Penalty labels
come only from the particular sheet, never a different match-level claim. Links
permit existing root-relative uploads and HTTP(S) attachments; malformed or
executable URLs are shown as unavailable instead of clickable. Submitted text
is rendered as text, not HTML. Existing screenshot preview/download behaviour on
the review page is preserved; the decision dialog opens attachments separately.

The resolution dialog can scroll on smaller screens. Its existing side selector
still prefills that side's original proposal, not its later dispute score; this
is explained beside the control. Invalid original score data leaves the final
inputs blank. Admin still reviews and explicitly enters/confirms the final score
through the unchanged server result-decision path. No submission, proof, penalty
rule, deadline or outcome is modified by this presentation change.

Eight focused frontend tests pass, including real React static rendering of both
types of evidence, all attachment sources, escaped explanation text, malformed
data and sheet-specific penalty output. Static rendering is not a browser test.
No backend change was made in this step; prior backend regression results are
not represented as a new full run. Lint/typecheck/backend entry syntax/build/diff
checks pass, including a build of the final source. Actual browser/
mobile keyboard/layout and live evidence access remain unverified. No deployment
or production dispute decision occurred; Graphify remains unavailable.

## Evidence-preview accessibility — 5 November 2026 follow-up

The Admin screenshot preview now uses the app's existing Radix dialog technology
instead of a standalone fixed overlay. DisputeProofDialog provides a labelled
title/description, modal focus handling, Escape/outside-close behaviour and two
explicit close controls. The clicked screenshot button is recorded as the opener;
closing restores it when still mounted. If it disappeared during navigation or
refresh, default dialog focus handling is retained.

The screenshot area fits the viewport and scrolls. A loading status is replaced
with a clear error if the image fails, while Open original attachment and Download
remain available for a valid stored URL. Browser/cross-origin download behaviour
still determines whether a download attribute forces a save. Missing/invalid URLs
are not made clickable. No evidence or result record is modified by this viewer.

Thirty-eight selected frontend tests pass, including connected/disconnected opener
focus handling and the existing evidence/render/result regressions. No backend
code changed and the server suite was not rerun for this presentation-only step.
Lint, typecheck, backend entry syntax, build and diff checks pass.
Actual browser keyboard, focus trapping, Escape, mobile viewport and attachment
loading still need live/browser verification; static/helper tests do not prove them.
No generated UI primitive was edited, and no dependency or endpoint was added.
Graphify is unavailable; no deployment or production decision occurred.

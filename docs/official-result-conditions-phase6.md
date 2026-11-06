# Captured result conditions in GameDay

Local implementation, 5 November 2026. This is player-facing guidance for the
already captured regional result policy, not a new deadline or submission rule.

## Where players find it

GAMEDAY's selected match and its Report / Review Result dialog now show a compact
**Official regional result conditions** notice when verified captured conditions
are available for that exact match. It explains the 24-hour proposal/correction
response window and that no response requires Admin review, never silent approval.

Captured v2 describes either club's first report after full time when no proposal
exists. Captured v1 retains the original home-first terms. Editions without a
captured result policy do not receive either version's new notice. Unknown or
inconsistent descriptors display an unavailable-policy message, not guessed terms.

While awaiting a proposal response, the notice reads confirmation_due_at; while
awaiting correction review, it reads review_due_at from the current match. The
stored absolute instant is shown with a machine-readable time element and the
viewer's local timezone. Result deadlines are UTC workflow timestamps, unlike
local kickoff wall times. UTC database strings and offset ISO strings are handled
explicitly. Invalid/missing dates show an unavailable-deadline message; no replacement
date, extension or countdown-based decision is generated.

Stored Admin-review/disputed states receive corresponding guidance. Completed or
otherwise closed matches do not show an actionable stale response deadline. Initial
result-submission deadlines remain outside this response-only notice; no unresolved
submission-time policy was inferred.

## Backend and compatibility

The existing protected official preparation-status read adds a sanitized
`result_policy` descriptor: match_id, version, response_hours, allow_either_initial
and timeout_action. It reuses regionalResultPolicyService.policyForContext and the
edition's captured window; absent policies return null. Existing participant checks
and the legacy `{official:false}` response remain. No proposal, proof, roster or
contact detail is added to this descriptor.

The detail page passes the descriptor into the report dialog; it is bound to the
canonical match ID. Deadline display uses the refreshed match, not a cached
deadline in the preparation descriptor. Existing reporting controls, server deadline
worker, audit, notifications and consent hashes are unchanged. No endpoint, schema,
new entity or persisted conditions were added or backfilled.

## Verification

358 selected sequential server regressions and 35 frontend tests pass. The two
historical unrelated server baseline cases remain excluded. Frontend coverage
includes actual static rendering, v1/v2/
legacy/wrong-match boundaries, proposal vs correction deadline selection, UTC/offset
conversion, invalid dates and no inferred initial-submission deadline. Existing
official eligibility tests exercise the new descriptor over actual local HTTP
with controlled persistence/auth. Lint/typecheck/backend syntax/build/diff checks
pass. Static rendering is not browser/mobile verification.

Real MySQL/JWT/browser/live operation remains unverified. Graphify update was
attempted; the executable is unavailable. Nothing was deployed, no live message or
result decision was made, and full programme delivery remains unfinished.

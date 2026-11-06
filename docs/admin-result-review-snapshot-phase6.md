# Admin result-review snapshot guard

Local implementation, 4 November 2026. This follows focused dispute navigation
and separate evidence presentation. It adds no new sporting or deadline policy.

The existing Admin resolution dialog now includes `expected_result_snapshot`
with its `matchKickoff/admin_resolve` request. It uses the same shared browser
snapshot contract as participant result confirmation: proposals, dispute sheets,
meaningful result history, lifecycle state and negotiation counters.

After verifying the stored Admin identity and loading the current match, the
existing server action compares supplied review evidence before calculating or
applying a decision. Changed evidence/proposals/state return `409 RESULT_CHANGED`;
malformed persisted result JSON uses the existing invalid-data rejection. JSON
whitespace/key order and ignored operational reminder/view/deadline-check history
events are not sporting changes. A formatting rewrite cannot create the previous
false-conflict behaviour.

The existing finalization transaction still locks and compares the server match
snapshot again, protecting the interval after this browser-review check. No new
write path or transaction bypass was added. Existing completed-tournament correction
handling is retained after the supplied snapshot has been checked.

On a recognized conflict, the Admin UI closes the stale decision dialog, clears
unsent choice/scores, displays the actual server reason and refreshes Admin data.
Admin must reopen the selected match and review current evidence. It does not
automatically retry the decision or overwrite new evidence. Other errors retain
the existing reporting path.

Compatibility: callers that omit the optional snapshot keep their existing API
behaviour and server-finalization guard. They do not gain the browser-to-server
review check until they send a snapshot. No endpoint/table, authority, evidence,
penalty rule, reward or result is changed merely by opening the review page.

Verification: 348 selected sequential server regressions pass, including actual
local HTTP rejection with only SELECT operations before conflict. Extended Admin
resolution coverage verifies changes to a dispute sheet, other proposal, meaningful
history and lifecycle state reject before completion/progression; formatting plus
operational reminders still allow a valid manual decision. The historical two
unrelated baseline exclusions remain. Nineteen frontend snapshot/result-flow tests
pass. Controlled persistence/auth is not real MySQL/JWT verification.

Lint, typecheck, backend syntax, final build and diff checks pass.
Browser interaction and live verification remain
open. Graphify is unavailable; no deployment or production decision was performed.

# Regional result response review

User confirmed 3 November 2026: for new official regional competitions, an
opponent's silence after 24 hours leads to Admin review, never automatic approval.

## Policy boundary

Newly published regional registration windows initially captured
`result_policy_version: regional_result_review_v1`. The subsequent
[either-side first-report step](regional-result-entry-phase6.md) publishes v2
with the additional entry rule. Both versions append their English rules to
the conditions before consent. The Admin preview shows the full resulting text;
players read it in their regional participation conditions. The policy uses the
existing JSON entity store; no table or Match column is added.

The result policy resolver reads official source relationships through
`officialMatchEligibilityService.context`. Pathways/Cups use the captured window
snapshot; allocated league groups use their stored registration-window identity.
Missing referenced windows or unknown policies fail closed. A request-body flag,
generic source label or mere date cannot opt a match in. Windows without the new
version keep their existing conditions and accepted-rules hashes.

Initial proposals, amendments, corrections and counters under this policy set a
24-hour response deadline. This work does not decide proof-only amendment rules,
the actual-finish submission clock, no-shows or withdrawal sanctions. Those remain
separate policy/implementation items.

## Deadline processing

At the stored deadline, pending confirmation or correction review transitions to
`ADMIN_REVIEW` / `disputed`. The guarded result transaction appends a versioned
`response_timeout_admin_review` history entry and retains the submitted evidence.
It does not call match completion, settlement, statistics or progression hooks.
Both clubs receive a best-effort Inbox message linking to GameDay. Delivery uses
the existing idempotent message mechanism; it is not a new durable outbox.

The server starts `regionalResultDeadlineService` after migrations. Every minute
it scans up to 80 due regional-source candidates, resolves the captured policy,
and invokes the same guarded deadline action. The cursor advances over legacy or
blocked candidates and wraps to retry. A restart begins a fresh scan; the stored
deadline, result state and guarded writes are the durable evidence. Competing
workers or a simultaneous confirmation cannot overwrite a different proposal.
No lease, new scheduling policy or invented winner is introduced.

## Where to find it

- Admin → Regional Leagues → Regional registration periods → preview: full terms.
- Regional Leagues / club Competitions → Your club's participation: accepted terms.
- GameDay: existing Admin-review result state and locked result actions.
- Admin → GameDay → existing stuck/open match review list: the expired match.

## Verification and deployment

- New tests cover the exact boundary, home/away original submissions, unchanged
  2–2 evidence, corrections, 24-hour proposal deadlines, stale snapshots,
  idempotent review, policy scope and worker retries/pagination.
- Regional registration is exercised over local HTTP with controlled persistence
  and authentication. No new endpoint is added.
- A selected 257-test service/controller regression run passed, including legacy
  result confirmation, regional registration, Cup lifecycle/rewards and calendars.
  Two known unrelated functionsController cases remain excluded as recorded in
  the earlier handoffs. Targeted result policy/write tests passed separately.
- Final targeted run: 43 tests passed, including local registration HTTP and the
  final versioned history change. Final lint, typecheck and server syntax pass;
  production build passed (the last subsequent change was server history metadata).
- Real MySQL/JWT locking, browser behaviour, deployment and live job operation are
  unverified. Upload changed server files and restart on Gandi before expecting
  the worker to run there. Graphify executable is unavailable in this checkout.

# Automatic draft-group allocation

Local, 4 November 2026. Read this before changing the final sporting-rights
handoff, the cycle recovery worker, allocation permissions or compatibility gates.

Follow-up: [transactional assignment notifications](regional-allocation-notifications-phase6.md)
now accompany supported allocations and roll back with them on a storage failure.

## Captured scope

Newly prepared official cycles whose captured window uses
`regional_registration_v1` and `regional_result_review_v2` record
`automatic_allocation_policy_version: regional_auto_allocation_v1`. The preparation
preview explains automatic draft allocation before the existing Admin confirmation.
Older cycles are not upgraded, including cycles prepared earlier under the same
participation conditions. Their manual allocation route remains available.

Once the sporting plan is ready, the recovery worker invokes the internal
`reconcileAllocation` action. This shares the existing allocation transaction,
source revisions, target checks, registration assignment, edition pointers and
audit writes. It does not call an HTTP action with a fabricated Admin identity.
The HTTP `allocate` action remains Admin-only; a body field named `automatic`
cannot select the internal system path.

## Conditions and durable recovery

- Captured structure, tie and source-ranking policy versions must remain supported.
  Invalidated cycles and changed sources block allocation.
- All required pathway matches must map unambiguously and have explicit definitive
  result states. Timeout-only approval or missing confirmation cannot allocate.
- On first sporting readiness, the cycle captures a hash of the canonical sporting
  result fields. A later score/state/opponent change blocks automatic allocation,
  even if capacity or winners appear unchanged. Proof/history bookkeeping is not
  part of that sporting hash. Admin can use the existing reviewed allocation route.
- Twenty confirmed clubs can become one D1 draft without inventing placement games.
  Existing absence-of-D2 relegation behaviour is preserved.
- New ready cycles are included in the existing durable recovery query. The shared
  worker retains transactional leases, attempt fencing, retries and review backoff.
  Interrupted allocated checkpoints can finish without allocating a second time.

Allocation creates or updates draft editions and zero-played standings, assigns
accepted registrations and preserves source history under permanent league
identities. It records `allocation_mode: automatic_followup`, a null system actor,
before/after audit evidence and a system reason. Repeated or competing applications
resolve the existing allocation. A write failure rolls back the whole transaction.

No league fixtures, kickoff times, entry-fee charges, new reward promise, GOST
qualification or D3 opening is created by this action. Existing completed-season
settlement jobs remain separate. Calendar publication and first-season activation
still require their existing checks and outstanding approved scheduling inputs.

## Admin view

Admin → Regional Leagues → Regional cycles shows the capture in its preparation
preview. Regional action overview distinguishes pending automatic allocation,
recovery blockers and unsupported policy snapshots. After allocation it shows
missing league-calendar actions instead. The manual preview handles an already
allocated response safely if the worker finished while the page was open.

## Verification

- 277 selected service/controller tests pass with test files run sequentially,
  including local HTTP authorization checks with controlled persistence/auth.
  The same two unrelated functionsController cases remain excluded as previously
  documented.
- Six focused allocation cases pass: full placement, no-match twenty-club launch,
  the actual worker-to-service handoff, rollback, changed sporting evidence and
  transition/history preservation. A final rerun includes the Admin-preview race.
- Recovery tests cover the internal action, durable completion, review backoff,
  legacy compatibility and sanitized operation/checkpoint output.
- Final lint, typecheck, backend syntax and production build pass, including the
  Admin-preview race handling.
- Real MySQL transactions/locks, JWT, browser and production worker operation
  remain unverified. No deployment or production data repair occurred.
- Graphify update was attempted; executable unavailable.

Full unattended initial preparation, first-calendar publication, remaining policy
details and end-to-end season/environment verification remain on the delivery list.

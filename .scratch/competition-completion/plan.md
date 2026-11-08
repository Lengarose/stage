# Finish the approved competition programme

Baseline: ac4ab5b6c30c24d3ef363d2ecab08b064ed16fe5.
Source: docs/stage-competition-masterplan.md, including 8 November approvals.
Flow: ask-matt → implement, using the approved masterdocument directly as spec.
The user explicitly excludes new checks and tests. No new test files, test
scenarios, approval layers, competition policies or external tracker are added.
Use the existing local ticket convention. Preserve existing audit, result,
roster, finance and authorisation contracts. No production actions or deployment.

1. League completion after an approved withdrawal: recognize an annulled fixture
   as resolved, not played; retain all original fixtures and stats evidence.
2. Corrected honours and captured position prizes: omit withdrawn clubs without
   changing amounts, reallocating an unused prize or rewriting paid history.
3. Reserve-backed rollover: remove withdrawn automatic rights; use the existing
   confirmed reserve field and order for supported structures. A new timely
   application can enter at the normal replacement tier, never inherit old rights.
4. Update existing guidance/status/manifest to describe the finished code and
   distinguish intentionally deferred policy/production from implementation.

Existing unresolved policy remains deferred: GOST/D3 activation, unsupported
counts and shrinkage, extra 180→240 calendar, North-American hours, absolute
launch dates and game resumption/payment-provider details not approved.


## Completion notes

All three implementation tickets are implemented, including the supported D1-only
20→20 replacement case. Source review corrections: retain a reopened application's
persisted ID; use the lowest existing tier for replacements. No tests or test
scenarios were added or run. Existing lint/typecheck/backend syntax requirements
were used. Earlier test evidence belongs to the baseline, not this delta.
The new code remains local until a separately authorized deployment. Unapproved
policy and production duplicate-ID repair remain outside this implementation.

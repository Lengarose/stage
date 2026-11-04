# Closed regional field assessment

Local, 3 November 2026. Read this when changing the closed-confirmation overview,
capacity assessment or participation-condition hash shared by the services.

## Behaviour and location

Admin → Regional Leagues → Regional action overview now assesses uncaptured,
closed registration fields with a recorded participation policy. It displays
applications, approved confirmed records, distinct confirmed clubs and applications
not confirmed. A valid field shows the approved D1/D2 capacity in groups of twenty.

The shared `regionalStructure.structure` table provides capacities for
20/40/60/80/100/120/180/240. This is capacity, not permission to launch or expand.
Sporting rights, placement/transition routes, deadlines and calendars remain
separate controlled checks. In particular, a capacity of 180/240 does not approve
a direct initial launch or its unresolved expansion calendar.

Unsupported counts such as 13, 30, 50 and 130 show review rather than being rounded
down. Duplicate club applications, conflicting confirmation states, wrong scope,
changed accepted conditions, missing/late timestamps and invalid captured minimum
three-player selections block the whole assessment. Suspect records are not
removed to produce a smaller supported count. Unreadable registration source data
blocks a seemingly valid capacity instead of becoming an empty list.

Only after the exact common deadline can a supported result be produced. A cycle
already capturing the window suppresses the duplicate field action. Retired/reset
sources remain excluded under the existing operations overview rules. Old windows
without a recorded participation policy keep their earlier generic review item.

## Integrity and limits

The public registration-window shape is now shared from
`regionalRegistrationPolicy.publicWindow`. Key ordering and omission of undefined
fields preserve earlier accepted-condition hashes, including windows without Cup
or result terms. Assessment checks the same hashed conditions; it does not infer
consent from a count or from the current contents of an editable form.

The existing authenticated Admin-only SELECT endpoint is reused. Output includes
aggregate counts, structure and generic blocker codes/messages, with no roster,
club identities, player IDs, draw seed or private contact data in the assessment.

No registration expires or changes status here. No club selection, waitlist
priority, draw, group allocation, fixture, notification, payout or activation is
created by this view. Captured confirmation evidence is assessed; live Plus and
match selection checks still belong to their existing workflows. This remains a
bounded read-only overview, not a complete database integrity oracle.

## Verification

- Six assessment/hash tests pass for every approved capacity, unsupported counts,
  common deadline, duplicate/invalid evidence, privacy and immutable inputs.
- Final assessment/operations run: 16 tests pass, including the real local
  Admin-only operations HTTP route with controlled storage/authentication.
- Registration, cycle and Cup regressions also passed in the selected run. Its
  first operations fixture omitted the window ID from its consent hash; that test
  fixture was corrected and the final 16-test run passes. Application validation
  was not relaxed to accommodate the bad fixture.
- Lint, typecheck, backend syntax and production build pass. Real MySQL/JWT,
  browser and production remain unverified. No deployment/data mutation.
- Graphify update attempted; executable unavailable.

Remaining work includes the approved complete orchestration, unsupported-count
policy, launch/transition dates, waitlist handling and full-season environment
verification. This step does not close those delivery gates.

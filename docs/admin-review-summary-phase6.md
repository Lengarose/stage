# Admin GameDay review summary — local handoff, 6 November 2026

The GameDay Disputes card and Needs Action preview now use an independent
read-only GET `/api/stage/matches/reviews/summary`. The existing authenticated
Match router checks the stored user role (0 or 2); token/body role claims do not
grant access. No entity, schema, mutation or notification was added.

The Match model shares the pending/terminal predicate with `/matches/reviews`.
One MySQL 8 window-count statement returns the complete count and at most ten
ID-ordered records from the same query snapshot. This bounds returned records,
not the database work required to count them. Internal `review_total` is removed
before response enrichment. `as_of` is the response generation time, not a freeze
of subsequent pages or future decisions.

GameDay shows Checking/Unavailable rather than zero until a valid summary is
loaded. It offers refresh, displays the preview size and directs Admin to the
complete paginated Disputes view. Invalid totals, duplicates, resolved records,
missing preview entries or bad timestamps fail validation. Cleanup ignores
responses from superseded loads. Needs Action adds category totals, not distinct
matches; the same match can have multiple actions. Its other forfeit/scheduling/
stuck feeds and the outer Admin dashboard/sidebar remain legacy and need their
own reliability audit. Do not describe this preview as the entire action queue.

A discovered integration gap is fixed: `?match=` forces GameDayTab to mount the
Disputes view, rather than defaulting to Needs Action and hiding the focused
review. Choosing another tab clears that parameter. The exact reread, result
snapshot guard, evidence, penalties and audited resolution path are unchanged.

## Verification

- Eight Match-controller tests pass, including real local HTTP against Express
  with controlled persistence/auth for role checks, a 53-case count/10-case
  preview, empty data, invalid counts and sanitized storage failures.
- 42 existing/extended selected frontend tests plus two new GameDay render tests
  pass. The latter use MemoryRouter and stub child boundaries to verify focused
  routing and an initially unknown queue; they do not test browser interaction.
- Lint, typecheck, backend syntax, production build and diff checks pass.
- Real MySQL execution/window-count performance, real JWT middleware, browser
  refresh/tab interactions/mobile and production remain unverified. No deploy,
  push, production repair or data write was performed.
- Graphify report/wiki are absent and `graphify update .` is unavailable.

The broader competition programme is not complete; see competition-delivery-status.md.

## Follow-up

The shared-feed follow-up in admin-action-feeds-phase6.md moves this summary load
to Admin and extends error-aware counts to the other GameDay categories and shell/
dashboard. The earlier GameDay-local ownership and legacy-counter limitations
above describe the preceding step. Its endpoint/preview contract is unchanged.

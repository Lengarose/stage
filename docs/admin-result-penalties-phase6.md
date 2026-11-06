# Explicit penalties in Admin result decisions

Local implementation, 4 November 2026. This follows Admin evidence presentation
and the browser-review snapshot guard. Existing server penalty policy is reused;
this adds no shootout, aggregate, extra-time or promotion rule.

## Admin flow

The existing dispute-resolution dialog now checks the entered final score through
GET `/api/stage/game-day/<match>/penalties`. The server derives deciding-leg and
aggregate eligibility from stored competition configuration and confirmed prior
legs. The UI displays that context and asks for an explicit home/away penalty
winner when required, separately from the approved original proposal side.
No penalty choice is inferred from a proposal or previous match-level flag.

Without a shootout the existing admin_resolve request explicitly sends
`decided_on_penalties: 0` and `penalty_winner_side: null`. With a verified choice,
it sends 1 and the chosen side. A manually changed ordinary result cannot silently
inherit an obsolete penalty marker. Existing proposal-statistics selection and
explicit final-score controls are otherwise unchanged.

Confirmation stays disabled while context is loading, unavailable, blocked or
missing a required choice. Changing the match, final score or approved original
proposal side invalidates the prior context/choice. Recheck clears readiness
immediately. Superseded fetches are discarded. Missing prior-leg results are not
replaced with a guessed aggregate.

The server revalidates penalty eligibility in its existing locked completion path;
browser readiness cannot bypass it. Existing snapshot guards still protect changed
evidence. No server action, schema or endpoint was added. Older API callers retain
their previous optional argument behaviour. This UI uses the existing penalty
endpoint's score validation and availability requirements.

## Verification

- 358 selected sequential server regressions pass, including penalty/aggregate
  suites and actual local HTTP context reads for stored Admin roles 0 and 2.
  Unrelated viewers are denied; invalid scores and missing first-leg evidence do
  not produce an invented ready context.
- The existing Admin resolution test verifies explicit no-penalty fields clear an
  inherited marker when Admin records a manual ordinary result.
- Thirty frontend tests pass: explicit choice, penalty clearing, blocked/malformed
  contexts, stale match/score/proposal keys, snapshots and evidence rendering.
  An existing source-wiring assertion was updated for the score handler that now
  clears penalty readiness before editing.
- Lint, typecheck, backend entry syntax, build and diff checks pass. The two
  historical unrelated server baseline cases remain outside the selection.

Tests use controlled persistence/auth. Actual MySQL/JWT, browser/mobile and live
operation remain unverified. Graphify update was attempted; the executable is
unavailable. No deployment, production decision or GOST/D3 activation occurred.
Full programme delivery remains unfinished.

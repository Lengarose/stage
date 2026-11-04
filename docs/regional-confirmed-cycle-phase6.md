# Confirmed field → canonical cycle preview

Local, 3 November 2026. Read this before changing the field-preview route,
source selection, canonical prepare input or the Admin handoff.

## User flow

Admin → Regional Leagues → Regional action overview → **Preview this confirmed
field** opens the existing Regional cycles panel with a `regional_field` URL
parameter. The server derives the route, current source editions and additional
approved registrations from that published window. Admin no longer needs to
reselect every confirmed registration manually.

The preview fills the existing form without saving a draw, creating fixtures or
publishing times. Admin supplies the required reason and existing confirmation,
then the established prepare action captures the real draw. After success the
field URL parameter is removed and the saved cycle remains visible. A failed
load has a Refresh confirmed-field preview action; requests for another window
cannot overwrite the current selection with an older response.

## Backend boundary

The existing POST `/api/stage/regional-leagues/cycles` now also accepts the
read-only request `{ "registration_window_id": "..." }`. This form accepts no
participant, count, route, seed or apply override. Stored Admin authority is
checked before private field reads. The shared regional Admin check now rejects
a stored null role instead of interpreting `Number(null)` as role zero.

`regionalConfirmedCycleService` validates the current window, permanent D1
identity, region/platform/reset series and complete closed field using the
existing assessment. It selects meaningful current groups, or an empty D1 anchor
for a fresh launch. Existing roster clubs remain source participants; only
confirmed clubs outside those rosters become additional registrations.

Same-season unplayed sources select placement. Preceding-season sources select
transition. Mixed seasons, malformed or duplicate rosters, reset/retired/ambiguous
sources, unconfirmed clubs with existing rights and already captured fields
require review. The builder does not silently substitute newcomers for a club
with sporting rights. Unsupported growth/launch formats are still rejected by
the existing sporting preview; this helper does not invent a route for them.

The derived input goes through `regionalCycleService.preview`, including complete
official source results, standings integrity, permanent target divisions and
captured participation conditions. Final prepare uses that canonical input and
the existing source revision, transaction, audit and idempotency checks. A field
changed after preview fails instead of being partially applied. Retries use the
recorded cycle and cannot create a second draw. Play still requires its approved
calendar; none is inferred from this handoff.

## Verification

- 22 focused builder/cycle tests pass, including actual local HTTP requests through
  the real cycles controller with controlled storage and authentication.
- Coverage includes empty/seeded launch fields, transitions, preserved rights,
  unsupported fields, reset/mixed identities, permission overrides, read-only
  preview, changed confirmations, audited prepare and retry stability.
- Broad selected run: 268/269 passed; one calendar HTTP fetch had a transport
  ECONNRESET. Its isolated 12-test calendar rerun passed without code changes.
  The same two unrelated functionsController exclusions from prior handoffs remain.
- Lint, typecheck, backend syntax and production build pass. Browser, real MySQL/JWT
  and production remain unverified. No deployment or production repair occurred.
- Graphify update attempted; executable unavailable.

This automates derivation of the proposed field, not unattended cycle activation.
The subsequent [automatic allocation step](regional-auto-allocation-phase6.md)
handles final-rights draft groups for newly captured official cycles. Automatic
first draw/first-calendar publication and remaining calendar/waitlist policies
stay open on the central delivery checklist.

# Decision calendars and Regional Cup preparation — 3 November 2026

Historical preparation handoff: the later [Cup lifecycle step](regional-cup-lifecycle-phase3.md)
adds activation, GameDay, confirmed-result progression and the participant page.
The preparation-only limits below describe this earlier step, not the current tree.

The user confirmed the Cup package and all six Cup names on 3 November 2026.
Masterplan §11 now records that confirmation. No North American time profile,
Cup STC prizes or automatic GOST ticket was inferred.

## What Admin can use now

### Supplementary sporting decisions

Admin → Regional Leagues → saved regional cycle → **Kalender aanvullende
beslissingsduels**.

- Reconcile official results first so the existing sporting engine has captured
  the real decision fixtures. Two tied clubs have one knockout decision;
  three/four clubs have the approved round-robin mini-league.
- Enter a kickoff for each still-pending round, in Europe/Brussels. There is no
  invented global default day for these exception matches. Only the exact pending
  rounds may be supplied; byes retain the recorded mini-league draw.
- Review the preview and load/identity blockers; supply a reason and publish.
- The transaction updates canonical Matches and engine fixtures, writes fixture
  audits and notices, and captures an immutable `regional_pathway_calendar`
  decision batch. Failure rolls back the whole batch. Identical retries reuse it.
- Sources are evaluated afresh; client-selected winners or opponents are not used.
  Existing schedules, reports and preparations cannot be overwritten here.
- Knockout decisions use 60-minute blocks; mini-league matches use 40 minutes.
  Club overlap, 2/day, 7/week and 4 playing evenings are checked against bookings.
- For transitions with D2 promotion, the source league calendar also protects the
  reserved promotion semifinal deadline. Planning before that deadline alone is
  not proof that reports will be confirmed in time: result deadlines still require
  review. Unresolved sporting results continue to block promotion publication.

Protected action: `POST /regional-leagues/cycles/:cycleId/decision-calendar`.
Preview body: `round_slots: [{round, date}]`. Apply additionally sends the reviewed
`fixture_ids`, `expected_revision`, `reason` and `apply:true`.

### Regional Cups — preparation only

Admin → Regional Leagues → **Regional Cups · voorbereiding**.

1. Choose an existing permanent D1 regional system and preview/save its fixed Cup.
   The approved name and region/platform identity come from the server. Repeating
   this does not create another Cup.
2. Load the trophy assignment and select an existing Trophies catalogue design.
   This reuses `gostOverviewService.assignment/assign`, source ownership checks,
   revision review and Admin audit. No separate upload mechanism was added.
3. Choose the published league calendar and preview the Cup edition.
4. All current, complete, confirmed groups enter together. Cup entry must have
   been included in that field's accepted registration conditions; old seasons
   cannot be silently enrolled retroactively.
5. Review the conservative calendar reservation and trophy image; save the draft.
   The server captures a random draw seed, actual first-round pairings and byes,
   participant IDs, source editions/calendar and trophy snapshot.

Names: STAGE UK & Ireland Cup, STAGE Coupe de France, STAGE Deutschland-Pokal,
STAGE Benelux Cup, STAGE Copa de España, STAGE North American Cup.
One permanent Cup per regional system/platform; new seasons reuse its trophy
assignment. Historical edition snapshots do not change when the assignment changes.

Confirmed European windows: Sunday 20:00 Europe/Brussels, 60-minute blocks.

| Clubs | Playing weeks |
| --- | --- |
| 20 | 4, 6, 8, 10, 12 |
| 40–60 | 2, 4, 6, 8, 10, 12 |
| 80–120 | 1, 2, 4, 6, 8, 10, 12 |
| 180–240 | 1, 2, 3, 4, 6, 8, 10, 12 |

Twenty entrants produce **four** actual first-round matches and twelve byes:
16 clubs advance to the next round, then 8, 4, 2 and 1. No dummy opponent,
automatic match result or Match entity is created for a bye.
All entrants' potential Cup round dates are checked conservatively against their
existing club bookings. This is a reservation preview, not a guarantee against
later bookings: activation must revalidate it.

GET/POST `/regional-leagues/cups` are Admin catalogue/preparation actions.
GET/POST `/regional-leagues/cups/:cupId/trophy` delegate to the shared trophy flow.
Internal `regional_cup` and `regional_cup_edition` records use the existing flexible
store; no new physical table, generic CRUD route or client entity was introduced.

## Participation conditions and history

The existing Admin registration form can include Cup entry in **new** published
conditions. The server appends the Cup terms and `cup_policy_version` to the
immutable public window, so its accepted-rules revision covers those conditions.
The existing user registration/confirmation flow shows the published rules.
Old registration hashes remain compatible when the optional marker is absent.
North America cannot include the new mandatory Cup term until its time profile
has been confirmed. Its permanent Cup identity/trophy can still be prepared.

A reviewed regional reset invalidates dependent Cup drafts without deleting the
fixed Cup identity or trophy configuration. A Cup spanning multiple divisions
requires all of its source divisions to be selected. No real reset was executed.

## Preparation-only limits at this earlier step

Cup editions are explicitly `draft` and `play_enabled:false`. There are no Cup
GameDay Matches, public Cup participation pages, result progression, later-round
materialisation, fees, STC payouts, trophy awards or GOST qualifications yet.
The next implementation must connect the Cup match lifecycle, penalties,
selection/Plus checks, confirmed-result progression, fresh open draws per round,
public views and final honour handling. Names/formats/time windows are now approved;
that does not establish prize amounts or withdrawal/replacement rules.

The decision calendar is operational locally, with an explicit Admin publication
step. It is not an unattended exception scheduler. Individual-player conflicts
across future events are still separate from club booking checks.

## Verification

244 selected regression tests pass. The local suite exercises actual Express endpoints with
controlled model/auth fixtures, not a production database or real JWTs. It covers
all approved Cup sizes and knockout depths, reproducible draw/byes, stable identity,
consent and legacy preservation, trophy delegation, source revisions, collisions,
permission, reset dependencies, decision round chronology and atomic rollback.
The two previously documented functionsController baseline failures remain excluded.
Lint, typecheck, backend syntax and frontend build are checked separately.
Production MySQL/concurrency, browser interaction, host throughput and deployment
remain unverified. No production operation, payment, reset or publication occurred.
Graphify report/wiki are absent and its CLI is unavailable.

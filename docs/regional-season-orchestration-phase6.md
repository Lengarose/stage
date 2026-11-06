# Regional season orchestration and European rescheduling

Local implementation, 6 November 2026. This extends original masterplan phases
3–4 and 6–7. It does not close the full eight-phase programme, execute production
identity repair, activate GOST/D3, or change older accepted conditions.

## Newly published registration periods

Admin → Regional Leagues → regional registration retains its existing reviewed
preview/publication. Admin sets the initial registration date, rules, Cup inclusion
and optional first league Monday. New windows capture
`regional_season_orchestration_v1` and `regional_recurring_schedule_v1`.
Supported European windows also capture `regional_reschedule_europe_v1`, with
English terms included before acceptance. Existing published windows are immutable;
optional fields are absent from legacy public-window hashes, preserving their
accepted revisions. There is no historical-window backfill.

The existing server startup now starts a season-preparation worker using the
shared durable progress machinery: persisted lease, attempt fencing, retry/backoff
and scoped Admin exceptions. No browser needs to remain open.

1. After the shared confirmation deadline, derive the exact confirmed field using
   the existing canonical selector. Unsupported counts, missing rights and other
   contradictions remain visible exceptions; no club is silently discarded.
2. Prepare the existing sporting cycle once. If the previous season has unfinished
   results, wait normally without persisting a premature cycle. The confirmation
   deadline is not extended by this wait.
3. Reconcile saved sporting results and use the existing automatic allocation for
   captured cycles. Placement and extra-decision calendars still require the
   existing approved planner configuration; this worker invents no weekdays.
4. Draw fixtures through the existing locked, audited lifecycle action for every
   exact saved group. Reuse an existing complete draw; never simulate or replace it.
5. Publish the league calendar using the captured Monday and existing calendar
   planner. No date means a visible Admin calendar action. A matching calendar
   already explicitly published by Admin can be reused. Initial publication must
   allow at least 48 hours before the first kickoff.
6. Prepare the next registration window before Cup processing, so a Cup exception
   does not block that independent work: registration weeks 5–8, confirmation
   week 9, reserves beginning week 10. The next league Monday follows twelve playing
   weeks and one transition week. Each local date is converted separately in
   Europe/Brussels, including daylight-saving changes. Existing published next
   windows are preserved; missed registration openings are not silently backdated.
7. If Cup participation was accepted, use the existing permanent regional Cup,
   catalogue trophy assignment, captured rewards, preparation and activation.
   Missing trophy, budget, contact or calendar evidence remains a review issue.

Only initial activation completes this worker's checkpoint. Existing Cup,
sporting-result, allocation and settlement workers retain their responsibilities.
An initial completed checkpoint does not mean the season or programme is complete.
System writes use a null system actor and fixed audit reasons, not an invented
Admin account. Public action body fields cannot enable internal automatic paths.

## Normal promotion

The existing cycle-recovery worker now publishes normal promotion semifinals for
new captured European transition cycles after final source standings determine the
stored opponents. They retain Tuesday week 11, 20:00, sixty minutes, derived from
the unique source calendar. Initial publication needs 48 hours' lead.

Confirmed semifinal results then enable the existing Thursday week-11 final.
The reserved Thursday slot is captured in the published semifinal policy; resolving
its opponents after Tuesday is progression, without a second initial 48-hour wait.
Calendar conflicts, changed evidence, unresolved ties or unsupported growth plans
remain exceptions. Older cycles retain reviewed semifinal publication and the
existing automatic final. No new sporting rights or expansion times are chosen.

## Club schedule-change flow

GameDay → scheduled official match → **Official schedule changes** is available
to the participating club's existing authorized lineup managers. It uses:

- `GET /api/stage/game-day/:id/reschedule?club_id=…`
- `POST /api/stage/game-day/:id/reschedule`

The server resolves the actual stored match/edition and permissions. A club cannot
supply its own official identity, policy or role. Ordinary requests apply only to
new captured European editions; rounds 37–38 require Admin review.

Request at least 48 hours before existing kickoff. The opponent has at most 24
hours, with agreement at least 24 hours before the new kickoff. Keep the same
Monday–Sunday week: Mon–Fri 20:00/20:40 or Sat 18:00–21:00 Europe/Brussels.
The reply deadline closes earlier when needed to preserve the new-kickoff lead.
Silence, rejection and withdrawal preserve the existing kickoff and use no quota.

Only an opposing club's approval charges the requesting club, up to two approved
changes per edition. Quota and official club calendar conflicts are reread under
the existing shared schedule lock. Match, source fixture, engine, proposal,
audit and preference-aware in-app notices commit together. Lost-response retries
reuse the decision. Started/reported matches cannot move through this flow.
Changed schedule keys invalidate preparation; the UI reloads the updated Match
and preparation. Individual player conflicts remain outstanding programme work.

Requests are internal business records in the existing generic league entity
store, not a new CRUD entity/table. Existing authentication mount is reused.
No new dependency, migration, external notification channel or production action.

## Remaining work and verification boundary

See [delivery status](competition-delivery-status.md). In particular, explicit
reserve invitations/priority, unsupported counts/shrinkage, remaining player/
transfer/Cup-tied enforcement, withdrawal/stat corrections, financial exceptions,
other tournament scheduling and complete phase-8 acceptance remain unfinished.
North American scheduling, GOST and D3 are not enabled by European approval.

Selected server/HTTP regressions use controlled persistence and authentication.
They do not establish real MySQL locking, real JWT-role behaviour, full-season
acceptance, actual browser/mobile operation or deployment. Exact run results are
recorded in the delivery status after final verification.

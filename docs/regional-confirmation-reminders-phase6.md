# Regional confirmation-week reminders — phase 6

Local implementation, 4 November 2026. Read alongside the registration policy,
allocation notification handoff and central competition delivery checklist.

## Captured scope

Newly published registration windows capture
`confirmation_notice_policy_version: regional_confirmation_notice_v1`.
Older windows are not upgraded or backfilled. The optional public-window key is
omitted from old serialized conditions, preserving their accepted consent hashes.
Previewing changed conditions for an already published window is rejected too.

The notice is a single opening reminder during the existing shared confirmation
week. It may be stored later in that week after a restart. It is not an additional
deadline reminder, a deadline extension or participation confirmation. The club
must still confirm with at least three eligible personal STAGE Plus players.

Only pending, registered applications with matching accepted conditions and
current region/platform/season/reset identity qualify. Confirmed, withdrawn,
invalidated, unavailable and closed applications do not. The service rechecks the
absolute closing boundary after contact/preference reads before storing a notice.

## Storage and recovery

`regionalConfirmationReminderService` starts after migrations through the existing
server startup chain and scans every minute. It asks the current public-window
service for eligible windows, then queries at most 80 candidates with a cursor.
One failed registration does not prevent later candidates from being processed.

`regionalRegistrationService.remindConfirmation` is internal, with no new HTTP
endpoint. It uses the existing edition lock order and a transaction. The current
president contact is resolved through the existing canonical resolver using that
transaction. Existing `club_updates` in-app preferences apply.

One deterministic notification ID per window/application and a registration JSON
receipt (`confirmation_notice`, version/status/checked_at/notification_id) prevent
duplicate processing after restarts or competing workers. The native notification
and receipt commit together; any write failure rolls both back. Muted preferences
store a muted receipt without storing a notification. Sporting state, consent,
deadlines and selections are unchanged. No new table or persisted entity is added.

The recovery follow-up below supersedes the original log-only retry behaviour.
No email, push, Inbox or socket delivery is added.

### Durable recovery follow-up — 4 November 2026

Each attempt now uses the existing `RegionalProgressModel`, with a distinct
`regional_confirmation_notice_progress` kind in the existing league-entities
store. This is an internal operational checkpoint, not a public CRUD entity or a
new table. Existing Cup/cycle IDs and behaviour remain unchanged.

A two-minute stored lease and unique attempt token coordinate workers. Expired
leases can be reclaimed after a restart; an older worker cannot overwrite its
successor. Reminder failures store a generic review message and a fifteen-minute
retry pause. Private exceptions, contact addresses and SQL are not persisted in
the checkpoint. A checkpoint write failure leaves the lease recoverable and does
not prevent other applications from being processed.

Candidates still require a current open confirmation window, pending application
and missing notice receipt, in addition to a due checkpoint. A saved native notice
and receipt remain the authoritative duplicate guard: a crash between their commit
and checkpoint completion cannot duplicate a notice. Such an already-receipted
application needs no further attempt, even if its last checkpoint remains running.
Closed/reset windows are not reopened to finish an operational checkpoint.

Admin → Regional Leagues → Regional action overview shows an aggregate review
item for failed notices still relevant to pending applications in an open marked
window. It disappears after a stored/muted receipt, confirmation or window closure.
This is notification recovery only; no sporting result, deadline or consent changes.
There is still no email/push outbox or guarantee that the user read the notice.

## Where to find it

- Admin regional registration preview explains the captured opening notice.
- Admin regional operations shows stored, muted and still-pending counts during
  confirmation. Those counts do not mean that users read the notices or confirmed.
- The participant registration panel explains the notice and the responsibility
  to check the published dates even when notifications are muted.
- Native notifications link to `/register-league` with club and region context.
  Stored English copy includes the absolute UTC deadline and directs the user to
  participation for local dates and current status.

## Verification and limits

301 selected sequential regression tests pass after the recovery follow-up,
including lease/restart/backoff/fencing and scoped Admin review, plus worker/service
handoff, rollback, restart idempotency, preference handling, immutable conditions,
closing-boundary races, bounded SQL selection and sanitized Admin summaries.
The selected run retains two previously documented unrelated baseline exclusions;
it is not a claim that every repository test passed. Selected HTTP regressions use
controlled persistence/auth, not production MySQL or real JWT roles.

Lint, typecheck, backend syntax, frontend build and diff checks pass. Graphify
update was attempted but the executable is unavailable. Real MySQL transaction
behaviour, browser/mobile flows and live delivery remain unverified. No deployment,
production repair or production notification was performed.

Complete lifecycle orchestration, other reminder events, automatic first-cycle
preparation/calendar publication and rollover remain separate delivery work.

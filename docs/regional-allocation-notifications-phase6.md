# Transactional group-assignment notifications

Local, 4 November 2026. Read this when changing allocation notifications,
recipient selection, notification preferences or allocation retry behaviour.

## Behaviour and locations

When a newly allocated cycle carries the supported automatic-allocation policy,
each club's responsible president receives a stored in-app `club_update`
notification titled **Regional group assigned**. This also applies to reviewed
manual allocation of such a cycle. Older unmarked cycles keep their former
behaviour; already allocated cycles are not backfilled.

The English body identifies the club, league, division, group and season (including
reset series when relevant). It explicitly says the group is a draft and match
dates follow calendar publication. The link includes the exact target edition ID
in both the league route and `season` parameter; it cannot silently switch to a
later edition. Group assignment remains visible on regional participation even
when notifications are muted.

- User: Notifications / notification centre → Regional group assigned → edition.
- Admin: Regional Leagues → saved Regional cycle → stored/muted notification counts.

These are database-backed in-app notifications. This step does not send email,
push, a separate Inbox message or an immediate socket broadcast. Usual app
notification loading displays them; no claim of verified browser/live delivery
is made here.

## Transaction, recipient and preferences

The existing `clubContactService.resolveClubPresidentContact` resolves the current
president using its established priority/fallback rules and the allocation query
transaction. No client recipient is accepted. In-app `club_updates` preferences
reuse `notificationPreferenceService`; disabled web/mobile delivery is counted as
muted without blocking the club's sporting allocation. Preferences are read once
per recipient within the transaction. Email/push settings do not trigger those
channels in this feature.

Notification inserts, draft groups, standings, registration assignments, cycle
completion and the allocation audit commit together. Deterministic IDs and
idempotency keys identify one cycle/club assignment. Existing allocated-state
replay returns before any delivery write, including after a worker restart.

An unavailable contact or a notification/settings storage error fails the
allocation transaction. Partial notifications roll back with sporting writes.
The existing worker records review/backoff rather than silently skipping a club
or committing a partial batch. Contact repair must respect the existing captured
source-revision checks; this feature never rewrites those snapshots to bypass
review. Stored/muted aggregate counts are captured on the cycle and its audit;
contact addresses/settings are not added to those counts.

No new table, migration, entity factory or HTTP route is introduced. The cycle
model owns the added notification SQL; existing notification reads are reused.

## Verification

- 281 selected sequential service/controller regressions pass. Existing unrelated
  functionsController exclusions remain as recorded in earlier handoffs.
- New cases cover forty exact-edition notifications, recipient normalization and
  president priority, muted in-app preferences, failure after three inserts with
  complete rollback, one-time retry, missing contacts, legacy compatibility and
  reviewed manual allocation.
- An earlier sporting-evidence test could change the winner depending on its
  random draw. It now changes a final deciding match's winning score while keeping
  that winner, matching its stated scenario. Product validation was not relaxed.
- Lint, typecheck, backend syntax, build and diff whitespace checks pass.
- Tests use controlled persistence/auth where applicable. Real MySQL locks,
  browser/JWT/live notification delivery and production remain unverified.
- No deployment or production messaging occurred. Graphify update was attempted;
  executable unavailable in this checkout.

Initial cycle activation, first calendars, confirmation reminders, remaining
exception rules and full-season/environment verification remain on the central
delivery checklist. This notification step does not imply overall completion.

# Transactional regional calendar notices

Local implementation, 4 November 2026. This follows the saved-cycle calendar
handoff and draw controls. It changes the existing calendar-publication in-app
notice, not the calendar policy or match-reminder schedule.

## Behaviour and locations

Publishing a new complete regional calendar now stores one native
`match_scheduled` notice per club whose existing `match_reminders` in-app
preferences permit it. The current president is resolved with the canonical
contact service using the publication transaction. Legacy owner contact is only
a fallback. Missing contact/settings reads fail rather than silently pretending
delivery succeeded.

Each notice names the club, region, season/reset series, first playing week and
calendar timezone. It links to the exact group edition's Stages tab:
`/leagues/<edition>?season=<edition>&tab=stages`. Calendar fixture entries must map
the club to exactly one selected edition. Two clubs sharing a president still
get distinct notices, with the correct club/group context; settings are read once
per recipient in the transaction.

Admin → Regional Leagues → Complete regional season calendar displays stored and
muted counts after publication and when the saved calendar is reopened through
the existing publication request. These counts indicate database storage and
preferences, not that anyone read the notice or received email/push.

## Transaction and compatibility

Notification IDs and idempotency keys derive from the stable calendar/club IDs.
Notices, fixture/engine/GameDay schedule writes, calendar record and audit writes
commit in the existing publication transaction. A contact, preference, notice or
final calendar-save failure rolls them all back. A retry uses the same notice IDs.
The existing published-calendar replay path returns before storing notifications,
so a lost response cannot create another notice.

New calendar JSON records capture region/season/reset scope and
`notification_summary` with `regional_calendar_notice_v1`, stored and muted counts.
No new table or entity/endpoint is added. The explicit-ID and saved-cycle forms
share this behaviour. Older published calendars are not amended, renotified or
backfilled. Existing notification history is preserved.

Preferences reuse the established match notification category for this notice
type; web/mobile in-app settings follow the existing resolver. Muting does not
block calendar publication. No email, push, Inbox, socket message, reward payout,
extra reminder event or new participation obligation is introduced.

## Verification

338 selected sequential server regressions pass, including real local HTTP
calendar publication using the actual native summary implementation with controlled
persistence/auth. Coverage includes distinct group links, shared-president
contacts, normalized current contact priority, preference muting, deterministic
IDs after rollback, all-or-nothing publication and unchanged legacy replay.
The two previously documented unrelated baseline cases remain excluded.

Lint, typecheck, backend syntax, build and diff checks pass. Real MySQL/JWT,
browser/mobile and live delivery remain unverified. Graphify update was attempted
but the executable is unavailable. No deployment, production repair or actual
production messaging was performed. Full competition delivery remains unfinished.
